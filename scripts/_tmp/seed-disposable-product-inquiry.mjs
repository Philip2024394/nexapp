// scripts/_tmp/seed-disposable-product-inquiry.mjs
//
// Sandbox-only · 2026-11-15 · CP2 companion seeder.
// -----------------------------------------------------------------
// Prepares the CK5 disposable seller with TWO live products (Product
// X + Product Y) used by tests/e2e-p6-isolation/product-linked-inquiry
// .spec.ts to prove:
//   (a) a product inquiry pins Product X to the top of the peer chat
//   (b) a second inquiry for Product Y stays distinguishable from X
//   (c) an ordinary peer chat has NO pinned product
//
// Reuses the sealed CK5 fixture (.env.playwright.vault-ck5) · never
// touches Hammerex / Rosa / dp6-f* / any protected identity.
//
// Appends PLAYWRIGHT_CK5_PRODUCT_X_ID + PLAYWRIGHT_CK5_PRODUCT_Y_ID to
// the same env file so the spec can read them directly.

import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const envRaw = readFileSync(".env.local", "utf8");
function envValue(name) {
  const m = envRaw.match(new RegExp(`^${name}=(.*)$`, "m"));
  return m ? m[1].trim() : null;
}

const DB_URL = envValue("DATABASE_URL") || envValue("SANDBOX_DATABASE_URL");
const URL = envValue("NEXT_PUBLIC_NEX_SUPABASE_URL") || envValue("NEX_SUPABASE_URL");
const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";

if (!DB_URL) { console.error("STOP missing DATABASE_URL"); process.exit(1); }
if (DB_URL.includes(PROD_REF) || URL?.includes(PROD_REF)) {
  console.error("STOP prod ref detected"); process.exit(2);
}
if (!DB_URL.includes(SANDBOX_REF)) {
  console.error("STOP not sandbox kdstoyyeygcopkogqsyv"); process.exit(3);
}

const ck5Raw = readFileSync(".env.playwright.vault-ck5", "utf8");
function envCk5(name) {
  const m = ck5Raw.match(new RegExp(`^${name}=['"]?([^'"\\n]*)['"]?$`, "m"));
  return m ? m[1].trim() : null;
}

const A_ACCOUNT_ID = envCk5("PLAYWRIGHT_CK5_A_ACCOUNT_ID");
const A_HANDLE = envCk5("PLAYWRIGHT_CK5_A_HANDLE");
const BUSINESS_ID = envCk5("PLAYWRIGHT_CK5_A_BUSINESS_ID");
const BUSINESS_SLUG = envCk5("PLAYWRIGHT_CK5_A_BUSINESS_SLUG");
if (!A_ACCOUNT_ID || !A_HANDLE || !BUSINESS_ID || !BUSINESS_SLUG) {
  console.error("STOP missing CK5 seller env · run seed-disposable-vault-accounts.mjs + seed-disposable-business.mjs first");
  process.exit(4);
}

// Hard guards.
const PROTECTED_IDS = new Set([
  "11111111-1111-4111-8111-111111111111", // Hammerex
  "11111111-1111-4111-8111-111111111113", // Rosa
]);
if (PROTECTED_IDS.has(A_ACCOUNT_ID)) {
  console.error("STOP cannot touch protected identity " + A_ACCOUNT_ID);
  process.exit(5);
}
if (!/^nex-9[0-9]{5}$/.test(A_HANDLE)) {
  console.error("STOP unexpected handle · " + A_HANDLE); process.exit(6);
}

const PRODUCT_NAME_PREFIX = "E2E PLQ Widget";
// Placeholder image · never fetched by server (see D2 fixture doc).
const PLACEHOLDER_IMG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP8/58BAAT/Av+GHHe6AAAAAElFTkSuQmCC";

const pool = new pg.Client({ connectionString: DB_URL });
await pool.connect();

try {
  // Hard-clean any prior PLQ widgets on THIS business (restart-safe).
  const leftovers = await pool.query(
    `SELECT id, name FROM nex_product WHERE business_id = $1 AND name LIKE $2`,
    [BUSINESS_ID, `${PRODUCT_NAME_PREFIX} %`],
  );
  for (const row of leftovers.rows) {
    if (!(row.name).startsWith(`${PRODUCT_NAME_PREFIX} `)) {
      throw new Error(`pre-clean refuse · unexpected product name ${row.name}`);
    }
  }
  await pool.query(
    `DELETE FROM nex_product WHERE business_id = $1 AND name LIKE $2`,
    [BUSINESS_ID, `${PRODUCT_NAME_PREFIX} %`],
  );

  const stamp = Date.now().toString(36);
  const X_NAME = `${PRODUCT_NAME_PREFIX} X ${stamp}`;
  const Y_NAME = `${PRODUCT_NAME_PREFIX} Y ${stamp}`;

  const xRes = await pool.query(
    `INSERT INTO nex_product
       (business_id, name, description, price_pence, currency, status,
        department_id, category_id, image_url)
     VALUES ($1, $2, 'CP2 fixture · product X · delete freely',
             1799, 'EUR', 'live', 'everything_else', 'other', $3)
     RETURNING id`,
    [BUSINESS_ID, X_NAME, PLACEHOLDER_IMG],
  );
  const X_ID = xRes.rows[0].id;

  const yRes = await pool.query(
    `INSERT INTO nex_product
       (business_id, name, description, price_pence, currency, status,
        department_id, category_id, image_url)
     VALUES ($1, $2, 'CP2 fixture · product Y · delete freely',
             4250, 'EUR', 'live', 'everything_else', 'other', $3)
     RETURNING id`,
    [BUSINESS_ID, Y_NAME, PLACEHOLDER_IMG],
  );
  const Y_ID = yRes.rows[0].id;

  // Append/replace the X/Y lines in the CK5 env file.
  let current = readFileSync(".env.playwright.vault-ck5", "utf8");
  current = current
    .split("\n")
    .filter((l) => !/^PLAYWRIGHT_CK5_PRODUCT_(X|Y)_(ID|NAME)=/.test(l))
    .join("\n");
  if (!current.endsWith("\n")) current += "\n";
  current += `PLAYWRIGHT_CK5_PRODUCT_X_ID='${X_ID}'\n`;
  current += `PLAYWRIGHT_CK5_PRODUCT_X_NAME='${X_NAME}'\n`;
  current += `PLAYWRIGHT_CK5_PRODUCT_Y_ID='${Y_ID}'\n`;
  current += `PLAYWRIGHT_CK5_PRODUCT_Y_NAME='${Y_NAME}'\n`;
  writeFileSync(".env.playwright.vault-ck5", current);

  console.log(`[CP2 products] business=${BUSINESS_SLUG} X=${X_ID} Y=${Y_ID}`);
} finally {
  await pool.end();
}
