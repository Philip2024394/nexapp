// scripts/_tmp/probe-theme-ownership-source-sandbox.mjs
//
// Probe · does `nex_theme_ownership` exist + does it carry a `source`
// column we can write `'first_free'` into? Reports whether migration
// 194 is applied AND whether the `source` column landed.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
function loadEnvVar(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const match = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!match) throw new Error(`${name} not found`);
  let v = match[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const databaseUrl = loadEnvVar("SANDBOX_DATABASE_URL");
const PROD = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX = "kdstoyyeygcopkogqsyv";
const u = new URL(databaseUrl);
const ref =
  u.username.match(/\.([a-z0-9]{15,})/)?.[1] ??
  u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1];
if (ref === PROD) { console.error("STOP · production"); process.exit(2); }
if (ref !== SANDBOX) { console.error(`STOP · ref ${ref} is not SANDBOX`); process.exit(2); }

const c = new Client({ connectionString: databaseUrl });
await c.connect();

const tbl = (await c.query(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema='public' AND table_name='nex_theme_ownership'`,
)).rows;
console.log(`nex_theme_ownership table: ${tbl.length > 0 ? "PRESENT" : "ABSENT"}`);

if (tbl.length > 0) {
  const cols = (await c.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_theme_ownership'
      ORDER BY column_name`,
  )).rows;
  console.log(`columns:`);
  for (const r of cols) console.log(`  · ${r.column_name} ${r.data_type} nullable=${r.is_nullable}`);

  const hasSource = cols.some(c => c.column_name === 'source');
  console.log(`\nsource column: ${hasSource ? "PRESENT" : "ABSENT"}`);

  const n = (await c.query(`SELECT count(*)::int AS n FROM nex_theme_ownership`)).rows[0].n;
  console.log(`total rows: ${n}`);

  if (hasSource) {
    const bySource = (await c.query(
      `SELECT source, count(*)::int AS n FROM nex_theme_ownership GROUP BY source ORDER BY source`,
    )).rows;
    console.log(`rows by source:`);
    for (const r of bySource) console.log(`  · ${r.source ?? "(null)"}: ${r.n}`);
  }
}

await c.end();
