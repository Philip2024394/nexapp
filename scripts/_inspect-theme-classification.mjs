// scripts/_inspect-theme-classification.mjs
//
// READ-ONLY · Stage 2 verification · counts theme rows by (tier, category)
// so we can prove the planned origin-backfill in migration 191 won't
// misclassify existing rows. Also lists every id so hammerex-products
// is visible as a 'premium' row that the SEPARATE historical script
// will later promote to origin='bespoke'.

import { readFileSync } from "node:fs";
import { Client } from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

const env = (() => {
  const t = readFileSync(path.join(REPO_ROOT, ".env.local"), "utf8");
  const out = {};
  for (const line of t.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
})();

const PG_URL = env.NEX_POSTGRES_URL;
if (!PG_URL || !/ijvqdvsvwtwxzcqmoqit/.test(PG_URL)) {
  console.error("NEX_POSTGRES_URL must point at Supabase ijvqdvsvwtwxzcqmoqit");
  process.exit(1);
}

const pg = new Client({ connectionString: PG_URL, ssl: { rejectUnauthorized: false } });
await pg.connect();
try {
  const counts = await pg.query(
    `SELECT tier, category, count(*)::int AS n
       FROM nex_chat_theme
      GROUP BY tier, category
      ORDER BY tier, category`,
  );
  const list = await pg.query(
    `SELECT id, name, tier, category
       FROM nex_chat_theme
      ORDER BY category DESC, sort_order ASC, id ASC`,
  );
  console.log(JSON.stringify({
    counts_by_tier_category: counts.rows,
    all_rows: list.rows,
  }, null, 2));
} finally {
  await pg.end();
}
