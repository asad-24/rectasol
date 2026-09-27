# Phase 4: Brevo transactional inquiry email

## Architecture

Brevo is the only active transactional email provider, as required by the project. Native server-side fetch avoids an SDK dependency.

Inquiry acceptance inserts client confirmation and admin notification jobs in the same database transaction. Replay/deduplication creates no additional jobs. Processing runs independently of /api/contact; email failure never changes or removes an accepted inquiry. There is no historical backfill.

Templates retain Rectasol branding, escaped HTML, plain text, public client references and safe authenticated admin links. Sender, recipients and content are frozen before sending. Admin reads retain session authorization/RLS and expose only kind, status, attempts and sent time. Browser clients cannot read message bodies or execute worker functions.

## Brevo API contract

POST https://api.brevo.com/v3/smtp/email uses api-key authentication and JSON with sender: {email,name}, to: [{email}], subject, htmlContent, textContent, and headers: {idempotencyKey: <outbox UUID>}. The URL is fixed, redirects are rejected, the timeout is ten seconds and response parsing is limited to 8 KiB. Keys and raw responses are never logged, persisted or exposed by the adapter.

A 2xx response succeeds only with a nonempty printable ASCII messageId of at most 128 characters, matching the database limit. Brevo's angle-bracket IDs are supported. The ID is saved through the fenced completion RPC. Sent means provider acceptance; inbox delivery, bounces and complaints require inspection in Brevo. No delivery webhook has been added.

Official references: [send API](https://developers.brevo.com/reference/send-transac-email), [idempotency](https://developers.brevo.com/docs/heterogenous-versions-batch-emails), [API keys](https://developers.brevo.com/docs/api-key-authentication).

## Retry and duplicate safety

Brevo documents UUID keys in message headers.idempotencyKey, a **30-minute** retention period, and duplicate_parameter on repeated keys. This does not replay the original successful response. A duplicate response is therefore never treated as success, and the worker never invents a provider ID.

| Result | Handling |
| --- | --- |
| Valid 2xx + messageId | Persist Sent and provider ID |
| 429 | Retry with exponential backoff and Retry-After |
| 5xx | Retry inside the shortened key window, with the same UUID and frozen content |
| Other permanent 4xx | Failed; sanitized provider_rejected |
| HTTP 408 or duplicate_parameter | Failed; delivery_uncertain; reconcile manually |
| Timeout/network failure | Failed; safe timeout/network category; no automatic retry |
| Missing/invalid/oversized/malformed success | Failed; delivery_uncertain |
| Crash/lost acknowledgement after prepare | Lease expiry quarantines as Failed / delivery_uncertain |

Network errors cannot reliably establish whether Brevo accepted the request, so they stop immediately. Response-stream network/timeout errors follow the same policy. The database refuses retry requests for ambiguous categories even if a caller asks to retry.

Claims use SKIP LOCKED, fresh fencing tokens and two-minute leases. Prepare atomically freezes content and sets dispatch_started_at before authorizing a send. Repeated prepare returns null. An expired lease with this marker is quarantined, never reclaimed to send again. A crash before prepare is safe to reclaim. A crash after prepare but before the network request can therefore lose a delivery; this is the deliberate cost of conservative duplicate protection.

Only an acknowledged 429/5xx retry clears the dispatch marker. Retries retain the UUID/content. The database stops at **20 minutes from the first claim**, and the worker has a **19-minute** guard, leaving margin inside Brevo's retention period. Backoff starts at 60 seconds and doubles; six claims is an absolute maximum. The deadline can stop work earlier. Retry-After accepts seconds or HTTP dates, capped at one hour; a delay beyond the deadline ends automatic processing.

The unique (inquiry_id,kind) constraint gives permanent logical identity. Provider idempotency is time-limited; this is not unlimited exactly-once delivery. Never reset ambiguous jobs, clear markers or rotate keys without reconciling recipient, inquiry reference, timestamps and any message ID against Brevo transactional logs. If acceptance cannot be established, leave the row failed for a human decision. There is no automated reconciliation or manual resend UI.

## Additive database upgrade

The already-applied 202609260001_email_outbox.sql is unchanged. Its provider constraint and retry functions require the new **202609260002_brevo_email.sql**. No live migration was run during implementation.

The migration adds dispatch_started_at, changes the active provider/default, and replaces claim/prepare/finish while preserving signatures, restricted grants, RLS and uniqueness. Untouched pending jobs move to Brevo. Previously attempted unsent jobs are quarantined; historical Sent/Failed records keep their provider identity. Historical provider wording remains only where deployed history and compatibility constraints require it.

Deployment order:

1. Stop scheduling and drain/stop every old worker instance before migration.
2. First apply the new migration to an isolated test database with Phases 2/3 and the original Phase 4 migration installed. Never edit/rerun applied migrations.
3. Run supabase/tests/email_outbox.sql only in non-production as owner. It temporarily clears queue/rate state and creates synthetic Auth users, then rolls back. Inspect custom Auth triggers first. It sends no mail.
4. Review the results, back up production, then manually apply only the new migration to the live project when ready. This remains an operator action.
5. Deploy the updated worker, configure its environment and restart. New workers reject jobs without provider: brevo before preparing or sending.
6. Complete controlled delivery checks before enabling scheduling. Existing untouched queued jobs become eligible: inspect the queue before invoking.

## Private configuration and manual setup

Keep existing Supabase variables and SITE_URL. Set these privately in .env.local and the deployment secret manager:

| Variable | Value |
| --- | --- |
| BREVO_API_KEY | Brevo API key, never an SMTP key |
| EMAIL_FROM | Plain verified sender address; no display-name wrapper |
| EMAIL_FROM_NAME | Display name, e.g. Rectasol; 1–100 characters, no controls/angle brackets |
| EMAIL_ADMIN_RECIPIENTS | 1–10 comma-separated plain mailboxes; no empty entries/display names |
| EMAIL_WORKER_SECRET | Independent random 32–128 character URL-safe secret shared with scheduler |

Configuration is validated before claiming. Missing/malformed values produce a generic 503 without consuming attempts. No new NEXT_PUBLIC variables exist. Secret placeholders in .env.example are empty. Admin recipients are an intentional To group and can see one another; a shared mailbox is appropriate. Callers cannot choose recipients.

1. Log in to the organization's Brevo account. Under sender/domain settings, add your domain and complete the DNS records Brevo supplies. Wait for successful authentication, then add/verify the sender mailbox and display name. See [sender setup](https://developers.brevo.com/reference/create-sender) and [domain authentication](https://developers.brevo.com/reference/authenticate-domain).
2. Open **SMTP & API → API Keys**, generate a dedicated API key and save it directly in your secret manager. Set BREVO_API_KEY privately. Never paste it into Git, logs or command history. Remove the obsolete provider key from your private environment yourself.
3. Set the four EMAIL variables above. EMAIL_FROM holds only the address; EMAIL_FROM_NAME holds the name. Use inboxes you control for initial testing.
4. Retain SITE_URL; verify it is the intended HTTPS origin in production. Localhost HTTP is supported for development. Do not add a provider URL setting.
5. Restart Next.js after environment changes. Complete the database upgrade before processing. Disable provider tracking unless separately approved for this stream. Frozen messages retain their original configuration.

## Worker invocation and live checks (operator only)

The following PowerShell command can send **one real queued email**. It was not run during implementation. Configure the private environment and start the application first:

```powershell
@'
const response = await fetch(new URL('/api/internal/email/process', process.env.SITE_URL), {
  method: 'POST', headers: { Authorization: 'Bearer ' + process.env.EMAIL_WORKER_SECRET }
});
console.log('Processing HTTP status:', response.status);
'@ | node --env-file=.env.local --input-type=module
```

The endpoint requires an empty POST with no query parameters. No caller-defined recipient, message or job selector is accepted. HTTP 200 means processing completed, including an idle queue or recorded failure; inspect delivery state separately.

1. Inspect eligible jobs before invoking; the worker always chooses database-defined work.
2. Submit a new inquiry with a controlled client inbox and synthetic text. Confirm acceptance and two Pending delivery entries in admin.
3. Invoke once per job (twice for an otherwise empty queue). Check client HTML and plain text for its reference, greeting and service; internal UUID/project-message content must be absent.
4. Check the admin email for project fields, escaped content and correct protected inquiry link. Check inbox/spam and Brevo transactional logs independently.
5. Confirm both admin entries show Sent, attempts and sent time. Inspect provider IDs with the owner projection below.
6. Replay the submission key and repeat identical input inside the deduplication window; no extra logical jobs should appear. Another invocation with an empty queue must send nothing.
7. Check non-admin denial. Keep timeout, rate-limit and crash simulations in local tests, without manipulating live rows.

```sql
select id, inquiry_id, kind, provider, status, attempts, sent_at,
       provider_message_id, last_error, next_attempt_at, dispatch_started_at
from public.email_outbox
order by created_at desc
limit 50;
```

## Production scheduling

Use an external HTTPS scheduler with encrypted header storage. Set the application origin plus /api/internal/email/process, method POST, **no body**, and Authorization from its secret store. Start at once per minute with a 60-second timeout and bounded retries. GET cron and schedulers that force a JSON body are incompatible.

Each invocation handles at most one job and retires up to 100 stale/exhausted jobs. A minute schedule allows at most 60 jobs/hour, roughly 30 inquiries before retries. Monitor queue age, failures and sustained endpoint errors; adjust frequency within account limits and measured demand. Leases support overlap. Missing acknowledgements never authorize another send after a dispatch marker exists.

## Local verification and limits

npm test uses synthetic provider/database boundaries and no live email calls. TypeScript, ESLint, diff/credential scans and production builds are separate checks. SQL verification uses an in-memory PGlite installation outside this repository:

```powershell
$env:PHASE4_PGLITE_PATH = "$env:TEMP/rectasol-phase4-sql-check/node_modules/@electric-sql/pglite"
node tests/helpers/run-phase4-sql.mjs
```

If absent, install @electric-sql/pglite@0.3.14 in that temporary directory with --no-save --package-lock=false --ignore-scripts. No application dependency is added.

The runner checks migrations, rollback, grants/RLS, replay/dedupe, uniqueness, frozen content, attempts, backoff, deadline, fencing, interrupted sends and inquiry preservation. Supabase Auth roles/UID are emulated; this does not prove live Auth/PostgREST or simultaneous sessions.

Live sender verification, provider delivery and inbox placement remain manual. Deferred: delivery/bounce/complaint webhooks, automated reconciliation, manual resend UI, retention automation and high-volume infrastructure.

### Local verification record (2026-09-26)

- Application tests: 46 passed, 0 failed, 0 skipped (28 Phase 1–3 regressions and 18 Phase 4 tests).
- PGlite: four migrations, Phase 2/3/4 SQL suites, provider-upgrade fixtures and rollback checks passed. No live database was contacted.
- TypeScript and ESLint passed. Git diff and Phase 4 untracked-file whitespace checks passed.
- Credential-pattern scan: 124 files, zero matches; private environment files excluded.
- Production build passed with a process-only synthetic HTTPS SITE_URL. The first restricted-network attempt could not fetch Google Fonts; the network-enabled retry passed. The existing multiple-lockfile warning remains.
- No emails were sent. The new migration has not been applied live. Private environment configuration and controlled delivery verification remain operator tasks.
