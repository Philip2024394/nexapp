// scripts/apply-migration-291-sandbox.mjs
//
// Phase 1.1 Security · apply mig 291 (atomic rate-limit RPC) to SANDBOX.
// Owner-authorised 2026-11-09 remediation. Hard-refuses production ref.
//
// Requires: mig 290 + 313 already applied (table + CHECK constraint).
// Apply this script only after owner explicit "apply mig 291 sandbox"
// authorisation.

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
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const databaseUrl = env("SANDBOX_DATABASE_URL");
const u = new URL(databaseUrl);
const ref = u.username.match(/\.([a-z0-9]{15,})/)?.[1]
  ?? u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1];
if (ref === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production ref"); process.exit(2); }
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · unknown ref ${ref}`); process.exit(2); }
console.log(`Target · sandbox ${ref}`);

const sql = readFileSync(
  resolve(repoRoot, "nex-supabase/migrations/291_nex_security_rate_limit_claim_rpc.sql"),
  "utf8",
);

const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 291 applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  process.exit(3);
} finally {
  await c.end();
}

// V-291-T* verification
const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  // T1 · history row present
  const hist = await v.query(
    "SELECT version, description FROM nex_migration_history WHERE version = '291'",
  );
  if (hist.rows.length !== 1) {
    console.error("VERIFY FAILED · migration_history row missing");
    process.exit(4);
  }
  console.log(`✓ T1 · history row present`);

  // T2 · function exists with correct signature
  const sig = await v.query(
    `SELECT pg_get_function_arguments(oid) AS args, pg_get_function_result(oid) AS result
       FROM pg_proc
      WHERE proname = 'nex_security_rate_limit_claim'
        AND pronamespace = 'public'::regnamespace`,
  );
  if (sig.rows.length !== 1) {
    console.error(`✗ T2 · function not found or duplicated · rows=${sig.rows.length}`);
    process.exit(5);
  }
  console.log(`✓ T2 · function signature · args=(${sig.rows[0].args}) returns=${sig.rows[0].result}`);

  // T3 · SECURITY DEFINER + pinned search_path
  const defn = await v.query(
    `SELECT prosecdef, proconfig
       FROM pg_proc
      WHERE proname = 'nex_security_rate_limit_claim'
        AND pronamespace = 'public'::regnamespace`,
  );
  if (!defn.rows[0]?.prosecdef) {
    console.error(`✗ T3 · function is NOT SECURITY DEFINER`);
    process.exit(6);
  }
  const config = defn.rows[0].proconfig ?? [];
  const hasSearchPath = Array.isArray(config) && config.some((c) => c.startsWith("search_path="));
  if (!hasSearchPath) {
    console.error(`✗ T3 · search_path not pinned · config=${JSON.stringify(config)}`);
    process.exit(7);
  }
  console.log(`✓ T3 · SECURITY DEFINER + search_path pinned`);

  // T4 · EXECUTE grants · service_role only
  const grants = await v.query(
    `SELECT grantee, privilege_type
       FROM information_schema.role_routine_grants
      WHERE routine_schema = 'public'
        AND routine_name = 'nex_security_rate_limit_claim'
        AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')`,
  );
  const anonAuthenticated = grants.rows.filter(
    (r) => r.grantee === "anon" || r.grantee === "authenticated" || r.grantee === "PUBLIC",
  );
  if (anonAuthenticated.length > 0) {
    console.error(`✗ T4 · function EXECUTE grant leaked · ${JSON.stringify(anonAuthenticated)}`);
    process.exit(8);
  }
  const serviceRole = grants.rows.find((r) => r.grantee === "service_role");
  if (!serviceRole) {
    console.error(`✗ T4 · service_role MISSING EXECUTE grant`);
    process.exit(9);
  }
  console.log(`✓ T4 · EXECUTE grant · service_role only`);

  // T5 · functional claim · insert a test key under test action and
  // confirm atomic claim returns (true, 0) · then over-limit returns
  // (false, retry>0).
  await v.query("BEGIN");
  try {
    // Fresh key so it doesn't collide with real traffic
    const testKey = "acct:00000000-cccc-4ccc-aaaa-000000000001";
    const r1 = await v.query(
      `SELECT * FROM public.nex_security_rate_limit_claim($1, 'chat_message', 1, 2)`,
      [testKey],
    );
    if (!r1.rows[0] || r1.rows[0].allowed !== true || r1.rows[0].retry_after_seconds !== 0) {
      console.error(`✗ T5a · first claim should allow=true · got ${JSON.stringify(r1.rows[0])}`);
      await v.query("ROLLBACK");
      process.exit(10);
    }
    const r2 = await v.query(
      `SELECT * FROM public.nex_security_rate_limit_claim($1, 'chat_message', 1, 2)`,
      [testKey],
    );
    if (!r2.rows[0] || r2.rows[0].allowed !== true) {
      console.error(`✗ T5b · second claim should allow=true · got ${JSON.stringify(r2.rows[0])}`);
      await v.query("ROLLBACK");
      process.exit(11);
    }
    const r3 = await v.query(
      `SELECT * FROM public.nex_security_rate_limit_claim($1, 'chat_message', 1, 2)`,
      [testKey],
    );
    if (!r3.rows[0] || r3.rows[0].allowed !== false || r3.rows[0].retry_after_seconds <= 0) {
      console.error(`✗ T5c · third claim should allow=false retry>0 · got ${JSON.stringify(r3.rows[0])}`);
      await v.query("ROLLBACK");
      process.exit(12);
    }
    console.log(
      `✓ T5 · claim sequence · (${r1.rows[0].allowed},${r1.rows[0].retry_after_seconds}) ` +
        `→ (${r2.rows[0].allowed},${r2.rows[0].retry_after_seconds}) → ` +
        `(${r3.rows[0].allowed},${r3.rows[0].retry_after_seconds})`,
    );
    await v.query("ROLLBACK"); // leave no test residue
    console.log(`✓ T5 · test rows rolled back · sandbox clean`);
  } catch (e) {
    console.error(`✗ T5 · functional test failed: ${e?.message}`);
    try { await v.query("ROLLBACK"); } catch {}
    process.exit(13);
  }
} finally {
  await v.end();
}

console.log("\nMig 291 sandbox apply + verification complete · V-291-T1..T5 all green.");
console.log("Service layer will detect RPC on first rate-limit call and activate atomic path.");
