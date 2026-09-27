begin;

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  kind text not null check (kind in ('inquiry_client_v1','inquiry_admin_v1')),
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0 check (attempts between 0 and 6),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  first_attempt_at timestamptz,
  provider text not null default 'resend' check (provider = 'resend'),
  provider_message_id text check (char_length(provider_message_id) between 1 and 128),
  -- Frozen immediately before the first send: retries must use identical content
  -- and recipients, even after configuration/template changes. Never includes keys.
  message jsonb check (message is null or (jsonb_typeof(message) = 'object' and octet_length(message::text) <= 65536)),
  last_error text check (last_error in ('network','timeout','rate_limited','provider_unavailable','provider_rejected','invalid_message','retry_exhausted','delivery_uncertain')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(inquiry_id,kind),
  check ((status = 'processing') = (lease_token is not null and lease_until is not null)),
  check ((status = 'sent') = (sent_at is not null and provider_message_id is not null))
);
create index email_outbox_due_idx on public.email_outbox(next_attempt_at,created_at) where status = 'pending';
create index email_outbox_lease_idx on public.email_outbox(lease_until) where status = 'processing';
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from public,anon,authenticated,service_role;
-- Admin reads retain session authorization/RLS and cannot read frozen message PII.
grant select (id,inquiry_id,kind,status,attempts,created_at,updated_at,sent_at) on public.email_outbox to authenticated;
create policy admin_email_read on public.email_outbox for select to authenticated
  using ((select public.is_inquiry_admin()));

-- AFTER INSERT runs inside submit_inquiry's existing transaction. Replays and
-- deduplication do not insert an inquiry, so they cannot enqueue more deliveries.
-- No historical backfill, no provider/config/network access in the transaction.
create function public.enqueue_inquiry_emails() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.source = 'website' then
    insert into public.email_outbox(inquiry_id,kind) values
      (new.id,'inquiry_client_v1'),(new.id,'inquiry_admin_v1');
  end if;
  return new;
end;
$$;
revoke all on function public.enqueue_inquiry_emails() from public,anon,authenticated,service_role;
create trigger inquiry_email_outbox after insert on public.inquiries
for each row execute function public.enqueue_inquiry_emails();

-- Only server service_role can execute worker functions. No direct table grants.
-- SKIP LOCKED permits overlapping schedulers without sharing a live lease.
create function public.claim_email_delivery() returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s' set lock_timeout = '3s' as $$
declare job public.email_outbox; v_now timestamptz := clock_timestamp(); lead jsonb;
begin
  -- Stop ambiguous retries before Resend's 24h idempotency retention expires.
  -- Never automatically resend an uncertain delivery beyond this window.
  with expired as (
    select id from public.email_outbox
    where (status='pending' or (status='processing' and lease_until <= v_now))
      and (attempts >= 6 or first_attempt_at <= v_now - interval '23 hours')
    order by created_at,id for update skip locked limit 100
  )
  update public.email_outbox set status='failed',lease_token=null,lease_until=null,
    last_error=case when first_attempt_at <= v_now - interval '23 hours'
      then 'delivery_uncertain' else 'retry_exhausted' end, updated_at=v_now
  where id in (select id from expired);

  select * into job from public.email_outbox
  where ((status='pending' and next_attempt_at <= v_now)
     or (status='processing' and lease_until <= v_now))
    and attempts < 6 and (first_attempt_at is null or first_attempt_at > v_now - interval '23 hours')
  order by next_attempt_at,created_at,id for update skip locked limit 1;
  if not found then return null; end if;
  update public.email_outbox set status='processing',attempts=attempts+1,
    lease_token=gen_random_uuid(),lease_until=v_now + interval '2 minutes',
    first_attempt_at=coalesce(first_attempt_at,v_now),updated_at=v_now
  where id=job.id returning * into job;
  select jsonb_build_object('id',id,'public_reference',public_reference,'name',name,
    'email',email,'company',company,'service',service,'budget',budget,
    'timeline',timeline,'message',message) into lead from public.inquiries where id=job.inquiry_id;
  return jsonb_build_object('id',job.id,'kind',job.kind,'lease_token',job.lease_token,
    'attempts',job.attempts,'first_attempt_at',job.first_attempt_at,
    'message',job.message,'inquiry',lead);
end;
$$;

create function public.prepare_email_delivery(p_id uuid,p_lease uuid,p_message jsonb) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s' set lock_timeout = '3s' as $$
declare job public.email_outbox;
begin
  select * into job from public.email_outbox where id=p_id for update;
  if not found or job.status <> 'processing' or job.lease_token is distinct from p_lease
    or job.lease_until <= clock_timestamp() or job.first_attempt_at <= clock_timestamp() - interval '23 hours' then
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
    return p_message;
  end if;
  return job.message;
end;
$$;

create function public.finish_email_delivery(p_id uuid,p_lease uuid,p_message_id text,
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
    if p_error is null or p_error not in ('network','timeout','rate_limited','provider_unavailable','provider_rejected','invalid_message')
      or p_retryable is null then raise exception 'Invalid failure' using errcode='22023'; end if;
    v_delay := greatest(60 * (2 ^ (job.attempts-1))::integer,least(3600,greatest(0,coalesce(p_retry_after,0))));
    update public.email_outbox set
      status=case when p_retryable and attempts < 6 and first_attempt_at + interval '23 hours' > v_now + make_interval(secs=>v_delay)
        then 'pending' else 'failed' end,
      next_attempt_at=v_now + make_interval(secs=>v_delay),last_error=p_error,
      lease_token=null,lease_until=null,updated_at=v_now where id=p_id;
  end if;
  return true;
end;
$$;

revoke all on function public.claim_email_delivery() from public,anon,authenticated,service_role;
revoke all on function public.prepare_email_delivery(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.finish_email_delivery(uuid,uuid,text,text,boolean,integer) from public,anon,authenticated,service_role;
grant execute on function public.claim_email_delivery() to service_role;
grant execute on function public.prepare_email_delivery(uuid,uuid,jsonb) to service_role;
grant execute on function public.finish_email_delivery(uuid,uuid,text,text,boolean,integer) to service_role;
commit;
