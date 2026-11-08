// scripts/apply-migration-307-sandbox.mjs
//
// Owner-authorised 2026-11-08 (round 25) · Option C hybrid.
// Applies 307_nex_group_call_country.sql to sandbox only.

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
const refFromUser = u.username.match(/\.([a-z0-9]{15,})/)?.[1] ?? null;
const refFromHost = u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1] ?? null;
const ref = refFromUser ?? refFromHost;
if (ref === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production ref"); process.exit(2); }
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · unknown ref ${ref}`); process.exit(2); }
console.log(`Target · sandbox ${ref}`);

const sql = readFileSync(
  resolve(repoRoot, "nex-supabase/migrations/307_nex_group_call_country.sql"),
  "utf8",
);
const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query("BEGIN");
  await c.query(sql);
  await c.query("COMMIT");
  console.log("Migration applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  try { await c.query("ROLLBACK"); } catch {}
  process.exit(3);
} finally {
  await c.end();
}

const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const sessCol = await v.query(
    `SELECT column_name, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_group_call_session'
        AND column_name='host_country'`,
  );
  const partCols = await v.query(
    `SELECT column_name, is_nullable, data_type
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_group_call_participant'
        AND column_name IN ('joined_from_country','cross_country_consent_at')
      ORDER BY column_name`,
  );
  const checks = await v.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname IN (
        'ck_group_call_session_host_country',
        'ck_group_call_participant_joined_from_country',
        'ck_group_call_participant_consent_shape'
      ) ORDER BY conname`,
  );
  const idx = await v.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname='public' AND indexname IN (
        'idx_nex_group_call_session_host_country',
        'idx_nex_group_call_participant_cross_country'
      ) ORDER BY indexname`,
  );
  const hist = await v.query(
    `SELECT version, description FROM nex_migration_history WHERE version='307'`,
  );
  const compat = await v.query(
    `SELECT
       (SELECT COUNT(*) FILTER (WHERE host_country IS NULL)::int FROM nex_group_call_session) AS session_missing_country,
       (SELECT COUNT(*) FILTER (WHERE cross_country_consent_at IS NOT NULL AND joined_from_country IS NULL)::int FROM nex_group_call_participant) AS orphan_consent`,
  );
  const grants = await v.query(
    `SELECT grantee, privilege_type FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name='nex_group_call_session' AND grantee='service_role'
      ORDER BY privilege_type`,
  );
  console.log(`✓ Session.host_country: ${JSON.stringify(sessCol.rows[0])}`);
  console.log(`✓ Participant new columns:`);
  for (const r of partCols.rows) console.log(`    - ${r.column_name} · nullable=${r.is_nullable} · ${r.data_type}`);
  console.log(`✓ CHECK constraints:`);
  for (const r of checks.rows) console.log(`    - ${r.conname}`);
  console.log(`✓ Indexes:`);
  for (const r of idx.rows) console.log(`    - ${r.indexname}`);
  console.log(`✓ service_role grants (unchanged):`);
  for (const r of grants.rows) console.log(`    - ${r.privilege_type}`);
  console.log(
    `✓ Compat · sessions_missing_country=${compat.rows[0].session_missing_country} · orphan_consent=${compat.rows[0].orphan_consent}`,
  );
  if (compat.rows[0].session_missing_country !== 0 || compat.rows[0].orphan_consent !== 0) {
    console.error("FAIL · migration left historical rows in a bad state");
    process.exit(4);
  }
  console.log(`✓ History: ${hist.rows[0]?.version} · ${hist.rows[0]?.description}`);
} finally {
  await v.end();
}
console.log("DONE · sandbox migration 307 applied + verified");
