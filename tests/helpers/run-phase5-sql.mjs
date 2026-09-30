// Uses only the already-installed local PGlite test runtime. In-memory database;
// no URL, persistent data directory, environment files or network connections.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

if (!process.env.PHASE5_PGLITE_PATH) throw new Error("An existing local PGlite installation is required.");
const require = createRequire(import.meta.url);
const { PGlite } = require(path.resolve(process.env.PHASE5_PGLITE_PATH));
const db = new PGlite();
const root = new URL("../../", import.meta.url);
const run = async file => {
  await db.exec(readFileSync(new URL(file, root), "utf8"));
  console.log(`PASS ${file}`);
};
try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
    $$;
    grant usage on schema auth to anon,authenticated,service_role;
  `);
  for (const file of ["202609250001_inquiries.sql", "202609250002_admin_pipeline.sql",
    "202609260001_email_outbox.sql", "202609260002_brevo_email.sql"]) {
    await run(`supabase/migrations/${file}`);
  }
  await db.exec(`
    insert into auth.users(id) values(gen_random_uuid());
    insert into public.admin_memberships(user_id,role) select id,'super_admin' from auth.users;
    insert into public.inquiries(name,email,service,message,request_hash)
      values('Preservation fixture','fixture@example.invalid','web-applications',
        'Synthetic preservation fixture only.',repeat('a',64));
    insert into public.admin_audit_events(actor_user_id,entity_type,entity_id,event_type,previous_status,new_status)
      select m.user_id,'inquiry',i.id,'status_changed','new','contacted'
      from public.admin_memberships m cross join public.inquiries i;
  `);
  const snapshot = async () => (await db.query(`select
    (select jsonb_agg(to_jsonb(t)) from public.admin_memberships t) members,
    (select jsonb_agg(to_jsonb(t)) from public.inquiries t) inquiries,
    (select jsonb_agg(to_jsonb(t)) from public.admin_audit_events t) audit,
    (select jsonb_agg(to_jsonb(t) order by id) from public.email_outbox t) email`)).rows;
  const before = await snapshot();
  await run("supabase/migrations/202609300001_phase5_access.sql");
  assert.deepEqual(await snapshot(), before);
  console.log("PASS migration preserves membership, inquiry, audit and email records.");
  // Still pre-bootstrap; remove only synthetic fixtures before rollback-only suites.
  await db.exec("delete from public.admin_audit_events; delete from public.inquiries; delete from public.admin_memberships; delete from auth.users;");
  for (const name of ["inquiries", "admin_pipeline", "email_outbox", "phase5_access"]) {
    await run(`supabase/tests/${name}.sql`);
  }
  assert.equal((await db.query("select user_id from public.agency_owner")).rows[0].user_id, null);
  assert.equal((await db.query("select count(*)::int as n from public.admin_memberships")).rows[0].n, 0);
  console.log("PASS rollback; all state was disposable and local. Hosted Auth and concurrency are not emulated.");
} catch (error) {
  console.error("Local SQL verification failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
} finally { await db.close(); }
