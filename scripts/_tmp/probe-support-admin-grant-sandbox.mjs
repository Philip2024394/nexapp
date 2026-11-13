// Read-only · confirm support_admin_grant actually missing in sandbox or
// renamed/moved.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
function env(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const databaseUrl = env("SANDBOX_DATABASE_URL");
const u = new URL(databaseUrl);
const ref = u.username.match(/\.([a-z0-9]{15,})/)?.[1]
  ?? u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1];
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · ${ref}`); process.exit(2); }

const c = new Client({ connectionString: databaseUrl });
await c.connect();

console.log("Searching for tables matching support_admin* or support_ticket*:");
const t = await c.query(
  `SELECT table_schema, table_name FROM information_schema.tables
    WHERE table_name LIKE 'support_%' OR table_name LIKE 'nex_support_%'
    ORDER BY table_schema, table_name`,
);
if (t.rows.length === 0) {
  console.log("  (none)");
} else {
  t.rows.forEach(r => console.log(`  ${r.table_schema}.${r.table_name}`));
}

console.log("\nAlso check 'admin_grant' / 'hq_admin*' / 'nex_hq_admin*' patterns:");
const a = await c.query(
  `SELECT table_schema, table_name FROM information_schema.tables
    WHERE table_name LIKE '%admin_grant%' OR table_name LIKE 'hq_%' OR table_name LIKE 'nex_hq_%'
    ORDER BY table_schema, table_name`,
);
if (a.rows.length === 0) {
  console.log("  (none)");
} else {
  a.rows.forEach(r => console.log(`  ${r.table_schema}.${r.table_name}`));
}

console.log("\nMigration history (last 20 rows):");
const h = await c.query(
  `SELECT version, description, applied_at
     FROM nex_migration_history
    ORDER BY applied_at DESC NULLS LAST, version DESC LIMIT 20`,
);
h.rows.forEach(r => console.log(`  ${r.version} · ${r.description} · ${r.applied_at ?? "(no applied_at)"}`));

await c.end();
