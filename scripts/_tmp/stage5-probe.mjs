// scripts/_tmp/stage5-probe.mjs
//
// Stage 5 pre-stage · read-only sandbox probe · 2026-11-14.
// Finds a signed-in impersonated-persona-friendly shop + at least one
// live product so the HTTP walkthrough can hit real routes. Hard-
// refuses to run against anything other than the sealed sandbox.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const envRaw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
function envValue(name) {
  const m = envRaw.match(new RegExp(`^${name}=(.*)$`, "m"));
  return m ? m[1].trim() : null;
}
const url = envValue("SANDBOX_DATABASE_URL") || envValue("DATABASE_URL");
if (!url) {
  console.error("STOP · no DATABASE_URL in .env.local");
  process.exit(1);
}
if (!url.includes("kdstoyyeygcopkogqsyv")) {
  console.error("STOP · not pointing at sandbox (kdstoyyeygcopkogqsyv)");
  process.exit(2);
}
if (url.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("STOP · URL contains production ref");
  process.exit(3);
}

const client = new Client({ connectionString: url });
await client.connect();
try {
  console.log("[probe] shops with at least one live product:");
  const shopsWithProducts = await client.query(`
    SELECT b.id AS business_id, b.slug, b.display_name, b.owner_account_id,
           COUNT(p.id) AS live_product_count
    FROM nex_business b
    JOIN nex_product p ON p.business_id = b.id AND p.status = 'live'
    GROUP BY b.id, b.slug, b.display_name, b.owner_account_id
    ORDER BY live_product_count DESC
    LIMIT 6
  `);
  console.table(shopsWithProducts.rows);

  if (shopsWithProducts.rows.length === 0) {
    console.log("[probe] no shops with live products in sandbox");
    process.exit(0);
  }

  const pick = shopsWithProducts.rows[0];
  console.log(`\n[probe] picking first shop: ${pick.slug} (business_id=${pick.business_id})\n`);

  const products = await client.query(
    `SELECT id, name, price_pence, currency, status
     FROM nex_product WHERE business_id = $1 AND status = 'live'
     ORDER BY created_at DESC LIMIT 5`,
    [pick.business_id],
  );
  console.log("[probe] live products on this shop:");
  console.table(products.rows);

  // Does nex-99901 have a conversation with this shop yet?
  const ninety = await client.query(
    `SELECT id, display_name FROM nex_account WHERE nex_handle = 'nex-99901'`,
  );
  if (ninety.rows.length > 0) {
    const nineAcc = ninety.rows[0];
    const conv = await client.query(
      `SELECT c.id FROM nex_conversation c
       JOIN nex_conversation_participant p ON p.conversation_id = c.id
       WHERE c.business_id = $1 AND p.account_id = $2`,
      [pick.business_id, nineAcc.id],
    );
    console.log(
      `\n[probe] nex-99901 (${nineAcc.id}) has ${conv.rows.length} conversations with ${pick.slug}`,
    );
    if (conv.rows.length > 0) {
      console.log("[probe] conversation_id =", conv.rows[0].id);
    }
  }

  // Count mock personas available
  const mocks = await client.query(
    `SELECT COUNT(*) AS count FROM nex_account WHERE is_mock_persona = true`,
  );
  console.log(`\n[probe] mock personas in sandbox: ${mocks.rows[0].count}`);
} finally {
  await client.end();
}
