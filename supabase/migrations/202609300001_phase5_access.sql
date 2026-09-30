begin;

-- M1 is deliberately dormant. No existing member is selected or promoted.
-- This permanent control row serializes membership changes and activation.
create table public.agency_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid unique references auth.users(id) on delete restrict,
  designated_at timestamptz,
  check ((user_id is null) = (designated_at is null))
);
insert into public.agency_owner(singleton) values (true);
alter table public.agency_owner enable row level security;
revoke all on public.agency_owner from public, anon, authenticated, service_role;

create function public.phase5_lock_memberships() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.agency_owner where singleton for update;
  if not found then raise exception 'Owner control row missing' using errcode = '23514'; end if;
  return null;
end;
$$;
create trigger phase5_membership_lock before insert or update or delete
  on public.admin_memberships for each statement execute function public.phase5_lock_memberships();

create function public.phase5_protect_owner_control() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP in ('DELETE','TRUNCATE') then
    raise exception 'Owner control cannot be removed' using errcode = '23514';
  end if;
  if old.user_id is not null and new.user_id is null then
    raise exception 'Owner activation cannot be cleared' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger phase5_owner_control before update or delete on public.agency_owner
  for each row execute function public.phase5_protect_owner_control();
create trigger phase5_owner_no_truncate before truncate on public.agency_owner
  for each statement execute function public.phase5_protect_owner_control();
create trigger phase5_memberships_no_truncate before truncate on public.admin_memberships
  for each statement execute function public.phase5_protect_owner_control();

create function public.phase5_check_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
declare designated uuid;
begin
  select user_id into designated from public.agency_owner where singleton for update;
  if not found then raise exception 'Owner control row missing' using errcode = '23514'; end if;
  -- Existing legacy roles are untouched until explicit operator activation.
  if designated is null then return null; end if;
  if (select count(*) from public.admin_memberships where role = 'super_admin') <> 1
    or not exists(select 1 from public.admin_memberships
      where user_id = designated and role = 'super_admin' and active) then
    raise exception 'Exactly one active designated owner is required' using errcode = '23514';
  end if;
  return null;
end;
$$;
create constraint trigger phase5_owner_invariant after insert or update or delete
  on public.agency_owner deferrable initially deferred
  for each row execute function public.phase5_check_owner();
create constraint trigger phase5_membership_invariant after insert or update or delete
  on public.admin_memberships deferrable initially deferred
  for each row execute function public.phase5_check_owner();

-- Operator-only, SECURITY INVOKER. The caller must independently verify identity.
-- Deliberately refuses to promote even an otherwise valid active admin.
create function public.phase5_bootstrap_owner(p_verified_user_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare designated uuid;
begin
  lock table public.admin_memberships in share row exclusive mode;
  select user_id into designated from public.agency_owner where singleton for update;
  if p_verified_user_id is null or not found then
    raise exception 'Verified owner identity required' using errcode = '22023';
  end if;
  if designated is not null then
    raise exception 'Owner already activated; use controlled recovery' using errcode = '23514';
  end if;
  if (select count(*) from public.admin_memberships where role = 'super_admin') <> 1
    or not exists(select 1 from public.admin_memberships
      where user_id = p_verified_user_id and role = 'super_admin' and active) then
    raise exception 'Resolve owner membership explicitly before activation' using errcode = '23514';
  end if;
  update public.agency_owner set user_id = p_verified_user_id, designated_at = now() where singleton;
end;
$$;

-- Each row is an allowed capability/scope pair, not a user-editable catalog.
create table public.staff_capabilities (
  capability text not null,
  scope text not null check (scope in ('assigned','all')),
  primary key (capability,scope)
);
insert into public.staff_capabilities values
  ('workspace.access','all'), ('crm.intake','all'), ('crm.create','all'),
  ('crm.read','assigned'), ('crm.read','all'),
  ('crm.update','assigned'), ('crm.update','all'),
  ('crm.stage','assigned'), ('crm.stage','all'),
  ('crm.assign','assigned'), ('crm.assign','all'),
  ('crm.notes.write','assigned'), ('crm.notes.write','all'),
  ('crm.followups.manage','assigned'), ('crm.followups.manage','all'),
  ('clients.read','assigned'), ('clients.read','all'),
  ('clients.convert','assigned'), ('clients.convert','all'),
  ('reports.crm.read','assigned'), ('reports.crm.read','all');

create table public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key in ('sales','project','finance','content','support')),
  name text not null check (char_length(name) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.staff_roles(key,name) values
  ('sales','Sales'), ('project','Project'), ('finance','Finance'),
  ('content','Content'), ('support','Support');
create table public.staff_role_permissions (
  role_id uuid not null references public.staff_roles(id) on delete restrict,
  capability text not null,
  scope text not null,
  primary key (role_id,capability,scope),
  foreign key (capability,scope) references public.staff_capabilities(capability,scope) on delete restrict
);
create table public.staff_role_assignments (
  user_id uuid not null references public.admin_memberships(user_id) on delete cascade,
  role_id uuid not null references public.staff_roles(id) on delete restrict,
  assigned_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id,role_id)
);
create index staff_role_assignments_role_idx on public.staff_role_assignments(role_id,user_id);
-- No permissions or assignments are seeded. Staff onboarding belongs to M3/M6.
alter table public.staff_capabilities enable row level security;
alter table public.staff_roles enable row level security;
alter table public.staff_role_permissions enable row level security;
alter table public.staff_role_assignments enable row level security;
revoke all on public.staff_capabilities, public.staff_roles, public.staff_role_permissions,
  public.staff_role_assignments from public, anon, authenticated, service_role;

create function public.phase5_is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.agency_owner o
    join public.admin_memberships m on m.user_id = o.user_id
    where o.singleton and o.user_id = (select auth.uid()) and m.active and m.role = 'super_admin');
$$;

create function public.phase5_current_permissions() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); owner_id uuid; member_active boolean; member_role text; grants jsonb;
begin
  select user_id into owner_id from public.agency_owner where singleton;
  select active,role into member_active,member_role from public.admin_memberships where user_id = actor;
  if owner_id is null or actor is null or member_active is distinct from true
    or member_role is null or member_role not in ('admin','super_admin') then
    return jsonb_build_object('user_id',actor,'active',false,'is_owner',false,'grants','[]'::jsonb);
  end if;
  if public.phase5_is_owner() then
    select coalesce(jsonb_agg(jsonb_build_object('capability',capability,'scope',scope)
      order by capability,scope),'[]'::jsonb) into grants from public.staff_capabilities;
  else
    select coalesce(jsonb_agg(jsonb_build_object('capability',p.capability,'scope',p.scope)
      order by p.capability,p.scope),'[]'::jsonb) into grants from (
      select distinct rp.capability,rp.scope from public.staff_role_assignments a
      join public.staff_roles r on r.id = a.role_id and r.active
      join public.staff_role_permissions rp on rp.role_id = r.id where a.user_id = actor
    ) p;
  end if;
  return jsonb_build_object('user_id',actor,'active',true,'is_owner',public.phase5_is_owner(),'grants',grants);
end;
$$;

-- This checks entitlement scope only. 'assigned' is NOT proof of record access.
-- Future mutation RPCs must separately verify the record's assignment in SQL.
create function public.phase5_has_capability(p_capability text,p_scope text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.staff_capabilities c
    where c.capability = p_capability and c.scope = p_scope)
    and exists(select 1 from public.agency_owner where singleton and user_id is not null)
    and exists(select 1 from public.admin_memberships m where m.user_id = (select auth.uid()) and m.active)
    and (public.phase5_is_owner() or exists(
      select 1 from public.staff_role_assignments a
      join public.staff_roles r on r.id = a.role_id and r.active
      join public.staff_role_permissions p on p.role_id = r.id
      where a.user_id = (select auth.uid()) and p.capability = p_capability
        and (p.scope = p_scope or p.scope = 'all')));
$$;

-- Owner can inspect the catalog; ordinary staff see only their own projection
-- through phase5_current_permissions. No application role can write these tables.
grant select on public.agency_owner, public.staff_capabilities, public.staff_roles,
  public.staff_role_permissions, public.staff_role_assignments to authenticated;
create policy phase5_owner_read on public.agency_owner for select to authenticated
  using ((select public.phase5_is_owner()));
create policy phase5_capability_read on public.staff_capabilities for select to authenticated
  using ((select public.phase5_is_owner()));
create policy phase5_role_read on public.staff_roles for select to authenticated
  using ((select public.phase5_is_owner()));
create policy phase5_permission_read on public.staff_role_permissions for select to authenticated
  using ((select public.phase5_is_owner()));
create policy phase5_assignment_read on public.staff_role_assignments for select to authenticated
  using ((select public.phase5_is_owner()));

revoke all on function public.phase5_lock_memberships(), public.phase5_protect_owner_control(),
  public.phase5_check_owner(), public.phase5_bootstrap_owner(uuid), public.phase5_is_owner(),
  public.phase5_current_permissions(), public.phase5_has_capability(text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.phase5_is_owner(), public.phase5_current_permissions(),
  public.phase5_has_capability(text,text) to authenticated;

commit;
