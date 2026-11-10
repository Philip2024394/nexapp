// scripts/apply-all-P-RLS-sandbox.mjs
// Apply every P-RLS-nex_*_PROPOSAL.sql file to SANDBOX. Hard-refuses prod.
// Idempotent per-file · each proposal uses CREATE POLICY IF NOT EXISTS or
// an equivalent guard. Reports each file's apply outcome + post-apply
// RLS state on the target table.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename } from "node:path";
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
console.log(`Target · sandbox ${ref}\n`);

const migrationsDir = resolve(repoRoot, "nex-supabase/migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.startsWith("P-RLS-nex_") && f.endsWith("_PROPOSAL.sql"))
  .sort();

console.log(`Found ${files.length} P-RLS-nex_* proposals.\n`);

// Extract "nex_xxx" table name from "P-RLS-nex_xxx_PROPOSAL.sql"
function tableFromFile(f) {
  const base = basename(f, "_PROPOSAL.sql");
  return base.replace(/^P-RLS-/, "");
}

const results = { ok: [], idempotent: [], failed: [] };

const c = new Client({ connectionString: databaseUrl });
await c.connect();

const vcli = new Client({ connectionString: databaseUrl });
await vcli.connect();

try {
  for (const f of files) {
    const table = tableFromFile(f);
    const sql = readFileSync(resolve(migrationsDir, f), "utf8");

    // Apply
    try {
      await c.query(sql);
      // Verify RLS enabled on target table
      const rls = await vcli.query(
        "SELECT relrowsecurity FROM pg_class WHERE oid=('public.' || $1)::regclass",
        [table],
      ).catch(() => ({ rows: [{ relrowsecurity: null }] }));
      const on = rls.rows[0]?.relrowsecurity;
      if (on === true) {
        console.log(`✓ ${f} · ${table} · RLS=on`);
        results.ok.push({ f, table });
      } else if (on === null) {
        console.log(`? ${f} · ${table} · target table does not exist · skipping verify`);
        results.ok.push({ f, table, note: "table-absent" });
      } else {
        console.log(`✗ ${f} · ${table} · applied but RLS still off`);
        results.failed.push({ f, table, reason: "rls_off_after_apply" });
      }
    } catch (e) {
      const msg = e?.message ?? String(e);
      if (/already exists|duplicate|already recorded/i.test(msg)) {
        console.log(`· ${f} · ${table} · idempotent (${msg.split("\n")[0].slice(0, 80)})`);
        results.idempotent.push({ f, table });
      } else if (/does not exist|unknown table|relation .+ does not exist/i.test(msg)) {
        console.log(`? ${f} · ${table} · table absent (${msg.split("\n")[0].slice(0, 80)})`);
        results.failed.push({ f, table, reason: "table_absent", msg });
      } else {
        console.log(`✗ ${f} · ${table} · ${msg.split("\n")[0].slice(0, 120)}`);
        results.failed.push({ f, table, reason: "apply_error", msg });
      }
    }
  }
} finally {
  await c.end();
  await vcli.end();
}

console.log(`\n================ Summary ================`);
console.log(`Applied OK: ${results.ok.length}`);
console.log(`Idempotent: ${results.idempotent.length}`);
console.log(`Failed:     ${results.failed.length}`);
if (results.failed.length > 0) {
  console.log(`\nFailures:`);
  for (const r of results.failed) console.log(`  - ${r.f} (${r.reason})`);
  process.exit(3);
}
console.log(`\nAll P-RLS proposals processed.`);
