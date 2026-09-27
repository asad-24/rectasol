begin;

-- Additive upgrade: stop/drain old workers before applying. Never rewrite 260001.
alter table public.email_outbox add column dispatch_started_at timestamptz;
alter table public.email_outbox drop constraint email_outbox_provider_check;
alter table public.email_outbox alter column provider set default 'brevo';
-- Only untouched jobs can move providers. Preserve historical acceptance identity.
update public.email_outbox set provider='brevo'
where status='pending' and attempts=0 and message is null;
update public.email_outbox set status='failed',last_error='delivery_uncertain',
  lease_token=null,lease_until=null,updated_at=clock_timestamp()
where provider <> 'brevo' and status in ('pending','processing');
alter table public.email_outbox add constraint email_outbox_provider_check
  check (provider='brevo' or (provider='resend' and status in ('sent','failed')));

create or replace function public.claim_email_delivery() returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s' set lock_timeout = '3s' as $$
declare job public.email_outbox; v_now timestamptz := clock_timestamp(); lead jsonb;
begin
  -- Brevo documents 30 minutes; stop at 20 minutes and quarantine interrupted sends.
  with expired as (
    select id from public.email_outbox
    where (status='pending' or (status='processing' and lease_until <= v_now))
      and (attempts >= 6 or first_attempt_at <= v_now - interval '20 minutes'
        or dispatch_started_at is not null)
    order by created_at,id for update skip locked limit 100
  )
  update public.email_outbox set status='failed',lease_token=null,lease_until=null,
    last_error=case when dispatch_started_at is not null or first_attempt_at <= v_now - interval '20 minutes'
      then 'delivery_uncertain' else 'retry_exhausted' end, updated_at=v_now
  where id in (select id from expired);

  select * into job from public.email_outbox
  where ((status='pending' and next_attempt_at <= v_now)
     or (status='processing' and lease_until <= v_now))
    and provider='brevo' and dispatch_started_at is null
    and attempts < 6 and (first_attempt_at is null or first_attempt_at > v_now - interval '20 minutes')
  order by next_attempt_at,created_at,id for update skip locked limit 1;
  if not found then return null; end if;
  update public.email_outbox set status='processing',attempts=attempts+1,
    lease_token=gen_random_uuid(),lease_until=v_now + interval '2 minutes',
    first_attempt_at=coalesce(first_attempt_at,v_now),updated_at=v_now
  where id=job.id returning * into job;
  select jsonb_build_object('id',id,'public_reference',public_reference,'name',name,
    'email',email,'company',company,'service',service,'budget',budget,
    'timeline',timeline,'message',message) into lead from public.inquiries where id=job.inquiry_id;
  return jsonb_build_object('provider',job.provider,'id',job.id,'kind',job.kind,'lease_token',job.lease_token,
    'attempts',job.attempts,'first_attempt_at',job.first_attempt_at,
    'message',job.message,'inquiry',lead);
end;
$$;

create or replace function public.prepare_email_delivery(p_id uuid,p_lease uuid,p_message jsonb) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s' set lock_timeout = '3s' as $$
declare job public.email_outbox;
begin
  select * into job from public.email_outbox where id=p_id for update;
  if not found or job.provider <> 'brevo' or job.dispatch_started_at is not null
    or job.status <> 'processing' or job.lease_token is distinct from p_lease
    or job.lease_until <= clock_timestamp() or job.first_attempt_at <= clock_timestamp() - interval '20 minutes' then
    return null;
  end if;
  if job.message is null then
    if p_message is null or jsonb_typeof(p_message) <> 'object'
      or octet_length(p_message::text) > 65536
      or (p_message - array['from','to','subject','html','text']) <> '{}'::jsonb
      or not (p_message ?& array['from','to','subject','html','text']) then
      raise exception 'Invalid email message' using errcode='22023';
    end if;
    update public.email_outbox set message=p_message,updated_at=clock_timestamp() where id=p_id;
    job.message := p_message;
  end if;
  -- Atomic dispatch reservation. A second prepare cannot authorize another send.
  update public.email_outbox set dispatch_started_at=clock_timestamp() where id=p_id;
  return job.message;
end;
$$;

create or replace function public.finish_email_delivery(p_id uuid,p_lease uuid,p_message_id text,
  p_error text,p_retryable boolean,p_retry_after integer default 0) returns boolean
language plpgsql security definer set search_path = '' set statement_timeout = '5s' set lock_timeout = '3s' as $$
declare job public.email_outbox; v_now timestamptz := clock_timestamp(); v_delay integer;
begin
  select * into job from public.email_outbox where id=p_id for update;
  if not found or job.status <> 'processing' or job.lease_token is distinct from p_lease
    or job.lease_until <= v_now then return false; end if;
  if p_message_id is not null then
    if p_error is not null or job.message is null or char_length(p_message_id) not between 1 and 128 then
      raise exception 'Invalid completion' using errcode='22023';
    end if;
    update public.email_outbox set status='sent',sent_at=v_now,provider_message_id=p_message_id,
      last_error=null,lease_token=null,lease_until=null,updated_at=v_now where id=p_id;
  else
    if p_error is null or p_error not in ('network','timeout','rate_limited','provider_unavailable','provider_rejected','invalid_message','delivery_uncertain')
      or p_retryable is null then raise exception 'Invalid failure' using errcode='22023'; end if;
    v_delay := greatest(60 * (2 ^ (job.attempts-1))::integer,least(3600,greatest(0,coalesce(p_retry_after,0))));
    update public.email_outbox set
      status=case when p_retryable and p_error in ('rate_limited','provider_unavailable') and attempts < 6 and first_attempt_at + interval '20 minutes' > v_now + make_interval(secs=>v_delay)
        then 'pending' else 'failed' end,
      dispatch_started_at=case when p_retryable and p_error in ('rate_limited','provider_unavailable')
        then null else dispatch_started_at end,
      next_attempt_at=v_now + make_interval(secs=>v_delay),last_error=p_error,
      lease_token=null,lease_until=null,updated_at=v_now where id=p_id;
  end if;
  return true;
end;
$$;

-- CREATE OR REPLACE preserves the existing restricted function grants.
commit;
