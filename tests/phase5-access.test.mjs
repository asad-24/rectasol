import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const load = createLoader();
const { capabilityScopes, isPermissionGrant } = load("src/lib/admin/permissions.ts");
const { getCurrentPermissions, hasCurrentCapability } = load("src/lib/server/admin/permissions.ts");
const userId = "170dc1fc-65b1-4295-a9fa-bcc6b82857b7";
const otherId = "d94bf1fd-79ee-4a5a-b879-9417e1646c39";
function fixture(overrides = {}) {
  const calls = [];
  const projection = { user_id: userId, active: true, is_owner: false, grants: [], ...overrides.projection };
  const client = {
    auth: { getUser: async () => {
      if (overrides.throws) throw new Error("private auth failure");
      return { data: { user: overrides.anonymous ? null : { id: userId, user_metadata: { role: "super_admin" } } }, error: overrides.authError ?? null };
    } },
    rpc: async (...args) => { calls.push(args); return { data: overrides.raw ?? projection, error: overrides.rpcError ?? null }; },
  };
  return { client, calls, projection };
}

test("M1 capability vocabulary matches the SQL allowlist exactly", () => {
  const sql = readFileSync(new URL("../supabase/migrations/202609300001_phase5_access.sql", import.meta.url), "utf8");
  const catalog = sql.split("insert into public.staff_capabilities values")[1].split(";")[0];
  const pairs = [...catalog.matchAll(/\('([a-z.]+)','(assigned|all)'\)/g)].map(match => `${match[1]}:${match[2]}`).sort();
  const expected = Object.entries(capabilityScopes).flatMap(([capability, scopes]) => scopes.map(scope => `${capability}:${scope}`)).sort();
  assert.deepEqual(pairs, expected);
  for (const [capability, scope] of [["__proto__", "all"], ["owner.manage", "all"], ["crm.intake", "assigned"], ["crm.read", "*"], [null, "all"]]) {
    assert.equal(isPermissionGrant(capability, scope), false);
  }
});

test("M1 checks verified identity before requesting only current-user permissions", async () => {
  for (const options of [
    { anonymous: true }, { authError: { status: 401 } }, { authError: { status: 503 } },
    { authError: {} }, { throws: true },
  ]) {
    const { client, calls } = fixture(options);
    assert.notEqual((await getCurrentPermissions(client)).kind, "authorized");
    assert.equal(calls.length, 0);
  }
  const { client, calls } = fixture();
  assert.equal((await getCurrentPermissions(client)).isOwner, false);
  assert.deepEqual(calls, [["phase5_current_permissions"]]);
});

test("M1 denies inactive and pre-bootstrap projections regardless of owner claims", async () => {
  const { client } = fixture({ projection: { active: false, is_owner: true } });
  assert.deepEqual(await getCurrentPermissions(client), { kind: "forbidden" });
  assert.equal(await hasCurrentCapability(client, { capability: "crm.read", scope: "assigned" }), false);
});

test("M1 owner detection comes from the database, with no metadata or wildcard bypass", async () => {
  const { client } = fixture({ projection: { is_owner: true, grants: [{ capability: "crm.read", scope: "all" }] } });
  assert.equal((await getCurrentPermissions(client)).isOwner, true);
  assert.equal(await hasCurrentCapability(client, { capability: "crm.read", scope: "assigned" }), true);
  assert.equal(await hasCurrentCapability(client, { capability: "clients.convert", scope: "all" }), false);
});

test("M1 assigned grants cannot satisfy agency-wide access; missing grants deny", async () => {
  const { client, projection } = fixture({ projection: { grants: [{ capability: "crm.read", scope: "assigned" }] } });
  assert.equal(await hasCurrentCapability(client, { capability: "crm.read", scope: "assigned" }), true);
  assert.equal(await hasCurrentCapability(client, { capability: "crm.read", scope: "all" }), false);
  assert.equal(await hasCurrentCapability(client, { capability: "crm.intake", scope: "assigned" }), false);
  projection.active = false;
  assert.equal(await hasCurrentCapability(client, { capability: "crm.read", scope: "assigned" }), false);
});

test("M1 fails closed on RPC failure, mixed identities and malformed permission data", async () => {
  for (const options of [
    { rpcError: { message: "private SQL" } }, { raw: {} },
    { projection: { user_id: otherId } }, { projection: { active: "true" } },
    { projection: { grants: [{ capability: "crm.read", scope: "*" }] } },
    { projection: { grants: [{ capability: "crm.intake", scope: "assigned" }] } },
    { projection: { grants: [{ capability: "owner.manage", scope: "all" }] } },
    { projection: { grants: [], secret: "must not escape" } },
  ]) {
    const { client } = fixture(options);
    assert.deepEqual(await getCurrentPermissions(client), { kind: "unavailable" });
  }
});

test("M1 leaves legacy admin evaluation independent of the new dormant helpers", async () => {
  const { getAdminAccess } = load("src/lib/server/admin/access.ts");
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "admin", active: true }, error: null }) }) }) }),
    rpc: () => assert.fail("Existing access must not depend on M1 activation"),
  };
  assert.equal((await getAdminAccess(client)).kind, "authorized");
});
