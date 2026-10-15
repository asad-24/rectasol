begin;

-- Add the new inquiry-status mutation capability to the M1 catalog.
insert into public.staff_capabilities values ('clients.stage','all')
  on conflict (capability, scope) do nothing;

-- Remove legacy broad RLS policies that use is_inquiry_admin().
drop policy if exists admin_inquiry_read on public.inquiries;
drop policy if exists admin_audit_read on public.admin_audit_events;
drop policy if exists admin_email_read on public.email_outbox;

-- INQUIRIES: owner read + staff with clients.read:all.
create policy inquiries_owner_read on public.inquiries for select to authenticated
  using ((select public.phase5_is_owner()));
create policy inquiries_staff_read_all on public.inquiries for select to authenticated
  using ((select public.phase5_has_capability('clients.read','all')));

-- ADMIN AUDIT EVENTS: owner read + staff with clients.read:all.
create policy admin_audit_owner_read on public.admin_audit_events for select to authenticated
  using ((select public.phase5_is_owner()));
create policy admin_audit_staff_read_all on public.admin_audit_events for select to authenticated
  using ((select public.phase5_has_capability('clients.read','all')));

-- EMAIL OUTBOX: owner read + staff with clients.read:all.
create policy email_outbox_owner_read on public.email_outbox for select to authenticated
  using ((select public.phase5_is_owner()));
create policy email_outbox_staff_read_all on public.email_outbox for select to authenticated
  using ((select public.phase5_has_capability('clients.read','all')));

-- CRM: preserve owner policies; add staff reads.
-- crm_contacts
create policy crm_staff_read_all_contacts on public.crm_contacts for select to authenticated
  using ((select public.phase5_has_capability('crm.read','all')));
create policy crm_staff_read_assigned_contacts on public.crm_contacts for select to authenticated
  using ((select public.phase5_has_capability('crm.read','assigned')) and assigned_to = (select auth.uid()));

-- crm_companies
create policy crm_staff_read_all_companies on public.crm_companies for select to authenticated
  using ((select public.phase5_has_capability('crm.read','all')));
create policy crm_staff_read_assigned_companies on public.crm_companies for select to authenticated
  using ((select public.phase5_has_capability('crm.read','assigned')) and assigned_to = (select auth.uid()));

-- crm_opportunities
create policy crm_staff_read_all_opportunities on public.crm_opportunities for select to authenticated
  using ((select public.phase5_has_capability('crm.read','all')));
create policy crm_staff_read_assigned_opportunities on public.crm_opportunities for select to authenticated
  using ((select public.phase5_has_capability('crm.read','assigned')) and assigned_to = (select auth.uid()));

-- crm_contact_companies: all-scope only (no trustworthy direct assignment relationship).
create policy crm_staff_read_all_contact_companies on public.crm_contact_companies for select to authenticated
  using ((select public.phase5_has_capability('crm.read','all')));

-- crm_inquiry_links: all-scope only.
create policy crm_staff_read_all_inquiry_links on public.crm_inquiry_links for select to authenticated
  using ((select public.phase5_has_capability('crm.read','all')));

-- crm_audit_events: all-scope only.
create policy crm_staff_read_all_audit_events on public.crm_audit_events for select to authenticated
  using ((select public.phase5_has_capability('crm.read','all')));

-- Rewrite admin_list_inquiries with capability authorization.
create or replace function public.admin_list_inquiries(p_search text default '', p_status text default '', p_page integer default 1)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_total bigint; v_items jsonb;
begin
  if not (select public.phase5_is_owner() or public.phase5_has_capability('clients.read','all')) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
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

-- Rewrite admin_inquiry_counts with explicit capability authorization.
create or replace function public.admin_inquiry_counts() returns table(status text,total bigint)
language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.phase5_is_owner() or public.phase5_has_capability('clients.read','all')) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query select i.status,count(i.id) from public.inquiries i group by i.status order by i.status;
end;
$$;
revoke all on function public.admin_inquiry_counts() from public,anon,authenticated,service_role;
grant execute on function public.admin_inquiry_counts() to authenticated;

-- Rewrite admin_change_inquiry_status with clients.stage:all authorization.
create or replace function public.admin_change_inquiry_status(p_id uuid, p_status text, p_revision bigint)
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
  if not (select public.phase5_is_owner() or public.phase5_has_capability('clients.stage','all')) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
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

-- Inquiry -> CRM conversion RPC.
-- Produces: contact (if no active contact with same normalized email exists)
--           + crm_inquiry_links row.
-- Does NOT create an opportunity or change inquiry status.
create or replace function public.convert_inquiry_to_crm(p_inquiry_id uuid)
returns jsonb language plpgsql security definer set search_path = '' set statement_timeout = '10s' set lock_timeout = '5s' as $$
declare
  v_actor uuid := auth.uid();
  v_inquiry public.inquiries;
  v_contact public.crm_contacts;
  v_link public.crm_inquiry_links;
  v_normalized_email text;
begin
  -- 1. Lock membership against concurrent revocation.
  perform 1 from public.admin_memberships where user_id = v_actor
    and active and role in ('admin','super_admin') for share;
  if not found then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if not (select public.phase5_is_owner() or public.phase5_has_capability('clients.convert','all')) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- 2. Lock inquiry row.
  select * into v_inquiry from public.inquiries where id = p_inquiry_id for update;
  if not found then
    return jsonb_build_object('outcome','not_found');
  end if;

  -- 3. Defensive email requirement.
  if v_inquiry.email is null or btrim(v_inquiry.email) = '' then
    return jsonb_build_object('outcome','no_email');
  end if;
  v_normalized_email := lower(btrim(v_inquiry.email));

  -- 4. Idempotency: if a link already exists, do not duplicate.
  if exists (select 1 from public.crm_inquiry_links where inquiry_id = p_inquiry_id) then
    return jsonb_build_object('outcome','already_converted');
  end if;

  -- 5. Reuse active contact with the same normalized email, if any.
  select * into v_contact from public.crm_contacts
    where email = v_normalized_email and archived_at is null
    for share;
   if not found then
    -- 5a. A concurrent conversion may have created an active contact with the
    --     same normalized email after our SELECT. Re-evaluate before classifying
    --     as archived_conflict.
    begin
      insert into public.crm_contacts(full_name,email,phone,source,lifecycle)
      values (btrim(v_inquiry.name), v_normalized_email, null, 'website_inquiry', 'lead')
      returning * into v_contact;
    exception when unique_violation then
      select * into v_contact from public.crm_contacts
        where email = v_normalized_email and archived_at is null
        for share;
      if not found then
        return jsonb_build_object('outcome','archived_conflict','email',v_normalized_email);
      end if;
    end;
  end if;

  -- 6. Create immutable inquiry link.
  insert into public.crm_inquiry_links(inquiry_id, contact_id)
  values (p_inquiry_id, v_contact.id)
  returning * into v_link;

  return jsonb_build_object(
    'outcome','converted',
    'contact_id', v_contact.id,
    'inquiry_link_id', v_link.inquiry_id
  );
end;
$$;
revoke all on function public.convert_inquiry_to_crm(uuid) from public,anon,authenticated,service_role;
grant execute on function public.convert_inquiry_to_crm(uuid) to authenticated;

-- Legacy is_inquiry_admin() may remain defined for compatibility, but
-- authenticated EXECUTE is revoked. M3 application/RLS/RPC authorization
-- no longer relies on it.
revoke execute on function public.is_inquiry_admin() from authenticated;
revoke execute on function public.is_inquiry_admin() from anon, public, service_role;

commit;
