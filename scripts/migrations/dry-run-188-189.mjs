#!/usr/bin/env node
// scripts/migrations/dry-run-188-189.mjs
//
// Transactional dry-run for migrations 188 (business_media backfill DDL)
// and 189 (business_media_review). FAIL-CLOSED by design: aborts
// immediately on any sign that transactional rollback cannot be
// guaranteed.
//
// Founder-authorised 2026-10-13 (Decision 3) · READ-ONLY review
// artifact · DO NOT EXECUTE without separate authorisation.
//
// What this script proves (when authorised to run):
//   · The project id in DATABASE_URL is ijvqdvsvwtwxzcqmoqit.
//   · PostgreSQL supports transactional DDL for every statement in
//     both migrations (verified by executing inside BEGIN; ROLLBACK;).
//   · After apply inside the txn: business_media_review table exists;
//     business_media table unchanged (because it already exists live).
//   · After ROLLBACK: business_media_review is gone; business_media
//     is still unchanged. Initial state === final state.
//
// What this script DOES NOT do:
//   · Does not commit anything.
//   · Does not change source_registry.can_display.
//   · Does not approve any business_media rows.
//   · Does not run the reconciliation script.
//   · Does not change RLS or GRANT state.
//
// Fail-closed invariants (abort if any fail):
//   1. DATABASE_URL extractable + matches sealed project.
//   2. Can open a transaction.
//   3. Initial snapshot capture succeeds.
//   4. Migration files readable + non-empty.
//   5. Migration SQL contains ONLY transactional-safe operations
//      (no CREATE INDEX CONCURRENTLY, no VACUUM, no CREATE DATABASE,
//       no ALTER SYSTEM, etc.).
//   6. ROLLBACK succeeds.
//   7. Post-rollback snapshot === initial snapshot.

import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const APPROVED_PROJECT_ID = "ijvqdvsvwtwxzcqmoqit";
const MIGRATION_FILES = [
  "nex-supabase/migrations/188_nex_business_media_backfill_ddl.sql",
  "nex-supabase/migrations/189_nex_business_media_review.sql",
];

// Transaction-unsafe operations · abort if any migration contains them.
const UNSAFE_PATTERNS = [
  /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i,
  /\bDROP\s+INDEX\s+CONCURRENTLY\b/i,
  /\bCREATE\s+DATABASE\b/i,
  /\bDROP\s+DATABASE\b/i,
  /\bVACUUM\b/i,
  /\bALTER\s+SYSTEM\b/i,
  /\bREINDEX\b/i,
  /\bCLUSTER\b/i,
];

/**
 * CRITICAL FIX (2026-10-13 · post-incident):
 * Strip the migration's own BEGIN/COMMIT/ROLLBACK statements before
 * executing inside the outer transaction. Postgres does NOT nest
 * transactions · a nested BEGIN is a no-op (with warning) but a
 * nested COMMIT commits the OUTER transaction, which then persists
 * all DDL irreversibly.
 *
 * The incident: migration 189 contains `BEGIN; CREATE TABLE …;
 * COMMIT;`. Executing it inside the script's outer BEGIN caused the
 * inner COMMIT to persist the table before the outer ROLLBACK fired.
 *
 * Fix: strip top-level BEGIN/COMMIT/ROLLBACK/END statements. Only
 * line-start matches (not inside strings · we assume migration SQL
 * does not contain BEGIN/COMMIT inside string literals, which is
 * standard convention).
 */
function stripOuterTxnStatements(sql) {
  const lines = sql.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim().toUpperCase();
    if (
      trimmed === "BEGIN;" ||
      trimmed === "BEGIN" ||
      trimmed === "COMMIT;" ||
      trimmed === "COMMIT" ||
      trimmed === "ROLLBACK;" ||
      trimmed === "ROLLBACK" ||
      trimmed === "END;" ||
      trimmed === "END"
    ) {
      out.push("-- stripped by dry-run harness: " + line);
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

function fail(reason) {
  console.error(`\n❌ FAIL-CLOSED · ${reason}\n`);
  process.exit(1);
}

function verifyTarget(url) {
  try {
    const u = new URL(url);
    const fromUser = u.username.includes(".") ? u.username.split(".")[1] : null;
    const fromHost = u.hostname.match(/^([a-z0-9]{20})\./)?.[1] ?? null;
    const id = fromUser ?? fromHost;
    if (!id) throw new Error("cannot extract project id from DATABASE_URL");
    if (id !== APPROVED_PROJECT_ID) {
      throw new Error(
        `DATABASE_URL points at project '${id}'. Expected '${APPROVED_PROJECT_ID}'.`,
      );
    }
    return id;
  } catch (e) {
    fail(`project-id check · ${e.message}`);
  }
}

async function loadMigrationSql(relPath) {
  const absPath = path.resolve(process.cwd(), relPath);
  let text;
  try {
    text = await fs.readFile(absPath, "utf8");
  } catch (e) {
    fail(`cannot read ${relPath} · ${e.message}`);
  }
  if (!text || text.trim().length === 0) {
    fail(`${relPath} is empty`);
  }
  for (const re of UNSAFE_PATTERNS) {
    if (re.test(text)) {
      fail(
        `${relPath} contains a transaction-unsafe operation matching ${re}. ` +
          `Transactional rollback would NOT undo this. Aborting before any execution.`,
      );
    }
  }
  const stripped = stripOuterTxnStatements(text);
  return { path: relPath, text: stripped, originalLength: text.length, strippedLength: stripped.length };
}

/**
 * Snapshot the parts of the schema this dry-run cares about: the
 * presence/columns/constraints/indexes of business_media and
 * business_media_review. Returns a deterministic object we can
 * JSON.stringify + diff before/after.
 */
async function snapshot(client) {
  const snap = { tables: {}, indexes: {}, checks: {}, fks: {} };
  for (const t of ["business_media", "business_media_review"]) {
    const cols = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema='nex' AND table_name=$1
         ORDER BY ordinal_position`,
      [t],
    );
    snap.tables[t] = cols.rows;
    const idx = await client.query(
      `SELECT indexname, indexdef FROM pg_indexes
         WHERE schemaname='nex' AND tablename=$1 ORDER BY indexname`,
      [t],
    );
    snap.indexes[t] = idx.rows;
    try {
      const chk = await client.query(
        `SELECT conname, pg_get_constraintdef(oid) AS def
           FROM pg_constraint
           WHERE conrelid = ('nex.' || $1)::regclass AND contype='c'
           ORDER BY conname`,
        [t],
      );
      snap.checks[t] = chk.rows;
      const fk = await client.query(
        `SELECT conname, pg_get_constraintdef(oid) AS def
           FROM pg_constraint
           WHERE conrelid = ('nex.' || $1)::regclass AND contype='f'
           ORDER BY conname`,
        [t],
      );
      snap.fks[t] = fk.rows;
    } catch {
      // Table doesn't exist · leave as empty arrays
      snap.checks[t] = snap.checks[t] ?? [];
      snap.fks[t] = snap.fks[t] ?? [];
    }
  }
  return snap;
}

function diff(before, after, label) {
  const b = JSON.stringify(before);
  const a = JSON.stringify(after);
  if (b === a) return { ok: true, msg: `${label} · unchanged` };
  // Find first differing table for a readable error
  for (const t of ["business_media", "business_media_review"]) {
    const bt = JSON.stringify({
      cols: before.tables[t],
      idx: before.indexes[t],
      chk: before.checks[t],
      fk: before.fks[t],
    });
    const at = JSON.stringify({
      cols: after.tables[t],
      idx: after.indexes[t],
      chk: after.checks[t],
      fk: after.fks[t],
    });
    if (bt !== at) {
      return {
        ok: false,
        msg: `${label} · DRIFT on nex.${t}`,
        detail: { table: t, before: bt, after: at },
      };
    }
  }
  return { ok: false, msg: `${label} · unknown drift`, detail: null };
}

async function assertTxnCapability(client) {
  // Probe: can we actually BEGIN + ROLLBACK?
  try {
    await client.query("BEGIN");
    const r = await client.query("SELECT 1 AS n");
    if (r.rows[0]?.n !== 1) throw new Error("probe SELECT failed inside txn");
    await client.query("ROLLBACK");
  } catch (e) {
    fail(`transaction capability probe · ${e.message}`);
  }
}

async function main() {
  console.log("=== dry-run · migrations 188 + 189 · READ-ONLY ===\n");

  const commitFlag = process.argv.includes("--commit");
  if (commitFlag) {
    fail(
      "this script never commits · remove --commit · it only exercises BEGIN; apply; ROLLBACK; " +
        "and reports whether the migrations behave as expected. There is no --commit path.",
    );
  }

  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL unset");
  const projectId = verifyTarget(url);
  console.log(`✓ project id · ${projectId} (matches sealed ${APPROVED_PROJECT_ID})`);

  console.log("\n--- step 1 · load migrations ---");
  const migs = [];
  for (const m of MIGRATION_FILES) {
    const loaded = await loadMigrationSql(m);
    migs.push(loaded);
    console.log(
      `✓ ${m} · ${loaded.originalLength} chars · ` +
        `${loaded.originalLength - loaded.strippedLength} chars stripped (inner BEGIN/COMMIT · see post-incident fix comment) · ` +
        `no unsafe patterns`,
    );
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  console.log("\n--- step 2 · transaction capability probe ---");
  await assertTxnCapability(client);
  console.log("✓ BEGIN/ROLLBACK succeeded on a trivial statement");

  console.log("\n--- step 3 · capture INITIAL snapshot ---");
  const initial = await snapshot(client);
  console.log(
    `✓ business_media columns: ${initial.tables.business_media.length} · ` +
      `indexes: ${initial.indexes.business_media.length} · ` +
      `checks: ${initial.checks.business_media.length} · ` +
      `fks: ${initial.fks.business_media.length}`,
  );
  console.log(
    `✓ business_media_review present: ${initial.tables.business_media_review.length > 0 ? "yes" : "no (expected · new table)"}`,
  );

  console.log("\n--- step 4 · open transaction + apply migrations ---");
  let inTxn = false;
  try {
    await client.query("BEGIN");
    inTxn = true;
    for (const m of migs) {
      console.log(`  applying ${m.path}...`);
      await client.query(m.text);
      console.log(`  ✓ ${m.path} applied inside txn`);
    }

    console.log("\n--- step 5 · capture POST-APPLY snapshot (inside txn) ---");
    const applied = await snapshot(client);
    console.log(
      `  business_media_review columns after apply: ${applied.tables.business_media_review.length}`,
    );
    console.log(
      `  business_media_review indexes after apply: ${applied.indexes.business_media_review.length}`,
    );
    // Prove the new table exists inside the txn
    if (applied.tables.business_media_review.length === 0) {
      fail("migration 189 did not create business_media_review inside the transaction");
    }
    // Prove business_media is unchanged (my migration 188 is IF NOT EXISTS no-ops)
    const bmComparison = JSON.stringify(initial.tables.business_media) === JSON.stringify(applied.tables.business_media);
    const bmIdxComparison = JSON.stringify(initial.indexes.business_media) === JSON.stringify(applied.indexes.business_media);
    if (!bmComparison || !bmIdxComparison) {
      fail(
        "migration 188 altered live business_media table/indexes · IF NOT EXISTS semantics should have prevented this. " +
          "Review the migration DDL vs live schema before any execution.",
      );
    }
    console.log("  ✓ business_media unchanged by 188 (IF NOT EXISTS no-ops confirmed)");
    console.log("  ✓ business_media_review created inside the txn");

    console.log("\n--- step 6 · ROLLBACK ---");
    await client.query("ROLLBACK");
    inTxn = false;
    console.log("  ✓ ROLLBACK executed");
  } catch (e) {
    if (inTxn) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // best-effort
      }
    }
    fail(`exception during apply/rollback cycle · ${e.message}`);
  }

  console.log("\n--- step 7 · capture POST-ROLLBACK snapshot ---");
  const final = await snapshot(client);
  const d = diff(initial, final, "initial vs post-rollback");
  if (!d.ok) {
    console.error("  ✗ " + d.msg);
    if (d.detail) {
      console.error("  BEFORE: " + d.detail.before.slice(0, 500));
      console.error("  AFTER:  " + d.detail.after.slice(0, 500));
    }
    fail("ROLLBACK did not restore initial schema state · DO NOT APPLY LIVE");
  }
  console.log("  ✓ " + d.msg);
  console.log(
    `  business_media_review present post-rollback: ${final.tables.business_media_review.length > 0 ? "yes (⚠ txn did not roll back)" : "no (correct · txn rolled back cleanly)"}`,
  );

  await client.end();

  console.log("\n=== dry-run result: PASS ===");
  console.log("Migrations 188 and 189 are transactionally safe against the sealed Supabase project.");
  console.log("Live schema is unchanged.");
  console.log("No reconciliation writes, no source permission changes, no approvals.");
  console.log("\nTo advance beyond dry-run: separate explicit authorisation required.");
}

main().catch((e) => {
  console.error("\n❌ UNHANDLED · " + e.message);
  process.exit(1);
});
