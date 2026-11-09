// scripts/sweep-s0-inventory-sandbox.mjs
//
// Historical secure-deletion sweep · Phase S0 · INVENTORY ONLY.
// Owner-authorised 2026-11-09 under the continuation-to-100 build.
// Sandbox-only · hard-refuses production ref.
//
// What this script does:
//   · Connects to sandbox Supabase via SANDBOX_DATABASE_URL in .env.local
//   · Counts rows in pre-device-only private-content tables
//   · Enumerates storage buckets + rough object counts
//   · Emits a timestamped JSON inventory report to stdout
//   · Does NOT delete or modify anything
//
// What this script does NOT do:
//   · Touch production (hard-refused at line 25)
//   · Remove, rewrite, drop, or alter anything
//   · Require S1..S6 authorisation (S0 is read-only)
//
// Next phase (S1) requires its own explicit owner authorisation per the
// sealed historical sweep procedure doctrine (I-4 compliance).

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function env(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} not found in .env.local`);
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

const c = new Client({ connectionString: databaseUrl });
await c.connect();

const report = {
  phase: "S0",
  phase_name: "inventory",
  generated_at: new Date().toISOString(),
  target_ref: ref,
  env: "sandbox",
  invariant: "I-4 (read-only · no deletion · requires owner review before S1)",
  tables: {},
  buckets: {},
  warnings: [],
};

async function countExists(table, whereClause, label) {
  const sql = `
    SELECT (
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1
      ) THEN (
        -- Table exists · check columns
        1
      ) ELSE 0 END
    ) AS table_exists
  `;
  const existsRes = await c.query(sql, [table]);
  if (!existsRes.rows[0].table_exists) {
    report.tables[label] = { exists: false, count: 0 };
    return;
  }
  try {
    const countRes = await c.query(`SELECT COUNT(*)::bigint AS n FROM public.${table} WHERE ${whereClause}`);
    report.tables[label] = {
      exists: true,
      table,
      where: whereClause,
      count: Number(countRes.rows[0].n),
    };
  } catch (e) {
    report.warnings.push(`${label} count failed · ${e?.message ?? e}`);
    report.tables[label] = { exists: true, table, where: whereClause, count: null, error: e?.message };
  }
}

async function columnExists(table, column) {
  const res = await c.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return res.rows.length === 1;
}

// Build column-aware WHERE clauses · tables may have evolved.
async function inventoryMessageTables() {
  for (const spec of [
    { table: "nex_peer_message", columns: ["body", "ciphertext", "plaintext", "content", "message_body"] },
    { table: "nex_message",      columns: ["body", "ciphertext", "plaintext", "content", "message_body"] },
  ]) {
    const presentColumns = [];
    for (const col of spec.columns) {
      if (await columnExists(spec.table, col)) presentColumns.push(col);
    }
    if (presentColumns.length === 0) {
      report.tables[`${spec.table}_private_content`] = {
        exists: await columnExists(spec.table, "id"),
        table: spec.table,
        note: "no body/ciphertext/plaintext/content columns present · schema may have advanced past S3",
        count: 0,
      };
      continue;
    }
    const where = presentColumns.map((c) => `${c} IS NOT NULL`).join(" OR ");
    await countExists(spec.table, where, `${spec.table}_private_content`);
    report.tables[`${spec.table}_private_content`].columns_checked = presentColumns;
  }
}

async function inventoryAttachmentMeta() {
  for (const table of ["nex_peer_message", "nex_message"]) {
    if (!(await columnExists(table, "attachment_meta"))) continue;
    try {
      const res = await c.query(
        `SELECT COUNT(*)::bigint AS total,
                SUM(CASE WHEN attachment_meta IS NOT NULL AND attachment_meta != '{}'::jsonb THEN 1 ELSE 0 END)::bigint AS non_empty,
                SUM(CASE WHEN attachment_meta ? 'product_name'
                           OR attachment_meta ? 'cart_items'
                           OR attachment_meta ? 'buyer_name'
                           OR attachment_meta ? 'buyer_address' THEN 1 ELSE 0 END)::bigint AS with_sensitive_keys
           FROM public.${table}`,
      );
      report.tables[`${table}_attachment_meta`] = {
        exists: true,
        table,
        total: Number(res.rows[0].total ?? 0),
        non_empty: Number(res.rows[0].non_empty ?? 0),
        with_sensitive_keys: Number(res.rows[0].with_sensitive_keys ?? 0),
      };
    } catch (e) {
      report.warnings.push(`${table}.attachment_meta inventory failed · ${e?.message ?? e}`);
    }
  }
}

async function inventoryBuckets() {
  try {
    const bucketsRes = await c.query(
      `SELECT id, name, public, created_at FROM storage.buckets ORDER BY name`,
    );
    for (const b of bucketsRes.rows) {
      const objRes = await c.query(
        `SELECT COUNT(*)::bigint AS n FROM storage.objects WHERE bucket_id = $1`,
        [b.id],
      );
      report.buckets[b.name] = {
        public: b.public,
        objects: Number(objRes.rows[0].n),
        created_at: b.created_at,
        sweep_relevance: b.name === "nex-peer-chat-attachments"
          ? "sealed S1 target · retire this bucket"
          : /(peer|chat|private|message)/i.test(b.name)
            ? "review manually · potential sweep target"
            : "public business asset · not a sweep target",
      };
    }
  } catch (e) {
    report.warnings.push(`storage.buckets enumeration failed · ${e?.message ?? e}`);
  }
}

async function inventoryMigrationState() {
  try {
    const res = await c.query(
      `SELECT version, description, applied_at
         FROM nex_migration_history
        WHERE version IN ('320', '321', '322', '323', '324', '325', '326', '327')
        ORDER BY version::int`,
    );
    report.migration_state = {
      phase_2_migrations_applied: res.rows.map((r) => ({
        version: r.version,
        description: r.description,
        applied_at: r.applied_at,
      })),
      notes:
        res.rows.length === 0
          ? "No Phase 2 migrations applied yet in this env."
          : `${res.rows.length} Phase 2 migration(s) applied.`,
    };
  } catch (e) {
    report.warnings.push(`migration state check failed · ${e?.message ?? e}`);
  }
}

try {
  await inventoryMessageTables();
  await inventoryAttachmentMeta();
  await inventoryBuckets();
  await inventoryMigrationState();
} finally {
  await c.end();
}

// Compute total exposure summary
const totalPrivateContent = Object.entries(report.tables)
  .filter(([k]) => k.endsWith("_private_content"))
  .reduce((acc, [, v]) => acc + (v.count ?? 0), 0);

report.summary = {
  total_rows_with_private_content: totalPrivateContent,
  non_empty_attachment_meta_rows: Object.entries(report.tables)
    .filter(([k]) => k.endsWith("_attachment_meta"))
    .reduce((acc, [, v]) => acc + (v.non_empty ?? 0), 0),
  attachment_meta_with_sensitive_keys: Object.entries(report.tables)
    .filter(([k]) => k.endsWith("_attachment_meta"))
    .reduce((acc, [, v]) => acc + (v.with_sensitive_keys ?? 0), 0),
  buckets_requiring_review: Object.entries(report.buckets)
    .filter(([, v]) => v.sweep_relevance !== "public business asset · not a sweep target").length,
};

const outputPath = resolve(repoRoot, `docs/sweep/s0-inventory-${ref}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
try {
  writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n");
  console.log(`\n✓ Inventory report written to ${outputPath}`);
} catch (e) {
  console.log("\nInventory report (could not write file):");
  console.log(JSON.stringify(report, null, 2));
}

console.log("\nS0 complete. S1-S6 require separate explicit owner authorisation per sealed I-4.");
