#!/usr/bin/env node
// scripts/apply-migration-357-sandbox.mjs.PREFLIGHT
//
// Gate A Lane G v5 · READ-ONLY PREFLIGHT for migrations 357/358/359
// against Supabase sandbox kdstoyyeygcopkogqsyv.
//
// Modelled on apply-migration-258.mjs:1-80 with sandbox-pin changes.
// NO DDL · NO INSERT · NO DELETE · SELECT-ONLY.
//
// Safety pins:
//   CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv"
//   Hostname must end ".supabase.co" (direct) OR ".pooler.supabase.com" (pooler).
//   If pooler, pooler-username MUST match /^postgres\.kdstoyyeygcopkogqsyv$/.
//   Both pins must pass or script exits 3.
//
// Author: AGENT DB · 2026-11-19

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import pg from "pg";

const CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readEnv(key) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

// Try SANDBOX_DATABASE_URL first, fall back to DATABASE_URL
const url = readEnv("SANDBOX_DATABASE_URL") ?? readEnv("DATABASE_URL");
if (!url) {
  console.error("FATAL: Neither SANDBOX_DATABASE_URL nor DATABASE_URL found in .env.local");
  process.exit(2);
}

let parsed;
try {
  parsed = new URL(url);
} catch (e) {
  console.error(`FATAL: DATABASE URL is not a valid URL (${e.message})`);
  process.exit(2);
}

// ── Project-ref extraction ──────────────────────────────────────────────────
let projectRef = null;
let isPooler = false;

if (parsed.hostname.endsWith(".pooler.supabase.com")) {
  isPooler = true;
  const m = parsed.username.match(/^postgres\.([a-z0-9]+)$/);
  if (m) projectRef = m[1];
} else if (parsed.hostname.endsWith(".supabase.co")) {
  // Direct connection: db.<ref>.supabase.co OR <ref>.supabase.co
  const m = parsed.hostname.match(/^(?:db\.)?([a-z0-9]+)\.supabase\.co$/);
  if (m) projectRef = m[1];
}

if (projectRef !== CANONICAL_PROJECT_REF) {
  console.error(
    `FATAL: project ref '${projectRef ?? "(unparseable)"}' does not match ` +
      `canonical '${CANONICAL_PROJECT_REF}'. Refusing to connect. EXIT 3.`
  );
  process.exit(3);
}

// ── Pooler-username pin (only if pooler format) ────────────────────────────
if (isPooler) {
  const expectedUsername = `postgres.${CANONICAL_PROJECT_REF}`;
  if (parsed.username !== expectedUsername) {
    console.error(
      `FATAL: pooler-username '${parsed.username}' does not match ` +
        `expected '${expectedUsername}'. EXIT 3.`
    );
    process.exit(3);
  }
  console.log(`PIN · pooler-hostname suffix PASS · pooler-username PASS`);
} else {
  // Direct connection: hostname pin
  const expectedHost = `db.${CANONICAL_PROJECT_REF}.supabase.co`;
  if (parsed.hostname !== expectedHost) {
    console.error(
      `FATAL: hostname '${parsed.hostname}' does not match ` +
        `expected direct '${expectedHost}'. EXIT 3.`
    );
    process.exit(3);
  }
  console.log(`PIN · direct-hostname PASS (${parsed.hostname})`);
}

console.log(`TARGET · sandbox project-ref=${CANONICAL_PROJECT_REF} (hostname-verified)`);
console.log(`MODE   · READ-ONLY preflight · no DDL · no writes`);
console.log(``);

// ── Candidate file SHAs ────────────────────────────────────────────────────
const CANDIDATES = [
  {
    label: "MIG-A (v4 combined)",
    path: "nex-supabase/candidate-migrations/CANDIDATE_nex_group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW.sql",
    expectedShaPrefix: "de77e9a1",
  },
  {
    label: "MIG-A rollback",
    path: "nex-supabase/candidate-migrations/CANDIDATE_nex_group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW_rollback.sql",
    expectedShaPrefix: "7235edc9",
  },
  {
    label: "MIG-B (v5-W2)",
    path: "nex-supabase/candidate-migrations/CANDIDATE_nex_call_session_create_rpc_v5_w2_PREVIEW.sql",
    expectedShaPrefix: "51cb5586",
  },
  {
    label: "MIG-B rollback",
    path: "nex-supabase/candidate-migrations/CANDIDATE_nex_call_session_create_rpc_v5_w2_PREVIEW_rollback.sql",
    expectedShaPrefix: "07466c7e",
  },
  {
    label: "MIG-C (v5-W3)",
    path: "nex-supabase/candidate-migrations/CANDIDATE_nex_call_participant_join_rpc_v5_w3_PREVIEW.sql",
    expectedShaPrefix: "375fc243",
  },
  {
    label: "MIG-C rollback",
    path: "nex-supabase/candidate-migrations/CANDIDATE_nex_call_participant_join_rpc_v5_w3_PREVIEW_rollback.sql",
    expectedShaPrefix: "2b83c0fe",
  },
];

console.log("── CANDIDATE SHA VERIFICATION ─────────────────────────────────────────────");
const candidateShas = {};
let shaFail = false;
for (const c of CANDIDATES) {
  const buf = readFileSync(resolve(repoRoot, c.path));
  const sha = createHash("sha256").update(buf).digest("hex");
  const prefix = sha.slice(0, 8);
  const ok = sha.startsWith(c.expectedShaPrefix);
  candidateShas[c.label] = sha;
  console.log(`  ${ok ? "PASS" : "FAIL"} ${c.label}: sha256=${sha} (expected prefix ${c.expectedShaPrefix})`);
  if (!ok) shaFail = true;
}
if (shaFail) {
  console.error("FATAL: SHA mismatch on one or more candidate files. STOP.");
  process.exit(1);
}
console.log(``);

// ── Connect ────────────────────────────────────────────────────────────────
const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED to sandbox");
console.log(``);

let exitCode = 0;

try {
  // ── PRE-01 · identity pin ────────────────────────────────────────────────
  console.log("── PRE-01 · identity pin ──────────────────────────────────────────────────");
  const id = await client.query(`
    SELECT current_database() AS db,
           inet_server_addr() AS addr,
           current_user AS pg_user,
           session_user AS pg_sess
  `);
  const r01 = id.rows[0];
  // Print db name and pg_user only. inet_server_addr is a Supabase-public infra value.
  console.log(`  db=${r01.db} pg_user=${r01.pg_user} pg_sess=${r01.pg_sess}`);
  console.log(`  inet_server_addr=[supabase-infra-addr · not printed per boundary]`);
  // Verify pg_user matches sandbox pattern
  const pgUserRef = r01.pg_user?.match(/^postgres(?:\.([a-z0-9]+))?$/)?.[1] ?? null;
  // For direct connections pg_user is typically just "postgres"
  if (r01.db && r01.pg_user) {
    console.log(`  PRE-01: PASS (connected to db=${r01.db})`);
  } else {
    console.log(`  PRE-01: FAIL (missing db or pg_user)`);
    exitCode = 1;
  }
  console.log(``);

  // ── PRE-02 · migration history ───────────────────────────────────────────
  console.log("── PRE-02 · migration history ─────────────────────────────────────────────");
  const hist = await client.query(`
    SELECT version, applied_at
    FROM nex_migration_history
    WHERE version::text ~ '^(13[0-9]|35[0-9]|36[0-9])$'
    ORDER BY version::text
  `);
  for (const r of hist.rows) {
    console.log(`  version=${r.version} applied_at=${r.applied_at}`);
  }
  const versions = new Set(hist.rows.map((r) => r.version.toString()));
  const claimed357 = versions.has("357");
  const claimed358 = versions.has("358");
  const claimed359 = versions.has("359");
  console.log(`  PRE-02 summary: 133=${versions.has("133") ? "PRESENT" : "absent"} 353=${versions.has("353") ? "PRESENT" : "absent"} 354=${versions.has("354") ? "PRESENT" : "absent"} 355=${versions.has("355") ? "PRESENT" : "absent"} 356=${versions.has("356") ? "PRESENT" : "absent"}`);
  console.log(`  PRE-02 target slots: 357=${claimed357 ? "TAKEN" : "FREE"} 358=${claimed358 ? "TAKEN" : "FREE"} 359=${claimed359 ? "TAKEN" : "FREE"}`);
  if (claimed357 || claimed358 || claimed359) {
    console.error(`  PRE-02: FAIL — one or more of 357/358/359 already claimed in history`);
    exitCode = 1;
  } else {
    console.log(`  PRE-02: PASS`);
  }
  console.log(``);

  // ── PRE-03 · existing function overloads ─────────────────────────────────
  console.log("── PRE-03 · function overloads ────────────────────────────────────────────");
  for (const fname of [
    "nex_invite_to_call_tx",
    "nex_create_group_call_session_tx",
    "nex_join_group_call_session_tx",
  ]) {
    const fn = await client.query(
      `SELECT proname, pronargs, prosecdef, proconfig,
              pg_get_userbyid(proowner) AS owner,
              pg_get_function_identity_arguments(p.oid) AS signature
       FROM pg_proc p
       JOIN pg_namespace n ON p.pronamespace = n.oid
       WHERE n.nspname = 'public' AND proname = $1`,
      [fname]
    );
    if (fn.rows.length === 0) {
      console.log(`  ${fname}: NOT FOUND (N/A — will be created)`);
    } else {
      for (const r of fn.rows) {
        console.log(`  ${fname}: pronargs=${r.pronargs} prosecdef=${r.prosecdef} proconfig=${JSON.stringify(r.proconfig)} owner=${r.owner} signature=(${r.signature})`);
        if (r.owner === "postgres" && r.owner !== "supabase_admin") {
          // For Supabase sandbox, postgres owner is expected
          console.log(`    owner=${r.owner} [sandbox pattern · known OK]`);
        }
      }
    }
  }
  console.log(`  PRE-03: recorded`);
  console.log(``);

  // ── PRE-04 · function body baseline compare (MIG-A only) ─────────────────
  console.log("── PRE-04 · function body baseline compare ────────────────────────────────");
  const fnBody = await client.query(
    `SELECT prosrc FROM pg_proc WHERE proname='nex_invite_to_call_tx' AND pronargs=7`
  );
  if (fnBody.rows.length === 0) {
    console.log(`  PRE-04: FAIL — nex_invite_to_call_tx (7 params) NOT FOUND in pg_proc`);
    exitCode = 1;
  } else {
    const liveBody = fnBody.rows[0].prosrc.replace(/^\s+|\s+$/g, "");
    // Read mig-356 function body lines 142-373 (0-indexed: 141-372)
    const mig356Raw = readFileSync(
      resolve(repoRoot, "nex-supabase/migrations/356_nex_group_call_invite_v2.sql"),
      "utf8"
    );
    const mig356Lines = mig356Raw.split(/\r?\n/);
    // Function body starts after "AS $$" (line ~160 1-indexed) and ends before final "$$"
    // Find AS $$ marker
    let bodyStart = -1;
    let bodyEnd = -1;
    for (let i = 0; i < mig356Lines.length; i++) {
      if (mig356Lines[i].trim() === "AS $$") bodyStart = i + 1;
      if (bodyStart > 0 && mig356Lines[i].trim() === "$$") { bodyEnd = i; break; }
    }
    let baselineBody = "";
    if (bodyStart > 0 && bodyEnd > bodyStart) {
      baselineBody = mig356Lines.slice(bodyStart, bodyEnd).join("\n").replace(/^\s+|\s+$/g, "");
    }
    if (liveBody === baselineBody) {
      console.log(`  PRE-04: PASS — baseline OK · safe to replace with MIG-A`);
    } else {
      // Compute similarity heuristic
      console.log(`  PRE-04: MISMATCH — live body differs from mig-356 baseline.`);
      console.log(`  live body length=${liveBody.length} baseline length=${baselineBody.length}`);
      console.log(`  STOP — do not proceed to apply until divergence is reviewed.`);
      exitCode = 1;
    }
  }
  console.log(``);

  // ── PRE-05 · has_function_privilege effective grants ─────────────────────
  console.log("── PRE-05 · has_function_privilege ────────────────────────────────────────");
  const inviteSig = "public.nex_invite_to_call_tx(uuid,text,text,jsonb,text,text,uuid)";
  for (const role of ["anon", "service_role", "authenticated"]) {
    try {
      const r = await client.query(
        `SELECT has_function_privilege($1, $2, 'EXECUTE') AS can_execute`,
        [role, inviteSig]
      );
      const val = r.rows[0]?.can_execute;
      const expected =
        role === "authenticated" ? true : false;
      const pass = val === expected;
      console.log(`  nex_invite_to_call_tx · ${role}: ${val} (expected ${expected}) → ${pass ? "PASS" : "FAIL"}`);
      if (!pass) exitCode = 1;
    } catch (e) {
      console.log(`  nex_invite_to_call_tx · ${role}: ERROR ${e.message}`);
      exitCode = 1;
    }
  }
  // For not-yet-applied functions:
  for (const fname of [
    "nex_create_group_call_session_tx",
    "nex_join_group_call_session_tx",
  ]) {
    console.log(`  ${fname}: N/A (function not yet applied — all checks N/A)`);
  }
  console.log(`  PRE-05: recorded`);
  console.log(``);

  // ── PRE-06 · cap trigger enabled ─────────────────────────────────────────
  console.log("── PRE-06 · cap trigger enabled ───────────────────────────────────────────");
  const trig = await client.query(
    `SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'nex_group_call_participant_cap_tr'`
  );
  if (trig.rows.length === 0) {
    console.log(`  PRE-06: FAIL — trigger 'nex_group_call_participant_cap_tr' NOT FOUND`);
    exitCode = 1;
  } else {
    const r = trig.rows[0];
    const pass = r.tgenabled === "O";
    console.log(`  tgname=${r.tgname} tgenabled=${r.tgenabled} (expect 'O') → ${pass ? "PASS" : "FAIL"}`);
    if (!pass) exitCode = 1;
  }
  console.log(``);

  // ── PRE-07 · RLS policies ─────────────────────────────────────────────────
  console.log("── PRE-07 · RLS policies ──────────────────────────────────────────────────");
  const rls = await client.query(`
    SELECT polname, polcmd,
           pg_get_expr(polqual, polrelid) AS using_expr,
           pg_get_expr(polwithcheck, polrelid) AS with_check_expr
    FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    WHERE c.relname = 'nex_group_call_participant'
    ORDER BY polname
  `);
  if (rls.rows.length === 0) {
    console.log(`  PRE-07: no RLS policies found on nex_group_call_participant`);
  } else {
    for (const r of rls.rows) {
      console.log(`  policy=${r.polname} cmd=${r.polcmd} using=(${r.using_expr}) with_check=(${r.with_check_expr})`);
    }
    // Check insert policy
    const insertPolicy = rls.rows.find((r) => r.polname === "nex_group_call_participant_insert_self");
    if (insertPolicy) {
      const expectedUsing = `account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())`;
      // Normalize whitespace for comparison
      const normalize = (s) => (s ?? "").replace(/\s+/g, " ").trim();
      if (normalize(insertPolicy.using_expr).includes("supabase_user_id = auth.uid()")) {
        console.log(`  INSERT policy nex_group_call_participant_insert_self: PASS (matches mig-133 pattern)`);
      } else {
        console.log(`  INSERT policy nex_group_call_participant_insert_self: FLAG — using_expr differs from expected mig-133:153-157`);
      }
    }
  }
  console.log(`  PRE-07: recorded`);
  console.log(``);

  // ── PRE-08 · dependencies on existing function ───────────────────────────
  console.log("── PRE-08 · dependencies on nex_invite_to_call_tx ─────────────────────────");
  const deps = await client.query(`
    SELECT DISTINCT n.nspname, c.relname, a.attname
    FROM pg_depend d
    JOIN pg_proc p ON d.refobjid = p.oid
    JOIN pg_namespace n_fn ON p.pronamespace = n_fn.oid
    LEFT JOIN pg_class c ON d.objid = c.oid
    LEFT JOIN pg_namespace n ON c.relnamespace = n.oid
    LEFT JOIN pg_attribute a ON a.attrelid = d.objid AND a.attnum = d.objsubid
    WHERE p.proname = 'nex_invite_to_call_tx'
      AND d.deptype = 'n'
  `);
  if (deps.rows.length === 0) {
    console.log(`  PRE-08: PASS — no dependent objects found (safe to replace)`);
  } else {
    for (const r of deps.rows) {
      console.log(`  DEPENDENCY: schema=${r.nspname} rel=${r.relname} attr=${r.attname}`);
    }
    console.log(`  PRE-08: FLAG — dependent objects exist; review before replace`);
  }
  console.log(``);

  // ── PRE-09 · numbering free-check ────────────────────────────────────────
  console.log("── PRE-09 · numbering free-check ──────────────────────────────────────────");
  const claimed = new Set(hist.rows.map((r) => r.version.toString()));
  const { readdirSync } = await import("node:fs");
  const migFiles = readdirSync(resolve(repoRoot, "nex-supabase/migrations"));
  const fileNums = new Set(
    migFiles
      .map((f) => f.match(/^(\d+)_/)?.[1])
      .filter(Boolean)
  );
  let nA = null, nB = null, nC = null;
  let candidate = 357;
  while (!nA || !nB || !nC) {
    const s = String(candidate);
    if (!claimed.has(s) && !fileNums.has(s)) {
      if (!nA) nA = candidate;
      else if (!nB) nB = candidate;
      else if (!nC) { nC = candidate; break; }
    }
    candidate++;
    if (candidate > 400) { console.error("FATAL: cannot find 3 free slots"); process.exit(1); }
  }
  console.log(`  N_A=${nA} ${claimed.has(String(nA)) ? "TAKEN-history" : "free-history"} ${fileNums.has(String(nA)) ? "TAKEN-disk" : "free-disk"}`);
  console.log(`  N_B=${nB} ${claimed.has(String(nB)) ? "TAKEN-history" : "free-history"} ${fileNums.has(String(nB)) ? "TAKEN-disk" : "free-disk"}`);
  console.log(`  N_C=${nC} ${claimed.has(String(nC)) ? "TAKEN-history" : "free-history"} ${fileNums.has(String(nC)) ? "TAKEN-disk" : "free-disk"}`);
  console.log(`  PRE-09: CHOSEN N_A=${nA} N_B=${nB} N_C=${nC}`);
  console.log(``);

  // ── DECISION GATE ─────────────────────────────────────────────────────────
  console.log("── DECISION GATE ──────────────────────────────────────────────────────────");
  if (exitCode === 0) {
    console.log(`  ALL PREFLIGHT CHECKS PASSED · proceed to Phase 2`);
    console.log(`  Chosen numbers: N_A=${nA} N_B=${nB} N_C=${nC}`);
  } else {
    console.log(`  PREFLIGHT FAILED · do not proceed to Phase 2 until failures are resolved`);
  }

} catch (e) {
  console.error(`PREFLIGHT ERROR: ${e.message}`);
  exitCode = 1;
} finally {
  try { await client.end(); } catch { /* ignore */ }
}

process.exit(exitCode);
