// scripts/apply-migration-316-sandbox.mjs
// Phase 2.1 · sequence_number for nex.support_ticket · SANDBOX ONLY.
// Owner-authorised 2026-11-10 inline with Phase 2 rollout.

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
  resolve(repoRoot, "nex-supabase/migrations/316_nex_support_ticket_sequence.sql"),
  "utf8",
);

const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 316 applied");
} finally {
  await c.end();
}

const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const hist = await v.query(
    "SELECT version, description FROM nex_migration_history WHERE version = '316'",
  );
  if (hist.rows.length !== 1) { console.error("✗ history missing"); process.exit(4); }
  console.log(`✓ History: 316 · ${hist.rows[0].description}`);

  const col = await v.query(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_schema='nex' AND table_name='support_ticket' AND column_name='sequence_number'`,
  );
  if (col.rows.length !== 1) { console.error("✗ sequence_number column missing"); process.exit(5); }
  console.log(`✓ Column · sequence_number · ${col.rows[0].data_type}`);

  const sample = await v.query(
    "SELECT ticket_number, sequence_number FROM nex.support_ticket ORDER BY sequence_number LIMIT 5",
  );
  console.log(`✓ Existing rows backfilled · ${sample.rowCount ?? 0} shown`);
  sample.rows.forEach((r) => console.log(`    ${r.sequence_number} → ${r.ticket_number}`));
} finally {
  await v.end();
}

console.log("\nMig 316 sandbox apply + verification complete.");
