// scripts/apply-migration-220.mjs
//
// One-shot migration applier · reads 220_nex_friend_request_intro_note.sql
// and runs it against the DATABASE_URL in .env.local. Hard safety:
// aborts if the connection string does not point at the sealed
// ijvqdvsvwtwxzcqmoqit project (per CLAUDE.md §8).

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
  resolve("nex-supabase/migrations/220_nex_friend_request_intro_note.sql"),
  "utf8",
);

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED to ijvqdvsvwtwxzcqmoqit via pooler");

try {
  const pre = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='nex_friend_request' AND column_name='intro_note'",
  );
  console.log(`PRE   intro_note column exists? ${pre.rowCount > 0 ? "YES (idempotent apply)" : "NO (will add)"}`);

  await client.query(sql);
  console.log("APPLIED migration 220");

  const post = await client.query(
    "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='nex_friend_request' AND column_name='intro_note'",
  );
  console.log(`POST  column: ${JSON.stringify(post.rows[0] ?? null)}`);

  const check = await client.query(
    "SELECT con.conname, pg_get_constraintdef(con.oid) AS def FROM pg_constraint con JOIN pg_class cls ON cls.oid = con.conrelid WHERE cls.relname='nex_friend_request' AND pg_get_constraintdef(con.oid) ILIKE '%intro_note%'",
  );
  console.log(`POST  CHECK: ${check.rows.map((r) => r.conname + ":" + r.def).join(" | ") || "(none)"}`);

  const hist = await client.query(
    "SELECT version, description FROM nex_migration_history WHERE version = '220'",
  );
  console.log(`POST  migration_history: ${JSON.stringify(hist.rows[0] ?? null)}`);
} catch (e) {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
} finally {
  await client.end();
}
console.log("DONE");
