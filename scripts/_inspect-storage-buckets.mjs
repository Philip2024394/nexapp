// scripts/_inspect-storage-buckets.mjs
// Read-only inspection of sandbox storage.buckets inventory.
// Stream B · 2026-11-16. Refuses prod project ref.

import pg from "pg";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envRaw = readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8");
const env = Object.fromEntries(
  envRaw.split(/\r?\n/).filter(Boolean).filter((l) => !l.startsWith("#")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1)];
  }),
);

const dbUrl = env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}
// Hard refuse prod.
if (/ijvqdvsvwtwxzcqmoqit/i.test(dbUrl)) {
  console.error("REFUSED · DATABASE_URL points at prod ref ijvqdvsvwtwxzcqmoqit");
  process.exit(2);
}

const c = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await c.connect();

const { rows: buckets } = await c.query(`
  SELECT id, name, public, file_size_limit, allowed_mime_types, created_at
    FROM storage.buckets
   ORDER BY id
`);

// Also probe for seller_viewed_at column on nex_order (S1)
const { rows: orderCols } = await c.query(`
  SELECT column_name, data_type
    FROM information_schema.columns
   WHERE table_name = 'nex_order' AND table_schema = 'public'
   ORDER BY ordinal_position
`);

// Also verify mig 320 payment_method state (S8 secondary task)
const { rows: paymentMethodCol } = await c.query(`
  SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
   WHERE table_name = 'nex_order'
     AND column_name = 'payment_method'
`);

await c.end();

const evidenceDir = resolve(__dirname, "..", "evidence", "stream-b");
mkdirSync(evidenceDir, { recursive: true });

const out = {
  timestamp: new Date().toISOString(),
  project_ref_from_url: /https:\/\/([a-z0-9]+)\.supabase\.co/.exec(env.NEXT_PUBLIC_NEX_SUPABASE_URL ?? "")?.[1] ?? null,
  buckets,
  nex_order_columns: orderCols.map((r) => r.column_name),
  has_seller_viewed_at: orderCols.some((r) => r.column_name === "seller_viewed_at"),
  mig_320_payment_method_column: paymentMethodCol[0] ?? null,
};
writeFileSync(resolve(evidenceDir, "bucket-inventory.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
