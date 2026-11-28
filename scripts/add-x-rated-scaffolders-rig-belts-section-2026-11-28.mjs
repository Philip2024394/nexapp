// scripts/add-x-rated-scaffolders-rig-belts-section-2026-11-28.mjs
//
// Owner directive 2026-11-28 (third pass on Utility Duffel) ·
// "first category is scaffolders rig belts, which will be the home
// page displaying cards". Add a second nex_product_section for the
// X-Rated shop called "Scaffolders Rig Belts" at sort_order 0 (so it
// renders first in the dropdown), bump the existing Tool Rig Bag to
// sort_order 1, and attach every currently-unsectioned X-Rated
// product (XRTB-001 .. XRTB-017) to the new section so the default
// view shows the belts/rigs grid.
//
// Idempotent · sandbox-only · hard-refuses prod.
//
// Writes `evidence/x-rated-seed/sections-run-{timestamp}.json`.

import pg from "pg";
import { readFileSync, writeFileSync } from "node:fs";
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

const dbUrl = env.DATABASE_URL;
if (!dbUrl) {
  console.error("REFUSED · missing DATABASE_URL");
  process.exit(1);
}
if (/ijvqdvsvwtwxzcqmoqit/.test(dbUrl)) {
  console.error("REFUSED · points at PROD ijvqdvsvwtwxzcqmoqit · sandbox-only");
  process.exit(1);
}
if (!/kdstoyyeygcopkogqsyv/.test(dbUrl)) {
  console.error("REFUSED · must point at sandbox kdstoyyeygcopkogqsyv");
  process.exit(1);
}

const BIZ_ID = "22222222-2222-4222-8222-222222299902";
const SCAFFOLDERS_NAME = "Scaffolders Rig Belts";
const TOOL_RIG_BAG_NAME = "Tool Rig Bag";
const DUFFEL_SKU = "XRTB-018";

const c = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

// Snapshot before
const { rows: sectionsBefore } = await c.query(
  `SELECT id, name, sort_order FROM nex_product_section
    WHERE business_id = $1 ORDER BY sort_order, created_at`,
  [BIZ_ID],
);
const { rows: productsBefore } = await c.query(
  `SELECT sku, section_id FROM nex_product WHERE business_id = $1 ORDER BY sku`,
  [BIZ_ID],
);

await c.query("BEGIN");
try {
  // 1 · Ensure Scaffolders Rig Belts section exists with sort_order=0.
  const existing = sectionsBefore.find((s) => s.name === SCAFFOLDERS_NAME);
  let scaffoldersId;
  if (existing) {
    scaffoldersId = existing.id;
    await c.query(
      `UPDATE nex_product_section SET sort_order = 0, updated_at = now() WHERE id = $1`,
      [scaffoldersId],
    );
  } else {
    const { rows } = await c.query(
      `INSERT INTO nex_product_section (business_id, name, sort_order)
         VALUES ($1, $2, 0)
         RETURNING id`,
      [BIZ_ID, SCAFFOLDERS_NAME],
    );
    scaffoldersId = rows[0].id;
  }

  // 2 · Bump Tool Rig Bag to sort_order 1 so Scaffolders renders first.
  await c.query(
    `UPDATE nex_product_section
        SET sort_order = 1, updated_at = now()
      WHERE business_id = $1 AND name = $2`,
    [BIZ_ID, TOOL_RIG_BAG_NAME],
  );

  // 3 · Attach every non-duffel X-Rated product to Scaffolders Rig Belts.
  //     Only touches products that currently have section_id IS NULL and
  //     are NOT the duffel · idempotent across re-runs.
  await c.query(
    `UPDATE nex_product
        SET section_id = $2, updated_at = now()
      WHERE business_id = $1
        AND sku <> $3
        AND section_id IS NULL`,
    [BIZ_ID, scaffoldersId, DUFFEL_SKU],
  );

  await c.query("COMMIT");
} catch (e) {
  await c.query("ROLLBACK");
  throw e;
}

// Snapshot after
const { rows: sectionsAfter } = await c.query(
  `SELECT id, name, sort_order FROM nex_product_section
    WHERE business_id = $1 ORDER BY sort_order, created_at`,
  [BIZ_ID],
);
const { rows: productsAfter } = await c.query(
  `SELECT sku, section_id FROM nex_product WHERE business_id = $1 ORDER BY sku`,
  [BIZ_ID],
);
const { rows: counts } = await c.query(
  `SELECT section_id, COUNT(*)::int AS n
     FROM nex_product WHERE business_id = $1 GROUP BY section_id`,
  [BIZ_ID],
);

await c.end();

const outPath = resolve(
  __dirname,
  "..",
  "evidence",
  "x-rated-seed",
  `sections-run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
);
writeFileSync(
  outPath,
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      business_id: BIZ_ID,
      sections_before: sectionsBefore,
      sections_after: sectionsAfter,
      products_before: productsBefore,
      products_after: productsAfter,
      counts_by_section: counts,
    },
    null,
    2,
  ),
);
console.log(`[done] ${outPath}`);
console.log(`sections: ${sectionsAfter.length}`);
for (const s of sectionsAfter) {
  const n = counts.find((x) => x.section_id === s.id)?.n ?? 0;
  console.log(`  ${s.sort_order} · ${s.name} · ${n} products`);
}
const nullSectionCount =
  counts.find((x) => x.section_id === null)?.n ?? 0;
console.log(`  (unsectioned: ${nullSectionCount})`);
