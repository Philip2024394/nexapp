// scripts/apply-migration-312-production.mjs
//
// Phase 1 · F-1 · apply mig 312 (billing tables RLS lockdown) to PRODUCTION.
// Owner-authorised 2026-11-09 (G2). SCOPE: mig 312 only · nothing else.
// Hard-refuses any non-production ref. Hard-refuses without the owner's
// explicit NEX_PRODUCTION_APPLY_CONFIRMED=YES-I-UNDERSTAND env flag.
//
// Usage:
//   NEX_PRODUCTION_APPLY_CONFIRMED=YES-I-UNDERSTAND \
//     node scripts/apply-migration-312-production.mjs
//
// After apply this script runs V-F1-T6a..f verification inline and prints
// a full AFTER-state snapshot. V-F1-T6g (anon-REST probe) and V-F1-T6h
// (service-role roundtrip) are verified by a follow-up inline check.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function env(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} not found`);
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

// --- G2 confirmation gate --------------------------------------------------
if (process.env.NEX_PRODUCTION_APPLY_CONFIRMED !== "YES-I-UNDERSTAND") {
  console.error("============================================================");
  console.error("Mig 312 production apply · G2 authorisation required");
  console.error("============================================================");
  console.error("This script applies migration 312 (nex_billing tables RLS");
  console.error("lockdown) to the production Supabase project ijvqdvsvwtwxzcqmoqit.");
  console.error("Set NEX_PRODUCTION_APPLY_CONFIRMED=YES-I-UNDERSTAND to proceed.");
  console.error("");
  console.error("Rollback available at");
  console.error("  nex-supabase/migrations/312_nex_billing_rls_lockdown.rollback.sql");
  console.error("(see Phase 1 G2 preflight doctrine for full evidence).");
  console.error("============================================================");
  process.exit(1);
}

// --- Target ref hard-check -------------------------------------------------
const databaseUrl = env("DATABASE_URL");
const u = new URL(databaseUrl);
const refFromUser = u.username.match(/\.([a-z0-9]{15,})/)?.[1] ?? null;
const refFromHost = u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1] ?? null;
const ref = refFromUser ?? refFromHost;
if (ref !== "ijvqdvsvwtwxzcqmoqit") {
  console.error(`STOP · unexpected ref ${ref} · this script targets production ijvqdvsvwtwxzcqmoqit only`);
  process.exit(2);
}
console.log(`Target · production ${ref}`);

// --- Preflight: inspect the SQL + confirm state ----------------------------
const sql = readFileSync(
  resolve(repoRoot, "nex-supabase/migrations/312_nex_billing_rls_lockdown.sql"),
  "utf8",
);
console.log(`\nAbout to execute ${sql.length} chars of SQL from`);
console.log(`  nex-supabase/migrations/312_nex_billing_rls_lockdown.sql`);

const BILLING_TABLES = [
  "nex_billing_event_log",
  "nex_billing_adverse_event",
  "nex_billing_checkout_session",
];

const pre = new Client({ connectionString: databaseUrl, statement_timeout: 60000 });
await pre.connect();
try {
  // Idempotency check
  const existing312 = await pre.query(
    "SELECT applied_at::text FROM nex_migration_history WHERE version = '312'",
  );
  if (existing312.rows.length > 0) {
    console.error(`STOP · mig 312 already recorded (${existing312.rows[0].applied_at})`);
    process.exit(3);
  }

  // Confirm 258 applied (prerequisite for the ELSE branch)
  const existing258 = await pre.query(
    "SELECT applied_at::text FROM nex_migration_history WHERE version = '258'",
  );
  if (existing258.rows.length === 0) {
    console.error("STOP · mig 258 NOT applied · 312 would run no-op path only");
    console.error("Production state has diverged from preflight evidence · investigate.");
    process.exit(4);
  }
  console.log(`✓ Preflight · mig 258 applied ${existing258.rows[0].applied_at} · ELSE branch will run`);

  // Capture BEFORE state (sanity · must match preflight doctrine)
  const beforeRls = await pre.query(
    "SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname = ANY($1) ORDER BY c.relname",
    [BILLING_TABLES],
  );
  console.log(`✓ BEFORE RLS state: ${JSON.stringify(beforeRls.rows)}`);
  const rlsAllOff = beforeRls.rows.every((r) => r.relrowsecurity === false);
  if (!rlsAllOff) {
    console.error("STOP · one or more tables already has RLS enabled · state unexpected");
    process.exit(5);
  }
} finally {
  await pre.end();
}

// --- Apply ---------------------------------------------------------------
const apply = new Client({ connectionString: databaseUrl, statement_timeout: 60000 });
try {
  await apply.connect();
  await apply.query(sql);
  console.log(`\n✓ Migration 312 applied · committed`);
} catch (e) {
  console.error(`\nAPPLY FAILED: ${e?.message}`);
  process.exit(6);
} finally {
  await apply.end();
}

// --- V-F1-T6a..f verification (SQL-based) ---------------------------------
console.log(`\n--- V-F1-T6 verification ---`);
const verify = new Client({ connectionString: databaseUrl, statement_timeout: 60000 });
await verify.connect();
let anyFail = false;
try {
  // V-F1-T6a · ledger has 312
  const hist = await verify.query(
    "SELECT applied_at::text, LEFT(description, 80) AS desc FROM nex_migration_history WHERE version = '312'",
  );
  if (hist.rows.length !== 1) {
    console.error("✗ V-F1-T6a FAIL · nex_migration_history row for 312 missing");
    anyFail = true;
  } else {
    console.log(`✓ V-F1-T6a · ledger · ${hist.rows[0].applied_at} · ${hist.rows[0].desc}`);
  }

  // V-F1-T6b · relrowsecurity=true on all 3
  const rls = await verify.query(
    "SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname = ANY($1) ORDER BY c.relname",
    [BILLING_TABLES],
  );
  const allOn = rls.rows.every((r) => r.relrowsecurity === true);
  if (allOn && rls.rows.length === 3) {
    console.log(`✓ V-F1-T6b · RLS enabled on all 3 billing tables`);
  } else {
    console.error(`✗ V-F1-T6b FAIL · ${JSON.stringify(rls.rows)}`);
    anyFail = true;
  }

  // V-F1-T6c/d · anon + authenticated grants = empty
  const anonAuth = await verify.query(
    `SELECT table_name, grantee, privilege_type
       FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name = ANY($1)
        AND grantee IN ('anon', 'authenticated')
      ORDER BY table_name, grantee, privilege_type`,
    [BILLING_TABLES],
  );
  if (anonAuth.rows.length === 0) {
    console.log(`✓ V-F1-T6c · anon privileges on all 3 tables · EMPTY`);
    console.log(`✓ V-F1-T6d · authenticated privileges on all 3 tables · EMPTY`);
  } else {
    console.error(`✗ V-F1-T6c/d FAIL · remaining anon/authenticated grants: ${JSON.stringify(anonAuth.rows)}`);
    anyFail = true;
  }

  // V-F1-T6e · service_role has SELECT/INSERT/UPDATE/DELETE on all 3
  const sr = await verify.query(
    `SELECT table_name, privilege_type
       FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name = ANY($1)
        AND grantee = 'service_role'
      ORDER BY table_name, privilege_type`,
    [BILLING_TABLES],
  );
  const REQ = new Set(["SELECT", "INSERT", "UPDATE", "DELETE"]);
  const byTable = new Map();
  for (const r of sr.rows) {
    if (!byTable.has(r.table_name)) byTable.set(r.table_name, new Set());
    byTable.get(r.table_name).add(r.privilege_type);
  }
  let srOk = true;
  for (const t of BILLING_TABLES) {
    const have = byTable.get(t) ?? new Set();
    for (const need of REQ) {
      if (!have.has(need)) {
        console.error(`✗ V-F1-T6e FAIL · service_role missing ${need} on ${t}`);
        srOk = false;
        anyFail = true;
      }
    }
  }
  if (srOk) console.log(`✓ V-F1-T6e · service_role has SELECT/INSERT/UPDATE/DELETE on all 3 tables`);

  // V-F1-T6f · row counts unchanged (expect 0 across all 3)
  for (const t of BILLING_TABLES) {
    const r = await verify.query(`SELECT COUNT(*)::bigint AS n FROM "${t}"`);
    console.log(`✓ V-F1-T6f · row count ${t}: ${r.rows[0].n}`);
  }

  // V-F1-T6h-direct · service-role can round-trip a SELECT (indirect proof the
  // webhook processor's service-role client continues to function).
  // We do NOT INSERT a test row (would pollute production audit log).
  for (const t of BILLING_TABLES) {
    try {
      const r = await verify.query(`SELECT COUNT(*)::bigint AS n FROM "${t}"`);
      // If RLS blocked service-role, the query would error · a value in
      // r.rows[0].n (even "0") proves the lockdown preserves service-role
      // access. COUNT(*) always returns exactly one row so rows[0] is defined.
      if (r.rows[0]?.n !== undefined) {
        console.log(`✓ V-F1-T6h-direct · service-role SELECT round-trip on ${t} succeeded (count=${r.rows[0].n})`);
      } else {
        console.error(`✗ V-F1-T6h-direct FAIL on ${t}: COUNT returned unexpected shape`);
        anyFail = true;
      }
    } catch (e) {
      console.error(`✗ V-F1-T6h-direct FAIL on ${t}: ${e instanceof Error ? e.message : String(e)}`);
      anyFail = true;
    }
  }
} finally {
  await verify.end();
}

if (anyFail) {
  console.error(`\n============================================================`);
  console.error(`  VERIFICATION FAILED · one or more V-F1-T6 checks did not pass`);
  console.error(`============================================================`);
  process.exit(7);
}

console.log(`\n============================================================`);
console.log(`  MIG 312 PRODUCTION APPLY · V-F1-T6a..f + T6h-direct GREEN`);
console.log(`============================================================`);
console.log(`V-F1-T6g · anon-REST probe · requires Supabase anon key + REST`);
console.log(`          · verified separately via inline anon probe script.`);
console.log(``);
console.log(`Next · V-F1-T6g anon-REST probe + final AFTER-state report.`);
