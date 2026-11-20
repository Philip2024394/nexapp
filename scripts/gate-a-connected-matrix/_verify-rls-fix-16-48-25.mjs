#!/usr/bin/env node
// Read-only verification · §16.48.25 · confirm 42P17 is cleared post-mig-360.
//
// Uses service-role direct pg connection to run `SET LOCAL ROLE authenticated`
// + `SET LOCAL request.jwt.claims` to simulate an authenticated-role SELECT
// WITHOUT resetting any user password and WITHOUT signing in. This is the
// SQL-level equivalent of script 40's post-RPC authed-A SELECT. Evidence
// tier: SIMULATED-AUTH (one step below real authed sign-in; acceptable
// because the policy evaluation path is identical — RLS reads auth.uid()
// from request.jwt.claims.sub regardless of transport).
//
// NO WRITES. NO PASSWORD RESET. NO SIGN-IN. Sandbox only.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../..");
const PROD = "ijvqdvsvwtwxzcqmoqit";
const CANON = "kdstoyyeygcopkogqsyv";

function envVal(key) {
  const raw = readFileSync(resolve(REPO_ROOT, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const dbUrl = envVal("SANDBOX_DATABASE_URL");
if (!dbUrl || dbUrl.includes(PROD) || !dbUrl.includes(CANON)) {
  console.error(`FATAL URL safety · must contain ${CANON} and not ${PROD}`);
  process.exit(3);
}

const cap = JSON.parse(readFileSync(resolve(__dir, "99_identity_capture.json.OUTPUT"), "utf8"));
const A_SUPA = cap.A.supabase_user_id;
const A_ACCT = cap.A.nex_account_id;

console.log(`§16.48.25 VERIFY · sandbox ${CANON} · read-only`);
console.log("");

const c = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await c.connect();

try {
  // 1. Confirm helper + rewritten policies are live
  console.log("── Schema state ──");
  const fn = (await c.query(
    `SELECT prosecdef, provolatile, proconfig,
            pg_get_userbyid(proowner) AS owner
       FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
      WHERE n.nspname='public' AND proname='nex_is_participant_in_session'`
  )).rows[0];
  console.log(`  helper · prosecdef=${fn?.prosecdef} provolatile=${fn?.provolatile} search_path=${JSON.stringify(fn?.proconfig)} owner=${fn?.owner}`);

  for (const polname of [
    "nex_group_call_participant_select_scoped",
    "nex_group_call_session_select_participants",
  ]) {
    const p = (await c.query(
      `SELECT pg_get_expr(polqual, polrelid) AS expr FROM pg_policy WHERE polname=$1`,
      [polname]
    )).rows[0];
    const expr = p?.expr ?? "";
    const self = /FROM\s+(public\.)?nex_group_call_participant/i.test(expr);
    const helper = /nex_is_participant_in_session/.test(expr);
    console.log(`  policy · ${polname} · recurses=${self} uses_helper=${helper}`);
  }
  console.log("");

  // 2. Simulated-authed-A SELECT · the pre-fix repro
  console.log("── Simulated authed-A SELECT (SQL-level, no password, no signin) ──");
  // Service-role connection; drop to `authenticated` role for the tx and set the JWT.
  await c.query("BEGIN");
  await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: A_SUPA, role: "authenticated" })]);
  await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [A_SUPA]);
  await c.query("SET LOCAL ROLE authenticated");

  // Confirm role + auth.uid()
  const who = (await c.query("SELECT current_user, auth.uid() AS uid")).rows[0];
  console.log(`  current_user=${who.current_user} auth.uid()=${who.uid}`);

  // The pre-fix error was 42P17 on SELECT FROM nex_group_call_participant.
  // Even "does my account exist as a participant anywhere?" blew up.
  const testTables = ["nex_group_call_participant", "nex_group_call_session"];
  const results = {};
  for (const tbl of testTables) {
    try {
      const r = await c.query(`SELECT count(*)::int AS n FROM ${tbl}`);
      console.log(`  ${tbl} count: ${r.rows[0].n} · OK (no 42P17)`);
      results[tbl] = { ok: true, count: r.rows[0].n };
    } catch (e) {
      console.log(`  ${tbl}: ERROR ${e.code ?? ""} ${e.message}`);
      results[tbl] = { ok: false, code: e.code, msg: e.message };
    }
  }
  await c.query("COMMIT");

  // 3. Helper function callable by authenticated · correctness check
  console.log("");
  console.log("── Helper direct invocation ──");
  await c.query("BEGIN");
  await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: A_SUPA, role: "authenticated" })]);
  await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [A_SUPA]);
  await c.query("SET LOCAL ROLE authenticated");
  try {
    const r = await c.query(`SELECT public.nex_is_participant_in_session($1) AS b`, [
      "00000000-0000-0000-0000-000000000000",
    ]);
    console.log(`  helper(null-session) returns: ${r.rows[0].b} (expect false)`);
  } catch (e) {
    console.log(`  helper ERROR ${e.code ?? ""} ${e.message}`);
  }
  await c.query("COMMIT");

  // 4. Final verdict
  console.log("");
  const cleared = Object.values(results).every((r) => r.ok);
  console.log(`VERDICT · 42P17 cleared = ${cleared}`);
  process.exitCode = cleared ? 0 : 1;
} catch (e) {
  console.error(`FAIL: ${e.message}${e.code ? " SQLSTATE=" + e.code : ""}`);
  process.exit(1);
} finally {
  await c.end();
}
