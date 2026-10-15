import assert from "node:assert/strict";
import test from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const load = createLoader();
const { capabilityScopes } = load("src/lib/admin/permissions.ts");
const { getCurrentCapabilities, hasCurrentCapability } = load("src/lib/server/admin/access.ts");

const userId = "170dc1fc-65b1-4295-a9fa-bcc6b82857b7";

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

test("M3 capability vocabulary includes clients.stage", () => {
  assert.ok(capabilityScopes["clients.stage"], "Missing clients.stage");
  assert.deepEqual(capabilityScopes["clients.stage"], ["all"]);
});

test("M3 legacy admin with no M1 role/capability is denied by capability path", async () => {
  const { client } = fixture({ projection: { active: true, is_owner: false, grants: [] } });
  const access = await getCurrentCapabilities(client);
  assert.equal(access.kind, "authorized");
  assert.equal(await hasCurrentCapability(client, { capability: "workspace.access", scope: "all" }), false);
  assert.equal(await hasCurrentCapability(client, { capability: "clients.read", scope: "all" }), false);
  assert.equal(await hasCurrentCapability(client, { capability: "clients.stage", scope: "all" }), false);
  assert.equal(await hasCurrentCapability(client, { capability: "clients.convert", scope: "all" }), false);
});

test("M3 legacy super_admin not designated owner with no M1 permission is denied", async () => {
  const { client } = fixture({ projection: { active: true, is_owner: false, grants: [] } });
  const access = await getCurrentCapabilities(client);
  assert.equal(access.kind, "authorized");
  assert.equal(await hasCurrentCapability(client, { capability: "clients.read", scope: "all" }), false);
});

test("M3 owner retains full access", async () => {
  const { client } = fixture({ projection: { active: true, is_owner: true, grants: [] } });
  const access = await getCurrentCapabilities(client);
  assert.equal(access.kind, "authorized");
  assert.equal(access.isOwner, true);
});

test("M3 workspace.access:assigned alone does not grant workspace entry", async () => {
  const { client } = fixture({ projection: { active: true, is_owner: false, grants: [{ capability: "clients.read", scope: "assigned" }] } });
  const access = await getCurrentCapabilities(client);
  assert.equal(access.kind, "authorized");
  assert.equal(await hasCurrentCapability(client, { capability: "workspace.access", scope: "all" }), false);
});

test("M3 clients.read:assigned alone does not grant broad inquiry access", async () => {
  const { client } = fixture({ projection: { active: true, is_owner: false, grants: [{ capability: "clients.read", scope: "assigned" }] } });
  const access = await getCurrentCapabilities(client);
  assert.equal(access.kind, "authorized");
  assert.equal(await hasCurrentCapability(client, { capability: "clients.read", scope: "all" }), false);
});

test("M3 clients.read:all grants inquiry read", async () => {
  const { client } = fixture({ projection: { active: true, is_owner: false, grants: [{ capability: "clients.read", scope: "all" }] } });
  assert.equal(await hasCurrentCapability(client, { capability: "clients.read", scope: "all" }), true);
});

test("M3 clients.stage:all authorizes inquiry status mutation", async () => {
  const { client } = fixture({ projection: { active: true, is_owner: false, grants: [{ capability: "clients.stage", scope: "all" }] } });
  assert.equal(await hasCurrentCapability(client, { capability: "clients.stage", scope: "all" }), true);
});

test("M3 crm.stage alone does not authorize inquiry status mutation", async () => {
  const { client } = fixture({ projection: { active: true, is_owner: false, grants: [{ capability: "crm.stage", scope: "all" }] } });
  assert.equal(await hasCurrentCapability(client, { capability: "clients.stage", scope: "all" }), false);
});

test("M3 clients.convert:assigned alone cannot convert arbitrary inquiry", async () => {
  const { client } = fixture({ projection: { active: true, is_owner: false, grants: [{ capability: "clients.convert", scope: "assigned" }] } });
  assert.equal(await hasCurrentCapability(client, { capability: "clients.convert", scope: "all" }), false);
});

test("M3 getCurrentCapabilities validates identity projection", async () => {
  for (const options of [
    { throws: true }, { authError: { status: 401 } }, { authError: { status: 503 } }, { authError: {} }, { anonymous: true },
  ]) {
    const { client } = fixture(options);
    assert.notEqual((await getCurrentCapabilities(client)).kind, "authorized");
  }
  const { client, calls } = fixture();
  assert.equal((await getCurrentCapabilities(client)).isOwner, false);
  assert.deepEqual(calls, [["phase5_current_permissions"]]);
});
