begin;

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  public_reference text not null unique default ('INQ-' || gen_random_uuid()::text),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  email text not null check (char_length(email) between 3 and 120 and email = lower(btrim(email))),
  company text check (char_length(company) <= 120),
  service text not null check (char_length(service) between 1 and 100),
  budget text check (char_length(budget) <= 160),
  timeline text check (char_length(timeline) <= 160),
  message text not null check (char_length(btrim(message)) between 20 and 2000),
  status text not null default 'new' check (status in ('new','contacted','qualified','proposal','won','lost')),
  source text not null default 'website' check (char_length(source) between 1 and 80),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inquiries_status_created_idx on public.inquiries(status, created_at desc);
create index inquiries_email_idx on public.inquiries(email);
create index inquiries_replay_idx on public.inquiries(request_hash, created_at desc);

create table public.inquiry_submissions (
  submission_key uuid primary key,
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index inquiry_submissions_expiry_idx on public.inquiry_submissions(expires_at);
create table public.inquiry_rate_buckets (
  bucket_key text primary key,
  window_start timestamptz not null,
  attempts integer not null check (attempts >= 1)
);
create index inquiry_rate_expiry_idx on public.inquiry_rate_buckets(window_start);

alter table public.inquiries enable row level security;
alter table public.inquiry_submissions enable row level security;
alter table public.inquiry_rate_buckets enable row level security;
revoke all on public.inquiries, public.inquiry_submissions, public.inquiry_rate_buckets from public, anon, authenticated, service_role;
grant select, insert on public.inquiries to service_role;
grant select, insert, update, delete on public.inquiry_submissions, public.inquiry_rate_buckets to service_role;

create function public.touch_inquiry_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.touch_inquiry_updated_at() from public, anon, authenticated;
create trigger inquiries_updated_at before update on public.inquiries
for each row execute function public.touch_inquiry_updated_at();

-- Only the server's secret key can execute this atomic operation.
-- The global lock intentionally suits a low-volume inquiry endpoint, not bulk ingestion.
create function public.submit_inquiry(
  p_payload jsonb, p_submission_key uuid, p_request_hash text,
  p_email_hash text, p_ip_hash text default null
) returns jsonb language plpgsql security invoker
set search_path = ''
set statement_timeout = '5s'
set lock_timeout = '3s'
as $$
declare
  v_now timestamptz;
  v_window timestamptz;
  v_keys text[] := array['global', 'email:' || p_email_hash];
  v_limits integer[] := array[100, 5];
  v_count integer;
  v_i integer;
  v_id uuid;
  v_reference text;
  v_hash text;
begin
  if p_submission_key is null or p_request_hash is null or p_email_hash is null
     or p_request_hash !~ '^[0-9a-f]{64}$' or p_email_hash !~ '^[0-9a-f]{64}$'
     or (p_ip_hash is not null and p_ip_hash !~ '^[0-9a-f]{64}$')
     or p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or (p_payload - array['name','email','company','service','budget','timeline','message']) <> '{}'::jsonb then
    raise exception 'Invalid inquiry arguments';
  end if;
  perform pg_advisory_xact_lock(726328519);
  v_now := clock_timestamp();
  v_window := to_timestamp(floor(extract(epoch from v_now) / 900) * 900);
  delete from public.inquiry_submissions where expires_at <= v_now;
  delete from public.inquiry_rate_buckets where window_start < v_window;
  if p_ip_hash is not null then
    v_keys := array_append(v_keys, 'ip:' || p_ip_hash);
    v_limits := array_append(v_limits, 10);
  end if;
  -- Global budget is checked first to bound helper-table growth.
  for v_i in 1..array_length(v_keys, 1) loop
    insert into public.inquiry_rate_buckets as b(bucket_key, window_start, attempts)
    values (v_keys[v_i], v_window, 1)
    on conflict (bucket_key) do update set
      attempts = case when b.window_start = v_window then least(b.attempts + 1, v_limits[v_i] + 1) else 1 end,
      window_start = v_window
    returning attempts into v_count;
    if v_count > v_limits[v_i] then
      return jsonb_build_object('outcome','rate_limited','retry_after',
        greatest(1, least(900, ceil(extract(epoch from (v_window + interval '15 minutes' - v_now)))::integer)));
    end if;
  end loop;
  select s.inquiry_id, s.request_hash into v_id, v_hash
    from public.inquiry_submissions s where submission_key = p_submission_key;
  if found then
    if v_hash <> p_request_hash then return jsonb_build_object('outcome','conflict'); end if;
    select public_reference into v_reference from public.inquiries where id = v_id;
    return jsonb_build_object('outcome','replayed','reference',v_reference);
  end if;
  select id, public_reference into v_id, v_reference from public.inquiries
    where request_hash = p_request_hash and created_at > v_now - interval '10 minutes'
    order by created_at desc limit 1;
  if found then
    insert into public.inquiry_submissions(submission_key,inquiry_id,request_hash)
      values(p_submission_key,v_id,p_request_hash);
    return jsonb_build_object('outcome','replayed','reference',v_reference);
  end if;
  insert into public.inquiries(name,email,company,service,budget,timeline,message,status,source,request_hash)
  values(p_payload->>'name',p_payload->>'email',p_payload->>'company',p_payload->>'service',
    p_payload->>'budget',p_payload->>'timeline',p_payload->>'message','new','website',p_request_hash)
  returning id, public_reference into v_id, v_reference;
  insert into public.inquiry_submissions(submission_key,inquiry_id,request_hash)
    values(p_submission_key,v_id,p_request_hash);
  return jsonb_build_object('outcome','created','reference',v_reference);
end;
$$;
revoke all on function public.submit_inquiry(jsonb,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_inquiry(jsonb,uuid,text,text,text) to service_role;
commit;
