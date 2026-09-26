-- NON-PRODUCTION ONLY. Apply both migrations first. All fixture changes roll back.
-- No passwords, tokens, or real user identities are used.
begin;
create temporary table phase3_fixture (kind text primary key,id uuid) on commit drop;
insert into phase3_fixture values ('admin',gen_random_uuid()),('member',gen_random_uuid()),('inquiry',gen_random_uuid());
grant select on phase3_fixture to authenticated;
insert into auth.users(id) select id from phase3_fixture where kind in ('admin','member');
insert into public.admin_memberships(user_id,role)
  select id,'admin' from phase3_fixture where kind = 'admin';
insert into public.inquiries(id,name,email,service,message,request_hash)
  select id,'Synthetic inquiry','synthetic@example.invalid','web-applications',
    'Non-production rollback-only test inquiry.',repeat('a',64)
  from phase3_fixture where kind = 'inquiry';

do $$
declare t text;
begin
  foreach t in array array['inquiries','inquiry_submissions','inquiry_rate_buckets','admin_memberships','admin_audit_events'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then raise exception 'RLS disabled: %',t; end if;
    if has_table_privilege('anon','public.' || t,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Anon permission: %',t; end if;
  end loop;
  if has_column_privilege('authenticated','public.inquiries','request_hash','SELECT') then raise exception 'Security field exposed'; end if;
  if has_table_privilege('authenticated','public.inquiries','UPDATE,INSERT,DELETE') then raise exception 'Direct writes allowed'; end if;
  if has_table_privilege('authenticated','public.admin_audit_events','UPDATE,INSERT,DELETE') then raise exception 'Audit writable'; end if;
  if has_table_privilege('authenticated','public.admin_memberships','UPDATE,INSERT,DELETE') then raise exception 'Membership writable'; end if;
  if has_function_privilege('anon','public.admin_change_inquiry_status(uuid,text,bigint)','EXECUTE') then raise exception 'Anon RPC allowed'; end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',(select id from phase3_fixture where kind='member'),'role','authenticated')::text,true) is not null as claims_configured;
do $$
begin
  if public.is_inquiry_admin() then raise exception 'Non-admin escalated'; end if;
  if exists(select id from public.inquiries) then raise exception 'Non-admin read inquiries'; end if;
  if exists(select id from public.admin_audit_events) then raise exception 'Non-admin read audit'; end if;
  begin
    perform public.admin_change_inquiry_status((select id from phase3_fixture where kind='inquiry'),'won',0);
    raise exception 'Non-admin mutated inquiry';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.admin_memberships(user_id,role) select id,'admin' from phase3_fixture where kind='member';
    raise exception 'Self-assignment allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select set_config('request.jwt.claims',json_build_object('sub',(select id from phase3_fixture where kind='admin'),'role','authenticated')::text,true) is not null as claims_configured;
do $$
declare v_id uuid := (select id from phase3_fixture where kind='inquiry'); result jsonb;
begin
  if not public.is_inquiry_admin() then raise exception 'Admin denied'; end if;
  if not exists(select id from public.inquiries where id = v_id) then raise exception 'Admin cannot read'; end if;
  perform public.admin_list_inquiries('', 'new', 1);
  perform public.admin_inquiry_counts();
  result := public.admin_change_inquiry_status(v_id,'contacted',0);
  if result->>'outcome' <> 'updated' then raise exception 'Update failed'; end if;
  if not exists(select id from public.admin_audit_events where entity_id = v_id and previous_status='new' and new_status='contacted' and actor_user_id=auth.uid()) then raise exception 'Missing/wrong audit'; end if;
  if not exists(select id from public.inquiries where id=v_id and status='contacted' and revision=1) then raise exception 'Incorrect inquiry state'; end if;
  result := public.admin_change_inquiry_status(v_id,'won',0);
  if result->>'outcome' <> 'conflict' then raise exception 'Stale mutation accepted'; end if;
  result := public.admin_change_inquiry_status(v_id,'contacted',1);
  if result->>'outcome' <> 'unchanged' then raise exception 'No-op failed'; end if;
  if (select count(id) from public.admin_audit_events where entity_id=v_id) <> 1 then raise exception 'Duplicate audit'; end if;
  begin
    perform public.admin_change_inquiry_status(v_id,'invalid',1);
    raise exception 'Invalid status accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    update public.inquiries set name='Tampered' where id=v_id;
    raise exception 'Arbitrary edit allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.admin_audit_events where entity_id=v_id;
    raise exception 'Audit deletion allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
update public.admin_memberships set active=false where user_id=(select id from phase3_fixture where kind='admin');
set local role authenticated;
do $$
begin
  if public.is_inquiry_admin() then raise exception 'Revoked membership still authorized'; end if;
  begin
    perform public.admin_change_inquiry_status((select id from phase3_fixture where kind='inquiry'),'won',1);
    raise exception 'Revoked membership can mutate';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
