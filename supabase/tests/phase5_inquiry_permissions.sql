-- ONLY an isolated disposable local database with emulated Auth and synthetic users.
-- Never use this fixture script on a hosted database. All changes roll back.
begin;

-- Fixture users: owner, staff (no M1 role), legacy_admin (no M1 role),
--                legacy_super (not designated owner, no M1 role),
--                inactive, outsider.
create temporary table phase5_fixture (kind text primary key,id uuid) on commit drop;
insert into phase5_fixture select kind,gen_random_uuid()
  from unnest(array['owner','staff','legacy_admin','legacy_super','inactive','outsider']) kind;
grant select on phase5_fixture to authenticated,anon,service_role;
insert into auth.users(id) select id from phase5_fixture;

-- Baseline: owner has super_admin membership; others have admin membership.
insert into public.admin_memberships(user_id,role,active)
  select id,'super_admin',kind <> 'inactive' from phase5_fixture where kind in ('owner','legacy_admin','legacy_super')
  union all
  select id,'admin',kind <> 'inactive' from phase5_fixture where kind in ('staff','inactive');

-- Staff gets a sales role with clients.read:all and clients.convert:all.
insert into public.staff_roles(key,name) values ('sales','Sales') on conflict (key) do nothing;
insert into public.staff_role_permissions(role_id,capability,scope)
  select id,'clients.read','all' from public.staff_roles where key='sales'
  union all
  select id,'clients.stage','all' from public.staff_roles where key='sales'
  union all
  select id,'clients.convert','all' from public.staff_roles where key='sales'
  union all
  select id,'crm.read','all' from public.staff_roles where key='sales';
insert into public.staff_role_assignments(user_id,role_id,assigned_by)
  select f.id,r.id,(select id from phase5_fixture where kind='owner')
  from phase5_fixture f cross join public.staff_roles r where f.kind='staff' and r.key='sales';

-- Activate owner.
select public.phase5_bootstrap_owner((select id from phase5_fixture where kind='owner'));
set constraints all immediate;

create function pg_temp.assert_ok(value boolean,message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception '%',message; end if; end;
$$;
create function pg_temp.expect_error(statement text,expected_state text) returns void language plpgsql as $$
declare failed boolean := false;
begin
  begin execute statement;
  exception when others then
    if not (sqlstate = any(string_to_array(expected_state,','))) then raise; end if;
    failed := true;
  end;
  if not failed then raise exception 'Expected SQLSTATE %',expected_state; end if;
end;
$$;

-- ============================================================
-- LEGACY AUTHORIZATION REMOVED
-- ============================================================

-- Legacy is_inquiry_admin() must not be callable by authenticated users.
select pg_temp.assert_ok(not has_function_privilege('authenticated','public.is_inquiry_admin()','EXECUTE'),'Legacy is_inquiry_admin still executable');

-- Legacy admin membership alone must not grant inquiry/CRM access.
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',(select id from phase5_fixture where kind='legacy_admin'))::text,true) is not null;
select pg_temp.expect_error('select * from public.inquiries limit 1','42501');
select pg_temp.expect_error('select * from public.admin_audit_events limit 1','42501');
select pg_temp.expect_error('select * from public.email_outbox limit 1','42501');
select pg_temp.expect_error('select * from public.crm_contacts limit 1','42501');
select pg_temp.expect_error('select * from public.admin_list_inquiries('''','''',1)','42501');
select pg_temp.expect_error('select * from public.admin_inquiry_counts()','42501');
select pg_temp.expect_error('select public.admin_change_inquiry_status(gen_random_uuid(),''new'',0)','42501');
select pg_temp.expect_error('select public.convert_inquiry_to_crm(gen_random_uuid())','42501');

-- Legacy super_admin who is NOT the designated owner must also be denied.
select set_config('request.jwt.claims',json_build_object('sub',(select id from phase5_fixture where kind='legacy_super'))::text,true) is not null;
select pg_temp.expect_error('select * from public.inquiries limit 1','42501');
select pg_temp.expect_error('select * from public.crm_contacts limit 1','42501');

-- ============================================================
-- DESIGNATED OWNER
-- ============================================================

select set_config('request.jwt.claims',json_build_object('sub',(select id from phase5_fixture where kind='owner'))::text,true) is not null;
select pg_temp.assert_ok(exists(select 1 from public.inquiries limit 1),'Owner inquiry read');
select pg_temp.assert_ok(exists(select 1 from public.admin_audit_events limit 1),'Owner audit read');
select pg_temp.assert_ok(exists(select 1 from public.email_outbox limit 1),'Owner email read');
select pg_temp.assert_ok(exists(select 1 from public.crm_contacts limit 1),'Owner CRM read');
select pg_temp.assert_ok(exists(select 1 from public.admin_list_inquiries('','',1) limit 1),'Owner list inquiries');
select pg_temp.assert_ok(exists(select 1 from public.admin_inquiry_counts()),'Owner inquiry counts');

-- ============================================================
-- ACTIVE STAFF CAPABILITIES
-- ============================================================

insert into public.inquiries(name,email,service,message,request_hash)
  values('Staff fixture','staff@example.invalid','web-applications','Synthetic M3 inquiry.',repeat('a',64));
insert into public.crm_contacts(id,full_name,email) values(gen_random_uuid(),'Contact','contact@example.invalid');

-- workspace.access:assigned alone must NOT grant admin workspace access.
insert into public.staff_role_permissions(role_id,capability,scope)
  select id,'workspace.access','assigned' from public.staff_roles where key='sales';
select set_config('request.jwt.claims',json_build_object('sub',(select id from phase5_fixture where kind='staff'))::text,true) is not null;
select pg_temp.expect_error('select * from public.inquiries limit 1','42501');
delete from public.staff_role_permissions where capability='workspace.access';

-- clients.read:all grants inquiry access.
insert into public.staff_role_permissions(role_id,capability,scope)
  select id,'clients.read','all' from public.staff_roles where key='sales';
select pg_temp.assert_ok(exists(select 1 from public.inquiries limit 1),'Staff clients.read all inquiry');
select pg_temp.assert_ok(exists(select 1 from public.admin_audit_events limit 1),'Staff clients.read all audit');
select pg_temp.assert_ok(exists(select 1 from public.admin_list_inquiries('','',1) limit 1),'Staff clients.read all list');
select pg_temp.assert_ok(exists(select 1 from public.admin_inquiry_counts()),'Staff clients.read all counts');

-- clients.read:assigned alone must NOT grant broad inquiry access in M3.
insert into public.staff_role_permissions(role_id,capability,scope)
  select id,'clients.read','assigned' from public.staff_roles where key='sales'
  on conflict do nothing;
delete from public.staff_role_permissions where capability='clients.read' and scope='all';
select pg_temp.expect_error('select * from public.inquiries limit 1','42501');
select pg_temp.expect_error('select * from public.admin_audit_events limit 1','42501');
delete from public.staff_role_permissions where capability='clients.read';

-- crm.read:all grants CRM access.
insert into public.staff_role_permissions(role_id,capability,scope)
  select id,'crm.read','all' from public.staff_roles where key='sales';
select pg_temp.assert_ok(exists(select 1 from public.crm_contacts limit 1),'Staff crm.read all CRM');

-- crm.read:assigned without matching assignment sees zero contacts (no assignment column in inquiries).
insert into public.staff_role_permissions(role_id,capability,scope)
  select id,'crm.read','assigned' from public.staff_roles where key='sales';
delete from public.staff_role_permissions where capability='crm.read' and scope='all';
select pg_temp.expect_error('select * from public.crm_contacts limit 1','42501');
delete from public.staff_role_permissions where capability='crm.read';

-- ============================================================
-- CAPABILITY GAP: inquiry status requires clients.stage, not crm.stage
-- ============================================================

insert into public.staff_role_permissions(role_id,capability,scope)
  select id,'clients.read','all' from public.staff_roles where key='sales'
  union all
  select id,'crm.stage','all' from public.staff_roles where key='sales';
select pg_temp.expect_error('select public.admin_change_inquiry_status((select id from public.inquiries),''contacted'',0)','42501');
insert into public.staff_role_permissions(role_id,capability,scope)
  select id,'clients.stage','all' from public.staff_roles where key='sales'
  on conflict do nothing;
select pg_temp.assert_ok((select count(*) from public.admin_change_inquiry_status((select id from public.inquiries),'contacted',0)) is not null,'Staff clients.stage authorizes status');

-- ============================================================
-- CONVERSION
-- ============================================================

-- Staff with clients.convert:all can convert.
select pg_temp.assert_ok(exists(select 1 from public.convert_inquiry_to_crm((select id from public.inquiries where name='Staff fixture')) limit 1),'Staff convert');

-- Idempotency: second conversion returns already_converted.
select pg_temp.assert_ok(
  (select jsonb_object_keys(public.convert_inquiry_to_crm((select id from public.inquiries where name='Staff fixture'))) @> array['outcome']),
  'Convert idempotent');

-- Direct call without capability is denied.
delete from public.staff_role_permissions where capability='clients.convert';
select set_config('request.jwt.claims',json_build_object('sub',(select id from phase5_fixture where kind='staff'))::text,true) is not null;
select pg_temp.expect_error('select public.convert_inquiry_to_crm((select id from public.inquiries where name=''Staff fixture''))','42501');

-- Owner can convert without explicit capability.
select set_config('request.jwt.claims',json_build_object('sub',(select id from phase5_fixture where kind='owner'))::text,true) is not null;
select pg_temp.assert_ok(exists(select 1 from public.convert_inquiry_to_crm(gen_random_uuid()) limit 1),'Owner convert');

-- ============================================================
-- INACTIVE / NONMEMBER / CLIENT DENIALS
-- ============================================================

select set_config('request.jwt.claims',json_build_object('sub',(select id from phase5_fixture where kind='inactive'))::text,true) is not null;
select pg_temp.expect_error('select * from public.inquiries limit 1','42501');

select set_config('request.jwt.claims',json_build_object('sub',(select id from phase5_fixture where kind='outsider'))::text,true) is not null;
select pg_temp.expect_error('select * from public.inquiries limit 1','42501');

reset role;

-- ============================================================
-- CRM ASSIGNED-SCOPE SEMANTICS
-- ============================================================

-- crm.read:assigned sees only assigned records.
insert into public.staff_role_permissions(role_id,capability,scope)
  select id,'crm.read','assigned' from public.staff_roles where key='sales';
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',(select id from phase5_fixture where kind='staff'))::text,true) is not null;
select pg_temp.assert_ok(not exists(select 1 from public.crm_contacts),'Assigned-only sees zero unassigned contacts');
select pg_temp.assert_ok(not exists(select 1 from public.crm_contact_companies),'Assigned-only sees zero contact_companies');
select pg_temp.assert_ok(not exists(select 1 from public.crm_inquiry_links),'Assigned-only sees zero inquiry_links');
select pg_temp.assert_ok(not exists(select 1 from public.crm_audit_events),'Assigned-only sees zero audit_events');
reset role;

-- ============================================================
-- ARCHIVED EMAIL CONFLICT
-- ============================================================

-- Use a dedicated inquiry so the archived-contact behavior is explicit.
insert into public.inquiries(name,email,service,message,request_hash)
  values('Archived fixture','archived@example.invalid','web-applications','Synthetic archived conflict test.',repeat('a',64));

-- Convert once to create the active contact for this email.
select public.convert_inquiry_to_crm((select id from public.inquiries where name='Archived fixture'));

-- Archive the contact created by the first conversion.
update public.crm_contacts
  set archived_at = clock_timestamp()
  where email = 'archived@example.invalid' and archived_at is null;

-- Second attempt must return archived_conflict, not silently reuse the archived contact.
select set_config('request.jwt.claims',json_build_object('sub',(select id from phase5_fixture where kind='owner'))::text,true) is not null;
select pg_temp.assert_ok(
  public.convert_inquiry_to_crm((select id from public.inquiries where name='Archived fixture'))->>'outcome' = 'archived_conflict',
  'Archived email conflict');

-- Verify no duplicate contact and no inquiry link was created for the failed conversion.
select pg_temp.assert_ok(
  (select count(*) from public.crm_contacts where email = 'archived@example.invalid') = 1,
  'Duplicate archived contact');
select pg_temp.assert_ok(
  not exists(select 1 from public.crm_inquiry_links where inquiry_id = (select id from public.inquiries where name='Archived fixture')),
  'Unexpected inquiry link for archived conflict');

rollback;
