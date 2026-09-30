begin;

-- M2 is an operator-maintained foundation: owner reads only, no app mutations.
create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  revision bigint not null default 0 check (revision >= 0),
  assigned_to uuid references public.admin_memberships(user_id) on delete set null,
  archived_at timestamptz,
  full_name text not null check (full_name = btrim(full_name) and char_length(full_name) between 1 and 160 and full_name !~ '[[:cntrl:]]'),
  email text unique check (email = lower(btrim(email)) and char_length(email) between 3 and 254 and email ~ '^[^@[:space:][:cntrl:]]+@[^@[:space:][:cntrl:]]+[.][^@[:space:][:cntrl:]]+$'),
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  source text not null default 'manual' check (source in ('manual','website_inquiry','referral','import','other')),
  lifecycle text not null default 'lead' check (lifecycle in ('lead','qualified','client','former_client'))
);
create table public.crm_companies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  revision bigint not null default 0 check (revision >= 0),
  assigned_to uuid references public.admin_memberships(user_id) on delete set null,
  archived_at timestamptz,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 160 and name !~ '[[:cntrl:]]'),
  website text check (char_length(website) <= 2048 and website ~ '^https?://[^/?#[:space:]@]+([/?#][^[:space:]]*)?$' and website !~ '[[:cntrl:]]'),
  industry text check (industry = btrim(industry) and char_length(industry) between 1 and 100 and industry !~ '[[:cntrl:]]'),
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  lifecycle text not null default 'prospect' check (lifecycle in ('prospect','client','former_client'))
);
create table public.crm_contact_companies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  revision bigint not null default 0 check (revision >= 0),
  contact_id uuid not null references public.crm_contacts(id) on delete restrict,
  company_id uuid not null references public.crm_companies(id) on delete restrict,
  job_title text check (job_title = btrim(job_title) and char_length(job_title) between 1 and 120 and job_title !~ '[[:cntrl:]]'),
  is_primary boolean not null default false,
  ended_at timestamptz,
  unique(company_id,contact_id),
  check (ended_at is null or (not is_primary and ended_at >= created_at))
);
create unique index crm_relationship_primary_idx on public.crm_contact_companies(company_id) where is_primary;
create index crm_relationship_contact_idx on public.crm_contact_companies(contact_id,company_id);

create table public.crm_inquiry_links (
  inquiry_id uuid primary key references public.inquiries(id) on delete restrict,
  contact_id uuid not null references public.crm_contacts(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  unique(inquiry_id,contact_id)
);
create index crm_inquiry_contact_idx on public.crm_inquiry_links(contact_id,inquiry_id);

create table public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  revision bigint not null default 0 check (revision >= 0),
  assigned_to uuid references public.admin_memberships(user_id) on delete set null,
  archived_at timestamptz,
  title text not null check (title = btrim(title) and char_length(title) between 1 and 200 and title !~ '[[:cntrl:]]'),
  contact_id uuid not null references public.crm_contacts(id) on delete restrict,
  company_id uuid references public.crm_companies(id) on delete restrict,
  source_inquiry_id uuid unique,
  source text not null default 'manual' check (source in ('manual','website_inquiry','referral','import','other')),
  stage text not null default 'new' check (stage in ('new','contacted','qualified','proposal','won','lost')),
  expected_value numeric(18,4) check (expected_value >= 0 and expected_value::text not in ('NaN','Infinity','-Infinity')),
  currency_code text check (currency_code ~ '^[A-Z]{3}$'),
  expected_close_date date,
  closed_at timestamptz,
  loss_reason text check (loss_reason in ('budget','timing','scope_mismatch','competitor','no_response','cancelled','other')),
  foreign key(company_id,contact_id) references public.crm_contact_companies(company_id,contact_id) on delete restrict,
  foreign key(source_inquiry_id,contact_id) references public.crm_inquiry_links(inquiry_id,contact_id) on delete restrict,
  check ((expected_value is null) = (currency_code is null)),
  check ((source = 'website_inquiry') = (source_inquiry_id is not null)),
  check ((stage in ('won','lost')) = (closed_at is not null)),
  check ((stage = 'lost') = (loss_reason is not null))
);
create index crm_opportunity_contact_idx on public.crm_opportunities(contact_id);
create index crm_opportunity_company_idx on public.crm_opportunities(company_id,contact_id) where company_id is not null;
create index crm_opportunity_stage_idx on public.crm_opportunities(stage,created_at desc,id desc) where archived_at is null;
create index crm_opportunity_assigned_idx on public.crm_opportunities(assigned_to,stage,created_at desc,id desc) where archived_at is null;
create index crm_opportunity_close_idx on public.crm_opportunities(expected_close_date,id)
  where archived_at is null and stage not in ('won','lost') and expected_close_date is not null;

create index crm_contacts_created_idx on public.crm_contacts(created_at desc,id desc) where archived_at is null;
create index crm_contacts_assigned_idx on public.crm_contacts(assigned_to,created_at desc,id desc) where archived_at is null;
create index crm_contacts_lifecycle_idx on public.crm_contacts(lifecycle,created_at desc,id desc) where archived_at is null;
create index crm_companies_created_idx on public.crm_companies(created_at desc,id desc) where archived_at is null;
create index crm_companies_assigned_idx on public.crm_companies(assigned_to,created_at desc,id desc) where archived_at is null;
create index crm_companies_lifecycle_idx on public.crm_companies(lifecycle,created_at desc,id desc) where archived_at is null;
-- Full indexes support membership FK actions even for archived records.
create index crm_contacts_membership_idx on public.crm_contacts(assigned_to) where assigned_to is not null;
create index crm_companies_membership_idx on public.crm_companies(assigned_to) where assigned_to is not null;
create index crm_opportunities_membership_idx on public.crm_opportunities(assigned_to) where assigned_to is not null;
create index crm_company_name_idx on public.crm_companies(lower(name));

-- Pure validation helper; no identity arguments or privileged reads.
create function public.phase5_crm_fields(p_entity text) returns text[]
language sql immutable set search_path = '' as $$
  select case p_entity
    when 'contact' then array['full_name','email','phone','source','lifecycle','assigned_to','archived_at']
    when 'company' then array['name','website','industry','country_code','lifecycle','assigned_to','archived_at']
    when 'contact_company' then array['contact_id','company_id','job_title','is_primary','ended_at']
    when 'opportunity' then array['title','contact_id','company_id','source_inquiry_id','source','stage','expected_value','currency_code','expected_close_date','closed_at','loss_reason','assigned_to','archived_at']
    when 'inquiry_link' then array['inquiry_id','contact_id']
  end;
$$;
create function public.phase5_crm_valid_fields(p_entity text,p_fields text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(array_ndims(p_fields)=1 and cardinality(p_fields)>0
    and array_position(p_fields,null) is null
    and p_fields <@ public.phase5_crm_fields(p_entity)
    and cardinality(p_fields)=(select count(distinct f) from unnest(p_fields) f),false);
$$;
create table public.crm_audit_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('contact','company','contact_company','opportunity','inquiry_link')),
  entity_id uuid not null,
  entity_revision bigint not null check (entity_revision >= 0),
  action text not null check (action in ('created','updated')),
  actor_user_id uuid,
  actor_kind text not null check (actor_kind in ('database_operator','authenticated_user')),
  occurred_at timestamptz not null default clock_timestamp(),
  changed_fields text[] not null,
  previous_state text,
  new_state text,
  previous_assigned_to uuid,
  new_assigned_to uuid,
  previous_archived boolean,
  new_archived boolean,
  unique(entity_type,entity_id,entity_revision),
  check (public.phase5_crm_valid_fields(entity_type,changed_fields)),
  check ((actor_kind='database_operator' and actor_user_id is null)
      or (actor_kind='authenticated_user' and actor_user_id is not null)),
  check ((action='created' and entity_revision=0 and previous_state is null
    and previous_assigned_to is null and previous_archived is null)
    or (action='updated' and entity_revision>0)),
  check (
    (entity_type='contact' and new_state is not null and new_state in ('lead','qualified','client','former_client')
      and (previous_state is null or previous_state in ('lead','qualified','client','former_client')))
    or (entity_type='company' and new_state is not null and new_state in ('prospect','client','former_client')
      and (previous_state is null or previous_state in ('prospect','client','former_client')))
    or (entity_type='opportunity' and new_state is not null and new_state in ('new','contacted','qualified','proposal','won','lost')
      and (previous_state is null or previous_state in ('new','contacted','qualified','proposal','won','lost')))
    or (entity_type in ('contact_company','inquiry_link') and previous_state is null and new_state is null)),
  check ((entity_type in ('contact','company','opportunity') and new_archived is not null
      and (action='created' or (previous_archived is not null and previous_state is not null)))
    or (entity_type in ('contact_company','inquiry_link') and previous_assigned_to is null
      and new_assigned_to is null and previous_archived is null and new_archived is null)),
  check (entity_type <> 'inquiry_link' or (action='created' and entity_revision=0))
);
create index crm_audit_entity_idx on public.crm_audit_events(entity_type,entity_id,occurred_at desc,id desc);
create index crm_audit_time_idx on public.crm_audit_events(occurred_at,id);
create index crm_audit_actor_idx on public.crm_audit_events(actor_user_id,occurred_at desc) where actor_user_id is not null;

create function public.phase5_crm_prepare_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Match M1: lock before row locks. Never alter owner identity here.
  perform 1 from public.agency_owner where singleton for update;
  if not found then raise exception 'Owner control missing' using errcode='23514'; end if;
  return null;
end;
$$;
create function public.phase5_crm_reject_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'CRM history must be archived, not deleted' using errcode='23514';
end;
$$;
create function public.phase5_crm_protect_history() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'CRM history is immutable' using errcode='23514';
end;
$$;

create function public.phase5_crm_validate_record() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  before_row jsonb := case when TG_OP='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  after_row jsonb := to_jsonb(new);
  entity text := TG_ARGV[0];
  fields text[] := public.phase5_crm_fields(entity);
  changed text[];
  prior_state text;
  next_state text;
  assignee uuid;
  contact uuid;
  company uuid;
  clearing_deleted_member boolean := false;
begin
  -- JSON is transient comparison only; no row snapshot is persisted or logged.
  if TG_OP='UPDATE' and (after_row->'id' is distinct from before_row->'id'
      or new.created_at is distinct from old.created_at) then
    raise exception 'Immutable CRM identity' using errcode='23514';
  end if;
  if entity='inquiry_link' then
    if TG_OP='UPDATE' then raise exception 'Inquiry link is immutable' using errcode='23514'; end if;
    new.created_at := clock_timestamp();
  else
    if TG_OP='INSERT' then
      new.created_at := clock_timestamp(); new.updated_at := new.created_at; new.revision := 0;
      if entity in ('contact','company','opportunity') then new.archived_at := null; end if;
    else
      new.updated_at := old.updated_at; new.revision := old.revision;
    end if;
  end if;

  if entity in ('contact','company','opportunity') then
    assignee := new.assigned_to;
    if TG_OP='INSERT' or new.assigned_to is distinct from old.assigned_to then
      if assignee is not null then
        perform 1 from public.admin_memberships where user_id=assignee and active for share;
        if not found then raise exception 'Active assignee required' using errcode='23514'; end if;
      elsif TG_OP='UPDATE' and old.assigned_to is not null then
        clearing_deleted_member := not exists(select 1 from public.admin_memberships where user_id=old.assigned_to);
      end if;
    end if;
    if TG_OP='UPDATE' then
      if new.archived_at is distinct from old.archived_at then
        if old.archived_at is not null and new.archived_at is not null then
          raise exception 'Archive timestamp is managed' using errcode='23514';
        end if;
        if (after_row - array['archived_at','updated_at','revision'])
            is distinct from (before_row - array['archived_at','updated_at','revision']) then
          raise exception 'Archive separately from edits' using errcode='23514';
        end if;
        if new.archived_at is not null then new.archived_at := clock_timestamp(); end if;
      elsif old.archived_at is not null and
        (after_row - array['updated_at','revision']) is distinct from (before_row - array['updated_at','revision']) then
        if not (clearing_deleted_member and
          (after_row - array['assigned_to','updated_at','revision']) =
          (before_row - array['assigned_to','updated_at','revision'])) then
          raise exception 'Restore before editing' using errcode='23514';
        end if;
      end if;
    end if;
  end if;

  if entity in ('contact','company') then
    next_state := new.lifecycle;
    if TG_OP='INSERT' and next_state is distinct from (case when entity='contact' then 'lead' else 'prospect' end) then
      raise exception 'Invalid initial lifecycle' using errcode='23514';
    elsif TG_OP='UPDATE' and new.lifecycle is distinct from old.lifecycle then
      prior_state := old.lifecycle;
      if not coalesce(
        (entity='contact' and ((prior_state='lead' and next_state='qualified')
          or (prior_state='qualified' and next_state in ('lead','client'))
          or (prior_state='client' and next_state='former_client')
          or (prior_state='former_client' and next_state in ('client','qualified'))))
        or (entity='company' and ((prior_state='prospect' and next_state='client')
          or (prior_state='client' and next_state='former_client')
          or (prior_state='former_client' and next_state in ('client','prospect')))),false) then
        raise exception 'Invalid lifecycle transition' using errcode='23514';
      end if;
    end if;
  end if;

  if entity='contact_company' and TG_OP='UPDATE' then
    if new.contact_id is distinct from old.contact_id or new.company_id is distinct from old.company_id then
      raise exception 'Relationship endpoints are immutable' using errcode='23514';
    end if;
  end if;
  if entity='opportunity' then
    if TG_OP='INSERT' then
      if new.stage is distinct from 'new' then raise exception 'Invalid initial stage' using errcode='23514'; end if;
      new.closed_at := null;
    else
      if old.source_inquiry_id is not null and new.source_inquiry_id is distinct from old.source_inquiry_id then
        raise exception 'Inquiry origin is immutable' using errcode='23514';
      end if;
      new.closed_at := old.closed_at;
      if new.stage is distinct from old.stage then
        if old.stage in ('won','lost') and new.stage is distinct from 'qualified' then
          raise exception 'Reopen to qualified first' using errcode='23514';
        end if;
        new.closed_at := case when new.stage in ('won','lost') then clock_timestamp() else null end;
        if new.stage <> 'lost' then new.loss_reason := null; end if;
      end if;
    end if;
  end if;

  -- Validate only new/retargeted/re-activated references. Historical affiliations
  -- remain valid when a parent is later archived or a relationship ends.
  if entity in ('contact_company','opportunity','inquiry_link') then
    if TG_OP='INSERT'
      or after_row->'contact_id' is distinct from before_row->'contact_id'
      or after_row->'company_id' is distinct from before_row->'company_id'
      or (entity='contact_company' and
        ((before_row->>'ended_at' is not null and after_row->>'ended_at' is null)
          or (after_row->>'is_primary'='true' and before_row->>'is_primary'='false'))) then
      contact := new.contact_id;
      company := (after_row->>'company_id')::uuid;
      if company is not null then
        perform 1 from public.crm_companies where id=company and archived_at is null for share;
        if not found then raise exception 'Active company required' using errcode='23514'; end if;
      end if;
      perform 1 from public.crm_contacts where id=contact and archived_at is null for share;
      if not found then raise exception 'Active contact required' using errcode='23514'; end if;
      if entity='opportunity' and company is not null then
        perform 1 from public.crm_contact_companies where company_id=company and contact_id=contact and ended_at is null for share;
        if not found then raise exception 'Current affiliation required' using errcode='23514'; end if;
      end if;
    end if;
  end if;
  if entity <> 'inquiry_link' then
    after_row := to_jsonb(new);
    select array_agg(f order by f) into changed from unnest(fields) f
      where TG_OP='INSERT' or after_row->f is distinct from before_row->f;
    if TG_OP='UPDATE' and changed is not null then
      new.updated_at := clock_timestamp(); new.revision := old.revision+1;
    end if;
  end if;
  return new;
end;
$$;

create function public.phase5_crm_audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  entity text := TG_ARGV[0];
  before_row jsonb := case when TG_OP='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  after_row jsonb := to_jsonb(new);
  changed text[];
  state_field text := case when entity='opportunity' then 'stage' else 'lifecycle' end;
  has_assignment boolean := entity in ('contact','company','opportunity');
begin
  select array_agg(f order by f) into changed from unnest(public.phase5_crm_fields(entity)) f
    where TG_OP='INSERT' or after_row->f is distinct from before_row->f;
  if changed is null then return null; end if;
  insert into public.crm_audit_events(entity_type,entity_id,entity_revision,action,
    actor_user_id,actor_kind,changed_fields,previous_state,new_state,
    previous_assigned_to,new_assigned_to,previous_archived,new_archived)
  values(entity,coalesce(after_row->>'id',after_row->>'inquiry_id')::uuid,
    coalesce((after_row->>'revision')::bigint,0),case when TG_OP='INSERT' then 'created' else 'updated' end,
    null,'database_operator',changed,before_row->>state_field,after_row->>state_field,
    (before_row->>'assigned_to')::uuid,(after_row->>'assigned_to')::uuid,
    case when has_assignment and TG_OP='UPDATE' then before_row->>'archived_at' is not null end,
    case when has_assignment then after_row->>'archived_at' is not null end);
  return null;
end;
$$;

create trigger crm_00_serialize before insert or update or delete on public.crm_contacts
  for each statement execute function public.phase5_crm_prepare_write();
create trigger crm_validate before insert or update on public.crm_contacts
  for each row execute function public.phase5_crm_validate_record('contact');
create trigger crm_audit after insert or update on public.crm_contacts
  for each row execute function public.phase5_crm_audit_change('contact');
create trigger crm_no_delete before delete or truncate on public.crm_contacts
  for each statement execute function public.phase5_crm_reject_delete();
create trigger crm_00_serialize before insert or update or delete on public.crm_companies
  for each statement execute function public.phase5_crm_prepare_write();
create trigger crm_validate before insert or update on public.crm_companies
  for each row execute function public.phase5_crm_validate_record('company');
create trigger crm_audit after insert or update on public.crm_companies
  for each row execute function public.phase5_crm_audit_change('company');
create trigger crm_no_delete before delete or truncate on public.crm_companies
  for each statement execute function public.phase5_crm_reject_delete();
create trigger crm_00_serialize before insert or update or delete on public.crm_contact_companies
  for each statement execute function public.phase5_crm_prepare_write();
create trigger crm_validate before insert or update on public.crm_contact_companies
  for each row execute function public.phase5_crm_validate_record('contact_company');
create trigger crm_audit after insert or update on public.crm_contact_companies
  for each row execute function public.phase5_crm_audit_change('contact_company');
create trigger crm_no_delete before delete or truncate on public.crm_contact_companies
  for each statement execute function public.phase5_crm_reject_delete();
create trigger crm_00_serialize before insert or update or delete on public.crm_opportunities
  for each statement execute function public.phase5_crm_prepare_write();
create trigger crm_validate before insert or update on public.crm_opportunities
  for each row execute function public.phase5_crm_validate_record('opportunity');
create trigger crm_audit after insert or update on public.crm_opportunities
  for each row execute function public.phase5_crm_audit_change('opportunity');
create trigger crm_no_delete before delete or truncate on public.crm_opportunities
  for each statement execute function public.phase5_crm_reject_delete();
create trigger crm_00_serialize before insert or update or delete on public.crm_inquiry_links
  for each statement execute function public.phase5_crm_prepare_write();
create trigger crm_validate before insert or update on public.crm_inquiry_links
  for each row execute function public.phase5_crm_validate_record('inquiry_link');
create trigger crm_audit after insert or update on public.crm_inquiry_links
  for each row execute function public.phase5_crm_audit_change('inquiry_link');
create trigger crm_no_delete before delete or truncate on public.crm_inquiry_links
  for each statement execute function public.phase5_crm_reject_delete();
create trigger crm_history_immutable before update or delete or truncate on public.crm_audit_events
  for each statement execute function public.phase5_crm_protect_history();

alter table public.crm_contacts enable row level security;
revoke all on public.crm_contacts from public,anon,authenticated,service_role;
grant select on public.crm_contacts to authenticated;
create policy crm_owner_read on public.crm_contacts for select to authenticated
  using ((select public.phase5_is_owner()));
alter table public.crm_companies enable row level security;
revoke all on public.crm_companies from public,anon,authenticated,service_role;
grant select on public.crm_companies to authenticated;
create policy crm_owner_read on public.crm_companies for select to authenticated
  using ((select public.phase5_is_owner()));
alter table public.crm_contact_companies enable row level security;
revoke all on public.crm_contact_companies from public,anon,authenticated,service_role;
grant select on public.crm_contact_companies to authenticated;
create policy crm_owner_read on public.crm_contact_companies for select to authenticated
  using ((select public.phase5_is_owner()));
alter table public.crm_opportunities enable row level security;
revoke all on public.crm_opportunities from public,anon,authenticated,service_role;
grant select on public.crm_opportunities to authenticated;
create policy crm_owner_read on public.crm_opportunities for select to authenticated
  using ((select public.phase5_is_owner()));
alter table public.crm_inquiry_links enable row level security;
revoke all on public.crm_inquiry_links from public,anon,authenticated,service_role;
grant select on public.crm_inquiry_links to authenticated;
create policy crm_owner_read on public.crm_inquiry_links for select to authenticated
  using ((select public.phase5_is_owner()));
alter table public.crm_audit_events enable row level security;
revoke all on public.crm_audit_events from public,anon,authenticated,service_role;
grant select on public.crm_audit_events to authenticated;
create policy crm_owner_read on public.crm_audit_events for select to authenticated
  using ((select public.phase5_is_owner()));
revoke all on function public.phase5_crm_fields(text),public.phase5_crm_valid_fields(text,text[]),
  public.phase5_crm_prepare_write(),public.phase5_crm_validate_record(),
  public.phase5_crm_audit_change(),public.phase5_crm_reject_delete(),public.phase5_crm_protect_history()
  from public,anon,authenticated,service_role;
commit;
