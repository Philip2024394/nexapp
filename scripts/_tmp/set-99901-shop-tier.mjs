// scripts/_tmp/set-99901-shop-tier.mjs
//
// Owner-authorised 2026-11-09 · set nex_account.shop_tier='shop' for
// account 99901 (UUID 11111111-1111-4111-8111-111111111111) in sandbox
// kdstoyyeygcopkogqsyv. Scoped one-row UPDATE. Hard-refuses production.
//
// Purpose: enable 99901 to test chat + shop themes + vault as a paid
// member. Reversible via the sibling revert script.

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

const TEST_ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";

const databaseUrl = env("SANDBOX_DATABASE_URL");
const u = new URL(databaseUrl);
const ref = u.username.match(/\.([a-z0-9]{15,})/)?.[1]
  ?? u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1];
if (ref === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production ref"); process.exit(2); }
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · unknown ref ${ref}`); process.exit(2); }
console.log(`Target · sandbox ${ref}`);

const c = new Client({ connectionString: databaseUrl });
await c.connect();

try {
  // Pre-state
  const pre = await c.query(
    "SELECT id, nex_handle, shop_tier FROM nex_account WHERE id = $1",
    [TEST_ACCOUNT_ID],
  );
  if (pre.rows.length !== 1) {
    console.error(`STOP · account ${TEST_ACCOUNT_ID} not found in sandbox`);
    process.exit(3);
  }
  console.log(`BEFORE: ${pre.rows[0].nex_handle} shop_tier=${pre.rows[0].shop_tier ?? "NULL"}`);

  // Scoped update
  const upd = await c.query(
    "UPDATE nex_account SET shop_tier = 'shop' WHERE id = $1 RETURNING id, nex_handle, shop_tier",
    [TEST_ACCOUNT_ID],
  );
  if (upd.rowCount !== 1) {
    console.error(`STOP · update affected ${upd.rowCount} rows, expected 1`);
    process.exit(4);
  }
  console.log(`AFTER : ${upd.rows[0].nex_handle} shop_tier=${upd.rows[0].shop_tier}`);
  console.log(`\n✓ 99901 is now entitled. Reload /nex-native/vault/setup to see the 6-digit wizard.`);
} finally {
  await c.end();
}
