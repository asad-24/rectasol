// Native PostgreSQL only. Always initializes its own disposable cluster; accepts
// a binary directory, never a URL, password, existing data directory or port.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const bin = process.env.PHASE5_PG_BIN;
if (!bin || !path.isAbsolute(bin)) throw new Error("Set PHASE5_PG_BIN to the installed native PostgreSQL bin directory.");
const root = fileURLToPath(new URL("../../", import.meta.url));
const temporary = mkdtempSync(path.join(os.tmpdir(), "rectasol-m1-native-"));
const dataDir = path.join(temporary, "data");
const extension = process.platform === "win32" ? ".exe" : "";
const executable = name => path.join(bin, name + extension);
// Do not inherit PG*, database credentials, HOME, NODE_OPTIONS or environment files.
const environment = Object.fromEntries(["SystemRoot", "WINDIR", "PATH", "TEMP", "TMP", "LANG"]
  .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
environment.PGAPPNAME = "rectasol-m1-disposable-test";
environment.PGPASSFILE = path.join(temporary, "no-password-file");
environment.PGSERVICEFILE = path.join(temporary, "no-service-file");
const sessions = new Set();
let started = false;
let port;
let passed = 0;
let serial = 0;
const owner = "00000000-0000-4000-8000-000000000001";
const staff = "00000000-0000-4000-8000-000000000002";
const other = "00000000-0000-4000-8000-000000000003";

function command(name, args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(executable(name), args, { cwd: temporary, env: environment, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    const timeout = setTimeout(() => { child.kill(); reject(new Error(`${name} timed out`)); }, 60000);
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { output += chunk; });
    child.on("error", error => { clearTimeout(timeout); reject(error); });
    child.on("exit", code => {
      clearTimeout(timeout);
      if (code === 0) resolve(output.trim());
      else reject(new Error(`${name} failed (${code}): ${output}`));
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}
const args = database => ["-X", "-w", "-q", "-A", "-t", "-v", "VERBOSITY=verbose", "-h", "127.0.0.1", "-p", String(port), "-U", "m1_test_operator", "-d", database];
const sql = (database, query) => command("psql", [...args(database), "-v", "ON_ERROR_STOP=1"], query);

class Session {
  constructor(database) {
    this.child = spawn(executable("psql"), [...args(database), "-v", "ON_ERROR_STOP=0"], {
      cwd: temporary, env: environment, windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
    });
    this.buffer = "";
    this.pending = null;
    this.errors = "";
    sessions.add(this);
    this.child.stdout.on("data", chunk => {
      this.buffer += chunk.toString();
      if (!this.pending) return;
      const { marker, resolve, timer } = this.pending;
      const match = this.buffer.match(new RegExp(`${marker} ([0-9A-Z]{5})\\r?\\n`));
      if (!match) return;
      const output = this.buffer.slice(0, match.index).trim();
      this.buffer = this.buffer.slice(match.index + match[0].length);
      this.pending = null;
      clearTimeout(timer);
      resolve({ state: match[1], output });
    });
    this.child.stderr.on("data", chunk => { this.errors += chunk.toString(); });
    this.child.on("error", error => this.fail(error));
    this.child.on("exit", () => { sessions.delete(this); this.fail(new Error("psql session ended unexpectedly")); });
    this.child.stdin.on("error", error => this.fail(error));
  }
  fail(error) {
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(error); this.pending = null; }
  }
  query(query) {
    assert.equal(this.pending, null, "One request at a time per independent session");
    const marker = `M1_RESULT_${++serial}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.fail(new Error("Session query timed out")); this.child.kill(); }, 25000);
      this.pending = { marker, resolve, reject, timer };
      this.child.stdin.write(`${query}\n\\echo ${marker} :SQLSTATE\n`);
    });
  }
  async ok(query) {
    const result = await this.query(query);
    assert.equal(result.state, "00000", `Unexpected SQLSTATE: ${result.state}; ${this.errors}`);
    return result.output;
  }
  async close() {
    if (this.child.exitCode !== null) return;
    const exit = new Promise(resolve => this.child.once("exit", resolve));
    this.child.stdin.end("\\q\n");
    await exit;
  }
}

async function pair(database) {
  const a = new Session(database), b = new Session(database);
  for (const session of [a, b]) {
    await session.ok("set statement_timeout='15s';");
    await session.ok("set lock_timeout='12s';");
    await session.ok("set deadlock_timeout='500ms';");
    session.pid = Number(await session.ok("select pg_backend_pid();"));
  }
  assert.notEqual(a.pid, b.pid, "Must use genuine independent server backends");
  console.log(`  independent backend PIDs: ${a.pid}, ${b.pid}`);
  return [a, b];
}

async function blocked(database, waiter, blocker) {
  const deadline = Date.now() + 8000;
  do {
    if ((await sql(database, `select ${blocker.pid}=any(pg_blocking_pids(${waiter.pid}));`)) === "t") return;
    await new Promise(resolve => setTimeout(resolve, 50));
  } while (Date.now() < deadline);
  throw new Error("Expected overlapping transactions/lock wait was not observed");
}
async function state(result, expected) {
  const value = await result;
  assert.equal(value.state, expected);
  if (expected !== "00000") console.log(`  expected SQLSTATE ${expected}`);
}
async function invariant(database, expectedOwner = owner) {
  const result = JSON.parse(await sql(database, `select json_build_object(
    'owner',o.user_id,'rows',(select count(*) from public.agency_owner),
    'super_count',(select count(*) from public.admin_memberships where role='super_admin'),
    'active',exists(select 1 from public.admin_memberships m where m.user_id=o.user_id and m.active and m.role='super_admin'))
    from public.agency_owner o;`));
  assert.deepEqual(result, { owner: expectedOwner, rows: 1, super_count: 1, active: true });
}

async function database(active = true) {
  const name = `m1_case_${++serial}`;
  await sql("postgres", `create database ${name} template m1_template;`);
  await sql(name, `insert into auth.users(id) values('${owner}'),('${staff}'),('${other}');
    insert into public.admin_memberships(user_id,role) values('${owner}','super_admin'),('${staff}','admin'),('${other}','admin');`);
  if (active) await sql(name, `select public.phase5_bootstrap_owner('${owner}');`);
  return name;
}
async function recovery(session, replacement) {
  await session.ok(`update public.admin_memberships set role='admin',active=false where user_id='${owner}';`);
  await session.ok(`update public.admin_memberships set role='super_admin',active=true where user_id='${replacement}';`);
  await session.ok(`update public.agency_owner set user_id='${replacement}',designated_at=now();`);
}
async function scenario(name, run) {
  console.log(`TEST ${name}`);
  try { await run(); passed++; console.log(`PASS ${name}`); }
  finally { await Promise.all([...sessions].map(session => session.close())); }
}

try {
  console.log(await command("postgres", ["--version"]));
  port = await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => { const selected = server.address().port; server.close(() => resolve(selected)); });
  });
  assert.notEqual(port, 5432);
  await command("initdb", ["-D", dataDir, "-U", "m1_test_operator", "--auth=trust", "--encoding=UTF8", "--no-locale"]);
  writeFileSync(path.join(dataDir, "pg_hba.conf"), "host all all 127.0.0.1/32 trust\n");
  writeFileSync(path.join(dataDir, "postgresql.auto.conf"), `listen_addresses = '127.0.0.1'\nport = ${port}\n`);
  await command("pg_ctl", ["-D", dataDir, "-l", path.join(temporary, "postgres.log"), "-w", "start"]);
  started = true;
  const actual = await sql("postgres", "show data_directory;");
  assert.equal(realpathSync(actual), realpathSync(dataDir), "Refuse any unexpected server");
  console.log(`Disposable cluster verified on loopback port ${port}; installed port 5432 is untouched.`);
  await sql("postgres", "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create database m1_template;");
  await sql("m1_template", `create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;$$;
    grant usage on schema auth to anon,authenticated,service_role;`);
  for (const file of ["202609250001_inquiries.sql", "202609250002_admin_pipeline.sql", "202609260001_email_outbox.sql", "202609260002_brevo_email.sql", "202609300001_phase5_access.sql"]) {
    await sql("m1_template", readFileSync(path.join(root, "supabase/migrations", file), "utf8"));
  }
  for (const name of ["inquiries", "admin_pipeline", "email_outbox", "phase5_access"]) {
    await sql("m1_template", readFileSync(path.join(root, "supabase/tests", name + ".sql"), "utf8"));
    console.log(`PASS native PostgreSQL SQL suite: ${name}`);
  }

  for (const rollback of [false, true]) await scenario(`simultaneous activation; first ${rollback ? "rolls back" : "commits"}`, async () => {
    const db = await database(false), [a, b] = await pair(db);
    await a.ok("begin;"); await b.ok("begin;");
    await a.ok(`select public.phase5_bootstrap_owner('${owner}');`);
    const pending = b.query(`select public.phase5_bootstrap_owner('${owner}');`);
    await blocked(db, b, a);
    await a.ok(rollback ? "rollback;" : "commit;");
    await state(pending, rollback ? "00000" : "23514");
    await b.ok(rollback ? "commit;" : "rollback;");
    await invariant(db);
  });

  await scenario("activation race rejects a different, non-owner candidate", async () => {
    const db = await database(false), [a, b] = await pair(db);
    await a.ok("begin;"); await b.ok("begin;");
    await a.ok(`select public.phase5_bootstrap_owner('${owner}');`);
    const pending = b.query(`select public.phase5_bootstrap_owner('${staff}');`);
    await blocked(db, b, a); await a.ok("commit;");
    await state(pending, "23514"); await b.ok("rollback;"); await invariant(db);
  });

  await scenario("competing direct owner replacements cannot bypass membership invariant", async () => {
    const db = await database(), [a, b] = await pair(db);
    await a.ok("begin;"); await b.ok("begin;");
    await a.ok(`update public.agency_owner set user_id='${staff}';`);
    const pending = b.query(`update public.agency_owner set user_id='${other}';`);
    await blocked(db, b, a);
    await state(a.query("commit;"), "23514");
    await state(pending, "00000");
    await state(b.query("commit;"), "23514");
    await invariant(db);
  });

  await scenario("simultaneous unauthorized owner replacement and staff self-promotion", async () => {
    const db = await database(), [a, b] = await pair(db);
    for (const session of [a, b]) {
      await session.ok("begin;");
      await session.ok(`set local request.jwt.claims='{"sub":"${staff}"}';`);
      await session.ok("set local role authenticated;");
    }
    await Promise.all([
      state(a.query(`update public.agency_owner set user_id='${staff}';`), "42501"),
      state(b.query(`update public.admin_memberships set role='super_admin' where user_id='${staff}';`), "42501"),
    ]);
    await a.ok("rollback;"); await b.ok("rollback;"); await invariant(db);
  });

  await scenario("two owner deactivations both fail", async () => {
    const db = await database(), [a, b] = await pair(db);
    await a.ok("begin;"); await b.ok("begin;");
    await a.ok(`update public.admin_memberships set active=false where user_id='${owner}';`);
    const pending = b.query(`update public.admin_memberships set active=false where user_id='${owner}';`);
    await blocked(db, b, a);
    await state(a.query("commit;"), "23514"); await state(pending, "00000");
    await state(b.query("commit;"), "23514"); await invariant(db);
  });

  await scenario("concurrent unauthorized role assignment and grant insertion are denied", async () => {
    const db = await database(), [a, b] = await pair(db);
    const role = await sql(db, "select id from public.staff_roles where key='sales';");
    for (const session of [a, b]) {
      await session.ok("begin;");
      await session.ok(`set local request.jwt.claims='{"sub":"${staff}"}';`);
      await session.ok("set local role authenticated;");
    }
    await Promise.all([
      state(a.query(`insert into public.staff_role_assignments(user_id,role_id,assigned_by) values('${staff}','${role}','${owner}');`), "42501"),
      state(b.query(`insert into public.staff_role_permissions(role_id,capability,scope) values('${role}','crm.read','all');`), "42501"),
    ]);
    await a.ok("rollback;"); await b.ok("rollback;");
    assert.equal(await sql(db, "select count(*) from public.staff_role_assignments;"), "0");
    assert.equal(await sql(db, "select count(*) from public.staff_role_permissions;"), "0");
    await invariant(db);
  });

  await scenario("failed owner deactivation releases blocked legitimate staff revocation", async () => {
    const db = await database(), [a, b] = await pair(db);
    await a.ok("begin;"); await b.ok("begin;");
    await a.ok(`update public.admin_memberships set active=false where user_id='${owner}';`);
    const pending = b.query(`update public.admin_memberships set active=false where user_id='${staff}';`);
    await blocked(db, b, a);
    await state(a.query("commit;"), "23514"); await state(pending, "00000"); await b.ok("commit;");
    assert.equal(await sql(db, `select active from public.admin_memberships where user_id='${staff}';`), "f");
    await invariant(db);
  });

  await scenario("role changes overlap membership revocation without retaining access", async () => {
    const db = await database(), [a, b] = await pair(db);
    await sql(db, `insert into public.staff_role_permissions select id,'crm.read','assigned' from public.staff_roles where key='sales';
      insert into public.staff_role_assignments(user_id,role_id,assigned_by) select '${staff}',id,'${owner}' from public.staff_roles where key='sales';`);
    await a.ok("begin;"); await b.ok("begin;");
    await Promise.all([
      a.ok("update public.staff_roles set active=false where key='sales';"),
      b.ok(`update public.admin_memberships set active=false where user_id='${staff}';`),
    ]);
    await Promise.all([a.ok("commit;"), b.ok("commit;")]);
    await a.ok(`set request.jwt.claims='{"sub":"${staff}"}';`); await a.ok("set role authenticated;");
    assert.equal(await a.ok("select public.phase5_has_capability('crm.read','assigned');"), "f");
    await invariant(db);
  });

  await scenario("concurrent recovery: first valid replacement wins, stale replacement rolls back", async () => {
    const db = await database(), [a, b] = await pair(db);
    await a.ok("begin;"); await b.ok("begin;");
    await a.ok("lock table public.admin_memberships in share row exclusive mode;");
    await recovery(a, staff);
    const pending = b.query("lock table public.admin_memberships in share row exclusive mode;");
    await blocked(db, b, a); await a.ok("commit;"); await state(pending, "00000");
    await recovery(b, other); await state(b.query("commit;"), "23514");
    await invariant(db, staff);
  });

  await scenario("repeatable-read stale membership write conflicts with committed recovery", async () => {
    const db = await database(), [a, b] = await pair(db);
    await a.ok("begin isolation level repeatable read;");
    await a.ok("select user_id from public.agency_owner;");
    await b.ok("begin;"); await b.ok("lock table public.admin_memberships in share row exclusive mode;");
    await recovery(b, staff); await b.ok("commit;");
    await state(a.query(`update public.admin_memberships set active=false where user_id='${other}';`), "40001");
    await a.ok("rollback;"); await invariant(db, staff);
  });

  await scenario("deliberate operator lock inversion: deadlock victim rolls back safely", async () => {
    const db = await database(), [a, b] = await pair(db);
    await a.ok("begin;"); await b.ok("begin;");
    await a.ok(`select user_id from public.admin_memberships where user_id='${staff}' for update;`);
    const pendingB = b.query(`update public.admin_memberships set active=false where user_id='${staff}';`);
    await blocked(db, b, a);
    const pendingA = a.query(`update public.admin_memberships set active=false where user_id='${other}';`);
    const results = await Promise.all([pendingA, pendingB]);
    assert.deepEqual(results.map(result => result.state).sort(), ["00000", "40P01"]);
    for (const [index, session] of [a, b].entries()) await session.ok(results[index].state === "00000" ? "commit;" : "rollback;");
    console.log("  expected SQLSTATE 40P01 under intentionally inverted operator lock order");
    await invariant(db);
  });
  console.log(`PASS ${passed} native multi-session scenarios; four SQL suites. No hosted services contacted.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Native concurrency verification failed");
  process.exitCode = 1;
} finally {
  await Promise.all([...sessions].map(session => session.close().catch(() => {})));
  if (started || existsSync(path.join(dataDir, "postmaster.pid"))) {
    await command("pg_ctl", ["-D", dataDir, "-m", "immediate", "-w", "stop"]);
    console.log("Disposable cluster stopped. Synthetic data/logs retained in its unique temporary directory.");
  }
}
