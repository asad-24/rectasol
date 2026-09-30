-- ONLY an isolated disposable local database with emulated Auth and synthetic users.
-- Never use this fixture script on a hosted database. All changes roll back.
begin;
create temporary table phase5_fixture (kind text primary key,id uuid) on commit drop;
insert into phase5_fixture select kind,gen_random_uuid()
  from unnest(array['owner','staff','outsider','other','inactive']) kind;
grant select on phase5_fixture to authenticated,anon,service_role;
insert into auth.users(id) select id from phase5_fixture;
insert into public.admin_memberships(user_id,role,active)
  select id,case when kind='owner' then 'super_admin' else 'admin' end,kind <> 'inactive'
  from phase5_fixture where kind <> 'outsider';

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

select pg_temp.assert_ok((select user_id is null from public.agency_owner),'Migration guessed owner');
select pg_temp.assert_ok(not exists(select 1 from public.staff_role_assignments),'Assignments seeded');
select pg_temp.assert_ok(not exists(select 1 from public.staff_role_permissions),'Role grants seeded');
select pg_temp.expect_error('insert into public.agency_owner(singleton) values(true)','23505');
select pg_temp.expect_error('insert into public.agency_owner(singleton) values(false)','23514');
select pg_temp.expect_error('delete from public.agency_owner','23514');
select pg_temp.expect_error('truncate public.agency_owner','23514');
select pg_temp.expect_error('select public.phase5_bootstrap_owner(null)','22023');
select pg_temp.expect_error('select public.phase5_bootstrap_owner((select id from phase5_fixture where kind=''staff''))','23514');

set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',(select id from phase5_fixture where kind='owner'))::text,true) is not null;
select pg_temp.assert_ok(not public.phase5_is_owner(),'Legacy role became owner before bootstrap');
select pg_temp.assert_ok(not public.phase5_has_capability('crm.read','all'),'Pre-bootstrap grant');
select pg_temp.assert_ok(public.is_inquiry_admin(),'Legacy admin compatibility lost');
select pg_temp.assert_ok(not (public.phase5_current_permissions()->>'active')::boolean,'Pre-bootstrap projection');
select pg_temp.expect_error('select public.phase5_bootstrap_owner((select id from phase5_fixture where kind=''owner''))','42501');
reset role;

-- Even an inactive second super_admin makes activation ambiguous.
update public.admin_memberships set role='super_admin' where user_id=(select id from phase5_fixture where kind='inactive');
select pg_temp.expect_error('select public.phase5_bootstrap_owner((select id from phase5_fixture where kind=''owner''))','23514');
update public.admin_memberships set role='admin' where user_id=(select id from phase5_fixture where kind='inactive');
select public.phase5_bootstrap_owner((select id from phase5_fixture where kind='owner'));
set constraints all immediate;
set constraints all deferred;
select pg_temp.expect_error('select public.phase5_bootstrap_owner((select id from phase5_fixture where kind=''owner''))','23514');
select pg_temp.expect_error('update public.agency_owner set user_id=null,designated_at=null','23514');
select pg_temp.expect_error('update public.admin_memberships set active=false where role=''super_admin''; set constraints all immediate','23514');
select pg_temp.expect_error('update public.admin_memberships set role=''admin'' where role=''super_admin''; set constraints all immediate','23514');
select pg_temp.expect_error('delete from public.admin_memberships where role=''super_admin''; set constraints all immediate','23514');
select pg_temp.expect_error('update public.admin_memberships set role=''super_admin'' where user_id=(select id from phase5_fixture where kind=''staff''); set constraints all immediate','23514');
-- PostgreSQL 18 reports RESTRICT as 23001; the embedded older engine uses 23503.
select pg_temp.expect_error('delete from auth.users where id=(select id from phase5_fixture where kind=''owner'')','23503,23001');

select pg_temp.expect_error('insert into public.staff_role_permissions select id,''owner.manage'',''all'' from public.staff_roles where key=''sales''','23503');
select pg_temp.expect_error('insert into public.staff_role_permissions select id,''crm.intake'',''assigned'' from public.staff_roles where key=''sales''','23503');
insert into public.staff_role_permissions select id,'crm.read','assigned' from public.staff_roles where key='sales';
insert into public.staff_role_assignments(user_id,role_id,assigned_by)
  select f.id,r.id,(select id from phase5_fixture where kind='owner')
  from phase5_fixture f cross join public.staff_roles r where f.kind in ('staff','inactive') and r.key='sales';

do $$
declare t text; fn text;
begin
  foreach t in array array['agency_owner','staff_capabilities','staff_roles','staff_role_permissions','staff_role_assignments'] loop
    perform pg_temp.assert_ok((select relrowsecurity from pg_class where oid=('public.'||t)::regclass),'RLS missing');
    perform pg_temp.assert_ok(not has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),'Anon grant');
    perform pg_temp.assert_ok(not has_table_privilege('service_role','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),'Service grant');
    perform pg_temp.assert_ok(not has_table_privilege('authenticated','public.'||t,'INSERT,UPDATE,DELETE,TRUNCATE'),'Authenticated write grant');
  end loop;
  foreach fn in array array['phase5_is_owner()','phase5_current_permissions()','phase5_has_capability(text,text)','phase5_bootstrap_owner(uuid)','phase5_check_owner()','phase5_lock_memberships()','phase5_protect_owner_control()'] loop
    perform pg_temp.assert_ok(not has_function_privilege('anon','public.'||fn,'EXECUTE'),'Anon RPC');
    perform pg_temp.assert_ok(not has_function_privilege('service_role','public.'||fn,'EXECUTE'),'Service RPC');
  end loop;
end;
$$;
set local role authenticated;
select pg_temp.assert_ok(public.phase5_is_owner(),'Designated owner denied');
select pg_temp.assert_ok(public.phase5_has_capability('clients.convert','all'),'Owner capability missing');
select pg_temp.assert_ok(not public.phase5_has_capability('invalid','all'),'Owner wildcard');
select pg_temp.assert_ok(not public.phase5_has_capability('crm.intake','assigned'),'Invalid scope accepted');
select pg_temp.assert_ok((select count(*)=1 from public.agency_owner),'Owner RLS read');
-- Owner identity is also forbidden from directly granting or changing roles.
select pg_temp.expect_error('update public.staff_roles set active=false','42501');
select set_config('request.jwt.claims',json_build_object('sub',(select id from phase5_fixture where kind='staff'))::text,true) is not null;
select pg_temp.assert_ok(not public.phase5_is_owner(),'Staff escalated');
select pg_temp.assert_ok(public.phase5_has_capability('crm.read','assigned'),'Assigned grant missing');
select pg_temp.assert_ok(not public.phase5_has_capability('crm.read','all'),'Assigned scope widened');
select pg_temp.assert_ok(not public.phase5_has_capability('clients.convert','assigned'),'Unassigned capability');
select pg_temp.assert_ok(not exists(select 1 from public.agency_owner),'Owner identity exposed');
select pg_temp.assert_ok(not exists(select 1 from public.staff_role_assignments),'Assignments exposed');
select pg_temp.expect_error('update public.admin_memberships set role=''super_admin'' where user_id=auth.uid()','42501');
select pg_temp.expect_error('update public.agency_owner set user_id=auth.uid()','42501');
select pg_temp.expect_error('insert into public.staff_role_permissions select id,''crm.read'',''all'' from public.staff_roles','42501');
select pg_temp.expect_error('select public.phase5_bootstrap_owner(auth.uid())','42501');
select set_config('request.jwt.claims',json_build_object('sub',(select id from phase5_fixture where kind='inactive'))::text,true) is not null;
select pg_temp.assert_ok(not public.phase5_has_capability('crm.read','assigned'),'Inactive staff access');
select pg_temp.assert_ok(not (public.phase5_current_permissions()->>'active')::boolean,'Inactive projection');
select set_config('request.jwt.claims',json_build_object('sub',(select id from phase5_fixture where kind='outsider'))::text,true) is not null;
select pg_temp.assert_ok(not public.phase5_has_capability('crm.read','assigned'),'Non-member access');
reset role;
insert into public.staff_role_permissions select id,'crm.read','all' from public.staff_roles where key='sales';
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',(select id from phase5_fixture where kind='staff'))::text,true) is not null;
select pg_temp.assert_ok(public.phase5_has_capability('crm.read','all'),'All grant missing');
select pg_temp.assert_ok(public.phase5_has_capability('crm.read','assigned'),'All grant did not include assigned');
select set_config('request.jwt.claims','{}',true) is not null;
select pg_temp.assert_ok(not public.phase5_has_capability('crm.read','all'),'Missing JWT identity authorized');
reset role;
update public.staff_roles set active=false where key='sales';
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',(select id from phase5_fixture where kind='staff'))::text,true) is not null;
select pg_temp.assert_ok(not public.phase5_has_capability('crm.read','assigned'),'Inactive role access');
reset role;
update public.staff_roles set active=true where key='sales';
delete from public.staff_role_assignments where user_id=(select id from phase5_fixture where kind='staff');
set local role authenticated;
select pg_temp.assert_ok(not public.phase5_has_capability('crm.read','assigned'),'Removed role still authorized');
select pg_temp.assert_ok(jsonb_array_length(public.phase5_current_permissions()->'grants')=0,'Removed grants retained');
reset role;
-- Controlled operator recovery is atomic; ordinary roles cannot execute these writes.
update public.admin_memberships set role='admin',active=false where user_id=(select id from phase5_fixture where kind='owner');
update public.admin_memberships set role='super_admin' where user_id=(select id from phase5_fixture where kind='other');
update public.agency_owner set user_id=(select id from phase5_fixture where kind='other'),designated_at=now();
set constraints all immediate;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',(select id from phase5_fixture where kind='owner'))::text,true) is not null;
select pg_temp.assert_ok(not public.phase5_is_owner(),'Recovered owner retained access');
select set_config('request.jwt.claims',json_build_object('sub',(select id from phase5_fixture where kind='other'))::text,true) is not null;
select pg_temp.assert_ok(public.phase5_is_owner(),'Recovery denied replacement');
reset role;
rollback;
