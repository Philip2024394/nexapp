// scripts/_tmp/qa-nov16/find-live-product.mjs
// READ-ONLY sandbox probe. Finds a live NEX product on the CK5 seller
// business (never Hammerex/Rosa). Dumps minimal metadata.
import pkg from "pg";
import { readFileSync } from "node:fs";

const { Client } = pkg;
const dbUrl = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1];
if (!dbUrl) throw new Error("DATABASE_URL not found");
if (dbUrl.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("refuses prod");
if (!dbUrl.includes("kdstoyyeygcopkogqsyv")) throw new Error("refuses non-sandbox");

const ck5 = readFileSync(".env.playwright.vault-ck5", "utf8");
const bizId = ck5.match(/PLAYWRIGHT_CK5_A_BUSINESS_ID=['"]?([^'"\n]*)['"]?$/m)?.[1];
if (!bizId) throw new Error("no CK5 biz id");

const c = new Client({ connectionString: dbUrl });
await c.connect();
try {
  const { rows } = await c.query(
    `SELECT id, name, price_pence, currency, image_url
       FROM nex_product
       WHERE business_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
    [bizId],
  );
  console.log(JSON.stringify({ businessId: bizId, products: rows }, null, 2));
} finally { await c.end(); }
