// scripts/_tmp/seed-disposable-business.mjs
//
// Sandbox-only · 2026-11-15 · D2/D3 companion seeder.
// Inserts ONE nex_business row per CK5 disposable seller (account A)
// so the create-product + order-visibility specs have a target shop.
//
// Reads account IDs from .env.playwright.vault-ck5 (produced by
// seed-disposable-vault-accounts.mjs). Hard-guards any INSERT/DELETE
// against accidentally touching Hammerex / Rosa / dp6-f* fixtures.
//
// Writes the resolved business_id + slug back into the same env file
// as PLAYWRIGHT_CK5_A_BUSINESS_ID / PLAYWRIGHT_CK5_A_BUSINESS_SLUG so
// the spec can consume them directly.

import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";
import { randomUUID } from "node:crypto";

const envRaw = readFileSync(".env.local", "utf8");
function envValue(name) {
  const m = envRaw.match(new RegExp(`^${name}=(.*)$`, "m"));
  return m ? m[1].trim() : null;
}

const DB_URL = envValue("DATABASE_URL") || envValue("SANDBOX_DATABASE_URL");
const URL = envValue("NEXT_PUBLIC_NEX_SUPABASE_URL") || envValue("NEX_SUPABASE_URL");
const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";

if (!DB_URL) {
  console.error("STOP missing DATABASE_URL");
  process.exit(1);
}
if (DB_URL.includes(PROD_REF) || URL?.includes(PROD_REF)) {
  console.error("STOP prod ref detected");
  process.exit(2);
}
if (!DB_URL.includes(SANDBOX_REF)) {
  console.error("STOP not sandbox kdstoyyeygcopkogqsyv");
  process.exit(3);
}

// Parse .env.playwright.vault-ck5
const ck5Raw = readFileSync(".env.playwright.vault-ck5", "utf8");
function envCk5(name) {
  const m = ck5Raw.match(new RegExp(`^${name}=['"]?([^'"\\n]*)['"]?$`, "m"));
  return m ? m[1].trim() : null;
}

const A_ACCOUNT_ID = envCk5("PLAYWRIGHT_CK5_A_ACCOUNT_ID");
const A_HANDLE = envCk5("PLAYWRIGHT_CK5_A_HANDLE");
if (!A_ACCOUNT_ID || !A_HANDLE) {
  console.error("STOP missing A account id/handle · run seed-disposable-vault-accounts.mjs first");
  process.exit(4);
}

// Hard guards on protected identities.
const PROTECTED_IDS = new Set([
  "11111111-1111-4111-8111-111111111111", // Hammerex (nex-99901)
  "11111111-1111-4111-8111-111111111113", // Rosa (nex-99903)
]);
if (PROTECTED_IDS.has(A_ACCOUNT_ID)) {
  console.error("STOP cannot touch protected identity " + A_ACCOUNT_ID);
  process.exit(5);
}
// Must match the seeder's synthetic range: nex-9xxxxx (6 digits starting 97-98).
if (!/^nex-9[0-9]{5}$/.test(A_HANDLE)) {
  console.error("STOP unexpected handle format · " + A_HANDLE);
  process.exit(6);
}

const stamp = Date.now().toString(36);
// slug must match ^[a-z0-9]([-a-z0-9]{0,62}[a-z0-9])?$
const slug = `e2e-ck5-seller-shop-${stamp}`;

const pool = new pg.Client({ connectionString: DB_URL });
await pool.connect();

try {
  // Hard-clean any existing e2e-ck5-seller-shop-* rows for THIS account
  // (prior aborted run). Guarded by owner_account_id match AND slug prefix.
  const existing = await pool.query(
    `SELECT id, slug FROM nex_business
      WHERE owner_account_id = $1 AND slug LIKE 'e2e-ck5-seller-shop-%'`,
    [A_ACCOUNT_ID],
  );
  for (const row of existing.rows) {
    if (!row.slug.startsWith("e2e-ck5-seller-shop-")) {
      throw new Error(`refuse · unexpected slug on cleanup: ${row.slug}`);
    }
    // Clean dependent rows first (products for this business).
    await pool.query(
      `DELETE FROM nex_product WHERE business_id = $1`,
      [row.id],
    );
    await pool.query(
      `DELETE FROM nex_business WHERE id = $1 AND owner_account_id = $2`,
      [row.id, A_ACCOUNT_ID],
    );
  }

  const businessId = randomUUID();
  const displayName = `E2E CK5 Seller Shop ${stamp}`;
  await pool.query(
    `INSERT INTO nex_business (id, owner_account_id, display_name, slug)
     VALUES ($1, $2, $3, $4)`,
    [businessId, A_ACCOUNT_ID, displayName, slug],
  );

  // Append business env vars (don't overwrite the account file wholesale).
  let current = readFileSync(".env.playwright.vault-ck5", "utf8");
  // Strip any prior business lines (idempotent).
  current = current
    .split("\n")
    .filter((l) => !/^PLAYWRIGHT_CK5_A_BUSINESS_(ID|SLUG|NAME)=/.test(l))
    .join("\n");
  if (!current.endsWith("\n")) current += "\n";
  current += `PLAYWRIGHT_CK5_A_BUSINESS_ID='${businessId}'\n`;
  current += `PLAYWRIGHT_CK5_A_BUSINESS_SLUG='${slug}'\n`;
  current += `PLAYWRIGHT_CK5_A_BUSINESS_NAME='${displayName}'\n`;
  writeFileSync(".env.playwright.vault-ck5", current);

  console.log(`[CK5 business] account=${A_HANDLE} business_id=${businessId} slug=${slug}`);
} finally {
  await pool.end();
}
