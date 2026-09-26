import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const load = createLoader();
const { getAdminAccess } = load("src/lib/server/admin/access.ts");
const { changeInquiryStatus, authenticateAdmin } = load("src/lib/server/admin/operations.ts");
const { inquiryQuerySchema, statusUpdateSchema, readActionFields } = load("src/lib/admin/validation.ts");
const id = randomUUID();
const user = { id, email: randomUUID() + "@example.invalid", user_metadata: { role: "super_admin" } };

test("inquiry detail resolves an internal PostgreSQL UUID through the authorized query", async () => {
  const inquiryId = "39d786a4-0b2d-4b65-92e7-4d37bc248f51";
  const row = {
    id: inquiryId, public_reference: "INQ-8aa815cc-cfee-4d85-843b-919476727813",
    name: "Test Client", email: "client@example.invalid", company: null,
    service: "web-development", budget: null, timeline: null, status: "new",
    message: "Synthetic inquiry", created_at: "2026-09-25T00:00:00Z",
    updated_at: "2026-09-25T00:00:00Z", revision: 0,
  };
  let result = { data: row, error: null };
  let authorized = true;
  let reads = 0;
  const local = createLoader({
    "@/lib/server/admin/guard": { requireAdmin: async () => {
      if (!authorized) throw new Error("Access denied");
      return { client: { from: table => {
        reads++;
        assert.equal(table, "inquiries");
        return { select: columns => {
          assert.equal(columns.includes("request_hash"), false);
          return { eq: (column, value) => {
            assert.equal(column, "id");
            assert.equal(value, inquiryId);
            return { maybeSingle: async () => result };
          } };
        } };
      } } };
    } },
  });
  const { getInquiry } = local("src/lib/server/admin/data.ts");
  assert.deepEqual(await getInquiry(inquiryId), row);
  for (const invalid of ["bad", row.public_reference, undefined]) {
    assert.equal(await getInquiry(invalid), null);
  }
  assert.equal(reads, 1);
  result = { data: null, error: null };
  assert.equal(await getInquiry(inquiryId), null);
  result = { data: null, error: { message: "private database details" } };
  await assert.rejects(getInquiry(inquiryId), { message: "Admin inquiry data is unavailable." });
  authorized = false;
  const previousReads = reads;
  await assert.rejects(getInquiry(inquiryId), { message: "Access denied" });
  assert.equal(reads, previousReads);
});

function fakeClient({ signedIn = true, role = "admin", active = true, outcome = "updated", dbError = null } = {}) {
  const calls = { rpc: [], membership: 0, signIn: 0, signOut: 0 };
  const client = {
    auth: {
      getUser: async () => ({ data: { user: signedIn ? user : null }, error: null }),
      signInWithPassword: async () => { calls.signIn++; return { error: null }; },
      signOut: async () => { calls.signOut++; return { error: null }; },
    },
    from: (table) => {
      assert.equal(table, "admin_memberships"); calls.membership++;
      return { select: () => ({ eq: (field, value) => {
        assert.equal(field, "user_id"); assert.equal(value, id);
        return { maybeSingle: async () => ({ data: role ? { role, active } : null, error: dbError }) };
      } }) };
    },
    rpc: async (name,args) => { calls.rpc.push({ name,args }); return { data: { outcome }, error: dbError }; },
  };
  return { client, calls };
}

test("admin access requires verified identity and active trusted membership", async () => {
  for (const [options, expected] of [
    [{ signedIn:false }, "unauthenticated"], [{ role:null }, "forbidden"],
    [{ role:"client" }, "forbidden"], [{ active:false }, "forbidden"],
    [{ role:"admin" }, "authorized"], [{ role:"super_admin" }, "authorized"],
    [{ dbError:{message:"private"} }, "unavailable"],
  ]) {
    const {client,calls} = fakeClient(options);
    assert.equal((await getAdminAccess(client)).kind,expected);
    if (!options.signedIn && options.signedIn !== undefined) assert.equal(calls.membership,0);
  }
});

test("protected page guard redirects anonymous/non-admin and fails closed on outage", async () => {
  for (const [kind,destination] of [["unauthenticated","/admin/login"],["forbidden","/admin/access-denied"],["unavailable","/admin/login?state=unavailable"]]) {
    const local = createLoader({
      react: { cache: fn => fn },
      "next/navigation": { redirect: target => { throw new Error(target); } },
      "@/lib/server/admin/client": { createAdminClient: async () => ({}) },
      "@/lib/server/admin/access": { getAdminAccess: async () => ({kind}) },
    });
    await assert.rejects(local("src/lib/server/admin/guard.ts").requireAdmin(), { message:destination });
  }
  const local = createLoader({
    react: { cache: fn => fn },
    "next/navigation": { redirect: () => assert.fail("Authorized user must not redirect") },
    "@/lib/server/admin/client": { createAdminClient: async () => ({}) },
    "@/lib/server/admin/access": { getAdminAccess: async () => ({kind:"authorized",user,role:"admin"}) },
  });
  assert.equal((await local("src/lib/server/admin/guard.ts").requireAdmin()).user.id,id);
});

test("login validates fields and rejects authenticated users without membership", async () => {
  const invalid = fakeClient();
  assert.equal((await authenticateAdmin(invalid.client,{email:"invalid"})).ok,false);
  assert.equal(invalid.calls.signIn,0);
  // Ephemeral synthetic input, never a stored or real admin credential.
  const input = {email:user.email,password:randomUUID()};
  for (const role of [null,"admin"]) {
    const {client,calls} = fakeClient({role});
    const result = await authenticateAdmin(client,input);
    assert.equal(result.ok,role === "admin");
    assert.equal(calls.signOut,role ? 0 : 1);
    assert.equal(JSON.stringify(result).includes(input.password),false);
  }
  invalid.client.auth.signInWithPassword = async () => ({error:{message:randomUUID()}});
  assert.equal((await authenticateAdmin(invalid.client,input)).ok,false);
});

test("status requests enforce the existing six statuses, IDs, revisions and no mass assignment", () => {
  const valid = {id,status:"contacted",revision:"0"};
  assert.equal(statusUpdateSchema.parse(valid).revision,0);
  for (const change of [{status:"deleted"},{id:"bad"},{revision:"-1"},{revision:"1.5"},{revision:"9007199254740992"},{email:user.email},{actor_user_id:id},{message:"tampered"}]) {
    assert.equal(statusUpdateSchema.safeParse({...valid,...change}).success,false);
  }
});

test("status mutation rechecks auth; only three allowed RPC arguments reach the database", async () => {
  for (const options of [{signedIn:false},{role:null},{active:false}]) {
    const {client,calls} = fakeClient(options);
    assert.equal((await changeInquiryStatus(client,{id,status:"won",revision:"0"})).ok,false);
    assert.equal(calls.rpc.length,0);
  }
  const {client,calls} = fakeClient();
  assert.equal((await changeInquiryStatus(client,{id,status:"won",revision:"0",name:"tampered"})).ok,false);
  assert.equal(calls.rpc.length,0);
  const result = await changeInquiryStatus(client,{id,status:"contacted",revision:"0"});
  assert.equal(result.ok,true);
  assert.deepEqual(calls.rpc,[{name:"admin_change_inquiry_status",args:{p_id:id,p_status:"contacted",p_revision:0}}]);
  assert.match(result.message,/audit trail/);
});

test("stale, missing, unchanged and failed status updates return safe feedback", async () => {
  for (const [outcome,ok,pattern] of [["conflict",false,/Another update/],["not_found",false,/no longer/],["unchanged",true,/already/],["unexpected",false,/could not/]]) {
    const {client} = fakeClient({outcome});
    const result = await changeInquiryStatus(client,{id,status:"won",revision:"2"});
    assert.equal(result.ok,ok);assert.match(result.message,pattern);
  }
  const {client} = fakeClient();
  const sensitive = randomUUID();
  client.rpc = async () => ({error:{message:sensitive}});
  const result = await changeInquiryStatus(client,{id,status:"won",revision:"2"});
  assert.equal(result.ok,false);assert.equal(JSON.stringify(result).includes(sensitive),false);
});

test("query validation bounds pages/search and rejects repeated or unknown parameters", () => {
  assert.deepEqual(inquiryQuerySchema.parse({}),{q:"",status:"",page:1});
  assert.equal(inquiryQuerySchema.parse({q:"  business  ",status:"proposal",page:"2"}).q,"business");
  // Quotes and SQL-like syntax remain literal parameters, not executable query fragments.
  assert.equal(inquiryQuerySchema.safeParse({q:"%' OR 1=1 --"}).success,true);
  for (const query of [{q:["one","two"]},{status:["new"]},{page:"0"},{page:"10001"},{page:"1.2"},{page:["1"]},{status:"unknown"},{q:"x".repeat(81)},{role:"admin"}]) {
    assert.equal(inquiryQuerySchema.safeParse(query).success,false);
  }
});

test("action fields reject duplicated application values and strip only framework metadata", () => {
  const form = new FormData();
  form.append("id",id);form.append("status","new");form.append("status","won");
  form.append("revision","0");form.append("$ACTION_ID_internal","");
  const fields = readActionFields(form);
  assert.equal(Object.hasOwn(fields,"$ACTION_ID_internal"),false);
  assert.equal(statusUpdateSchema.safeParse(fields).success,false);
});

test("server actions reject foreign/missing origins before auth or mutations", async () => {
  for (const origin of [null,"https://foreign.invalid"]) {
    const local = createLoader({
      "next/headers": { headers: async () => new Headers(origin ? {origin} : {}) },
      "next/navigation": { redirect: () => assert.fail() },
      "next/cache": { revalidatePath: () => assert.fail() },
      "@/lib/site-url": {SITE_URL:"https://example.test"},
      "@/lib/server/admin/client": {createAdminClient: () => assert.fail(),clearAdminCookies: () => assert.fail()},
    });
    const actions = local("src/app/admin/actions.ts");
    assert.equal((await actions.loginAction({},new FormData())).ok,false);
    assert.equal((await actions.statusAction({},new FormData())).ok,false);
    await actions.logoutAction();
  }
});

test("SSR cookie writers preserve chunk names and enforce HTTP-only admin scope", async () => {
  const writes = [];
  let options;
  const local = createLoader({
    "@supabase/ssr": {createServerClient: (_url,_key,config) => {options=config;return {};}},
    "next/headers": {cookies: async () => ({
      getAll: () => [{name:"rectasol-admin-auth.0",value:randomUUID()},{name:"unrelated",value:""}],
      set: (name,_value,settings) => writes.push({name,settings}),
    })},
    "@/lib/server/admin/config": {
      getAdminConfig: () => ({url:"https://example.invalid",key:""}),
      adminCookieName:"rectasol-admin-auth",
      adminCookieOptions:{path:"/admin",httpOnly:true,sameSite:"lax",secure:true},
    },
  });
  const clientModule = local("src/lib/server/admin/client.ts");
  await clientModule.createAdminClient(true);
  options.cookies.setAll([{name:"rectasol-admin-auth.1",value:randomUUID(),options:{path:"/"}}]);
  assert.equal(writes[0].name,"rectasol-admin-auth.1");
  assert.equal(writes[0].settings.httpOnly,true);
  assert.equal(writes[0].settings.path,"/admin");
  assert.equal(Object.hasOwn(writes[0].settings,"name"),false);
  await clientModule.clearAdminCookies();
  assert.equal(writes.length,2);
  assert.equal(writes[1].name,"rectasol-admin-auth.0");
  assert.equal(writes[1].settings.maxAge,0);
});

test("proxy forwards refreshed cookie chunks and disables admin caching/indexing", async () => {
  const cookieValue = randomUUID();
  const local = createLoader({
    "@supabase/ssr": {createServerClient: (_url,_key,options) => ({
      auth:{getClaims:async()=>{
        options.cookies.setAll([{name:"rectasol-admin-auth.0",value:cookieValue,options:{}}]);
        options.cookies.setAll([{name:"rectasol-admin-auth.1",value:cookieValue,options:{}}]);
        return {data:{}};
      }},
    })},
    "@/lib/server/admin/config": {
      getAdminConfig: () => ({url:"https://example.invalid",key:""}),
      adminCookieName:"rectasol-admin-auth",
      adminCookieOptions:{path:"/admin",httpOnly:true,sameSite:"lax",secure:true},
    },
  });
  const {NextRequest} = await import("next/server.js");
  const request = new NextRequest("https://example.test/admin");
  const response = await local("src/proxy.ts").proxy(request);
  assert.equal(request.cookies.get("rectasol-admin-auth.0").value,cookieValue);
  assert.equal(response.cookies.get("rectasol-admin-auth.0").value,cookieValue);
  assert.equal(response.cookies.get("rectasol-admin-auth.1").value,cookieValue);
  assert.match(response.headers.get("Cache-Control"),/no-store/);
  assert.equal(response.headers.get("X-Robots-Tag"),"noindex, nofollow");
  assert.equal(response.headers.get("X-Frame-Options"),"DENY");
});

test("admin client configuration rejects privileged keys and invalid project origins", () => {
  const names = ["SUPABASE_URL","SUPABASE_PUBLISHABLE_KEY","NODE_ENV"];
  const previous = Object.fromEntries(names.map(name => [name,process.env[name]]));
  try {
    process.env.NODE_ENV = "production";
    process.env.SUPABASE_URL = "https://example.invalid";
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_" + randomUUID().replaceAll("-","");
    assert.equal(createLoader()("src/lib/server/admin/config.ts").getAdminConfig().url,"https://example.invalid");
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_secret_" + randomUUID().replaceAll("-","");
    assert.throws(() => createLoader()("src/lib/server/admin/config.ts").getAdminConfig(), /Admin configuration unavailable/);
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_" + randomUUID().replaceAll("-","");
    for (const url of ["https://example.invalid/rest/v1","http://example.invalid","https://example.invalid?query=1"]) {
      process.env.SUPABASE_URL = url;
      assert.throws(() => createLoader()("src/lib/server/admin/config.ts").getAdminConfig());
    }
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name];
    }
  }
});
