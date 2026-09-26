# Phase 3: secure inquiry administration

## Architecture

The public marketing pages now live under the `(marketing)` route group; their URLs and contents are unchanged. Their layout owns the existing navigation, footer, preloader and animation providers. The common root retains fonts/styles/metadata only. The separate `/admin` application does not load those marketing providers.

Admin authentication uses Supabase Auth and `@supabase/ssr`. There is no browser Supabase client in Phase 3: login/logout and status changes are server actions. Sessions use HTTP-only cookies scoped to `/admin`, SameSite=Lax and Secure in production. The publishable key is used by a session-aware server client; the Phase 2 secret-key insertion client is separate and unchanged.

`src/proxy.ts` matches only `/admin/:path*`, refreshes/verifies sessions with `getClaims()` and forwards refreshed cookies to both the request and response. It adds no-store, noindex, no-referrer and anti-framing headers. It is not the authorization boundary. Page/data guards verify the current Auth user using `getUser()`, then query their active database membership. Every status action independently repeats these checks, and the database mutation rechecks membership.

React's request-scoped cache deduplicates the page/layout guards. No shared cross-user cache is used for admin data. Queries use the authenticated session and RLS, never the privileged inquiry client. Each fetch has a ten-second timeout. Database errors are replaced with fixed safe messages, without logging credentials, sessions or inquiry contents.

## Required configuration

Keep all existing Phase 2 variables. Add this **empty example placeholder**, filling the real value only in the ignored local environment or deployment secret manager:

- `SUPABASE_PUBLISHABLE_KEY`: the **publishable key** from the same Supabase project's Connect / API Keys settings. A legacy **anon** JWT key is also supported. A secret/service_role key is rejected by this configuration parser.

The existing `SUPABASE_URL` must be the project origin, with no API path. `SITE_URL` must exactly match the browser's origin for server-action origin validation. Use the appropriate localhost origin for development and the actual HTTPS deployment origin for production. Do not set `NEXT_PUBLIC_SUPABASE_SECRET_KEY`. No new NEXT_PUBLIC variables are needed because authentication stays on the server; the new key is browser-safe in principle but is not sent to the browser by this implementation.

Restart the development server after configuration changes. No environment values are printed by the application. Do not commit `.env.local`.

## Manual Supabase setup

Perform the first verification in a **non-production** project:

1. Back up the database and confirm the Phase 2 migration is already applied. Execute **only the new** `supabase/migrations/202609250002_admin_pipeline.sql` in the SQL editor, or use your existing Supabase migration workflow. Do not rerun or edit the deployed Phase 2 migration.
2. Verify the new membership/audit tables have RLS enabled and inquiries now has a `revision` column. No anonymous access policy is added.
3. In Authentication settings, enable email/password authentication and **disable new public user signups**. No signup UI/API is provided by this app, but the upstream Auth signup setting must also be disabled. Configure appropriate password security, session expiry, and Auth rate limits.
4. In Authentication → Users → Add user, **create** the first administrator using a privately chosen email and strong password. Confirm the account through the trusted dashboard flow. No app invite/password-reset callback is included in this phase, so use dashboard-created, confirmed password accounts. Deliver credentials through your approved private channel; never paste them into source files or chat.
5. Copy that account's Auth user UUID. Assign membership in the SQL editor while signed in as the project owner. Replace the placeholder **only in the dashboard**, not in a checked-in file:

   ```sql
   insert into public.admin_memberships (user_id, role, active)
   values ('<AUTH_USER_UUID>'::uuid, 'super_admin', true);
   ```

   Both admin roles have the same inquiry permissions in Phase 3. Neither can assign roles through the application or public API. Use controlled project-owner SQL to provision another membership, change its role, or set `active = false`. There is no automatic email allowlist, user-metadata authorization or signup trigger.
6. Set the new environment variable locally, start `npm run dev`, and visit `/admin/login`. Sign in with the privately created account. Confirm the dashboard and inquiry list reflect real existing records.
7. Create a separate non-production Auth user **without membership**. Verify it cannot sign in to the workspace or read data through the authenticated Data API. Existing logged-in non-admin sessions should be directed to `/admin/access-denied`. Signed-out sessions must be redirected to login.
8. Open one synthetic inquiry, change its status, and check `admin_audit_events`: actor ID, inquiry ID, previous/new statuses and time must match. Verify only status, revision and updated_at changed on the inquiry. Use two browser sessions on the same revision to confirm the second conflicting change is rejected and refreshed.
9. Run `supabase/tests/admin_pipeline.sql` **in non-production only**. It creates temporary synthetic Auth users without credentials and a synthetic inquiry inside a transaction; all changes roll back. It verifies RLS/grants, non-admin denial, self-promotion denial, admin read/update, one audit record, stale/no-op behavior, invalid statuses, direct-write denial, audit deletion denial and revoked membership denial. Inspect custom auth.users triggers before running this in an existing test project.
10. Verify session refresh, page reload, logout, expired sessions, disabled memberships and mobile/keyboard flows in the real browser. Also submit a synthetic **public** contact inquiry to confirm Phase 2 still works after the new migration.
11. Apply the same reviewed migration/configuration and controlled bootstrap in production only after those checks pass. Do not copy non-production credentials into production.

## Database security

- `admin_memberships` references auth.users. Users may read only their own membership through RLS; they have no write grants. Role/active state is trusted database data, never user-editable Auth metadata.
- `is_inquiry_admin()` is SECURITY DEFINER only to read membership safely without recursive RLS. It has an empty search_path, takes no caller identity argument and evaluates only auth.uid(). EXECUTE is granted only to authenticated.
- Inquiry SELECT is limited to explicitly allowed columns and an admin-only RLS policy. `request_hash`, submission keys and rate data remain inaccessible to authenticated users. There are no authenticated direct INSERT/UPDATE/DELETE grants.
- The bounded list and metrics RPCs are SECURITY INVOKER, retaining grants/RLS. Search is a literal parameterized substring across contact/reference fields; it is not interpolated SQL or PostgREST filter syntax. Lists return at most 25 rows, page is bounded at 10,000, search at 80 characters, and sort is created_at/id descending.
- `admin_change_inquiry_status` is SECURITY DEFINER to allow a narrow audited update without granting arbitrary table writes. It has an empty search_path, derives the actor from auth.uid(), locks/checks active membership, validates the six existing statuses and locks the inquiry row.
- An optimistic revision prevents stale overwrites. A successful change increments revision and triggers updated_at. A repeat with an old revision conflicts; a same-status no-op creates no audit event. Update and audit insertion commit or roll back together.
- `admin_audit_events` is append-only through the restricted mutation path. Admins can read it but cannot insert/update/delete it directly. It records UUID identifiers and status values only, not copied emails/messages, tokens or IPs. Actor/entity UUIDs are retained without cascade deletion for historical accountability. A project owner can still maintain the database; this is not cryptographic tamper-proof storage.
- The original `submit_inquiry` function, rate protection, insertion grants and Phase 2 migration are unchanged. The new revision column defaults to zero, so existing public inserts continue to work.

## Routes and behavior

| Route | Purpose |
| --- | --- |
| `/admin/login` | Password sign-in, generic safe feedback, no signup |
| `/admin/access-denied` | Safe non-admin explanation and sign-out |
| `/admin` | Real total/status counts and five recent inquiries |
| `/admin/inquiries` | Literal search, six-status filter, 25-row pagination |
| `/admin/inquiries/[id]` | Validated internal UUID; contact/project details, status form, latest 25 audit events |

The public reference is prominently displayed; internal inquiry UUIDs are appropriate for authorized admin links and are never treated as permission. Detail responses exclude security fields. All times display UTC. The audit view identifies admins by stable Auth UUID, which the project owner can map to users in the Supabase dashboard.

Mutations use POST server actions with Next.js Origin/Host checks plus an exact SITE_URL origin check. Redirect destinations are fixed internal routes; no caller-controlled next/return URL is accepted. Forms reject unknown and repeated application fields. Only the intended three RPC arguments (inquiry ID, status, expected revision) are sent. The UI disables pending actions and refreshes after changes/conflicts. Status changes are reversible and audited, so there is no destructive-action confirmation dialog.

## Verification and operating limits

- Run `npm test`, `npm run lint -- --no-cache`, `npx tsc --noEmit --incremental false`, `git diff --check`, and a production build with the proper SITE_URL.
- Automated tests use injected Auth/database clients. They verify server guards, role checks, action origin rejection, strict field/query validation, mutation argument whitelisting, safe errors, stale outcomes, cookie chunk handling and proxy cache headers. They do **not** prove deployed RLS, real sign-in or audit persistence.
- The SQL smoke test is the database verification layer and is run manually in non-production. The migration and controlled first-admin bootstrap have been completed manually; live verification results are recorded below.
- Configure platform/WAF throttling for `/admin` POST requests and Supabase Auth rate limits. The application uses Supabase's Auth protection rather than adding an in-memory limiter or a new vendor. Behind server actions, Auth may see the application server's IP; do not assume per-visitor IP limits without a reviewed hosting setup.
- Ensure your reverse proxy preserves the public origin/host and does not cache admin pages, RSC responses, actions or Set-Cookie responses. Do not log request bodies, cookies or search query strings containing contact information.
- Logout clears this device's admin cookies even when Auth is unavailable. Supabase access tokens may remain valid until their expiry; immediate administrative revocation is the membership active flag, enforced on each data operation and mutation. Adopt appropriate JWT/session durations.
- Metrics/search count real rows and may need database indexing/aggregation work at larger scale. Recent history is bounded to 25 events; older audit entries remain in the database. This phase has no full audit explorer or team management UI.
- MFA enforcement, invitation/password-reset UX, team provisioning UI, advanced audit retention and infrastructure throttling are future security/operations work. No client portal, projects, payments, email workflows, file storage or analytics product was added.

References: [Supabase SSR guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Next.js authentication](https://nextjs.org/docs/app/guides/authentication), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Implementation verification record

The isolated Next.js 16 production webpack build passed. All 19 public URLs listed in the sitemap returned successfully, robots.txt worked, and service-to-contact preselection was verified. All eight moved public page files match their committed originals. The Phase 2 API/form/server utilities and deployed migration remain unchanged.

Browser verification against a temporary in-memory Auth/Data API simulator passed for non-admin rejection, admin login, dashboard/list display, HTTP-only/Secure admin cookies, status change, audit-history rendering, reload, mobile page width, logout and post-logout denial. No live Supabase requests or persistent records were involved. These browser checks validate application integration, not deployed database security.

Final automated verification passed: all 28 Phase 1/2/3 tests, TypeScript, ESLint, `git diff --check`, and the Next.js 16 production build. The final build used a process-only synthetic HTTPS `SITE_URL` without editing local configuration. The only production-build warning concerns existing lockfiles above this repository; those files were not changed.

Live Supabase verification completed successfully:

- The Phase 3 migration was applied, email/password authentication was enabled, and public signup was disabled.
- The first Super Admin was bootstrapped through controlled manual setup. Local `SUPABASE_PUBLISHABLE_KEY` configuration and Super Admin login were verified.
- `/admin` displayed real database data; `/admin/inquiries` and `/admin/inquiries/[id]` were verified.
- The temporary detail-route 404 was caused by stale Next.js development route discovery and disappeared after a full dev-server restart. No application routing, query, or RLS defect was found; no additional migration was required.
- A New -> Contacted status mutation succeeded. Status history appeared in the admin UI, and the corresponding `admin_audit_events` record was verified directly in Supabase.
- An authenticated non-admin was denied access. Setting the Super Admin membership to `active=false` denied access; restoring `active=true` restored access.

These live checks are separate from the simulator checks above. They do not assert execution of the full SQL smoke-test script or live session-expiry/refresh tests. Real configuration values remain only in the ignored local environment or deployment secret manager.
