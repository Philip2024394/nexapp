// scripts/_inspect-x-rated-detail-2026-11-28.mjs
// Follow-up read-only inspection: department/category values + image_url shape.

import pg from "pg";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envRaw = readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8");
const env = Object.fromEntries(
  envRaw.split(/\r?\n/).filter(Boolean).filter((l) => !l.startsWith("#")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
  }),
);
const dbUrl = env.DATABASE_URL;
if (!/kdstoyyeygcopkogqsyv/.test(dbUrl ?? "")) {
  console.error("REFUSED · DATABASE_URL must point at sandbox kdstoyyeygcopkogqsyv");
  process.exit(1);
}

const c = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await c.connect();

const BIZ_ID = "22222222-2222-4222-8222-222222299902";

// 1 · Sample an existing X-Rated product for department/category/image shape
const { rows: sample } = await c.query(`
  SELECT id, name, department_id, category_id, image_url, gallery_urls,
         stock_status, sku, dispatch_time, section_id, spec
    FROM nex_product
   WHERE business_id = $1
   LIMIT 3
`, [BIZ_ID]);

// 2 · Count department / category usage across all products (not just X-Rated)
const { rows: depts } = await c.query(`
  SELECT department_id, COUNT(*)::int AS n
    FROM nex_product
   GROUP BY department_id
   ORDER BY n DESC
   LIMIT 20
`);
const { rows: cats } = await c.query(`
  SELECT category_id, COUNT(*)::int AS n
    FROM nex_product
   GROUP BY category_id
   ORDER BY n DESC
   LIMIT 40
`);

// 3 · Are department_id / category_id FK-constrained to another table?
const { rows: fkInfo } = await c.query(`
  SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
   WHERE conrelid = 'public.nex_product'::regclass
     AND contype = 'f'
`);

await c.end();

const out = {
  timestamp: new Date().toISOString(),
  sample_products: sample,
  all_departments: depts,
  all_categories: cats,
  foreign_keys: fkInfo,
};
const outPath = resolve(__dirname, "..", "evidence", "x-rated-seed", "detail-inspection.json");
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`[done] ${outPath}`);
console.log(`  sample products: ${sample.length}`);
console.log(`  departments observed: ${depts.length}`);
console.log(`  categories observed: ${cats.length}`);
console.log(`  foreign keys: ${fkInfo.length}`);
