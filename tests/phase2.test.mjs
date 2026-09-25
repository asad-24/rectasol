import assert from "node:assert/strict";
import test from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const load = createLoader();
const { contactSchema } = load("src/lib/contact.ts");
const { createContactHandler } = load("src/lib/server/contact-handler.ts");
const { prepareInquiry } = load("src/lib/server/inquiries.ts");
const key = "2e240cf1-1ea9-4d24-b7d2-08a34ade0986";
const reference = "INQ-" + key;
const valid = { name: "Ada", email: "ada@example.test", company: "", service: "web-applications", budget: "", timeline: "6 weeks", message: "A customer portal for our team." };
const request = (body = JSON.stringify(valid), headers = {}) => new Request("https://example.test/api/contact", {
  method: "POST", body, headers: { "Content-Type": "application/json", "Idempotency-Key": key, ...headers },
});
const handler = (save) => createContactHandler(save, "https://example.test");

test("normalization, optional fields, and strict rejection of internal fields", () => {
  const normalized = contactSchema.parse({ ...valid, name: " Ada ", email: " ADA@EXAMPLE.TEST ", message: " " + valid.message + " " });
  assert.equal(normalized.name, "Ada");
  assert.equal(normalized.email, valid.email);
  assert.equal(normalized.message, valid.message);
  for (const field of ["status", "id", "public_reference", "source", "created_at", "updated_at"]) {
    assert.equal(contactSchema.safeParse({ ...valid, [field]: "injected" }).success, false, field);
  }
  // Zod deliberately ignores __proto__; it must never reach the persistence payload.
  assert.equal(Object.hasOwn(contactSchema.parse({ ...valid, ["__proto__"]: "injected" }), "__proto__"), false);
  for (const body of [null, [], "text", { ...valid, service: ["web-applications"] }, { ...valid, timeline: "x".repeat(161) }]) {
    assert.equal(contactSchema.safeParse(body).success, false);
  }
});

test("invalid bodies, honeypot, origins, media type and key never reach storage", async () => {
  const post = handler(() => assert.fail("Storage must not be called"));
  for (const [req, status] of [
    [request("{"), 400],
    [request(JSON.stringify({ ...valid, status: "won" })), 400],
    [request(JSON.stringify({ ...valid, website: "https://spam.test" })), 400],
    [request(" ".repeat(16385)), 413],
    [request("😀".repeat(5000)), 413],
    [request("{}", { "Content-Length": "999999" }), 413],
    [request(undefined, { Origin: "https://evil.test" }), 403],
    [request(undefined, { "Sec-Fetch-Site": "cross-site" }), 403],
    [request(undefined, { "Content-Type": "text/plain" }), 415],
    [request(undefined, { "Idempotency-Key": "" }), 400],
  ]) {
    const response = await post(req);
    assert.equal(response.status, status);
    assert.equal((await response.json()).ok, false);
  }
});

test("actual streamed size is enforced without Content-Length", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(9000)); },
    cancel() { cancelled = true; },
  });
  const req = new Request("https://example.test/api/contact", {
    method: "POST", body: stream, duplex: "half",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
  });
  assert.equal((await handler(() => assert.fail())(req)).status, 413);
  assert.equal(cancelled, true);
});

test("created and replayed responses expose only the public receipt", async () => {
  for (const outcome of ["created", "replayed"]) {
    const post = handler(async (input, submissionKey) => {
      assert.equal(input.email, valid.email);
      assert.equal(submissionKey, key);
      return { outcome, reference, id: "private-id", email: valid.email };
    });
    const response = await post(request());
    assert.equal(response.status, outcome === "created" ? 201 : 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), ["message", "ok", "reference"]);
    assert.equal(body.reference, reference);
    assert.equal(JSON.stringify(body).includes(valid.email), false);
  }
});

test("aborted and slow bodies cannot reach persistence", async (context) => {
  const post = handler(() => assert.fail("Storage must not be called"));
  const controller = new AbortController();
  controller.abort();
  const aborted = new Request(request(), { signal: controller.signal });
  assert.equal((await post(aborted)).status, 408);

  context.mock.timers.enable({ apis: ["setTimeout"] });
  let cancelled = false;
  const slow = new Request("https://example.test/api/contact", {
    method: "POST", duplex: "half",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: new ReadableStream({ cancel() { cancelled = true; } }),
  });
  const pending = post(slow);
  context.mock.timers.tick(5000);
  assert.equal((await pending).status, 408);
  assert.equal(cancelled, true);
});

test("conflict and distributed rate decisions preserve their HTTP semantics", async () => {
  assert.equal((await handler(async () => ({ outcome: "conflict" }))(request())).status, 409);
  const limited = await handler(async () => ({ outcome: "rate_limited", retry_after: 123 }))(request());
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "123");
});

test("database failures expose no PII, SQL, credentials, or raw error in response/log", async () => {
  const secret = "sensitive database failure " + valid.email;
  const logs = [];
  const original = console.error;
  console.error = (...args) => logs.push(args);
  try {
    const response = await handler(async () => { throw new Error(secret); })(request());
    assert.equal(response.status, 503);
    assert.equal(JSON.stringify(await response.json()).includes(secret), false);
    assert.equal(JSON.stringify(logs).includes(secret), false);
    assert.equal(logs.length, 1);
  } finally { console.error = original; }
});

test("persistence hashes are deterministic, scoped and do not retain raw IP", () => {
  const config = { hashSecret: "test-only-secret-".repeat(3), ipHeader: "x-test-client-ip" };
  const headers = new Headers({ "x-test-client-ip": "192.0.2.10" });
  const one = prepareInquiry(contactSchema.parse(valid), headers, config);
  const two = prepareInquiry(contactSchema.parse({ ...valid, email: " ADA@EXAMPLE.TEST " }), headers, config);
  assert.deepEqual(one, two);
  assert.equal(one.payload.company, null);
  assert.match(one.requestHash, /^[a-f0-9]{64}$/);
  assert.notEqual(one.requestHash, one.emailHash);
  assert.equal(JSON.stringify(one).includes("192.0.2.10"), false);
  assert.notEqual(prepareInquiry({ ...valid, message: valid.message + " Different" }, headers, config).requestHash, one.requestHash);
  assert.equal(prepareInquiry(valid, headers, { hashSecret: config.hashSecret }).ipHash, null);
  assert.throws(() => prepareInquiry(valid, new Headers(), config));
  assert.throws(() => prepareInquiry(valid, new Headers({ "x-test-client-ip": "192.0.2.1, 192.0.2.2" }), config));
});

test("Supabase RPC boundary rejects malformed receipts and sends only allowed payload fields", async () => {
  let rpcArgs;
  let result = { data: { outcome: "created", reference }, error: null };
  const testLoad = createLoader({
    "@/lib/server/inquiry-config": { getInquiryConfig: () => ({ hashSecret: "test-only".repeat(8) }) },
    "@/lib/server/supabase": { createInquiryClient: () => ({
      rpc: (name, args) => {
        assert.equal(name, "submit_inquiry");
        rpcArgs = args;
        return { abortSignal: async (signal) => { assert.ok(signal instanceof AbortSignal); return result; } };
      },
    }) },
  });
  const { saveInquiry } = testLoad("src/lib/server/inquiries.ts");
  assert.deepEqual(await saveInquiry(valid, key, new Headers()), { outcome: "created", reference });
  assert.deepEqual(Object.keys(rpcArgs.p_payload).sort(), ["budget", "company", "email", "message", "name", "service", "timeline"]);
  result = { data: { outcome: "created", reference: "sequential-1" }, error: null };
  await assert.rejects(saveInquiry(valid, key, new Headers()));
  result = { data: null, error: { message: "private SQL failure" } };
  await assert.rejects(saveInquiry(valid, key, new Headers()), /Inquiry persistence failed/);
});

test("site URL has a local fallback and requires an explicit secure production origin", () => {
  const previous = { NODE_ENV: process.env.NODE_ENV, SITE_URL: process.env.SITE_URL };
  try {
    process.env.NODE_ENV = "development";
    delete process.env.SITE_URL;
    assert.equal(createLoader()("src/lib/site-url.ts").SITE_URL, "http://localhost:3000");
    process.env.NODE_ENV = "production";
    assert.throws(() => createLoader()("src/lib/site-url.ts"));
    for (const value of ["http://example.test", "https://localhost", "https://example.test/path", "https://user:pass@example.test", "https://example.test?x=1"]) {
      process.env.SITE_URL = value;
      assert.throws(() => createLoader()("src/lib/site-url.ts"), value);
    }
    process.env.SITE_URL = "https://example.test/";
    assert.equal(createLoader()("src/lib/site-url.ts").SITE_URL, "https://example.test");
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
