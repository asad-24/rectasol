-- NON-PRODUCTION ONLY. Run after the migration in the Supabase SQL editor.
-- Test mutations are rolled back, including temporary clearing of protection state.
begin;
do $$
declare t text; r text;
begin
  foreach t in array array['inquiries','inquiry_submissions','inquiry_rate_buckets'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'RLS disabled: %', t;
    end if;
    foreach r in array array['anon','authenticated'] loop
      if has_table_privilege(r, 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE') then
        raise exception 'Unexpected public table permissions: % / %', r, t;
      end if;
    end loop;
  end loop;
  foreach r in array array['anon','authenticated'] loop
    if has_function_privilege(r, 'public.submit_inquiry(jsonb,uuid,text,text,text)', 'EXECUTE') then
      raise exception 'Unexpected public RPC permission: %', r;
    end if;
  end loop;
end;
$$;
set local role service_role;
delete from public.inquiry_rate_buckets;
do $$
declare
  payload jsonb := jsonb_build_object('name','Test Inquiry','email','test@example.invalid',
    'company',null,'service','web-applications','budget',null,'timeline','Test only',
    'message','Non-production transaction rollback verification.');
  submission uuid := gen_random_uuid();
  hash text := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  email_hash text := repeat('e',64);
  result jsonb;
  receipt text;
begin
  result := public.submit_inquiry(payload,submission,hash,email_hash,null);
  if result->>'outcome' <> 'created' then raise exception 'Create failed: %',result; end if;
  receipt := result->>'reference';
  if receipt !~ '^INQ-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Unsafe receipt';
  end if;
  result := public.submit_inquiry(payload,submission,hash,email_hash,null);
  if result->>'outcome' <> 'replayed' or result->>'reference' <> receipt then raise exception 'Replay failed'; end if;
  result := public.submit_inquiry(payload,gen_random_uuid(),hash,email_hash,null);
  if result->>'outcome' <> 'replayed' or result->>'reference' <> receipt then raise exception 'Duplicate failed'; end if;
  result := public.submit_inquiry(payload,submission,repeat('a',64),email_hash,null);
  if result->>'outcome' <> 'conflict' then raise exception 'Conflict failed'; end if;
  result := public.submit_inquiry(payload,submission,hash,email_hash,null);
  if result->>'outcome' <> 'replayed' then raise exception 'Fifth attempt failed'; end if;
  result := public.submit_inquiry(payload,submission,hash,email_hash,null);
  if result->>'outcome' <> 'rate_limited' then raise exception 'Email limit failed'; end if;
  if (select count(*) from public.inquiries where request_hash = hash) <> 1 then raise exception 'Duplicate rows'; end if;
  if not exists(select 1 from public.inquiries where public_reference = receipt and status = 'new' and source = 'website') then
    raise exception 'Invalid defaults';
  end if;
end;
$$;
rollback;
