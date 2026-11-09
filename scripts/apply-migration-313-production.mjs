// scripts/apply-migration-313-production.mjs
//
// Phase 1 G3 follow-up · apply mig 313 to PRODUCTION. Prepared under
// comprehensive G3 mandate · 2026-11-09. Hard-refuses without env flag
// NEX_PRODUCTION_APPLY_CONFIRMED=YES-I-UNDERSTAND. Hard-refuses non-production
// refs. Hard-refuses if mig 290 not applied in target.
//
// Usage (after separate G3-prod owner authorisation):
//   NEX_PRODUCTION_APPLY_CONFIRMED=YES-I-UNDERSTAND \
//     node scripts/apply-migration-313-production.mjs

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

if (process.env.NEX_PRODUCTION_APPLY_CONFIRMED !== "YES-I-UNDERSTAND") {
  console.error("============================================================");
  console.error("Mig 313 production apply · confirmation env flag required");
  console.error("============================================================");
  console.error("Set NEX_PRODUCTION_APPLY_CONFIRMED=YES-I-UNDERSTAND to proceed.");
  console.error("Prerequisite · mig 290 must be applied to production first");
  console.error("(script will hard-check this).");
  process.exit(1);
}

const databaseUrl = env("DATABASE_URL");
const u = new URL(databaseUrl);
const ref = u.username.match(/\.([a-z0-9]{15,})/)?.[1]
  ?? u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1];
if (ref !== "ijvqdvsvwtwxzcqmoqit") {
  console.error(`STOP · unexpected ref ${ref} · production only`);
  process.exit(2);
}
console.log(`Target · production ${ref}`);

const pre = new Client({ connectionString: databaseUrl, statement_timeout: 60000 });
await pre.connect();
try {
  const existing313 = await pre.query(
    "SELECT applied_at::text FROM nex_migration_history WHERE version = '313'",
  );
  if (existing313.rows.length > 0) {
    console.error(`STOP · mig 313 already recorded (${existing313.rows[0].applied_at})`);
    process.exit(3);
  }
  const existing290 = await pre.query(
    "SELECT applied_at::text FROM nex_migration_history WHERE version = '290'",
  );
  if (existing290.rows.length === 0) {
    console.error("STOP · mig 290 NOT applied · 290 must precede 313");
    process.exit(4);
  }
  console.log(`✓ Prerequisite: mig 290 applied ${existing290.rows[0].applied_at}`);
} finally {
  await pre.end();
}

const sql = readFileSync(
  resolve(repoRoot, "nex-supabase/migrations/313_nex_security_rate_limit_hq_admin_grant.sql"),
  "utf8",
);

const apply = new Client({ connectionString: databaseUrl, statement_timeout: 60000 });
try {
  await apply.connect();
  await apply.query(sql);
  console.log(`✓ Migration 313 applied · committed`);
} catch (e) {
  console.error(`APPLY FAILED: ${e?.message}`);
  process.exit(5);
} finally {
  await apply.end();
}

const verify = new Client({ connectionString: databaseUrl, statement_timeout: 60000 });
await verify.connect();
try {
  const hist = await verify.query("SELECT version, description FROM nex_migration_history WHERE version='313'");
  console.log(`✓ Ledger: ${hist.rows[0]?.version} · ${hist.rows[0]?.description}`);

  const chk = await verify.query(
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
    process.exit(6);
  }
  console.log(`✓ CHECK contains all 9 sealed actions`);
} finally {
  await verify.end();
}

console.log(`\nMig 313 production apply + verification complete.`);
