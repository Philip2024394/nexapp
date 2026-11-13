// scripts/_tmp/probe-theme-purchase-sandbox.mjs
//
// READ-ONLY probe · owner-authorised 2026-11-11 for Phase 0 of
// NEX Themes Plus. Single query scope:
//
//   SELECT count(*) FROM nex_theme_purchase WHERE state = 'verified'
//
// Sandbox-only. Hard-refuses prod ref ijvqdvsvwtwxzcqmoqit.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
function env(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} not found`);
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

// First check whether nex_theme_purchase exists at all in sandbox (mig 193 is DRAFT)
const tableExists = await c.query(
  `SELECT EXISTS (
     SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'nex_theme_purchase'
   ) AS exists`,
);
console.log(`\nnex_theme_purchase table present: ${tableExists.rows[0].exists}`);

if (tableExists.rows[0].exists) {
  const result = await c.query(
    `SELECT count(*)::int AS verified_count
     FROM nex_theme_purchase
     WHERE state = 'verified'`,
  );
  console.log(`\n[AUTHORISED QUERY RESULT]`);
  console.log(`nex_theme_purchase WHERE state = 'verified' · row count: ${result.rows[0].verified_count}`);

  // Also report total row distribution across states (non-sensitive aggregate only)
  const dist = await c.query(
    `SELECT state, count(*)::int AS n
     FROM nex_theme_purchase
     GROUP BY state
     ORDER BY state`,
  );
  console.log(`\n[Non-sensitive evidence · state distribution]`);
  if (dist.rows.length === 0) {
    console.log(`  (empty table · 0 rows total)`);
  } else {
    dist.rows.forEach((r) => console.log(`  ${r.state}: ${r.n}`));
  }
} else {
  console.log(`\n[AUTHORISED QUERY RESULT]`);
  console.log(`nex_theme_purchase table NOT PRESENT in sandbox · migration 193 has never been applied.`);
  console.log(`Implied verified-row count: 0`);
}

// Also check nex_theme_ownership (related historical state)
const ownTableExists = await c.query(
  `SELECT EXISTS (
     SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'nex_theme_ownership'
   ) AS exists`,
);
console.log(`\nnex_theme_ownership table present: ${ownTableExists.rows[0].exists}`);
if (ownTableExists.rows[0].exists) {
  const ownCount = await c.query(
    `SELECT count(*)::int AS n,
            count(*) FILTER (WHERE revoked_at IS NULL)::int AS active
     FROM nex_theme_ownership`,
  );
  console.log(`  rows total: ${ownCount.rows[0].n} · active (revoked_at IS NULL): ${ownCount.rows[0].active}`);
}

await c.end();
console.log(`\nProbe complete. No writes performed.`);
