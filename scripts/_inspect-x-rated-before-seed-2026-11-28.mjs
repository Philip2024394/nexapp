// scripts/_inspect-x-rated-before-seed-2026-11-28.mjs
//
// Read-only sandbox inspection before seeding the X-Rated Utility
// Duffel S. Gathers everything the seed script needs in one hop:
//
//   1. Confirm sandbox project ref (REFUSE prod ijvqdvsvwtwxzcqmoqit)
//   2. Resolve X-Rated Tool Belts business row + owner account
//   3. List existing X-Rated products (so we don't duplicate)
//   4. List existing X-Rated product sections (so we know whether
//      "Tool Rig Bag" already exists)
//   5. Inspect storage buckets · identify the product-media bucket
//   6. Show nex_product column shape to confirm the insert payload
//
// Writes report to evidence/x-rated-seed/pre-insert-inspection.json.

import pg from "pg";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envRaw = readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8");
const env = Object.fromEntries(
  envRaw
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((l) => !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);

const supaUrl = env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const projectRef = /https:\/\/([a-z0-9]+)\.supabase\.co/.exec(supaUrl ?? "")?.[1];
if (!projectRef) {
  console.error("REFUSED · cannot parse project ref from NEXT_PUBLIC_NEX_SUPABASE_URL");
  process.exit(1);
}
if (projectRef === "ijvqdvsvwtwxzcqmoqit") {
  console.error("REFUSED · .env.local points at prod ref ijvqdvsvwtwxzcqmoqit");
  process.exit(2);
}
if (projectRef !== "kdstoyyeygcopkogqsyv") {
  console.error(`REFUSED · unexpected project ref ${projectRef} · sandbox is kdstoyyeygcopkogqsyv`);
  process.exit(3);
}
console.log(`[ok] sandbox ref ${projectRef}`);

const dbUrl = env.DATABASE_URL;
if (!dbUrl) {
  console.error("REFUSED · DATABASE_URL not set in .env.local");
  process.exit(4);
}

const c = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await c.connect();

const report = { timestamp: new Date().toISOString(), projectRef };

// 1 · X-Rated business row
const { rows: biz } = await c.query(`
  SELECT b.id, b.slug, b.display_name, b.owner_account_id,
         b.created_at, a.display_name AS owner_display_name
    FROM nex_business b
    LEFT JOIN nex_account a ON a.id = b.owner_account_id
   WHERE b.slug = 'x-rated-tool-belts'
   LIMIT 1
`);
report.x_rated_business = biz[0] ?? null;

if (!biz[0]) {
  report.x_rated_business_error = "SHOP NOT FOUND · slug x-rated-tool-belts has no row";
} else {
  const biz_id = biz[0].id;
  console.log(`[ok] X-Rated business ${biz_id} · owner ${biz[0].owner_account_id}`);

  // 2 · Existing X-Rated products
  const { rows: prods } = await c.query(`
    SELECT id, name, price_pence, currency, status, created_at
      FROM nex_product
     WHERE business_id = $1
     ORDER BY created_at DESC
     LIMIT 50
  `, [biz_id]);
  report.existing_products = prods;
  console.log(`[info] X-Rated has ${prods.length} existing products`);

  // 3 · Existing X-Rated product sections (migration 107)
  const { rows: sectionsTableExists } = await c.query(`
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'nex_product_section'
  `);
  if (sectionsTableExists[0]) {
    const { rows: sectionCols } = await c.query(`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'nex_product_section'
       ORDER BY ordinal_position
    `);
    report.nex_product_section_columns = sectionCols.map((r) => r.column_name);
    const { rows: sections } = await c.query(`
      SELECT * FROM nex_product_section
       WHERE business_id = $1
    `, [biz_id]);
    report.existing_sections = sections;
    console.log(`[info] X-Rated has ${sections.length} existing product sections`);
  } else {
    report.existing_sections = "nex_product_section table does not exist in sandbox";
    console.log(`[warn] nex_product_section table does not exist`);
  }
}

// 4 · Storage buckets inventory
const { rows: buckets } = await c.query(`
  SELECT id, name, public, file_size_limit, allowed_mime_types
    FROM storage.buckets
   ORDER BY id
`);
report.buckets = buckets;
report.product_media_candidates = buckets.filter((b) =>
  /product|media|business|shop|catalogue|catalog/i.test(b.name),
);
console.log(`[info] ${buckets.length} buckets · ${report.product_media_candidates.length} product-media candidates`);

// 5 · nex_product column shape
const { rows: cols } = await c.query(`
  SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'nex_product'
   ORDER BY ordinal_position
`);
report.nex_product_columns = cols;

await c.end();

const evidenceDir = resolve(__dirname, "..", "evidence", "x-rated-seed");
mkdirSync(evidenceDir, { recursive: true });
const outPath = resolve(evidenceDir, "pre-insert-inspection.json");
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`[done] report written to ${outPath}`);
