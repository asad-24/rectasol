import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const contracts = createLoader()("src/lib/admin/crm.ts");
const sql = readFileSync(new URL("../supabase/migrations/202609300002_phase5_crm.sql", import.meta.url), "utf8");
const tables = ["contacts", "companies", "contact_companies", "opportunities", "inquiry_links", "audit_events"];

test("M2 creates exactly six tables with owner-only policies and no application writes", () => {
  assert.deepEqual([...sql.matchAll(/create table public.crm_(\w+)/g)].map(match => match[1]).sort(), [...tables].sort());
  for (const table of tables) {
    assert.ok(sql.includes(`alter table public.crm_${table} enable row level security;`));
    assert.ok(sql.includes(`revoke all on public.crm_${table} from public,anon,authenticated,service_role;`));
    assert.ok(sql.includes(`grant select on public.crm_${table} to authenticated;`));
  }
  assert.equal([...sql.matchAll(/using \(\(select public.phase5_is_owner\(\)\)\)/g)].length, 6);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete|all|execute)|is_inquiry_admin|create or replace/i);
});

test("M2 shared state catalogs match database check constraints", () => {
  for (const [name, column] of [
    ["contactLifecycles", "lifecycle"], ["companyLifecycles", "lifecycle"],
    ["opportunityStages", "stage"], ["crmSources", "source"], ["lossReasons", "loss_reason"],
  ]) {
    assert.ok(sql.includes(`${column} in (${contracts[name].map(value => `'${value}'`).join(",")})`), name);
  }
});

test("M2 audit field contract matches database allowlists without sensitive payload fields", () => {
  const section = sql.split("create function public.phase5_crm_fields")[1].split("$$;")[0];
  const actual = Object.fromEntries([...section.matchAll(/when '([^']+)' then array\[([^\]]+)\]/g)]
    .map(match => [match[1], [...match[2].matchAll(/'([^']+)'/g)].map(value => value[1])]));
  assert.deepEqual(actual, contracts.crmEntityFields);
  const audit = sql.split("create table public.crm_audit_events (")[1].split("create index")[0];
  assert.doesNotMatch(audit, /\b(jsonb?|email|phone|password|token|ip_address|user_agent)\s/i);
  const trigger = sql.split("create function public.phase5_crm_audit_change()")[1].split("$$;")[0];
  assert.ok(trigger.includes("null,'database_operator'"));
  assert.doesNotMatch(trigger, /auth.uid|current_setting/);
});

test("M2 lifecycle contracts are closed vocabularies and terminal stages require reopening", () => {
  for (const [states, transitions] of [
    [contracts.contactLifecycles, contracts.contactTransitions],
    [contracts.companyLifecycles, contracts.companyTransitions],
    [contracts.opportunityStages, contracts.opportunityTransitions],
  ]) {
    assert.deepEqual(Object.keys(transitions).sort(), [...states].sort());
    for (const [from, targets] of Object.entries(transitions)) {
      assert.equal(new Set(targets).size, targets.length);
      for (const target of targets) assert.ok(states.includes(target) && target !== from);
    }
  }
  assert.deepEqual(contracts.opportunityTransitions.won, ["qualified"]);
  assert.deepEqual(contracts.opportunityTransitions.lost, ["qualified"]);
});

test("M2 preserves historical migrations and exposes no mutation RPC or destructive cascades", () => {
  assert.doesNotMatch(sql, /on delete cascade|alter table public\.(inquiries|admin_memberships|email_outbox)|create trigger[^;]+on public\.inquiries/is);
  for (const fn of [...sql.matchAll(/create function public\.(\w+)\([^]*?\$\$/g)]) {
    assert.ok(fn[0].includes("set search_path = ''"), fn[1]);
    assert.ok(sql.slice(sql.lastIndexOf("revoke all on function")).includes(fn[1]), fn[1]);
  }
  assert.doesNotMatch(sql, /\bexecute\s+format|\bexecute\s+'|\bexecute\s+query/i);
});

test("M2 native harness covers independent connections and cleans its disposable cluster", () => {
  const runner = readFileSync(new URL("./helpers/run-phase5-concurrency.mjs", import.meta.url), "utf8");
  assert.ok(runner.includes("assert.notEqual(a.pid, b.pid"));
  assert.ok(runner.includes("pg_blocking_pids"));
  assert.ok(runner.includes("await runCrmScenarios()"));
  assert.ok(runner.includes("rmSync(temporary"));
  assert.ok(runner.includes('"phase5_crm"'));
});

