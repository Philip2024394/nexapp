// scripts/_tmp/stream-a-find-live-product.mjs
//
// Stream A · Nov-16 · one-off probe. Reads a single live product id
// (joined with its business) from the sandbox DB so smoke tests for
// /nex-native/product/<id> have a known-good URL. Read-only · no
// writes · no DDL. Guards against prod ref ijvqdvsvwtwxzcqmoqit.

import { readFileSync } from "node:fs";
import pg from "pg";

const envRaw = readFileSync(".env.local", "utf8");
function envValue(name) {
  const m = envRaw.match(new RegExp(`^${name}=(.*)$`, "m"));
  return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : null;
}

const DB_URL = envValue("DATABASE_URL") || envValue("SANDBOX_DATABASE_URL");
if (!DB_URL) {
  console.error("No DATABASE_URL in .env.local · aborting.");
  process.exit(1);
}
if (DB_URL.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("REFUSING · DATABASE_URL points at production. Aborting.");
  process.exit(2);
}

const client = new pg.Client({ connectionString: DB_URL });
await client.connect();

const res = await client.query(
  `SELECT p.id, p.name, p.price_pence, p.currency, p.stock_status,
          b.slug AS business_slug, b.display_name AS business_name,
          b.owner_account_id
     FROM nex_product p
     JOIN nex_business b ON b.id = p.business_id
    WHERE p.status = 'live'
      AND b.owner_account_id IS NOT NULL
    ORDER BY p.created_at DESC NULLS LAST
    LIMIT 5`,
);

for (const row of res.rows) {
  console.log(JSON.stringify(row, null, 2));
}

await client.end();
