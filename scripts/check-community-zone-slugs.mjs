// scripts/check-community-zone-slugs.mjs
//
// READ-ONLY · detects anomalies in nex_community_zone:
//   · orphan non-country rows (parent_zone_id IS NULL for non-country level)
//   · slug CHECK violations (ck_zone_slug_shape · migration 146)
//   · duplicate (parent_zone_id, slug) pairs (should be impossible given
//     sealed uq_zone_parent_slug partial unique · a trip here means
//     the sealed index is broken)
//   · neighbourhood rows whose parent is NOT level='city' (hierarchy
//     violation)
// Owner-sealed 2026-11-03.

import { readFileSync } from "node:fs";
import pg from "pg";

function readEnv(k) {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === k) return m[2];
  }
  return null;
}

const url = readEnv("DATABASE_URL");
if (!url?.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("ERR: wrong project");
  process.exit(3);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
let errors = 0;

try {
  // a · orphan non-country rows
  const orphans = await client.query(
    `SELECT id, country, level, name, slug
       FROM nex_community_zone
      WHERE archived_at IS NULL
        AND level <> 'country'
        AND parent_zone_id IS NULL`,
  );
  if (orphans.rows.length > 0) {
    console.error(
      `ANOMALY · ${orphans.rows.length} non-country rows have no parent:`,
    );
    console.table(orphans.rows);
    errors++;
  }

  // b · slug CHECK violation (defensive · CHECK should prevent)
  const badSlugs = await client.query(
    `SELECT id, slug
       FROM nex_community_zone
      WHERE NOT (slug ~ '^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$' OR slug ~ '^[a-z0-9]$')`,
  );
  if (badSlugs.rows.length > 0) {
    console.error(
      `ANOMALY · ${badSlugs.rows.length} rows violate ck_zone_slug_shape:`,
    );
    console.table(badSlugs.rows);
    errors++;
  }

  // c · neighbourhood with non-city parent
  const nbhLineage = await client.query(
    `SELECT child.id, child.name AS child_name, parent.level AS parent_level
       FROM nex_community_zone child
       JOIN nex_community_zone parent ON child.parent_zone_id = parent.id
      WHERE child.level = 'neighbourhood'
        AND parent.level <> 'city'
        AND child.archived_at IS NULL`,
  );
  if (nbhLineage.rows.length > 0) {
    console.error(
      `ANOMALY · ${nbhLineage.rows.length} neighbourhood rows have non-city parent:`,
    );
    console.table(nbhLineage.rows.slice(0, 10));
    errors++;
  }

  // d · duplicate (parent_zone_id, slug) pairs (bypass partial unique)
  const dupSlugs = await client.query(
    `SELECT parent_zone_id, slug, count(*)::int AS c
       FROM nex_community_zone
      WHERE parent_zone_id IS NOT NULL AND archived_at IS NULL
   GROUP BY parent_zone_id, slug
     HAVING count(*) > 1`,
  );
  if (dupSlugs.rows.length > 0) {
    console.error(
      `ANOMALY · ${dupSlugs.rows.length} duplicate (parent, slug) pairs:`,
    );
    console.table(dupSlugs.rows.slice(0, 10));
    errors++;
  }
} finally {
  await client.end();
}

if (errors === 0) {
  console.log("✓ No zone-slug anomalies.");
} else {
  console.log(`\n${errors} class(es) of anomaly detected.`);
  process.exit(1);
}
