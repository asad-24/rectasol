-- NON-PRODUCTION ONLY. Apply Phases 2, 3 and both Phase 4 migrations first. Stop the test scheduler.
-- Runs as project owner in SQL editor. All mutations roll back. NO emails sent.
-- Temporarily clears outbox/rate state to isolate claims; inspect Auth triggers
-- before running, as this creates two synthetic users without credentials.
begin;
delete from public.email_outbox;
delete from public.inquiry_rate_buckets;
create temporary table phase4_state (name text primary key,value jsonb) on commit drop;
grant select,insert,update on phase4_state to service_role,authenticated;
insert into phase4_state values ('admin',to_jsonb(gen_random_uuid())),('member',to_jsonb(gen_random_uuid()));
insert into auth.users(id) select (value #>> '{}')::uuid from phase4_state where name in ('admin','member');
insert into public.admin_memberships(user_id,role) select (value #>> '{}')::uuid,'admin' from phase4_state where name='admin';

do $$
declare role_name text; signature text;
begin
  if not (select relrowsecurity from pg_class where oid='public.email_outbox'::regclass) then raise exception 'RLS disabled'; end if;
  foreach role_name in array array['anon','authenticated','service_role'] loop
    if has_table_privilege(role_name,'public.email_outbox','INSERT,UPDATE,DELETE') then raise exception 'Direct writes allowed'; end if;
    if has_column_privilege(role_name,'public.email_outbox','message','SELECT') then raise exception 'Message body exposed'; end if;
    if has_column_privilege(role_name,'public.email_outbox','dispatch_started_at','SELECT') then raise exception 'Dispatch marker exposed'; end if;
  end loop;
  if has_column_privilege('anon','public.email_outbox','status','SELECT') then raise exception 'Anonymous read allowed'; end if;
  foreach signature in array array['public.claim_email_delivery()', 'public.prepare_email_delivery(uuid,uuid,jsonb)',
    'public.finish_email_delivery(uuid,uuid,text,text,boolean,integer)'] loop
    foreach role_name in array array['anon','authenticated'] loop
      if has_function_privilege(role_name,signature,'EXECUTE') then raise exception 'Public worker execution allowed'; end if;
    end loop;
    if not has_function_privilege('service_role',signature,'EXECUTE') then raise exception 'Worker execution denied'; end if;
  end loop;
end;
$$;

set local role service_role;
do $$
declare
  payload jsonb := jsonb_build_object('name','Synthetic Email Test','email','synthetic@example.invalid',
    'company',null,'service','web-applications','budget',null,'timeline',null,
    'message','Synthetic rollback-only email verification.');
  submission uuid := gen_random_uuid();
  fingerprint text := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  email_hash text := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  result jsonb; receipt text;
begin
  result := public.submit_inquiry(payload,submission,fingerprint,email_hash,null);
  if result->>'outcome' <> 'created' then raise exception 'New inquiry failed'; end if;
  receipt := result->>'reference';
  insert into phase4_state select 'inquiry',to_jsonb(id) from public.inquiries where public_reference=receipt;
  result := public.submit_inquiry(payload,submission,fingerprint,email_hash,null);
  if result->>'outcome' <> 'replayed' or result->>'reference' <> receipt then raise exception 'Replay changed'; end if;
  result := public.submit_inquiry(payload,gen_random_uuid(),fingerprint,email_hash,null);
  if result->>'outcome' <> 'replayed' or result->>'reference' <> receipt then raise exception 'Dedupe changed'; end if;
  result := public.submit_inquiry(payload,submission,repeat('b',64),email_hash,null);
  if result->>'outcome' <> 'conflict' then raise exception 'Conflict changed'; end if;
end;
$$;
reset role;

do $$
declare lead_id uuid := (select (value #>> '{}')::uuid from phase4_state where name='inquiry');
begin
  if (select count(*) from public.email_outbox where inquiry_id=lead_id) <> 2 then raise exception 'New/replay/dedupe delivery count wrong'; end if;
  if (select count(distinct kind) from public.email_outbox where inquiry_id=lead_id) <> 2 then raise exception 'Missing delivery kind'; end if;
  if exists(select 1 from public.email_outbox where status <> 'pending' or attempts <> 0 or message is not null) then raise exception 'Unexpected initial state'; end if;
  begin
    insert into public.email_outbox(inquiry_id,kind) values(lead_id,'inquiry_client_v1');
    raise exception 'Duplicate logical delivery allowed';
  exception when unique_violation then null;
  end;
end;
$$;

set local role anon;
do $$ begin
  begin perform status from public.email_outbox; raise exception 'Anon read allowed'; exception when insufficient_privilege then null; end;
  begin perform public.claim_email_delivery(); raise exception 'Anon worker allowed'; exception when insufficient_privilege then null; end;
end; $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',(select value #>> '{}' from phase4_state where name='member'),'role','authenticated')::text,true) is not null as claims_configured;
do $$ begin
  if exists(select id from public.email_outbox) then raise exception 'Non-admin can read'; end if;
  begin perform public.claim_email_delivery(); raise exception 'Member worker allowed'; exception when insufficient_privilege then null; end;
  begin update public.email_outbox set status='failed'; raise exception 'Browser write allowed'; exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claims',json_build_object('sub',(select value #>> '{}' from phase4_state where name='admin'),'role','authenticated')::text,true) is not null as claims_configured;
do $$ begin
  if (select count(id) from public.email_outbox) <> 2 then raise exception 'Admin status denied'; end if;
  perform kind,status,attempts,sent_at from public.email_outbox;
  begin perform message from public.email_outbox; raise exception 'Admin sees frozen message'; exception when insufficient_privilege then null; end;
  begin perform public.claim_email_delivery(); raise exception 'Admin worker allowed'; exception when insufficient_privilege then null; end;
end; $$;
reset role;

-- Isolate the client job. Claims do not share an active lease even if called twice.
update public.email_outbox set next_attempt_at=now()+interval '1 day' where kind='inquiry_admin_v1';
set local role service_role;
insert into phase4_state values ('job',public.claim_email_delivery());
do $$
declare job jsonb := (select value from phase4_state where name='job'); result jsonb;
  payload jsonb := '{"from":{"email":"sender@example.invalid","name":"Rectasol"},"to":["client@example.invalid"],"subject":"Synthetic test","html":"<p>Test</p>","text":"Test"}'::jsonb;
begin
  if job is null or job->>'kind' <> 'inquiry_client_v1' or (job->>'attempts')::int <> 1 then raise exception 'Claim failed'; end if;
  if public.claim_email_delivery() is not null then raise exception 'Active lease reclaimed'; end if;
  if public.prepare_email_delivery((job->>'id')::uuid,gen_random_uuid(),payload) is not null then raise exception 'Wrong lease accepted'; end if;
  result := public.prepare_email_delivery((job->>'id')::uuid,(job->>'lease_token')::uuid,payload);
  if result is distinct from payload then raise exception 'Message not prepared'; end if;
  result := public.prepare_email_delivery((job->>'id')::uuid,(job->>'lease_token')::uuid,payload || '{"subject":"Changed"}'::jsonb);
  if result is not null then raise exception 'Repeated dispatch authorized'; end if;
  if not public.finish_email_delivery((job->>'id')::uuid,(job->>'lease_token')::uuid,null,'rate_limited',true,0) then raise exception 'Retry failed'; end if;
end;
$$;
reset role;

-- Explicit rejection permits retry with the same identity and frozen payload.
update public.email_outbox set next_attempt_at=clock_timestamp()-interval '1 second' where kind='inquiry_client_v1';
insert into phase4_state values ('reclaimed',public.claim_email_delivery());
do $$
declare old_job jsonb := (select value from phase4_state where name='job');
  job jsonb := (select value from phase4_state where name='reclaimed');
begin
  if job->>'id' is distinct from old_job->>'id' or job->>'lease_token' = old_job->>'lease_token'
    or (job->>'attempts')::int <> 2 or job->'message' is null then raise exception 'Crash recovery lost identity/payload'; end if;
  if public.prepare_email_delivery((job->>'id')::uuid,(job->>'lease_token')::uuid,job->'message' || '{"subject":"Changed"}'::jsonb) is distinct from job->'message' then raise exception 'Frozen content changed'; end if;
  if public.finish_email_delivery((old_job->>'id')::uuid,(old_job->>'lease_token')::uuid,'synthetic-old',null,false) then raise exception 'Stale worker completed'; end if;
  if not public.finish_email_delivery((job->>'id')::uuid,(job->>'lease_token')::uuid,'synthetic-provider-id',null,false) then raise exception 'Sent completion failed'; end if;
  if not exists(select 1 from public.email_outbox where id=(job->>'id')::uuid and status='sent'
    and provider_message_id='synthetic-provider-id' and sent_at is not null and lease_token is null) then raise exception 'Sent state wrong'; end if;
  if public.claim_email_delivery() is not null then raise exception 'Sent job reclaimed'; end if;
end;
$$;

-- Exercise the other job's retry schedule and max attempts without sleeping.
do $$
declare job jsonb; attempt integer; delay_seconds numeric; lead_id uuid;
begin
  for attempt in 1..6 loop
    update public.email_outbox set next_attempt_at=clock_timestamp()-interval '1 second' where kind='inquiry_admin_v1';
    job := public.claim_email_delivery();
    if (job->>'attempts')::int is distinct from attempt then raise exception 'Attempt count wrong'; end if;
    perform public.prepare_email_delivery((job->>'id')::uuid,(job->>'lease_token')::uuid,
      '{"from":{"email":"sender@example.invalid","name":"Rectasol"},"to":["team@example.invalid"],"subject":"Test","html":"<p>Test</p>","text":"Test"}'::jsonb);
    if not public.finish_email_delivery((job->>'id')::uuid,(job->>'lease_token')::uuid,null,'provider_unavailable',true,0) then raise exception 'Retry completion failed'; end if;
    select extract(epoch from next_attempt_at-updated_at) into delay_seconds from public.email_outbox where id=(job->>'id')::uuid;
    if delay_seconds <> 60 * (2 ^ (attempt-1)) then raise exception 'Backoff wrong'; end if;
  end loop;
  if not exists(select 1 from public.email_outbox where kind='inquiry_admin_v1' and status='failed' and attempts=6) then raise exception 'Max attempts not enforced'; end if;
  if public.claim_email_delivery() is not null then raise exception 'Terminal failure reclaimed'; end if;
  lead_id := (select (value #>> '{}')::uuid from phase4_state where name='inquiry');
  if not exists(select 1 from public.inquiries where id=lead_id and status='new') then raise exception 'Email failure lost/changed inquiry'; end if;
end;
$$;

-- Owner-only fixture resets for permanent rejection, Retry-After and expiry cases.
update public.email_outbox set status='pending',attempts=0,dispatch_started_at=null,first_attempt_at=null,next_attempt_at=now() where kind='inquiry_admin_v1';
do $$
declare job jsonb := public.claim_email_delivery();
begin
  perform public.finish_email_delivery((job->>'id')::uuid,(job->>'lease_token')::uuid,null,'rate_limited',true,600);
  if not exists(select 1 from public.email_outbox where id=(job->>'id')::uuid and status='pending'
    and next_attempt_at=updated_at+interval '10 minutes') then raise exception 'Retry-After ignored'; end if;
  if public.claim_email_delivery() is not null then raise exception 'Retried before due time'; end if;
end; $$;
update public.email_outbox set next_attempt_at=now() where kind='inquiry_admin_v1';
do $$
declare job jsonb := public.claim_email_delivery();
begin
  perform public.finish_email_delivery((job->>'id')::uuid,(job->>'lease_token')::uuid,null,'provider_rejected',false);
  if not exists(select 1 from public.email_outbox where id=(job->>'id')::uuid and status='failed') then raise exception 'Permanent rejection retried'; end if;
end; $$;
update public.email_outbox set status='pending',attempts=1,first_attempt_at=now()-interval '21 minutes',next_attempt_at=now() where kind='inquiry_admin_v1';
do $$ begin
  if public.claim_email_delivery() is not null then raise exception 'Expired idempotency window retried'; end if;
  if not exists(select 1 from public.email_outbox where kind='inquiry_admin_v1' and status='failed' and last_error='delivery_uncertain') then raise exception 'Uncertain delivery not quarantined'; end if;
end; $$;

-- Ambiguous failures cannot be made retryable by a caller. Crash after prepare
-- quarantines even if the process never reached the provider (delivery may be lost).
do $$
declare job jsonb; reclaimed jsonb; category text;
begin
  update public.email_outbox set status='pending',attempts=0,first_attempt_at=null,
    dispatch_started_at=null,next_attempt_at=now() where kind='inquiry_admin_v1';
  job := public.claim_email_delivery();
  perform public.finish_email_delivery((job->>'id')::uuid,(job->>'lease_token')::uuid,null,'rate_limited',true,3600);
  if not exists(select 1 from public.email_outbox where id=(job->>'id')::uuid and status='failed') then raise exception 'Retry scheduled past safety deadline'; end if;
  foreach category in array array['network','timeout','delivery_uncertain'] loop
    update public.email_outbox set status='pending',attempts=0,first_attempt_at=null,
      dispatch_started_at=null,next_attempt_at=now() where kind='inquiry_admin_v1';
    job := public.claim_email_delivery();
    perform public.prepare_email_delivery((job->>'id')::uuid,(job->>'lease_token')::uuid,
      '{"from":{"email":"sender@example.invalid","name":"Rectasol"},"to":["team@example.invalid"],"subject":"Test","html":"<p>Test</p>","text":"Test"}'::jsonb);
    perform public.finish_email_delivery((job->>'id')::uuid,(job->>'lease_token')::uuid,null,category,true);
    if not exists(select 1 from public.email_outbox where id=(job->>'id')::uuid and status='failed') then raise exception 'Ambiguity retried'; end if;
  end loop;
  update public.email_outbox set status='pending',attempts=0,first_attempt_at=null,
    dispatch_started_at=null,next_attempt_at=now() where kind='inquiry_admin_v1';
  job := public.claim_email_delivery();
  -- Before preparation no external request was authorized, so lease recovery is safe.
  update public.email_outbox set lease_until=clock_timestamp()-interval '1 second' where id=(job->>'id')::uuid;
  reclaimed := public.claim_email_delivery();
  if reclaimed->>'id' is distinct from job->>'id' or reclaimed->>'lease_token'=job->>'lease_token' then raise exception 'Pre-dispatch recovery failed'; end if;
  if public.prepare_email_delivery((job->>'id')::uuid,(job->>'lease_token')::uuid,'{}') is not null then raise exception 'Stale prepare accepted'; end if;
  perform public.prepare_email_delivery((reclaimed->>'id')::uuid,(reclaimed->>'lease_token')::uuid,reclaimed->'message');
  update public.email_outbox set lease_until=clock_timestamp()-interval '1 second' where id=(job->>'id')::uuid;
  if public.claim_email_delivery() is not null then raise exception 'Interrupted dispatch retried'; end if;
  if not exists(select 1 from public.email_outbox where id=(job->>'id')::uuid and status='failed' and last_error='delivery_uncertain') then raise exception 'Interrupted dispatch not quarantined'; end if;
  if public.finish_email_delivery((reclaimed->>'id')::uuid,(reclaimed->>'lease_token')::uuid,'late',null,false) then raise exception 'Late completion accepted'; end if;
end; $$;

-- Revocation immediately removes status visibility.
update public.admin_memberships set active=false where user_id=(select (value #>> '{}')::uuid from phase4_state where name='admin');
set local role authenticated;
do $$ begin
  if exists(select id from public.email_outbox) then raise exception 'Revoked admin can read'; end if;
end; $$;
reset role;
rollback;
