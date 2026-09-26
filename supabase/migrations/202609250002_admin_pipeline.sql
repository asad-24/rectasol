begin;

create table public.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','super_admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.admin_memberships enable row level security;
revoke all on public.admin_memberships from public, anon, authenticated, service_role;
grant select on public.admin_memberships to authenticated;
create policy membership_self_read on public.admin_memberships for select to authenticated
  using (user_id = (select auth.uid()));

-- Definer is necessary to inspect trusted membership from RLS without recursion.
-- No caller-supplied user ID; callers may only ask about their own identity.
create function public.is_inquiry_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admin_memberships
    where user_id = (select auth.uid()) and active and role in ('admin','super_admin'));
$$;
revoke all on function public.is_inquiry_admin() from public, anon, authenticated, service_role;
grant execute on function public.is_inquiry_admin() to authenticated;

alter table public.inquiries add column revision bigint not null default 0 check (revision >= 0);
-- Column grants deliberately omit request_hash. No direct authenticated writes.
grant select (id,public_reference,name,email,company,service,budget,timeline,message,status,source,created_at,updated_at,revision)
  on public.inquiries to authenticated;
create policy admin_inquiry_read on public.inquiries for select to authenticated
  using ((select public.is_inquiry_admin()));
create index inquiries_created_id_idx on public.inquiries(created_at desc,id desc);

create table public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  entity_type text not null check (entity_type = 'inquiry'),
  entity_id uuid not null,
  event_type text not null check (event_type = 'status_changed'),
  previous_status text not null check (previous_status in ('new','contacted','qualified','proposal','won','lost')),
  new_status text not null check (new_status in ('new','contacted','qualified','proposal','won','lost')),
  created_at timestamptz not null default now(),
  check (previous_status <> new_status)
);
-- IDs intentionally survive user/inquiry deletion; no PII snapshots or cascade.
create index admin_audit_entity_idx on public.admin_audit_events(entity_type,entity_id,created_at desc);
alter table public.admin_audit_events enable row level security;
revoke all on public.admin_audit_events from public, anon, authenticated, service_role;
grant select on public.admin_audit_events to authenticated;
create policy admin_audit_read on public.admin_audit_events for select to authenticated
  using ((select public.is_inquiry_admin()));

-- Only this definer can update leads from the admin path. Identity is derived
-- from the verified JWT, never from an argument. Update + audit are one transaction.
create function public.admin_change_inquiry_status(p_id uuid, p_status text, p_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_previous text;
  v_revision bigint;
begin
  -- Lock membership against concurrent revocation during this transaction.
  perform 1 from public.admin_memberships where user_id = v_actor
    and active and role in ('admin','super_admin') for share;
  if not found then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_id is null or p_status is null or p_status not in ('new','contacted','qualified','proposal','won','lost')
    or p_revision is null or p_revision < 0 then
    raise exception 'Invalid status request' using errcode = '22023';
  end if;
  select status,revision into v_previous,v_revision from public.inquiries where id = p_id for update;
  if not found then return jsonb_build_object('outcome','not_found'); end if;
  if v_revision <> p_revision then return jsonb_build_object('outcome','conflict'); end if;
  if v_previous = p_status then return jsonb_build_object('outcome','unchanged'); end if;
  update public.inquiries set status = p_status, revision = revision + 1 where id = p_id;
  insert into public.admin_audit_events(actor_user_id,entity_type,entity_id,event_type,previous_status,new_status)
    values(v_actor,'inquiry',p_id,'status_changed',v_previous,p_status);
  return jsonb_build_object('outcome','updated');
end;
$$;
revoke all on function public.admin_change_inquiry_status(uuid,text,bigint) from public,anon,authenticated,service_role;
grant execute on function public.admin_change_inquiry_status(uuid,text,bigint) to authenticated;

-- Invoker reads retain column grants and RLS. Search is a literal substring,
-- never interpolated PostgREST syntax or dynamic SQL.
create function public.admin_list_inquiries(p_search text default '', p_status text default '', p_page integer default 1)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_total bigint; v_items jsonb;
begin
  if not public.is_inquiry_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_search is null or char_length(p_search) > 80 or p_status is null
    or p_status not in ('','new','contacted','qualified','proposal','won','lost')
    or p_page is null or p_page < 1 or p_page > 10000 then
    raise exception 'Invalid query' using errcode = '22023';
  end if;
  select count(id) into v_total from public.inquiries
    where (p_status = '' or status = p_status)
    and (p_search = '' or strpos(lower(concat_ws(' ',name,email,company,public_reference)),lower(p_search)) > 0);
  select coalesce(jsonb_agg(row_to_json(i)), '[]'::jsonb) into v_items from (
    select id,public_reference,name,email,company,service,budget,timeline,status,created_at
    from public.inquiries where (p_status = '' or status = p_status)
      and (p_search = '' or strpos(lower(concat_ws(' ',name,email,company,public_reference)),lower(p_search)) > 0)
    order by created_at desc,id desc limit 25 offset ((p_page - 1) * 25)
  ) i;
  return jsonb_build_object('total',v_total,'items',v_items);
end;
$$;
revoke all on function public.admin_list_inquiries(text,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.admin_list_inquiries(text,text,integer) to authenticated;

create function public.admin_inquiry_counts() returns table(status text,total bigint)
language sql stable security invoker set search_path = '' as $$
  select i.status,count(i.id) from public.inquiries i group by i.status;
$$;
revoke all on function public.admin_inquiry_counts() from public,anon,authenticated,service_role;
grant execute on function public.admin_inquiry_counts() to authenticated;
commit;
