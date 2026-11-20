#!/usr/bin/env node
// scripts/gate-a-connected-matrix/82_v_rollback_c.mjs
//
// V-ROLLBACK-C · MIG-C rollback procedure.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// FAILURE-PATH INVOCATION ONLY. Default: source-inspect + UNVERIFIED exit.
// Rollback: DROP FUNCTION IF EXISTS nex_join_group_call_session_tx(UUID,TEXT)
// Rollback source: candidate-migrations/CANDIDATE_nex_call_participant_join_rpc_v5_w3_PREVIEW_rollback.sql

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../..");
const ROLLBACK_SQL_PATH = "nex-supabase/candidate-migrations/CANDIDATE_nex_call_participant_join_rpc_v5_w3_PREVIEW_rollback.sql";
const REASON_FILE = resolve(__dir, "_rollback_c_reason.txt");
const CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv";
const PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit";

function readEnv(key) {
  const envPath = resolve(REPO_ROOT, ".env.local");
  const raw = readFileSync(envPath, "utf8");
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

console.log("=== V-ROLLBACK-C: MIG-C rollback script ===");
console.log(`Rollback SQL: ${ROLLBACK_SQL_PATH}`);
console.log("Rollback effect: DROP FUNCTION IF EXISTS nex_join_group_call_session_tx(UUID,TEXT)");
console.log("Note: nothing to restore (MIG-C is a net-new function). DROP is correct rollback.");

if (!process.env.GATE_A_ROLLBACK_INVOKED || process.env.GATE_A_ROLLBACK_INVOKED !== "1") {
  console.log("\nSTATUS: ROLLBACK EXECUTION UNVERIFIED (source inspected only)");
  console.log(JSON.stringify({ verdict: "ROLLBACK_EXECUTION_UNVERIFIED", detail: "source inspected only" }));
  process.exit(0);
}

if (!existsSync(REASON_FILE)) {
  console.error("STOP: GATE_A_ROLLBACK_INVOKED=1 but _rollback_c_reason.txt does not exist.");
  console.log(JSON.stringify({ verdict: "ROLLBACK_BLOCKED", detail: "reason file missing" }));
  process.exit(1);
}

const reason = readFileSync(REASON_FILE, "utf8").trim();
console.log(`Reason: ${reason}`);

const databaseUrl = readEnv("SANDBOX_DATABASE_URL");
if (!databaseUrl || databaseUrl.includes(PRODUCTION_REF)) { console.error("FATAL: DB URL issue"); process.exit(2); }
let u; try { u = new URL(databaseUrl); } catch { console.error("FATAL: invalid URL"); process.exit(2); }
const ref = u.username.match(/^postgres\.([a-z0-9]+)$/)?.[1] ?? u.hostname.match(/^(?:db\.)?([a-z0-9]+)\.supabase\.co$/)?.[1];
if (ref === PRODUCTION_REF || ref !== CANONICAL_PROJECT_REF) { console.error(`FATAL: ref ${ref}`); process.exit(3); }

const rollbackPath = resolve(REPO_ROOT, ROLLBACK_SQL_PATH);
if (!existsSync(rollbackPath)) { console.error(`FATAL: rollback SQL not found at ${rollbackPath}`); process.exit(2); }
const sql = readFileSync(rollbackPath, "utf8");

console.log(`\nEXECUTING rollback for MIG-C...`);
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query(sql);
  console.log("Rollback applied.");
  const res = await client.query("SELECT proname FROM pg_proc WHERE proname='nex_join_group_call_session_tx'");
  if (res.rows.length > 0) {
    console.error("FAIL: nex_join_group_call_session_tx still exists after DROP");
    console.log(JSON.stringify({ verdict: "ROLLBACK_FAIL", detail: "function still exists after DROP" }));
    process.exit(1);
  }
  console.log("PASS: nex_join_group_call_session_tx dropped");
  console.log(JSON.stringify({ verdict: "ROLLBACK_APPLIED", detail: "MIG-C dropped — pg_proc has no row for nex_join_group_call_session_tx" }));
} catch (e) {
  console.error(`Rollback failed: ${e.message}`);
  console.log(JSON.stringify({ verdict: "ROLLBACK_FAIL", detail: e.message }));
  process.exit(1);
} finally {
  await client.end();
}
