// scripts/investigate-wexford.mjs
// READ-ONLY · establishes the exact current state of the Wexford
// community-zone + neighbourhood rows after the 2026-11-03 slug-
// mismatch incident (migration 271 looked up slug='wexford' but the
// sealed migration 266 slug is 'county-wexford' · 42 rows inserted
// with parent_zone_id=NULL · scripts/fix-wexford-orphans.mjs then
// re-parented them).
//
// Owner-authorised 2026-11-03 under the Engineering Quality
// Correction directive · "investigate migration 271 and the 42
// Wexford rows · establish the exact current state and propose a
// safe recovery plan · do NOT apply further data changes".
//
// Does NOT mutate anything. Prints:
//   · Wexford county row id + slug + parent + archived state
//   · Count of IE level='neighbourhood' rows AND their parent (should
//     all point at Wexford · ever any still orphaned?)
//   · Any slug / FK anomalies for the 42 inserted names
//   · Membership rows that reference each of the 42 neighbourhoods
//   · Verifies migration 271 history row exists

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

const EXPECTED_NAMES = [
  "Adamstown","Ballindaggin","Ballycanew","Ballycullane","Ballyduff",
  "Ballygarrett","Bannow","Blackwater","Bree","Bunclody","Camolin",
  "Castlebridge","Clongeen","Clonard","Cloughbawn","Crossabeg",
  "Curracloe","Cushinstown","Davidstown","Duncannon","Enniscorthy",
  "Ferns","Fethard-on-Sea","Glynn","Gorey","Horeswood","Kilanerin",
  "Kilmore","Kilmore Quay","Kilmuckridge","Marshalstown","Mayglass",
  "Monageer","New Ross","Oulart","Oylegate","Piercestown","Rathangan",
  "Rathnure","Rosslare","Taghmon","Wexford Town",
];

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("─── READ-ONLY INVESTIGATION · ijvqdvsvwtwxzcqmoqit ───\n");

try {
  // 1 · Wexford county row
  const county = await client.query(
    `SELECT id, name, slug, parent_zone_id, archived_at
       FROM nex_community_zone
      WHERE country='IE' AND level='city'
        AND (slug='wexford' OR slug='county-wexford')`,
  );
  console.log("1 · Wexford county row(s):");
  console.table(county.rows);
  const wexId = county.rows.find((r) => r.slug === "county-wexford")?.id;
  if (!wexId) {
    console.error("   ANOMALY · no county-wexford row found");
  }

  // 2 · All IE neighbourhoods · bucket by parent (expected: all under wexId)
  const nbh = await client.query(
    `SELECT parent_zone_id, count(*)::int AS c
       FROM nex_community_zone
      WHERE country='IE' AND level='neighbourhood' AND archived_at IS NULL
   GROUP BY parent_zone_id
   ORDER BY c DESC`,
  );
  console.log("\n2 · IE neighbourhoods bucketed by parent:");
  console.table(nbh.rows);
  const orphans = nbh.rows.find((r) => r.parent_zone_id === null);
  if (orphans) {
    console.error(`   ANOMALY · ${orphans.c} orphan neighbourhoods remain`);
  }

  // 3 · Verify every expected name is present + parented at wexId
  const parented = await client.query(
    `SELECT name, slug, parent_zone_id, moderation_status, created_by_account_id
       FROM nex_community_zone
      WHERE country='IE' AND level='neighbourhood' AND archived_at IS NULL
        AND name = ANY($1)`,
    [EXPECTED_NAMES],
  );
  console.log(
    `\n3 · Expected-name check · found ${parented.rows.length} of ${EXPECTED_NAMES.length}`,
  );
  const missing = EXPECTED_NAMES.filter(
    (n) => !parented.rows.some((r) => r.name === n),
  );
  if (missing.length > 0) {
    console.error(`   MISSING: ${missing.join(" · ")}`);
  }
  const mis = parented.rows.filter((r) => r.parent_zone_id !== wexId);
  if (mis.length > 0) {
    console.error("   MIS-PARENTED:");
    console.table(mis);
  }

  // 4 · Membership rows that reference these 42 neighbourhood ids
  const nbhIds = parented.rows.map((r) =>
    typeof r === "object" && "id" in r ? r.id : null,
  );
  // (need ids · re-query with id column)
  const withIds = await client.query(
    `SELECT id FROM nex_community_zone
      WHERE country='IE' AND level='neighbourhood' AND archived_at IS NULL`,
  );
  const mem = await client.query(
    `SELECT hyperlocal_zone_id, count(*)::int AS c
       FROM nex_community_membership
      WHERE hyperlocal_zone_id = ANY($1)
   GROUP BY hyperlocal_zone_id`,
    [withIds.rows.map((r) => r.id)],
  );
  console.log(
    `\n4 · Memberships bound to any of the 42 Wexford neighbourhoods: ${mem.rows.length} zones have members`,
  );
  if (mem.rows.length > 0) console.table(mem.rows.slice(0, 10));

  // 5 · Migration 271 history row
  const hist = await client.query(
    `SELECT version, description, applied_at
       FROM nex_migration_history
      WHERE version IN ('266','270','271','272')
   ORDER BY version`,
  );
  console.log("\n5 · Relevant migration_history rows:");
  console.table(hist.rows);
} finally {
  await client.end();
  console.log("\n─── END · no writes performed ───");
}
