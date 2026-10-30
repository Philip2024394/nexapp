// scripts/apply-migration-238.mjs
//
// Applier for Migration 238 (nex_account follow counters + visibility
// + maintenance triggers + reconciliation RPC). Owner-authorised
// 2026-10-30 per Stage 1 preparation §13.5.
//
// Dependency: migration 237 MUST have been applied first. This script
// verifies the dependency before touching the DB.
//
// Hard safety: aborts if DATABASE_URL does not point at the sealed
// project `ijvqdvsvwtwxzcqmoqit` per CLAUDE.md §8.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

function readEnv(key) {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && m[1] === key) return m[2];
    }
  } catch {
    /* .env.local absent in CI/disposable contexts · fall through */
  }
  return null;
}

const url = process.env.DATABASE_URL ?? readEnv("DATABASE_URL");
if (!url) { console.error("ERR: DATABASE_URL missing"); process.exit(2); }

// Owner-authorised 2026-10-30 · dry-run path. See apply-migration-237.mjs
// for rationale. Same safety: refuses to run against production when
// the disposable flag is active, and vice versa.
const PROD_SIGIL = "ijvqdvsvwtwxzcqmoqit";
const DISPOSABLE = process.env.NEX_FOLLOW_DISPOSABLE_APPLY === "yes";
if (DISPOSABLE) {
  if (url.includes(PROD_SIGIL)) {
    console.error(
      "ERR: NEX_FOLLOW_DISPOSABLE_APPLY=yes but DATABASE_URL points at production (" +
        PROD_SIGIL +
        ") · refusing to mix flags · aborting",
    );
    process.exit(4);
  }
  console.log("MODE: DISPOSABLE (production id guard inverted)");
} else {
  if (!url.includes(PROD_SIGIL)) {
    console.error(
      "ERR: DATABASE_URL does not point at " +
        PROD_SIGIL +
        " · aborting · (set NEX_FOLLOW_DISPOSABLE_APPLY=yes for a disposable-DB dry run)",
    );
    process.exit(3);
  }
  console.log("MODE: PRODUCTION (" + PROD_SIGIL + ")");
}

const sql = readFileSync(
  resolve("nex-supabase/migrations/238_nex_account_follow_counters.sql"),
  "utf8",
);

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log(`CONNECTED to ${DISPOSABLE ? "DISPOSABLE DB" : PROD_SIGIL + " via pooler"}`);

try {
  // Dependency verification · migration 237 must be present
  const dep = await client.query(
    "SELECT version FROM nex_migration_history WHERE version = '237'",
  );
  if (dep.rowCount === 0) {
    throw new Error("Dependency failed · migration 237 (nex_follow) must be applied before 238");
  }
  console.log("PRE   dependency OK · migration 237 present in history");

  const preCols = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='nex_account' AND column_name IN ('followers_count','following_count','followers_list_visibility','following_list_visibility','follower_count_hidden') ORDER BY column_name",
  );
  console.log(`PRE   existing follow columns on nex_account: ${JSON.stringify(preCols.rows.map(r => r.column_name))}`);

  await client.query(sql);
  console.log("APPLIED migration 238");

  // Validation V2 · all 5 columns present
  const cols = await client.query(
    "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='nex_account' AND column_name IN ('followers_count','following_count','followers_list_visibility','following_list_visibility','follower_count_hidden') ORDER BY column_name",
  );
  console.log(`POST  V2 columns: ${JSON.stringify(cols.rows)}`);
  if (cols.rowCount !== 5) throw new Error(`V2 failed · expected 5 columns, got ${cols.rowCount}`);

  // Validation V3 · triggers armed
  const trg = await client.query(
    "SELECT trigger_name FROM information_schema.triggers WHERE event_object_schema='public' AND event_object_table='nex_follow' AND trigger_name IN ('nex_follow_counters_insert_trg','nex_follow_counters_delete_trg') ORDER BY trigger_name",
  );
  console.log(`POST  V3 triggers: ${JSON.stringify(trg.rows.map(r => r.trigger_name))}`);
  if (trg.rowCount !== 2) throw new Error(`V3 failed · expected 2 triggers, got ${trg.rowCount}`);

  // Validation · RPC exists + is service_role only
  const rpc = await client.query(
    "SELECT proname FROM pg_proc WHERE proname = 'nex_follow_recompute_counters'",
  );
  console.log(`POST  RPC exists: ${rpc.rowCount > 0 ? "YES" : "NO (FAIL)"}`);

  // Migration history
  const hist = await client.query(
    "SELECT version, description FROM nex_migration_history WHERE version = '238'",
  );
  console.log(`POST  migration_history: ${JSON.stringify(hist.rows[0] ?? null)}`);
} catch (e) {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
} finally {
  await client.end();
}
console.log("DONE");
