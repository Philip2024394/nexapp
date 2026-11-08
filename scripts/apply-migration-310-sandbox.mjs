// scripts/apply-migration-310-sandbox.mjs
//
// Owner-authorised 2026-11-08 Round 30 · nex_account.shop_tier CHECK
// extended to include 'shop' (sealed single-package tier).
// SANDBOX only · hard-refuses production per sealed boundary rule.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
const refFromUser = u.username.match(/\.([a-z0-9]{15,})/)?.[1] ?? null;
const refFromHost = u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1] ?? null;
const ref = refFromUser ?? refFromHost;
if (ref === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production ref"); process.exit(2); }
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · unknown ref ${ref}`); process.exit(2); }
console.log(`Target · sandbox ${ref}`);

const sql = readFileSync(
  resolve(repoRoot, "nex-supabase/migrations/310_nex_account_shop_tier_add_shop.sql"),
  "utf8",
);
const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query("BEGIN");
  await c.query(sql);
  await c.query("COMMIT");
  console.log("Migration applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  try { await c.query("ROLLBACK"); } catch {}
  process.exit(3);
} finally {
  await c.end();
}

const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const chk = await v.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname='nex_account_shop_tier_check'`,
  );
  const hist = await v.query(
    `SELECT version, description FROM nex_migration_history WHERE version='310'`,
  );
  const def = chk.rows[0]?.def ?? "";
  const expected = ["shop", "standard", "unlimited"];
  const missing = expected.filter((e) => !def.includes(`'${e}'`));
  console.log(`✓ CHECK constraint: ${def}`);
  if (missing.length > 0) {
    console.error(`✗ Missing values: ${missing.join(", ")}`);
    process.exit(4);
  } else {
    console.log(`✓ All 3 expected shop_tier values present`);
  }
  console.log(`✓ History: ${hist.rows[0]?.version} · ${hist.rows[0]?.description}`);
} finally {
  await v.end();
}
console.log("DONE · sandbox migration 310 applied + verified");
