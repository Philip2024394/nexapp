// scripts/_inspect-philip-businesses.mjs
//
// READ-ONLY inspection · one scoped SELECT.
// Reports the nex_business rows owned by the founder account
// (resolved via the sentinel business slug 'nex-10842' as in the
// Hammerex seed), ordered by created_at.
//
// Scope: id, slug, display_name, cover_layout_id. No other fields,
// no mutations, no other queries. Delete after review.

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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
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
  // Resolve founder account id via the sentinel slug (same resolution the seed uses).
  const owner = await pg.query(
    `SELECT a.id, a.display_name
       FROM nex_account a
       JOIN nex_business b ON b.owner_account_id = a.id
      WHERE b.slug = 'nex-10842'
      LIMIT 1`,
  );
  if (!owner.rows[0]) {
    console.error("founder sentinel 'nex-10842' not found; cannot resolve owner account");
    process.exit(1);
  }

  // The ONE authorised scoped SELECT.
  const businesses = await pg.query(
    `SELECT id, slug, display_name, cover_layout_id, created_at
       FROM nex_business
      WHERE owner_account_id = $1
      ORDER BY created_at ASC`,
    [owner.rows[0].id],
  );

  console.log(JSON.stringify({
    owner_account_id: owner.rows[0].id,
    owner_display_name: owner.rows[0].display_name,
    businesses_count: businesses.rows.length,
    businesses: businesses.rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      display_name: r.display_name,
      cover_layout_id: r.cover_layout_id,
      created_at: r.created_at,
    })),
  }, null, 2));
} finally {
  await pg.end();
}
