# Phase 2: persistent project inquiries

## Architecture and access

The browser posts JSON to the Node.js route at `POST /api/contact`. Shared Zod validation normalizes inputs and rejects internal/unknown fields. The handler bounds the body and validates origin, submission key and honeypot before calling the server-only persistence utility. Supabase's official JavaScript client calls one PostgreSQL transaction, `submit_inquiry`, which enforces rate budgets and deduplication before inserting.

Only the server secret key can call this function. All three tables have RLS enabled with **no browser policies**, and privileges are explicitly revoked from PUBLIC, anon and authenticated. The function uses security invoker, an empty search path and an explicit service_role grant. The server client does not forward user cookies or authorization headers. Future admin access needs a separate reviewed authorization design; no public listing or receipt lookup endpoint exists.

`inquiries` has separate random internal UUID and public UUIDv4 reference, contact/project fields, status, source, timestamps and an HMAC request fingerprint. Status starts at `new` and supports contacted/qualified/proposal/won/lost. The RPC hardcodes new/website. Indexes cover pipeline ordering, email lookup and recent duplicate checks. A timestamp trigger supports future updates. Service slugs are validated against the existing application catalog, avoiding a second hardcoded service list in SQL.

## Required manual setup

1. Use Node.js **22 or later** (required by the installed Supabase client; Node 24 was used here). Create a **non-production Supabase project** for initial verification. No project has been provisioned automatically.
2. In that project's SQL editor, execute `supabase/migrations/202609250001_inquiries.sql` once. Alternatively, apply it through your established Supabase migration workflow. Do not disable RLS or add anonymous policies.
3. Verify the three tables exist and RLS is enabled. Run `supabase/tests/inquiries.sql` in the non-production SQL editor. It checks grants, create/replay/deduplication/conflict/rate behavior and rolls back all test mutations. Never run this smoke script in production: it temporarily clears rate state inside its transaction.
4. Copy `.env.example` to an untracked `.env.local`. Set the names below using that non-production project's settings. Do not paste credentials into chat or commit them.
5. In Supabase Project Settings / API, obtain the project URL and a **server secret key**. A legacy service_role key also works. Never use a publishable/anon key here, and never prefix privileged names with `NEXT_PUBLIC_`.
6. Generate an independent cryptographically random secret of at least 32 characters for HMAC hashing (for example, a password manager's random 64-character value). Keep it stable across application instances and deploys.
7. Run `npm run dev`, open `http://localhost:3000/contact`, submit synthetic details, and verify a receipt appears. In the SQL editor check the corresponding inquiry has status new, source website, separate IDs and the expected fields. Confirm it appears once.
8. Test a retry with the **same Idempotency-Key and identical JSON** using browser developer tools or a local HTTP client. Expect HTTP 200 and the same receipt; a first create is 201. Reusing the key with changed valid details yields 409. More than five valid attempts for the same normalized email within a window yields 429. Wait until the next window for further tests.
9. With a publishable/anon client, verify direct reads/writes and RPC execution are denied; repeat with an authenticated nonprivileged account if one exists in your test project. Test simultaneous identical submissions from two clients and verify a single row. These live checks have **not** been performed in this workspace.
10. Before deployment, configure the real HTTPS `SITE_URL` at **build and runtime**, server secrets at runtime, and platform-level request throttling. Review retention, backups and access to customer PII. Apply the migration to the intended deployment project only after non-production verification.

| Variable | Purpose |
| --- | --- |
| `SITE_URL` | Website origin only, no path/query/credentials. Local development defaults to http://localhost:3000. Production requires an explicit HTTPS, non-localhost origin. |
| `SUPABASE_URL` | Supabase project origin; server only. |
| `SUPABASE_SECRET_KEY` | Server secret key, or legacy service_role key. |
| `INQUIRY_HASH_SECRET` | Independent random HMAC secret, at least 32 characters. |
| `INQUIRY_TRUSTED_IP_HEADER` | Optional header name set and overwritten by a trusted deployment proxy with one validated client IP. Leave empty unless that guarantee is established. |

Never put the last four values into browser code. Database configuration is lazy: the app can build without database credentials, but submission returns a safe 503 until configured. The example file contains no credentials or invented production domain. A production build without SITE_URL intentionally fails rather than publishing localhost SEO metadata.

## Request/response contract

Send `Content-Type: application/json` and a random UUIDv4 `Idempotency-Key`. Fields are name, email, optional company, catalog service slug, optional budget, optional timeline, message, and optional empty website honeypot. Trimming and email lowercase normalization happen on the server. The client imports lightweight limits/options without shipping Zod or database code.

Success (201 create, 200 replay): `{ ok: true, reference: "INQ-<random UUIDv4>", message: "..." }`. No internal ID or submitted PII is returned. Failures use `{ ok: false, code, message, issues? }`: 400 validation/JSON/key/honeypot, 403 cross-origin, 408 slow/aborted body, 409 key conflict, 413 oversized body, 415 media type, 429 rate limit with Retry-After, 503 storage/configuration failure. Responses are no-store; raw database errors and payloads are never logged. Failures log a random correlation ID and a fixed event name only.

Origin checks apply when Origin is present; cross-site Fetch Metadata is also rejected. This is not authentication or bot prevention: non-browser callers can omit or forge these headers. No CORS permission is provided. Native/no-JavaScript form submission uses POST rather than leaking PII through a GET URL, and receives a safe unsupported-content response; the page offers email as a fallback.

## Protection and limitations

- The request stream is capped at **16 KiB**, including requests without Content-Length, and body reading is limited to five seconds. Storage calls have an eight-second abort timeout. The UI waits fifteen seconds and retains entries on failure.
- The database applies shared fixed **15-minute** windows: 100 attempts globally, five per normalized email, and ten per IP when a trusted header is configured. All valid storage attempts, including replays/conflicts, consume budget. These conservative defaults suit low-volume inquiries; adjust only after measuring real traffic.
- Rate decisions and insert/deduplication share an advisory transaction lock. This prevents concurrent duplicates across instances but serializes this endpoint. It is intentionally not a high-throughput ingestion design. Global budget is evaluated first to bound protection-table growth.
- Same key + same normalized payload returns the original reference for **24 hours**; key reuse with changed payload is rejected. Identical normalized payload with a different key is deduplicated for **10 minutes**. Replay beyond those windows may create another inquiry. The browser retains the key only in memory and does not store PII in browser storage.
- A browser timeout does not prove the database rolled back. Retrying unchanged details recovers the original reference within the above windows. HMAC secret rotation invalidates fingerprints and may cause conflicts/duplicates during the transition; plan rotation deliberately.
- The hidden honeypot catches unsophisticated automation only. Email identity is not verified. Without a trusted IP header, only email/global limits apply; attackers can rotate emails or exhaust the global budget and deny legitimate submissions. Add platform/WAF request throttling before significant public traffic. Invalid requests are bounded but do not reach the database limiter. This is not DDoS protection, and no Redis/CAPTCHA vendor was added.
- Raw IP addresses are not persisted. Fingerprints and rate keys are HMACs, but inquiries contain customer PII and require an operational retention/access policy. Expired helper rows are removed on the next valid RPC call; idle tables may retain expired rows until that call. Inquiry retention is not automatically implemented.
- No email, auth, admin dashboard, client accounts, projects, payments or other Phase 3 functionality is included. Success means the inquiry was persisted only.

## Verification

`npm test` runs Phase 1 regressions (adapted from stub success to persisted success) and Phase 2 validation/API/security-boundary tests with injected storage. These tests do not claim to exercise PostgreSQL. `supabase/tests/inquiries.sql` is the separate live database smoke test. Test isolation is disabled to work in restricted environments; tests restore temporary environment changes and logging hooks.

Run `npm run lint`, `npx tsc --noEmit --incremental false`, `npm test`, `npm run build` with a valid SITE_URL, and `git diff --check`. Run the manual live checks above before relying on database behavior in production.

Implementation verification: 15 automated tests, ESLint, TypeScript and an isolated Next.js production webpack build passed. The built server returned a PII-free 503 without database configuration. A headless browser verified service preselection, the timeline field, POST fallback, retained failure data, concurrent-submit prevention, retry-key reuse, receipt display and the post-success guard with mocked responses. No live Supabase test was run. Next.js reported an existing workspace-root warning due to lockfiles above this repository; those files were left untouched.

Official references: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [database functions and grants](https://supabase.com/docs/guides/database/functions).
