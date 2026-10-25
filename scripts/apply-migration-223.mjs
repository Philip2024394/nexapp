// scripts/apply-migration-223.mjs
//
// One-shot migration applier for Migration 223 (nex_uploaded_video).
// Owner directive 2026-10-25 · the 2026-10-24 "wait for sandbox"
// seal was explicitly overridden by the owner in this session.
// Still safety-gated: aborts if DATABASE_URL does not point at the
// sealed project `ijvqdvsvwtwxzcqmoqit` per CLAUDE.md §8.

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
  resolve("nex-supabase/migrations/223_nex_uploaded_video.sql"),
  "utf8",
);

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED to ijvqdvsvwtwxzcqmoqit via pooler");

try {
  const pre = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='nex_uploaded_video'",
  );
  console.log(`PRE   nex_uploaded_video exists? ${pre.rowCount > 0 ? "YES (idempotent apply)" : "NO (will create)"}`);

  await client.query(sql);
  console.log("APPLIED migration 223");

  const post = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='nex_uploaded_video' ORDER BY ordinal_position",
  );
  console.log(`POST  columns: ${post.rowCount}`);
  for (const row of post.rows) {
    console.log(`      - ${row.column_name} :: ${row.data_type}`);
  }

  const hist = await client.query(
    "SELECT version, description FROM nex_migration_history WHERE version = '223'",
  );
  console.log(`POST  migration_history: ${JSON.stringify(hist.rows[0] ?? null)}`);
} catch (e) {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
} finally {
  await client.end();
}
console.log("DONE");
