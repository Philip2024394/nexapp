// scripts/apply-migration-313-sandbox.mjs
//
// Phase 1 G3 follow-up · apply mig 313 (security_rate_limit CHECK widening)
// to SANDBOX. Owner-authorised 2026-11-09. SANDBOX ONLY · hard-refuses
// production.

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
  resolve(repoRoot, "nex-supabase/migrations/313_nex_security_rate_limit_hq_admin_grant.sql"),
  "utf8",
);

const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 313 applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  process.exit(3);
} finally {
  await c.end();
}

// Verification
const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const hist = await v.query(
    "SELECT version, description FROM nex_migration_history WHERE version = '313'",
  );
  if (hist.rows.length !== 1) {
    console.error("VERIFY FAILED · nex_migration_history row for 313 missing");
    process.exit(4);
  }
  console.log(`✓ History: 313 · ${hist.rows[0].description}`);

  const chk = await v.query(
    "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.nex_security_rate_limit'::regclass AND conname='ck_sec_rl_action'"
  );
  const def = chk.rows[0]?.def ?? "";
  const expected = [
    "password_change", "session_revoke", "session_revoke_all",
    "chat_message", "account_create", "webauthn_assert",
    "webauthn_enroll", "visitor_bootstrap", "hq_admin_grant",
  ];
  const missing = expected.filter((e) => !def.includes(`'${e}'`));
  if (missing.length > 0) {
    console.error(`✗ Missing values: ${missing.join(", ")}`);
    console.error(`Current CHECK: ${def}`);
    process.exit(5);
  }
  console.log(`✓ CHECK contains all 9 sealed actions`);

  // Prove the write path now works · insert + delete a test row with hq_admin_grant
  await v.query("BEGIN");
  try {
    await v.query(
      "INSERT INTO nex_security_rate_limit (key, action, window_started_at, count) VALUES ('acct:00000000-aaaa-4aaa-aaaa-000000000000', 'hq_admin_grant', now(), 1)"
    );
    const q = await v.query("SELECT count FROM nex_security_rate_limit WHERE action='hq_admin_grant' AND key='acct:00000000-aaaa-4aaa-aaaa-000000000000'");
    console.log(`✓ Test INSERT with action='hq_admin_grant' succeeded · count=${q.rows[0]?.count}`);
    await v.query("ROLLBACK"); // leave no test residue
    console.log(`✓ Test row rolled back · sandbox table unchanged`);
  } catch (e) {
    console.error(`✗ Test INSERT FAILED: ${e?.message}`);
    try { await v.query("ROLLBACK"); } catch {}
    process.exit(6);
  }
} finally {
  await v.end();
}

console.log("\nMig 313 sandbox apply + verification complete.");
