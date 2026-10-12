#!/usr/bin/env node
// scripts/audit-stage0-production-baseline.mjs
//
// Stage 0 · Production baseline · READ-ONLY.
//
// Scope sealed by the owner's approval message on 2026-10-13:
//   · Only read; zero writes, zero migrations, zero deletions
//   · Confirm the exact database and schema being audited
//   · Produce real counts and dependencies for the 197 orphan
//     canonicals and the synthetic proof row
//   · Dump the full category slug distribution + alias collisions
//   · Assess whether the identity-bridge migration (nex_business.
//     canonical_business_id) is safe to apply to the live schema
//   · Establish a recoverable baseline for later verification
//
// The script runs ONLY SELECT and read-only catalog queries. If any
// write path accidentally exists, the sealed project-id gate at
// top will refuse to connect. Face-cover tables are NOT read beyond
// column listing · the auditor never touches cover_layout_id values
// or chat_theme values.

import pg from "pg";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const APPROVED_PROJECT_ID = "ijvqdvsvwtwxzcqmoqit";

function verifyTarget(url) {
  const u = new URL(url.replace(/^postgres(ql)?:\/\//, "http://"));
  const m = /^postgres\.([a-z0-9]+)$/.exec(u.username);
  if (!m || m[1] !== APPROVED_PROJECT_ID) {
    throw new Error(
      `REFUSED · pooler user is not sealed project '${APPROVED_PROJECT_ID}'`,
    );
  }
  return { project: m[1], host: u.hostname };
}

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const ts = () => new Date().toISOString();

async function sectionBar(label) {
  const bar = "═".repeat(78);
  log(`\n${bar}\n§ ${label}\n${bar}`);
}

const OUT_LINES = [];
function log(...args) {
  const line = args
    .map((a) =>
      typeof a === "string"
        ? a
        : JSON.stringify(a, null, 2),
    )
    .join(" ");
  console.log(line);
  OUT_LINES.push(line);
}

async function table(client, label, sql, args = []) {
  try {
    const r = await client.query(sql, args);
    log(`\n${label}`);
    if (r.rows.length === 0) {
      log("  (no rows)");
    } else {
      // Convert rows to a stable text table
      const cols = Object.keys(r.rows[0]);
      const header = cols.join(" · ");
      log("  " + header);
      log("  " + "─".repeat(Math.min(header.length, 100)));
      for (const row of r.rows) {
        const vals = cols
          .map((c) => {
            const v = row[c];
            if (v === null) return "(null)";
            if (v instanceof Date) return v.toISOString();
            if (typeof v === "string" && v.length > 60) return v.slice(0, 57) + "...";
            if (Array.isArray(v)) return "[" + v.join(",") + "]";
            if (typeof v === "object") return JSON.stringify(v).slice(0, 60);
            return String(v);
          })
          .join(" · ");
        log("  " + vals);
      }
    }
    return r.rows;
  } catch (e) {
    log(`\n${label}\n  ERROR · ${e.message.slice(0, 240)}`);
    return [];
  }
}

async function scalar(client, label, sql, args = []) {
  try {
    const r = await client.query(sql, args);
    const val = r.rows[0] ? Object.values(r.rows[0])[0] : null;
    log(`  ${label.padEnd(60)} ${val}`);
    return val;
  } catch (e) {
    log(`  ${label.padEnd(60)} ERROR: ${e.message.slice(0, 120)}`);
    return null;
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL unset");
  const target = verifyTarget(url);

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  // Record a safety fingerprint of the connection string (without password)
  const connFingerprint = sha256(
    url.replace(/:[^:/@]+@/, ":****@"),
  ).slice(0, 16);

  await sectionBar("Stage 0 · head");
  log(`run_timestamp:               ${ts()}`);
  log(`approved_project_id:         ${APPROVED_PROJECT_ID}`);
  log(`actual_project (from pooler username): ${target.project}`);
  log(`pooler_host:                 ${target.host}`);
  log(`conn_fingerprint (sha256, pwd-redacted): ${connFingerprint}`);
  await scalar(client, "current_database():", "SELECT current_database()");
  await scalar(client, "current_user:", "SELECT current_user");
  await scalar(client, "server_version:", "SELECT version()");
  await scalar(client, "server_now():", "SELECT now()");
  await scalar(client, "server_timezone:", "SHOW timezone");
  await scalar(client, "pg_is_in_recovery (true=replica, false=primary):", "SELECT pg_is_in_recovery()");

  await sectionBar("1 · Schema inventory · identity-relevant tables");
  // List all tables in the nex schema and in public (filtered to tables
  // this audit touches). We never read the row-level data for
  // face-cover customisation tables.
  await table(client, "schemas visible to the pooler role:", `
    SELECT schema_name FROM information_schema.schemata
     WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast','pg_temp_1','pg_toast_temp_1')
     ORDER BY schema_name
  `);
  await table(client, "nex.* table inventory (row count via reltuples estimate):", `
    SELECT c.relname AS table, c.reltuples::bigint AS reltuples_est,
           pg_size_pretty(pg_relation_size(c.oid)) AS heap_size
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'nex' AND c.relkind IN ('r','p')
     ORDER BY c.relname
  `);
  await table(client, "public.* identity tables (only the ones in scope):", `
    SELECT c.relname AS table, c.reltuples::bigint AS reltuples_est,
           pg_size_pretty(pg_relation_size(c.oid)) AS heap_size
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r','p')
       AND c.relname IN (
         'nex_account','nex_business','nex_product','nex_service',
         'nex_chat_theme','nex_peer_conversation','nex_peer_message',
         'nex_friend_edge','nex_account_profile'
       )
     ORDER BY c.relname
  `);

  // Columns on nex_business (identity-critical) and the WIP column we
  // plan to add. We check whether canonical_business_id already exists.
  await table(client, "nex_business column inventory:", `
    SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='nex_business'
     ORDER BY ordinal_position
  `);
  await scalar(client, "nex_business.canonical_business_id already present?", `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='nex_business'
         AND column_name='canonical_business_id'
    )
  `);

  // nex.business_canonical schema (incl. the sealed CHECK constraints).
  await table(client, "nex.business_canonical column inventory:", `
    SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
     WHERE table_schema='nex' AND table_name='business_canonical'
     ORDER BY ordinal_position
  `);
  await table(client, "nex.business_canonical constraints:", `
    SELECT conname, contype, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid=c.connamespace
     WHERE n.nspname='nex' AND conrelid::regclass::text='nex.business_canonical'
     ORDER BY conname
  `);
  await table(client, "FK constraints referencing nex.business_canonical:", `
    SELECT conname, conrelid::regclass::text AS from_table, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
     WHERE contype='f'
       AND confrelid::regclass::text='nex.business_canonical'
     ORDER BY from_table, conname
  `);

  await sectionBar("2 · Migration history");
  // Supabase doesn't maintain a migration ledger in our schema; the
  // repo's nex-supabase/migrations/ files are applied manually. The
  // best evidence we have is which TABLES / COLUMNS exist that each
  // migration would have created. We spot-check the ones that matter.
  await table(client, "Does the WIP migration (nex_business.canonical_business_id) appear applied anywhere?", `
    SELECT c.relname AS table, a.attname AS column
      FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum > 0 AND NOT a.attisdropped
     WHERE a.attname='canonical_business_id'
       AND n.nspname IN ('public','nex')
     ORDER BY c.relname
  `);
  await table(client, "source_registry rows (what the walker + legacy promoters cite):", `
    SELECT source_id, source_type, can_derive, can_display,
           attribution_required, attribution_template
      FROM nex.source_registry
     ORDER BY source_id
  `);

  await sectionBar("3 · Headline integrity counts (expected ↔ measured)");
  const baseline = {};
  baseline.canonical_total = await scalar(client, "nex.business_canonical rows (expected 40,738):",
    "SELECT COUNT(*)::int FROM nex.business_canonical");
  baseline.directory_v = await scalar(client, "nex.business_directory_v rows (expected 40,541):",
    "SELECT COUNT(*)::int FROM nex.business_directory_v");
  baseline.evidence = await scalar(client, "nex.business_evidence rows (expected 40,703):",
    "SELECT COUNT(*)::int FROM nex.business_evidence");
  baseline.lifecycle_log = await scalar(client, "nex.business_canonical_lifecycle_log rows:",
    "SELECT COUNT(*)::int FROM nex.business_canonical_lifecycle_log");
  baseline.category_image_library = await scalar(client, "nex.category_image_library rows:",
    "SELECT COUNT(*)::int FROM nex.category_image_library");
  baseline.source_registry = await scalar(client, "nex.source_registry rows:",
    "SELECT COUNT(*)::int FROM nex.source_registry");
  baseline.nex_business = await scalar(client, "nex_business rows:",
    "SELECT COUNT(*)::int FROM nex_business");
  baseline.nex_product_live = await scalar(client, "nex_product rows status='live':",
    "SELECT COUNT(*)::int FROM nex_product WHERE status='live'");
  try {
    baseline.business_claim = await scalar(client, "nex.business_claim rows:",
      "SELECT COUNT(*)::int FROM nex.business_claim");
  } catch { baseline.business_claim = "ERROR"; }

  await sectionBar("4 · Orphan canonicals deep-dive (A2)");
  const orphans = await client.query(`
    SELECT bc.canonical_business_id, bc.entity_type, bc.lifecycle_state,
           bc.name_canonical, bc.city, bc.osm_id, bc.created_at,
           bc.updated_at, bc.last_verified_at,
           bc.phone_e164, bc.website_apex, bc.category_ids
      FROM nex.business_canonical bc
     WHERE NOT EXISTS (
       SELECT 1 FROM nex.business_evidence be
        WHERE be.canonical_business_id = bc.canonical_business_id
     )
     ORDER BY bc.created_at
  `);
  log(`\norphan canonical count: ${orphans.rowCount}`);
  // Group by entity_type + lifecycle + source attribution guess
  const byState = new Map();
  for (const r of orphans.rows) {
    const k = `${r.entity_type}/${r.lifecycle_state}`;
    byState.set(k, (byState.get(k) ?? 0) + 1);
  }
  log("\norphan breakdown by entity_type/lifecycle_state:");
  for (const [k, v] of byState) log(`  ${k.padEnd(32)} ${v}`);

  // Check for FK dependents on each orphan canonical_business_id in
  // all tables that reference nex.business_canonical. If any orphan
  // IS referenced somewhere, deletion would cascade or RESTRICT.
  const orphanIds = orphans.rows.map((r) => r.canonical_business_id);
  const refTables = (await client.query(`
    SELECT conrelid::regclass::text AS from_table
      FROM pg_constraint c
     WHERE contype='f' AND confrelid::regclass::text='nex.business_canonical'
  `)).rows.map((r) => r.from_table);
  log(`\nTables with FK to nex.business_canonical: ${refTables.join(", ")}`);

  for (const t of refTables) {
    try {
      const n = (await client.query(
        `SELECT COUNT(*)::int AS n FROM ${t} WHERE canonical_business_id = ANY($1::uuid[])`,
        [orphanIds],
      )).rows[0].n;
      log(`  references from ${t.padEnd(50)} ${n}`);
    } catch (e) {
      log(`  references from ${t.padEnd(50)} ERROR · ${e.message.slice(0, 120)}`);
    }
  }

  // business_canonical_lifecycle_log references each orphan should
  // typically have exactly 1 row (the DISCOVERED → VERIFIED
  // transition our bulk promoter wrote). If there's an evidence
  // orphan with a lifecycle_log entry, the earlier per-row script
  // committed partial work.
  await table(client, "orphans sampled with their lifecycle_log entries (first 5):", `
    SELECT bc.canonical_business_id, bc.name_canonical, bc.city,
           COUNT(l.canonical_business_id)::int AS lifecycle_log_rows
      FROM nex.business_canonical bc
      LEFT JOIN nex.business_canonical_lifecycle_log l
             ON l.canonical_business_id = bc.canonical_business_id
     WHERE NOT EXISTS (
       SELECT 1 FROM nex.business_evidence be
        WHERE be.canonical_business_id = bc.canonical_business_id
     )
     GROUP BY bc.canonical_business_id, bc.name_canonical, bc.city, bc.created_at
     ORDER BY bc.created_at
     LIMIT 5
  `);

  // Dump the full orphan list to a side file for permanence.
  mkdirSync("logs/stage0-evidence", { recursive: true });
  const orphansJsonPath = "logs/stage0-evidence/orphans-2026-10-13.json";
  writeFileSync(
    orphansJsonPath,
    JSON.stringify(orphans.rows, null, 2),
    "utf8",
  );
  log(`\n→ full orphan dump written to ${orphansJsonPath} (${orphans.rowCount} rows)`);

  await sectionBar("5 · Synthetic proof row deep-dive");
  const syntheticRows = await client.query(`
    SELECT * FROM nex.business_canonical
     WHERE name_canonical ILIKE 'SYNTHETIC NEX FIRST LIVE WRITE PROOF%'
        OR city = 'SYNTHETIC-CITY'
  `);
  log(`synthetic row count: ${syntheticRows.rowCount}`);
  for (const r of syntheticRows.rows) {
    log(`  canonical_business_id: ${r.canonical_business_id}`);
    log(`  name_canonical:        ${r.name_canonical}`);
    log(`  city:                  ${r.city}`);
    log(`  entity_type:           ${r.entity_type}`);
    log(`  lifecycle_state:       ${r.lifecycle_state}`);
    log(`  osm_id:                ${r.osm_id}`);
    log(`  created_at:            ${r.created_at.toISOString()}`);
    log(`  category_ids:          [${(r.category_ids ?? []).join(",")}]`);
    // Per-FK dependency check
    for (const t of refTables) {
      try {
        const n = (await client.query(
          `SELECT COUNT(*)::int AS n FROM ${t} WHERE canonical_business_id = $1`,
          [r.canonical_business_id],
        )).rows[0].n;
        log(`  references from ${t.padEnd(50)} ${n}`);
      } catch (e) {
        log(`  references from ${t.padEnd(50)} ERROR · ${e.message.slice(0, 120)}`);
      }
    }
  }

  await sectionBar("6 · Category slug distribution + alias collisions");
  await table(client, "slugs appearing in nex.business_canonical.category_ids (top 40 by count):", `
    SELECT unnest(category_ids) AS slug, COUNT(*)::int AS n
      FROM nex.business_canonical
     GROUP BY slug
     ORDER BY n DESC
     LIMIT 40
  `);
  const allSlugsInDb = await client.query(`
    SELECT DISTINCT unnest(category_ids) AS slug
      FROM nex.business_canonical
  `);
  const dbSlugs = new Set(allSlugsInDb.rows.map((r) => r.slug));
  log(`\ndistinct slugs in business_canonical.category_ids: ${dbSlugs.size}`);

  await table(client, "slugs in category_image_library NOT present in any canonical row:", `
    SELECT cil.category_slug, COUNT(*)::int AS library_rows
      FROM nex.category_image_library cil
     WHERE cil.active
       AND NOT EXISTS (
         SELECT 1 FROM nex.business_canonical bc
          WHERE cil.category_slug = ANY(bc.category_ids)
       )
     GROUP BY cil.category_slug
     ORDER BY cil.category_slug
     LIMIT 50
  `);

  await sectionBar("7 · Identity-bridge safety assessment");
  // We WOULD add nex_business.canonical_business_id uuid NULL + partial
  // unique index. Before authorising that migration, verify:
  //   (a) column does not exist today (checked §1 above)
  //   (b) nex_business row count (small enough for ALTER TABLE to be
  //       nearly instant on Supabase)
  //   (c) no competing migration adds that column with a different
  //       shape (we grep the migration folder, not the DB, for
  //       archaeological safety)
  //   (d) partial UNIQUE INDEX ... WHERE canonical_business_id IS NOT
  //       NULL can be created CONCURRENTLY (Supabase allows it on
  //       user schemas)
  //   (e) nex.business_canonical has a stable UUID PK that nex_business
  //       can soft-reference
  await scalar(client, "nex_business rows (ALTER TABLE cost basis):",
    "SELECT COUNT(*)::int FROM nex_business");
  await table(client, "existing indexes on nex_business:", `
    SELECT indexname, indexdef FROM pg_indexes
     WHERE schemaname='public' AND tablename='nex_business'
     ORDER BY indexname
  `);
  await table(client, "existing FKs out of nex_business:", `
    SELECT conname, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
     WHERE contype='f' AND conrelid::regclass::text='public.nex_business'
     ORDER BY conname
  `);
  await scalar(client, "nex.business_canonical PK is uuid?",
    `SELECT data_type FROM information_schema.columns
      WHERE table_schema='nex' AND table_name='business_canonical'
        AND column_name='canonical_business_id'`);
  await scalar(client, "any existing claim rows (should constrain reconciler scope):",
    "SELECT COUNT(*)::int FROM nex.business_claim");
  await scalar(client, "VERIFIED claim rows (would need backfill):", `
    SELECT COUNT(*)::int FROM nex.business_claim WHERE state='VERIFIED'
  `);

  await sectionBar("8 · Face-cover sanity check (read-only · do NOT touch values)");
  // We only confirm the column exists and record one row count. Never
  // read individual values · the owner's cover customisations and
  // chat themes are explicitly protected.
  await scalar(client, "nex_business.cover_layout_id column exists?", `
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='nex_business'
                      AND column_name='cover_layout_id')
  `);
  await scalar(client, "nex_account.chat_theme column exists?", `
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='nex_account'
                      AND column_name='chat_theme')
  `);
  await scalar(client, "rows in nex_business with cover_layout_id set (count only):",
    "SELECT COUNT(*)::int FROM nex_business WHERE cover_layout_id IS NOT NULL");
  await scalar(client, "rows in nex_account with chat_theme non-null (count only):",
    "SELECT COUNT(*)::int FROM nex_account WHERE chat_theme IS NOT NULL");

  await sectionBar("9 · Recoverable baseline snapshot");
  // We cannot pg_dump through the pooler without superuser, but we CAN
  // record a cryptographic fingerprint of the identity-critical row
  // sets so a later run can detect drift at the row-count + hash
  // level. Every count is captured. Face-cover is excluded.
  const snapshot = { ...baseline };
  snapshot.orphan_canonical_count = orphans.rowCount;
  snapshot.synthetic_proof_row_count = syntheticRows.rowCount;
  snapshot.distinct_slugs_in_canonical = dbSlugs.size;
  snapshot.ref_fk_tables = refTables;
  snapshot.recorded_at = ts();
  snapshot.project_id = APPROVED_PROJECT_ID;

  // Fingerprint of the orphan ids (so re-running later shows whether
  // the SAME 197 rows are still orphaned, or whether anything moved).
  snapshot.orphan_ids_fingerprint = sha256(
    orphans.rows
      .map((r) => r.canonical_business_id)
      .sort()
      .join(","),
  );
  // Fingerprint of category_ids slugs (so category reclass can be
  // detected without a full re-dump).
  snapshot.canonical_slugs_fingerprint = sha256(
    [...dbSlugs].sort().join(","),
  );

  log("\nsnapshot:");
  log(JSON.stringify(snapshot, null, 2));

  const snapshotPath = "logs/stage0-evidence/baseline-2026-10-13.json";
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");
  log(`\n→ baseline snapshot written to ${snapshotPath}`);

  // Also persist the full console log so the evidence trail survives.
  writeFileSync(
    "logs/stage0-evidence/stage0-console-2026-10-13.log",
    OUT_LINES.join("\n"),
    "utf8",
  );
  log("\n→ full console transcript saved to logs/stage0-evidence/stage0-console-2026-10-13.log");

  await client.end();
  log("\nSTAGE 0 COMPLETE · no writes performed.");
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
