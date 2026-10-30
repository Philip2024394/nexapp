// scripts/apply-migration-237.mjs
//
// Applier for Migration 237 (nex_follow one-way follow graph).
// Owner-authorised 2026-10-30 per Stage 1 preparation
// `docs/doctrine/nex-follow-stage-1-implementation-plan-draft-2026-10-30.md`
// §13.5 deployment order.
//
// Hard safety: aborts if DATABASE_URL does not point at the sealed
// project `ijvqdvsvwtwxzcqmoqit` per CLAUDE.md §8.
//
// This script does NOT execute automatically · the owner invokes it
// explicitly during the authorised deployment window (E-1 + E-2 per
// §13.8).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

function readEnv(key) {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === key) return m[2];
  }
  return null;
}

const url = readEnv("DATABASE_URL");
if (!url) { console.error("ERR: DATABASE_URL missing"); process.exit(2); }
if (!url.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("ERR: DATABASE_URL does not point at ijvqdvsvwtwxzcqmoqit · aborting");
  process.exit(3);
}

const sql = readFileSync(
  resolve("nex-supabase/migrations/237_nex_follow_graph.sql"),
  "utf8",
);

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED to ijvqdvsvwtwxzcqmoqit via pooler");

try {
  const pre = await client.query(
    "SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='nex_follow'",
  );
  console.log(`PRE   nex_follow exists? ${pre.rowCount > 0 ? "YES (migration will no-op the table creation)" : "NO (will create)"}`);

  await client.query(sql);
  console.log("APPLIED migration 237");

  // Validation V1 · table exists
  const t = await client.query(
    "SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='nex_follow'",
  );
  console.log(`POST  V1 table exists: ${t.rowCount > 0 ? "YES" : "NO (FAIL)"}`);
  if (t.rowCount === 0) throw new Error("V1 failed · nex_follow table absent after apply");

  // Validation V3 · indexes armed
  const idx = await client.query(
    "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='nex_follow' ORDER BY indexname",
  );
  console.log(`POST  V3 indexes: ${JSON.stringify(idx.rows.map(r => r.indexname))}`);

  // Validation V4 · CHECK constraint rejects self-follow (soft check · no actual INSERT)
  const chk = await client.query(
    "SELECT conname FROM pg_constraint WHERE conname IN ('nex_follow_no_self_follow', 'nex_follow_source_known')",
  );
  console.log(`POST  V4 CHECK constraints: ${JSON.stringify(chk.rows.map(r => r.conname))}`);

  // Migration history
  const hist = await client.query(
    "SELECT version, description FROM nex_migration_history WHERE version = '237'",
  );
  console.log(`POST  migration_history: ${JSON.stringify(hist.rows[0] ?? null)}`);
} catch (e) {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
} finally {
  await client.end();
}
console.log("DONE");
