// scripts/apply-migration-224.mjs
//
// Applier for Migration 224 (nex_account.is_mock_persona). Owner
// authorised the apply in the mock-persona seed slice 2026-10-26.
// Hard safety: aborts if DATABASE_URL does not point at the sealed
// project `ijvqdvsvwtwxzcqmoqit` per CLAUDE.md §8.

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
  resolve("nex-supabase/migrations/224_nex_account_is_mock_persona.sql"),
  "utf8",
);

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED to ijvqdvsvwtwxzcqmoqit via pooler");

try {
  const pre = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='nex_account' AND column_name='is_mock_persona'",
  );
  console.log(`PRE   is_mock_persona exists? ${pre.rowCount > 0 ? "YES" : "NO (will add)"}`);

  await client.query(sql);
  console.log("APPLIED migration 224");

  const post = await client.query(
    "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='nex_account' AND column_name='is_mock_persona'",
  );
  console.log(`POST  column: ${JSON.stringify(post.rows[0] ?? null)}`);

  const hist = await client.query(
    "SELECT version, description FROM nex_migration_history WHERE version = '224'",
  );
  console.log(`POST  migration_history: ${JSON.stringify(hist.rows[0] ?? null)}`);
} catch (e) {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
} finally {
  await client.end();
}
console.log("DONE");
