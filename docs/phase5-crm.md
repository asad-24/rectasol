# Phase 5, M1: owner invariant and permission foundation

## Scope and compatibility

M1 adds a dormant capability foundation. It does not implement CRM records,
staff invitations, role-management actions, client access or M2-M8. Existing
admin guards, inquiry RPCs/RLS and email workflows are unchanged. No database
has been provisioned or migrated by this change.

**Do not onboard restricted staff yet.** The old `admin` membership still grants
broad inquiry access through Phase 3. M3 must replace every affected database
policy, read/count RPC and mutation authorization path before restricted staff
can use the application. Hiding navigation does not provide that cutover.

The original owner bootstrap in `phase3-admin.md` creates a manually verified
`super_admin` membership. It did not enforce uniqueness. M1 does not assume the
existing member count, choose a UUID, promote an admin, or rewrite memberships.

## Migration and pre-bootstrap state

Apply `202609300001_phase5_access.sql` after all four existing migrations through
the established operator workflow, after review and an isolated rehearsal.
This implementation does not apply it to any hosted or persistent database.

New objects:

- `agency_owner`: one permanent control row, initially with NULL user/time.
- `staff_capabilities`: explicit valid capability/scope pairs.
- `staff_roles`: sales, project, finance, content and support catalog.
- `staff_role_permissions`: FK-constrained capability/scope grants.
- `staff_role_assignments`: membership-to-role links.

The catalog starts without role permissions or user assignments. All new
permission helpers deny before activation. Existing Phase 3 behavior remains
available independently. Existing duplicate legacy super_admin memberships do
not prevent the additive migration, but they prevent activation.

The control row cannot be deleted/truncated, and activation cannot be reset to
NULL. Membership changes serialize on that row. Deferred constraint triggers
require, after activation, exactly one super_admin membership (including inactive
members in the count), matching the designated user and active. They reject
demotion, deletion, deactivation and a second super_admin at constraint checking
or commit. The Auth FK also restricts deletion of the designated Auth identity.
TRUNCATE of memberships is rejected rather than bypassing row constraints.

Database owners can deliberately disable/drop controls; this design does not
claim to constrain a PostgreSQL superuser. Use controlled operator access.

## Explicit owner activation: operator only

1. Back up and verify restore procedures. Confirm the target database/project
   out of band. Review migration inventory and existing membership roles.
2. Independently verify the agency owner's existing Supabase Auth identity and
   that its active membership is `super_admin`. Do not choose the first row,
   derive identity from email domain, or trust user metadata.
3. If there is no matching membership, multiple super_admin memberships, or any
   uncertainty, STOP. Resolve identity/membership explicitly through the trusted
   operator process before continuing. The bootstrap function will not promote
   an ordinary admin, insert a membership, or silently demote another user.
4. Supply the verified UUID as a bound operator parameter. Never put personal
   identifiers in a migration, test fixture, chat or committed document.
5. Run the following transaction as the migration-owning database operator.
   This is a **psql variable template**, not executable SQL until the operator
   privately supplies `verified_owner_uuid`. Other clients should use a bound
   UUID parameter in the SELECT instead.

```sql
begin;
select public.phase5_bootstrap_owner(:'verified_owner_uuid'::uuid);
set constraints all immediate;
commit;
```

The function is SECURITY INVOKER and has no EXECUTE grants for PUBLIC, anon,
authenticated or service_role. A logged-in application Super Admin cannot call
it. Calling it twice fails safely, even for the same user. A failed transaction
must be rolled back; do not continue issuing commands in an aborted transaction.

Activation does not enable new staff flows. It allows the designated owner to
receive the finite capability catalog from the M1 read helpers.

## Permission contract and security boundaries

`src/lib/admin/permissions.ts` defines the shared typed vocabulary. The SQL
catalog is the database allowlist; tests compare the two. Global capabilities
(`workspace.access`, `crm.intake`, `crm.create`) accept only `all`. Record-scoped
capabilities support `assigned` and `all`. An `all` grant satisfies `assigned`;
an `assigned` grant never satisfies `all`. Unknown pairs deny even for owners.

The session-aware client may execute:

- `phase5_is_owner()`: designated identity AND active super_admin membership.
- `phase5_current_permissions()`: current JWT user only, no identity argument.
- `phase5_has_capability(capability, scope)`: current user's active role grants.

`getCurrentPermissions(client)` first verifies Auth with `getUser()`, then
validates the database projection and requires its user ID to match. It fails
closed on malformed data, expired identity, inactive membership, missing
migration or database outage. It never reads user metadata as authority and
does not cache across requests. Errors expose only fixed result categories.

`hasCurrentCapability(client, {capability, scope})` checks an explicit scope.
**Assigned scope is an entitlement, not proof that a particular record is
assigned to the caller.** Future mutation RPCs must check the record relationship
and lock/recheck membership in the same transaction. M1 has no record mutations
and does not offer an authorization snapshot as a reusable mutation credential.

All new tables have RLS. Authenticated users have SELECT only, limited by owner
policies. Ordinary staff obtain only their own permission projection through
the helper; they cannot enumerate the owner or other staff assignments. No
application role, including service_role, receives table writes. Owners do not
get direct writes either. Catalog editing and role-management RPCs are deferred
to reviewed later milestones, so M1 introduces no self-promotion path.

Role deactivation or assignment removal affects subsequent helper calls. Access
already returned to a browser cannot be recalled. Existing Phase 3 revocation
semantics are unchanged. The embedded SQL runner is sequential. Use the native
PostgreSQL runner below for the independently verified multi-session schedules.

## Controlled owner recovery

There is no application recovery endpoint or automatic second-owner creation.
Prefer recovery of the existing Auth account through a verified operator
process. For an unavoidable identity replacement:

1. Verify ownership offline, preserve recovery evidence and back up first.
2. Independently verify the replacement Auth identity and membership. Stop if
   either identity is uncertain. No UUID is hardcoded in this procedure.
3. As the database operator, begin a transaction, keep constraints deferred,
   lock `admin_memberships` in SHARE ROW EXCLUSIVE mode, then lock the singleton
   row FOR UPDATE. Use this lock order consistently.
4. With bound UUID parameters, demote/deactivate the old owner membership,
   promote the verified replacement membership, and change the singleton's
   user/time. Check affected-row counts rather than assuming success.
5. Force all constraints IMMEDIATE and commit only after verification. The
   transaction must finish with exactly one active matching super_admin.
6. Through the approved Auth operation, revoke the old identity's sessions and
   complete account recovery/security checks. Record the operation in the
   restricted operational audit log; generalized in-app audit is not in M1.

Do not remove the control row, disable triggers, clear activation, or grant the
application arbitrary membership/owner writes to accomplish recovery.

## Local verification

Application checks (none load `.env.local`):

```text
node --test --experimental-test-isolation=none tests/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js src tests
```

The optional `tests/helpers/run-phase5-sql.mjs` accepts only the path to an
already-installed local PGlite package via `PHASE5_PGLITE_PATH`. It creates an
in-memory disposable database with synthetic Auth roles/users, runs the four
existing migrations and M1, checks byte-for-byte JSON projections of preserved
business records, and executes Phase 2/3/4/M1 SQL suites. It accepts no database
URL or persistent data directory and makes no external requests. No package
installation is necessary or performed. Do not run the fixture SQL on hosted
databases; it is for this isolated local harness only.

```powershell
$env:PHASE5_PGLITE_PATH = Join-Path $env:TEMP 'rectasol-phase4-sql-check/node_modules/@electric-sql/pglite'
node tests/helpers/run-phase5-sql.mjs
```

The tests cover dormant activation, singleton constraints, wrong/ambiguous
bootstrap identity, role escalation, direct writes, inactive membership/role,
scope widening, RLS/grants, owner protection, controlled recovery, rollback and
legacy inquiry/email compatibility. This does not prove hosted Supabase Auth,
PostgREST or concurrent sessions.

Never run the ordinary build in the working tree under a no-secret-read rule:
Next.js loads local environment files. Use an isolated allowlisted source copy
without environment files, an explicit synthetic SITE_URL and mocked font
responses to avoid network requests. Such a build verifies compilation and
prerendering, not real font downloads or deployment credentials.

## Deployment and rollback

Deploy only after explicit operator authorization and identity verification.
Before activation, the new helpers deny and old code continues independently.
After activation, preserve owner constraints even if application code is rolled
back. Do not remove M1 tables/triggers as an automatic rollback, clear owner
identity, or delete existing inquiry/email data. Use a reviewed forward fix.

M3 must complete the authorization cutover before assigning restricted staff.
Owner MFA and invitation delivery belong to their approved later milestone;
M1 adds no new owner mutation surface that relies on an unenforced MFA promise.

After activation, the old Phase 3 manual test that deactivates a Super Admin
must use an ordinary staff fixture instead: deactivating the designated owner
now intentionally fails the owner invariant. Use the recovery procedure for
replacement of that identity.

## Initial local verification record (2026-09-30)

- All 60 application tests passed (53 existing tests and seven M1 tests).
- TypeScript without incremental output and ESLint over src/tests passed.
- The already-installed local PGlite runtime passed all five migrations,
  Phase 2/3/4/M1 SQL suites, preservation assertions and rollback checks using
  only an in-memory database and synthetic identities.
- An isolated Next.js production webpack build passed with a synthetic HTTPS
  SITE_URL and mocked Google Font responses. No environment files were copied.
  The initial default-worker attempt hit Windows spawn EPERM; the successful
  retry used worker threads, one CPU, disabled webpack build workers and an
  explicit tracing root in the temporary copy only. Repository configuration
  was not changed. Real font delivery was not tested.
- All seven new files passed whitespace/conflict-marker checks. Existing
  tracked files are unchanged; the untracked node file remains zero bytes.
- No owner identity was selected, no hosted database was contacted, and no
  migration was deployed. Real Auth/PostgREST and multi-session concurrency
  remain outside these local verification results.

## Native PostgreSQL concurrency verification

Run the saved harness with a locally installed PostgreSQL binary directory:

```powershell
$env:PHASE5_PG_BIN = 'C:\Program Files\PostgreSQL\18\bin'
node tests/helpers/run-phase5-concurrency.mjs
```

The runner accepts no connection URL, password, existing data directory or port.
It initializes a new cluster under a unique temporary directory, binds only to
127.0.0.1 on an automatically selected port other than 5432, verifies the actual
server data directory, and creates synthetic Auth users and roles. Local trust
authentication applies only to this disposable cluster containing test data.
The child environment excludes inherited PG credentials and default password/
service files; psql runs with `-X -w`. Nothing reads application environment files.
No package downloads, Supabase calls or real owner activation occur.

Each competing transaction uses its own persistent psql process and distinct
PostgreSQL backend PID. Where a scenario requires blocking, the harness checks
`pg_blocking_pids` before releasing the competing transaction. This is genuine
native PostgreSQL concurrency, not queued operations on PGlite. Assertions check
SQLSTATEs and the committed singleton/membership invariant after every scenario.
Statement, lock and harness timeouts bound failures. The runner stops its own
cluster in a finally block and retains synthetic data/logs in its unique temp
directory; it never modifies or stops the installed server on port 5432.

### Verified results: PostgreSQL 18.6

All four existing SQL suites passed on the native engine. All 12 concurrency
scenarios passed:

1. Two owner activations: first commits, second is rejected.
2. Two owner activations: first rolls back, second succeeds.
3. Competing activation with a different non-owner candidate is rejected.
4. Two direct owner replacements fail the deferred membership invariant.
5. Concurrent unauthorized replacement/self-promotion are denied.
6. Two owner deactivations both fail at commit.
7. Concurrent unauthorized role assignment/permission insertion are denied.
8. Rejected owner deactivation releases a legitimate staff revocation.
9. Role deactivation and staff revocation overlap without retaining access.
10. Competing recovery operations: valid replacement commits, stale replacement
    fails and leaves the first replacement intact.
11. A repeatable-read snapshot predating recovery cannot write stale membership
    state; PostgreSQL returns `40001` and the transaction is rolled back.
12. Deliberately inverted operator lock ordering creates `40P01`; PostgreSQL
    aborts one transaction, the survivor commits, and the owner remains valid.

Expected rejections were `23514` (owner invariant/activation), `42501`
(insufficient privilege), `40001` (serialization failure), and `40P01` (the
deliberately induced deadlock). No unexpected deadlock or timeout occurred in
the successful full run. Follow the documented recovery lock order; on a
deadlock/serialization error, roll back and re-read state before deciding whether
to retry the entire operation. A stale recovery must not be retried blindly.

Native testing found a test portability issue, not a protection failure:
PostgreSQL 18 rejects deletion of the referenced owner Auth row with `23001`
(`restrict_violation`); the embedded engine returns `23503`. The M1 SQL test now
accepts either of those specific rejection codes. Production SQL is unchanged.

These results cover the recorded schedules under READ COMMITTED and the explicit
REPEATABLE READ conflict case. They do not prove every transaction interleaving,
hosted Supabase Auth/PostgREST behavior, or future M3 mutation authorization.
Restricted staff onboarding remains blocked until the M3 permission cutover.

# Phase 5 M2 — CRM Records & Audit

## Scope and purpose

M2 adds the CRM data foundation as operator-maintained tables only. It does not
expose mutation APIs, admin pages, client portal access, inquiry conversion,
notes/follow-ups, proposals, contracts, projects, invoices, payments, MFA, or
restricted-staff authorization. Existing inquiry submission, Brevo outbox and
Phase 3 admin behavior are unchanged.

The migration is intended to be reviewed and applied by a database operator in
an isolated rehearsal before any live deployment. No migration has been applied
to hosted Supabase by this implementation, and no real owner has been activated
for CRM access.

## Implemented tables

Six tables provide the CRM record foundation:

- `public.crm_contacts` — people records with lifecycle, contact details and
  assignment.
- `public.crm_companies` — organization records with lifecycle and assignment.
- `public.crm_contact_companies` — many-to-many relationships between contacts
  and companies, with primary-contact semantics and employment end dates.
- `public.crm_opportunities` — deal records linked to a contact and optional
  company, with pipeline stage, value and close tracking.
- `public.crm_inquiry_links` — immutable links between existing inquiries and
  contacts.
- `public.crm_audit_events` — transactional, immutable audit history for CRM
  record changes.

## Relationship model

`crm_contact_companies` implements a many-to-many relationship. Each row stores
a `contact_id`, `company_id`, optional `job_title`, `is_primary` flag and
optional `ended_at` timestamp. The unique constraint on `(company_id, contact_id)`
prevents duplicates. A partial unique index on `company_id` where `is_primary`
ensures at most one primary contact per company.

`crm_opportunities` references a required `contact_id` and an optional `company_id`.
When `company_id` is supplied, a foreign key on `(company_id, contact_id)` enforces
that the opportunity’s contact is currently affiliated with that company through
`crm_contact_companies` with `ended_at IS NULL`. This prevents opportunities from
pointing to stale relationships.

`crm_inquiry_links` links an existing `inquiry_id` to a `contact_id`. The table
is immutable: inserts are allowed, but updates are rejected. A unique constraint
on `(inquiry_id, contact_id)` prevents duplicate links. The inquiry itself is
protected by a foreign key with `ON DELETE RESTRICT`, so existing inquiry records
cannot be removed through the CRM schema.

Assignments use `assigned_to` referencing `public.admin_memberships(user_id)`.
When an assignment target is inserted or changed, the trigger validates that the
target membership exists and is active. When a membership is deleted, any
`assigned_to` reference is cleared to `NULL` automatically by the foreign key
`ON DELETE SET NULL`.

## CRM lifecycle

### Contacts

The supported contact lifecycle and transitions are:

```
lead → qualified → client → former_client
```

Reverse and reactivation transitions:

- `qualified` → `lead`
- `qualified` → `client`
- `client` → `former_client`
- `former_client` → `client`
- `former_client` → `qualified`

Any other transition raises an exception. The initial lifecycle for a new contact
must be `lead`.

### Companies

The supported company lifecycle and transitions are:

```
prospect → client → former_client
```

Reverse and reactivation transitions:

- `client` → `former_client`
- `former_client` → `client`
- `former_client` → `prospect`

Any other transition raises an exception. The initial lifecycle for a new company
must be `prospect`.

## Opportunity pipeline

Opportunity stages, in pipeline order:

```
new → contacted → qualified → proposal → won
                              → lost
```

Transitions:

- From `new`, `contacted`, `qualified`, `proposal`: may move forward or backward
  to any other open stage, or close as `won` or `lost`.
- From `won` or `lost`: must reopen to `qualified` first before any other stage
  change.

Closing behavior:

- When stage changes to `won` or `lost`, `closed_at` is set to `clock_timestamp()`.
- When reopening from `won` or `lost` to `qualified`, `closed_at` is cleared.
- `loss_reason` is required when stage is `lost`; it is cleared when moving out
  of `lost`.

Inquiry-origin behavior:

- When `source` is `website_inquiry`, `source_inquiry_id` must be supplied and
  must reference an existing `crm_inquiry_links` row with the same contact.
- Once set, `source_inquiry_id` is immutable for that opportunity.
- `source_inquiry_id` must reference an existing inquiry/contact link; it cannot
  be removed or changed after insert.

Value and currency rules:

- `expected_value` and `currency_code` must both be supplied or both be `NULL`.
- `expected_value` must be non-negative and cannot be `NaN` or infinite.

## Record integrity

- UUID primary keys generated with `gen_random_uuid()`.
- `created_at` and `updated_at` are managed by triggers; application code must
  not supply them.
- `revision` starts at `0` and increments by `1` on every update.
- `archived_at` is managed; setting it archives the record, and clearing it
  restores the record. Edits to an archived record are rejected; the record must
  be restored before other fields can change.
- `id` and `created_at` are immutable after insert.
- Hard deletes and truncates are rejected by statement triggers; CRM history must
  be archived, not deleted.
- The `crm_audit_events` table is protected by an additional immutable-history
  trigger that rejects updates and deletes.
- Relationship endpoints (`contact_id`, `company_id`) in `crm_contact_companies`
  are immutable after insert.

## Security and RLS

Row-level security is enabled on all six CRM tables.

Grants:

- `REVOKE ALL` from `public`, `anon`, `authenticated`, `service_role`.
- `GRANT SELECT` to `authenticated` only.
- No `INSERT`, `UPDATE`, `DELETE`, `EXECUTE` or application grants are issued
  for CRM tables or functions.

Access control:

- `anon` — denied (no SELECT grant).
- `authenticated` non-owner — denied by RLS policy using `phase5_is_owner()`.
- Legacy `admin` or restricted staff — denied by the same owner-only policy.
- Designated active owner — `SELECT` only when `phase5_is_owner()` returns true.
- Application roles — no CRM writes in M2.
- `service_role` — no CRM application privileges.
- Database operator — controlled maintenance access through the existing operator
  workflow; operator writes are attributed as `database_operator` in audit events.

The M1 `phase5_is_owner()` helper enforces that the caller is both the designated
owner Auth identity and holds an active `super_admin` membership. Broad
inquiry-admin authorization is not reused for CRM tables.

## Audit architecture

Audit events are generated transactionally by `AFTER INSERT OR UPDATE` triggers
on every CRM table except `crm_audit_events` itself. The audit trigger inserts
one row per changed entity revision.

Audit event contents:

- `entity_type` — one of `contact`, `company`, `contact_company`, `opportunity`,
  `inquiry_link`.
- `entity_id` — the row’s UUID.
- `entity_revision` — the row’s revision after the change (`0` for inserts).
- `action` — `created` or `updated`.
- `actor_user_id` — `NULL` for operator writes.
- `actor_kind` — always `database_operator`; never `authenticated_user`.
- `changed_fields` — sorted list of changed allowed fields.
- `previous_state` / `new_state` — lifecycle or stage values.
- `previous_assigned_to` / `new_assigned_to` — assignment changes.
- `previous_archived` / `new_archived` — archive state changes for assignable
  entities.

Behavioral guarantees:

- No-op updates (no field change) do not advance revision and do not create audit
  events.
- Rollback removes both business rows and audit events atomically.
- If the audit insert fails, the entire business write transaction fails.
- Audit history is immutable; updates and deletes on `crm_audit_events` are
  rejected.
- JWT claims or `current_setting` are never used to derive the audit actor.
- No raw email, phone, password, token, IP address, user agent or arbitrary JSON
  payload is stored in audit events.

## Inquiry integration boundary

M2 provides relationship structure only. It does not:

- convert inquiries to contacts or opportunities automatically,
- backfill existing inquiries with contacts,
- modify `submit_inquiry` or inquiry RLS,
- synchronize inquiry status from CRM changes,
- modify the Brevo adapter or `email_outbox`,
- expose inquiry-conversion UI or RPC.

`crm_inquiry_links` is a manual operator/application link between an existing
inquiry and an existing contact. The inquiry link row is immutable after insert.

## Concurrency strategy

M2 verification uses two isolated local runtimes:

1. **Local PGlite runner** (`tests/helpers/run-phase5-sql.mjs`) — in-memory
   disposable database. Runs all migrations and SQL suites, verifies preserved
   business records, and rolls back all state. No URL, password, persistent data
   directory or network access.

2. **Native PostgreSQL 18 runner** (`tests/helpers/run-phase5-concurrency.mjs`) —
   initializes its own disposable cluster under a unique temporary directory,
   binds to 127.0.0.1 on an automatically selected port other than 5432, and
   verifies the actual server data directory. Each competing transaction uses its
   own persistent `psql` process with a distinct backend PID. Blocking is verified
   with `pg_blocking_pids` before releasing the competing transaction.

Locking and serialization:

- CRM writes serialize on the operator-owned singleton via `phase5_crm_prepare_write()`
  before row-level locks.
- Assignment validation uses `FOR SHARE` on `admin_memberships`.
- Parent/company/affiliation validation uses `FOR SHARE` on referenced tables.
- Owner recovery schedules from M1 are compatible; CRM triggers do not change
  the recovery lock order.

## Verification record

### Application tests

66 passed, 0 failed.

Includes 53 existing application tests and 13 M2-specific application tests.

### M2 SQL assertions

191 assertions passed on PGlite.

191 assertions passed on native PostgreSQL 18.

### Native concurrency

21 native multi-session scenarios passed on PostgreSQL 18.6.

Genuine independent backend PIDs verified for every competing transaction pair.
Expected SQLSTATEs observed: `00000`, `23505`, `23514`, `42501`, `40001`, `40P01`.

### SQL suites

- `supabase/tests/inquiries.sql`
- `supabase/tests/admin_pipeline.sql`
- `supabase/tests/email_outbox.sql`
- `supabase/tests/phase5_access.sql`
- `supabase/tests/phase5_crm.sql`

### TypeScript

PASS — `tsc --noEmit --incremental false` with zero errors.

### ESLint

PASS — `eslint src tests` with zero errors.

### Production build

NOT RE-RUN for M2.

The working-tree Next.js production build was intentionally not re-run. M2
changes are SQL-only plus a TypeScript types file that does not affect Next.js
compilation. Re-running the ordinary build in the working tree would load
`.env.local`, which is prohibited by the safety rules. The M1 documentation
records a prior isolated build under an allowlisted synthetic copy with mocked
font responses; that result is preserved in the M1 section above.

### Windows cleanup note

After the native concurrency runner stops its disposable PostgreSQL cluster, the
final `rmSync` of the temporary cluster directory may log a non-fatal `EPERM`
warning on Windows. This occurs after all test assertions have already completed
successfully and after PostgreSQL shutdown, during OS-level temp-directory cleanup.
The warning does not indicate a test failure, data loss, or cluster issue.

## M3-deferred functionality

The following are explicitly out of scope for M2 and remain deferred:

- Restricted staff authorization cutover.
- CRM mutation RPCs, server actions or admin UI.
- Inquiry conversion workflow or automatic contact creation.
- Notes, follow-ups or activity history.
- Client portal or provisioning.
- Proposals, contracts, projects, invoices, payments.
- Owner MFA or invitation delivery.
- Retention/erasure policy enforcement.

## Retention

Retention and erasure policy for CRM records remains an owner decision before
live CRM use. No automated retention period, purge schedule or legal hold is
implemented in M2.

## Deployment status

- The `202609300002_phase5_crm.sql` migration has **not** been applied to live
  or hosted Supabase.
- No real owner was activated for CRM access by this implementation.
- No production CRM data was created.
- No commit or push has occurred.
