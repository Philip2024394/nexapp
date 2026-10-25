// scripts/apply-migration-221.mjs
//
// One-shot migration applier · reads
// 221_nex_uploaded_video_is_ai_generated.sql and runs it against the
// DATABASE_URL in .env.local. Hard safety: aborts if the connection
// string does not point at the sealed `ijvqdvsvwtwxzcqmoqit` project
// (per CLAUDE.md §8).
//
// IMPORTANT: owner directive 2026-10-25 · DO NOT RUN this script
// without explicit owner approval for Migration 221. The migration
// itself is idempotent (IF NOT EXISTS + ON CONFLICT DO NOTHING) so
// a repeat run is safe, but the FIRST run modifies the live schema.

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
if (!url) {
  console.error("ERR: DATABASE_URL not found in .env.local");
  process.exit(2);
}
if (!url.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("ERR: DATABASE_URL does not point at ijvqdvsvwtwxzcqmoqit · aborting per CLAUDE.md §8");
  process.exit(3);
}

const sql = readFileSync(
  resolve("nex-supabase/migrations/221_nex_uploaded_video_is_ai_generated.sql"),
  "utf8",
);

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED to ijvqdvsvwtwxzcqmoqit via pooler");

try {
  const pre = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='nex_uploaded_video' AND column_name='is_ai_generated'",
  );
  console.log(`PRE   is_ai_generated column exists? ${pre.rowCount > 0 ? "YES (idempotent apply)" : "NO (will add)"}`);

  await client.query(sql);
  console.log("APPLIED migration 221");

  const post = await client.query(
    "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='nex_uploaded_video' AND column_name='is_ai_generated'",
  );
  console.log(`POST  column: ${JSON.stringify(post.rows[0] ?? null)}`);

  const hist = await client.query(
    "SELECT version, description FROM nex_migration_history WHERE version = '221'",
  );
  console.log(`POST  migration_history: ${JSON.stringify(hist.rows[0] ?? null)}`);
} catch (e) {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
} finally {
  await client.end();
}
console.log("DONE");
