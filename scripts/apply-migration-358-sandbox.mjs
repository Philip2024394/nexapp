// scripts/apply-migration-358-sandbox.mjs
//
// Gate A Lane G v5 · Apply migration 358 (nex_create_group_call_session_tx v5-W2)
// against Supabase sandbox kdstoyyeygcopkogqsyv ONLY.
// Author: AGENT DB · 2026-11-19
//
// Modelled on apply-migration-315-sandbox.mjs.
// Pins: CANONICAL_PROJECT_REF + direct-or-pooler hostname + migration SHA.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { Client } from "pg";

const CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv";
const MIGRATION_NUMBER = "358";
const MIGRATION_FILE = "nex-supabase/migrations/358_nex_create_group_call_session_tx.sql";
const EXPECTED_SHA = "51cb55863636a8b23f4c825646f5eeb980159493cedef7b36aea44154d4344db";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function env(key) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

// ── Project-ref pin ────────────────────────────────────────────────────────
const url = env("SANDBOX_DATABASE_URL") ?? env("DATABASE_URL");
if (!url) { console.error("FATAL: no DATABASE_URL in .env.local"); process.exit(2); }

const parsed = new URL(url);
let projectRef = null;

if (parsed.hostname.endsWith(".pooler.supabase.com")) {
  const m = parsed.username.match(/^postgres\.([a-z0-9]+)$/);
  if (m) projectRef = m[1];
  if (projectRef !== CANONICAL_PROJECT_REF) {
    console.error(`STOP · pooler-username project-ref '${projectRef}' !== '${CANONICAL_PROJECT_REF}'`);
    process.exit(3);
  }
  if (parsed.username !== `postgres.${CANONICAL_PROJECT_REF}`) {
    console.error(`STOP · pooler-username mismatch`); process.exit(3);
  }
} else if (parsed.hostname.endsWith(".supabase.co")) {
  const m = parsed.hostname.match(/^(?:db\.)?([a-z0-9]+)\.supabase\.co$/);
  if (m) projectRef = m[1];
  if (projectRef !== CANONICAL_PROJECT_REF) {
    console.error(`STOP · hostname project-ref '${projectRef}' !== '${CANONICAL_PROJECT_REF}'`);
    process.exit(3);
  }
} else {
  console.error(`STOP · unrecognised hostname '${parsed.hostname}'`); process.exit(3);
}

if (projectRef === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production ref"); process.exit(3); }
console.log(`Target · sandbox ${projectRef}`);

// ── Migration SQL file + SHA pin ───────────────────────────────────────────
const sqlBuf = readFileSync(resolve(repoRoot, MIGRATION_FILE));
const actualSha = createHash("sha256").update(sqlBuf).digest("hex");
if (actualSha !== EXPECTED_SHA) {
  console.error(`STOP · migration file SHA mismatch: got ${actualSha} expected ${EXPECTED_SHA}`);
  process.exit(1);
}
console.log(`SHA · ${actualSha} VERIFIED`);
const sql = sqlBuf.toString("utf8");

// ── Connect + apply ────────────────────────────────────────────────────────
const tStart = Date.now();
const c = new Client({ connectionString: url });
try {
  await c.connect();
  console.log("CONNECTED");

  // Check if already applied
  const pre = await c.query(
    "SELECT version FROM nex_migration_history WHERE version = $1",
    [MIGRATION_NUMBER]
  );
  if (pre.rows.length > 0) {
    console.log(`Migration ${MIGRATION_NUMBER} already in history · verifying post-state only`);
  } else {
    // Execute migration (file contains its own BEGIN;...COMMIT;)
    await c.query(sql);
    console.log(`Migration ${MIGRATION_NUMBER} SQL executed`);

    // Write history row. Schema: (version text NOT NULL, applied_at timestamptz
    // NOT NULL DEFAULT now(), description text NOT NULL, notes text NULL).
    // Style matches migrations 353 and 356 which write their own row.
    await c.query(
      `INSERT INTO nex_migration_history(version, description, notes)
       VALUES ($1, $2, $3) ON CONFLICT (version) DO NOTHING`,
      [
        MIGRATION_NUMBER,
        "nex_create_group_call_session_tx · W2 session creation with server-side invitee slice",
        "Net-new SECURITY DEFINER RPC · server-side 3-invitee cap · sandbox only",
      ]
    );
    console.log(`History row inserted for version ${MIGRATION_NUMBER}`);
  }

  // ── Post-check ──────────────────────────────────────────────────────────
  console.log("── POST-CHECK");
  const fnRows = await c.query(
    `SELECT proname, pronargs, prosecdef, proconfig,
            pg_get_userbyid(proowner) AS owner,
            pg_get_function_identity_arguments(p.oid) AS signature
     FROM pg_proc p
     JOIN pg_namespace n ON p.pronamespace = n.oid
     WHERE n.nspname = 'public' AND proname = 'nex_create_group_call_session_tx'`
  );
  if (!fnRows.rows.length) {
    console.error("POST: FAIL — nex_create_group_call_session_tx not found in pg_proc");
    process.exit(1);
  }
  const fn = fnRows.rows[0];
  console.log(`  pg_proc: pronargs=${fn.pronargs} prosecdef=${fn.prosecdef} proconfig=${JSON.stringify(fn.proconfig)} owner=${fn.owner}`);
  if (!fn.prosecdef) { console.error("POST: FAIL prosecdef != true"); process.exit(1); }
  if (!fn.proconfig?.includes("search_path=public, pg_temp")) { console.error("POST: FAIL search_path not set"); process.exit(1); }

  const sig = "public.nex_create_group_call_session_tx(text, uuid, text, uuid[])";
  for (const [role, expected] of [["anon", false], ["service_role", false], ["authenticated", true]]) {
    const v = (await c.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS v", [role, sig])).rows[0].v;
    console.log(`  privilege · ${role}: ${v} (exp ${expected}) → ${v === expected ? "PASS" : "FAIL"}`);
    if (v !== expected) { process.exitCode = 1; }
  }

  const hist = await c.query("SELECT version, applied_at FROM nex_migration_history WHERE version = $1", [MIGRATION_NUMBER]);
  if (!hist.rows.length) { console.error("POST: FAIL history row missing"); process.exit(1); }
  console.log(`  history: version=${hist.rows[0].version} applied_at=${hist.rows[0].applied_at}`);

  const ms = Date.now() - tStart;
  console.log(`\nMig ${MIGRATION_NUMBER} sandbox apply complete · duration=${ms}ms · exitCode=${process.exitCode ?? 0}`);

} catch (e) {
  console.error(`FAIL: ${e.message}${e.code ? " SQLSTATE=" + e.code : ""}`);
  process.exit(1);
} finally {
  try { await c.end(); } catch { /* ignore */ }
}
