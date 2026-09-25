import assert from "node:assert/strict";
import test from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const reference = "INQ-2e240cf1-1ea9-4d24-b7d2-08a34ade0986";
const load = createLoader({
  "@/lib/site-url": { SITE_URL: "https://example.test" },
  "@/lib/server/inquiries": { saveInquiry: async () => ({ outcome: "created", reference }) },
});
const { contactSchema, contactLimits, serviceOptions, resolveContactService } = load("src/lib/contact.ts");
const { POST } = load("src/app/api/contact/route.ts");
const valid = { name: "Ada", email: "ada@example.com", company: "", service: "web-applications", budget: "", message: "A customer portal for our team." };
const submit = (body) => POST(new Request("http://localhost/api/contact", {
  method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "2e240cf1-1ea9-4d24-b7d2-08a34ade0986" }, body,
}));

test("every catalog service is selectable and validated; invalid URL context falls back", () => {
  assert.equal(serviceOptions.length, 10);
  for (const { value } of serviceOptions) {
    assert.equal(resolveContactService(value), value);
    assert.equal(contactSchema.safeParse({ ...valid, service: value }).success, true);
  }
  for (const value of [undefined, "unknown", ["ai-automation"], "<script>"]) {
    assert.equal(resolveContactService(value), "web-applications");
  }
  assert.equal(contactSchema.safeParse({ ...valid, service: "unknown" }).success, false);
});

test("validation trims input and enforces all shared upper bounds", () => {
  assert.equal(contactSchema.parse({ ...valid, name: "  Ada  " }).name, "Ada");
  for (const [field, { max }] of Object.entries(contactLimits)) {
    assert.equal(contactSchema.safeParse({ ...valid, [field]: "x".repeat(max + 1) }).success, false, field);
  }
  assert.equal(contactSchema.safeParse({ ...valid, name: "  ", message: " ".repeat(25) }).success, false);
});

test("persisted success is explicit and does not echo personal information", async () => {
  const response = await submit(JSON.stringify(valid));
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.reference, reference);
  assert.match(body.message, /has been received/);
  assert.equal(JSON.stringify(body).includes(valid.email), false);
  assert.equal("inquiry" in body, false);
});

test("API returns field errors and handles malformed JSON", async () => {
  const response = await submit(JSON.stringify({ ...valid, name: " ", email: "bad", message: "short" }));
  assert.equal(response.status, 400);
  const { issues } = await response.json();
  for (const field of ["name", "email", "message"]) assert.ok(issues[field].length);
  const malformed = await submit("{");
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).ok, false);
});

test("sitemap covers every public page once; robots references it", () => {
  const sitemap = load("src/app/sitemap.ts").default();
  assert.equal(sitemap.length, 19);
  assert.equal(new Set(sitemap.map(({ url }) => url)).size, 19);
  assert.ok(sitemap.some(({ url }) => url === "https://example.test/services/ai-automation"));
  const robots = load("src/app/robots.ts").default();
  assert.equal(robots.sitemap, "https://example.test/sitemap.xml");
  assert.equal(robots.rules.disallow, "/api/");
});
