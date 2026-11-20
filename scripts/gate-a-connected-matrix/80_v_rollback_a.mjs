#!/usr/bin/env node
// scripts/gate-a-connected-matrix/80_v_rollback_a.mjs
//
// V-ROLLBACK-A · MIG-A rollback procedure.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// FAILURE-PATH INVOCATION ONLY. This script is NOT part of the forward run.
// Default behavior: print intent and rollback SQL path, then exit 0 with
//   ROLLBACK EXECUTION UNVERIFIED (source inspected only)
// unless GATE_A_ROLLBACK_INVOKED=1 is set AND a reason file exists.
//
// Rollback: drops v4 nex_invite_to_call_tx, restores mig-356 body verbatim.
// Rollback source: candidate-migrations/CANDIDATE_nex_group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW_rollback.sql

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../..");
const ROLLBACK_SQL_PATH = "nex-supabase/candidate-migrations/CANDIDATE_nex_group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW_rollback.sql";
const REASON_FILE = resolve(__dir, "_rollback_a_reason.txt");
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

console.log("=== V-ROLLBACK-A: MIG-A rollback script ===");
console.log(`Rollback SQL: ${ROLLBACK_SQL_PATH}`);
console.log(`Rollback effect: DROP v4 nex_invite_to_call_tx + restore mig-356 function body verbatim.`);
console.log(`Does NOT restore nex_migration_history row (operator decision).`);
console.log(`Does NOT cover test-fixture row cleanup.`);

if (!process.env.GATE_A_ROLLBACK_INVOKED || process.env.GATE_A_ROLLBACK_INVOKED !== "1") {
  console.log("\nSTATUS: ROLLBACK EXECUTION UNVERIFIED (source inspected only)");
  console.log("To execute: set GATE_A_ROLLBACK_INVOKED=1 and create _rollback_a_reason.txt with reason.");
  console.log(JSON.stringify({ verdict: "ROLLBACK_EXECUTION_UNVERIFIED", detail: "source inspected only" }));
  process.exit(0);
}

if (!existsSync(REASON_FILE)) {
  console.error("STOP: GATE_A_ROLLBACK_INVOKED=1 but _rollback_a_reason.txt does not exist. Cannot proceed.");
  console.log(JSON.stringify({ verdict: "ROLLBACK_BLOCKED", detail: "reason file missing" }));
  process.exit(1);
}

const reason = readFileSync(REASON_FILE, "utf8").trim();
console.log(`Reason: ${reason}`);

const databaseUrl = readEnv("SANDBOX_DATABASE_URL");
if (!databaseUrl || databaseUrl.includes(PRODUCTION_REF)) {
  console.error("FATAL: SANDBOX_DATABASE_URL missing or contains production ref");
  process.exit(2);
}
// Project ref check
let u; try { u = new URL(databaseUrl); } catch (e) { console.error("FATAL: invalid URL"); process.exit(2); }
const ref = u.username.match(/^postgres\.([a-z0-9]+)$/)?.[1] ?? u.hostname.match(/^(?:db\.)?([a-z0-9]+)\.supabase\.co$/)?.[1];
if (ref === PRODUCTION_REF) { console.error("FATAL: production ref"); process.exit(3); }
if (ref !== CANONICAL_PROJECT_REF) { console.error(`FATAL: unexpected ref ${ref}`); process.exit(3); }

const rollbackPath = resolve(REPO_ROOT, ROLLBACK_SQL_PATH);
if (!existsSync(rollbackPath)) {
  console.error(`FATAL: rollback SQL not found at ${rollbackPath}`);
  process.exit(2);
}
const sql = readFileSync(rollbackPath, "utf8");

console.log(`\nEXECUTING rollback for MIG-A against sandbox ${CANONICAL_PROJECT_REF}...`);
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query(sql);
  console.log("Rollback applied.");
  // Verify: nex_invite_to_call_tx should still exist (mig-356 body restored)
  const res = await client.query("SELECT proname FROM pg_proc WHERE proname='nex_invite_to_call_tx' AND pronargs=7");
  if (res.rows.length === 0) {
    console.error("FAIL: nex_invite_to_call_tx not found after rollback");
    console.log(JSON.stringify({ verdict: "ROLLBACK_FAIL", detail: "function not found after rollback" }));
    process.exit(1);
  }
  console.log("PASS: nex_invite_to_call_tx restored (mig-356 body)");
  console.log(JSON.stringify({ verdict: "ROLLBACK_APPLIED", detail: "MIG-A rolled back; mig-356 body restored" }));
} catch (e) {
  console.error(`Rollback failed: ${e.message}`);
  console.log(JSON.stringify({ verdict: "ROLLBACK_FAIL", detail: e.message }));
  process.exit(1);
} finally {
  await client.end();
}
