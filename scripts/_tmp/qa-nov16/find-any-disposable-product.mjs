// Find a disposable seeded product that is NOT Hammerex/Rosa.
import pkg from "pg";
import { readFileSync } from "node:fs";
const { Client } = pkg;
const dbUrl = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1];
if (!dbUrl) throw new Error("DATABASE_URL not found");
if (dbUrl.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("prod ref");
if (!dbUrl.includes("kdstoyyeygcopkogqsyv")) throw new Error("not sandbox");

const PROTECTED_ACC = new Set([
  "11111111-1111-4111-8111-111111111111", // Hammerex
  "11111111-1111-4111-8111-111111111113", // Rosa
]);

const c = new Client({ connectionString: dbUrl });
await c.connect();
try {
  // List products with owners to find disposables.
  const { rows } = await c.query(
    `SELECT p.id AS product_id, p.name, p.price_pence, p.currency, p.business_id,
            p.image_url,
            b.slug AS business_slug, b.owner_account_id,
            a.nex_handle, a.display_name
       FROM nex_product p
       JOIN nex_business b ON b.id = p.business_id
       JOIN nex_account  a ON a.id = b.owner_account_id
       ORDER BY p.created_at DESC
       LIMIT 50`,
  );
  const filtered = rows.filter(
    (r) =>
      !PROTECTED_ACC.has(r.owner_account_id) &&
      !/hammerex|rosa|nex-99901|nex-99903/i.test(r.display_name || "") &&
      !/hammerex|rosa|nex-99901|nex-99903/i.test(r.nex_handle || ""),
  );
  console.log(JSON.stringify({ count: filtered.length, sample: filtered.slice(0, 5) }, null, 2));
} finally { await c.end(); }
