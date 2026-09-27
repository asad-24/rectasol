// Optional local PostgreSQL verification. No network, credentials, .env files or
// live Supabase connections. Install PGlite in a temporary directory; see docs.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

if (!process.env.PHASE4_PGLITE_PATH) throw new Error("Set PHASE4_PGLITE_PATH to the temporary PGlite package directory.");
const require = createRequire(import.meta.url);
const { PGlite } = require(path.resolve(process.env.PHASE4_PGLITE_PATH));
const root = new URL("../../", import.meta.url);
const db = new PGlite();
try {
  // Minimal Supabase Auth emulation. This does not verify hosted Auth/PostgREST.
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
  for (const file of [
    "supabase/migrations/202609250001_inquiries.sql",
    "supabase/tests/inquiries.sql",
    "supabase/migrations/202609250002_admin_pipeline.sql",
    "supabase/migrations/202609260001_email_outbox.sql",
    "supabase/migrations/202609260002_brevo_email.sql",
    "supabase/tests/admin_pipeline.sql",
    "supabase/tests/email_outbox.sql",
  ]) {
    if (file.endsWith("202609260002_brevo_email.sql")) {
      await db.exec(`
        insert into public.inquiries(name,email,service,message,request_hash)
        select 'Upgrade fixture','upgrade@example.invalid','web-applications',
          'Synthetic upgrade fixture only.',repeat('a',64) from generate_series(1,3);
        create temporary table upgrade_jobs as
          select id,row_number() over(order by id) as n from public.email_outbox;
        update public.email_outbox set status='processing',attempts=1,
          first_attempt_at=now(),lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes'
          where id in (select id from upgrade_jobs where n=2);
        update public.email_outbox set attempts=1,first_attempt_at=now()
          where id in (select id from upgrade_jobs where n=3);
        update public.email_outbox set status='sent',attempts=1,
          provider_message_id='historical-id',sent_at=now()
          where id in (select id from upgrade_jobs where n=4);
        update public.email_outbox set status='failed',attempts=1,last_error='provider_rejected'
          where id in (select id from upgrade_jobs where n=5);
      `);
    }
    await db.exec(readFileSync(new URL(file, root), "utf8"));
    console.log(`PASS ${file}`);
    if (file.endsWith("202609260002_brevo_email.sql")) {
      const { rows } = await db.query(`select j.n::int, e.provider, e.status, e.last_error,
        e.provider_message_id from public.email_outbox e join upgrade_jobs j using(id) order by j.n`);
      for (const row of rows) {
        const expected = [1,6].includes(row.n) ? "pending" : row.n === 4 ? "sent" : "failed";
        if (row.status !== expected || ([1,6].includes(row.n) !== (row.provider === "brevo"))) {
          throw new Error("Provider upgrade changed historical identity or failed to migrate untouched jobs.");
        }
        if ([2,3].includes(row.n) && row.last_error !== "delivery_uncertain") throw new Error("Attempted job not quarantined.");
        if (row.n === 4 && row.provider_message_id !== "historical-id") throw new Error("Historical acceptance lost.");
      }
      await db.exec("delete from public.inquiries; drop table upgrade_jobs;");
      console.log("PASS provider upgrade preserves history and quarantines attempted jobs.");
    }
  }
  const { rows } = await db.query("select count(*)::int as count from public.inquiries");
  if (rows[0].count !== 0) throw new Error("SQL test did not roll back.");
  console.log("PASS SQL rollback; no live services contacted.");
} catch (error) {
  // Only synthetic local SQL is executed. Do not dump full database objects.
  console.error("Local SQL verification failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
} finally { await db.close(); }
