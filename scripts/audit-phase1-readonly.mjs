#!/usr/bin/env node
// scripts/audit-phase1-readonly.mjs
//
// Phase 1 · Production integrity audit · READ-ONLY.
//
// Verifies:
//   - Target DB is the sealed Supabase project ijvqdvsvwtwxzcqmoqit
//   - Current directory_v + category_image_library counts
//   - Claimed increase (23,423 → 40,541) reconciled against row-level data
//   - Duplicates: (country, osm_id), (name, city), (name, coordinates)
//   - Lifecycle state distribution + publishability gates
//   - Source-registry attribution per source_id
//   - Category-image resolver coverage per published row
//   - Separation: genuine OSM-sourced businesses vs. non-business POI
//     (bus_station / railway_station / amenity_atm / amenity_bank are
//     POI landmarks, not business listings in the owner-operated sense)
//
// This script runs ONLY SELECT. Never INSERT/UPDATE/DELETE/DDL.

import pg from "pg";

const APPROVED_PROJECT_ID = "ijvqdvsvwtwxzcqmoqit";

function verifyTarget(url) {
  const u = new URL(url.replace(/^postgres(ql)?:\/\//, "http://"));
  const m = /^postgres\.([a-z0-9]+)$/.exec(u.username);
  if (!m || m[1] !== APPROVED_PROJECT_ID) {
    throw new Error(`REFUSED · pooler user is not sealed project '${APPROVED_PROJECT_ID}'`);
  }
  return { project: m[1], host: u.hostname };
}

async function section(title, fn) {
  const bar = "═".repeat(72);
  console.log(`\n${bar}\n§ ${title}\n${bar}`);
  await fn();
}

async function table(client, label, sql, args = []) {
  try {
    const r = await client.query(sql, args);
    console.log(`\n${label}`);
    if (r.rows.length === 0) {
      console.log("  (no rows)");
    } else {
      console.table(r.rows);
    }
    return r.rows;
  } catch (e) {
    console.log(`\n${label}\n  ERROR · ${e.message.slice(0, 200)}`);
    return [];
  }
}

async function scalar(client, label, sql, args = []) {
  try {
    const r = await client.query(sql, args);
    const val = r.rows[0] ? Object.values(r.rows[0])[0] : null;
    console.log(`  ${label.padEnd(50)} ${val}`);
    return val;
  } catch (e) {
    console.log(`  ${label.padEnd(50)} ERROR: ${e.message.slice(0, 100)}`);
    return null;
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL unset");
  const target = verifyTarget(url);

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  await section("Environment", async () => {
    console.log(`  project (approved):           ${target.project}`);
    console.log(`  host:                         ${target.host}`);
    await scalar(client, "current_database():", "SELECT current_database()");
    await scalar(client, "current_user:", "SELECT current_user");
    await scalar(client, "server_version:", "SELECT version()");
    await scalar(client, "server now():", "SELECT now()");
  });

  await section("Headline counts (claim: directory_v = 40,541)", async () => {
    await scalar(client, "nex.business_canonical rows:", "SELECT COUNT(*)::int FROM nex.business_canonical");
    await scalar(client, "nex.business_directory_v rows:", "SELECT COUNT(*)::int FROM nex.business_directory_v");
    await scalar(client, "nex.business_evidence rows:", "SELECT COUNT(*)::int FROM nex.business_evidence");
    await scalar(client, "nex.business_canonical_lifecycle_log rows:", "SELECT COUNT(*)::int FROM nex.business_canonical_lifecycle_log");
    await scalar(client, "nex.category_image_library rows:", "SELECT COUNT(*)::int FROM nex.category_image_library");
    await scalar(client, "nex.category_image_library distinct slugs:", "SELECT COUNT(DISTINCT category_slug)::int FROM nex.category_image_library WHERE active");
    await scalar(client, "nex.source_registry rows:", "SELECT COUNT(*)::int FROM nex.source_registry");
  });

  await section("Reconciliation (claim: +17,118 this session)", async () => {
    // Earlier push was 23,423 publishable rows (commit 5272950). The two
    // commits of this session were 47c1ef7 (bulk accommodation+service)
    // and 8e67c72 (OSM walker + card redesign). Reconcile the delta.
    await table(client, "canonical rows by entity_type:", `
      SELECT entity_type, COUNT(*)::int AS n
        FROM nex.business_canonical
       GROUP BY entity_type ORDER BY entity_type`);
    await table(client, "directory_v rows by entity_type:", `
      SELECT entity_type, COUNT(*)::int AS n
        FROM nex.business_directory_v
       GROUP BY entity_type ORDER BY entity_type`);
    await table(client, "evidence rows by source_id:", `
      SELECT source_id, COUNT(*)::int AS n
        FROM nex.business_evidence
       GROUP BY source_id ORDER BY n DESC`);
    await table(client, "lifecycle_log transitions by reason:", `
      SELECT transition_reason, COUNT(*)::int AS n
        FROM nex.business_canonical_lifecycle_log
       GROUP BY transition_reason ORDER BY n DESC`);
    await table(client, "canonicals created today (session window):", `
      SELECT DATE(created_at) AS day, COUNT(*)::int AS n
        FROM nex.business_canonical
       WHERE created_at >= CURRENT_DATE - INTERVAL '2 days'
       GROUP BY day ORDER BY day`);
  });

  await section("Duplicate detection", async () => {
    await table(client, "country+osm_id duplicates (should be 0 · partial UQ):", `
      SELECT country, osm_id, COUNT(*)::int AS n
        FROM nex.business_canonical
       WHERE osm_id IS NOT NULL
       GROUP BY country, osm_id HAVING COUNT(*) > 1
       ORDER BY n DESC LIMIT 10`);
    await table(client, "name_canonical + city collisions (top 20):", `
      SELECT name_canonical, city, COUNT(*)::int AS n
        FROM nex.business_canonical
       WHERE lifecycle_state IN ('VERIFIED','CLAIMED')
       GROUP BY name_canonical, city
      HAVING COUNT(*) > 1 ORDER BY n DESC LIMIT 20`);
    await table(client, "coordinate collisions (same exact lat/lng · top 10):", `
      SELECT ST_X(coordinates::geometry) AS lng,
             ST_Y(coordinates::geometry) AS lat,
             COUNT(*)::int AS n
        FROM nex.business_canonical
       WHERE coordinates IS NOT NULL
       GROUP BY lng, lat HAVING COUNT(*) > 1
       ORDER BY n DESC LIMIT 10`);
    await scalar(client, "canonicals missing city:",
      "SELECT COUNT(*)::int FROM nex.business_canonical WHERE city IS NULL OR city = ''");
    await scalar(client, "canonicals missing coordinates:",
      "SELECT COUNT(*)::int FROM nex.business_canonical WHERE coordinates IS NULL");
    await scalar(client, "canonicals missing name_canonical:",
      "SELECT COUNT(*)::int FROM nex.business_canonical WHERE name_canonical IS NULL OR length(trim(name_canonical)) = 0");
    await scalar(client, "canonicals w/ coords outside Indonesia bbox (ID extent approx):",
      `SELECT COUNT(*)::int FROM nex.business_canonical
        WHERE coordinates IS NOT NULL
          AND NOT ST_Intersects(coordinates, ST_MakeEnvelope(94, -11, 142, 7, 4326)::geography)`);
  });

  await section("Lifecycle + publishability", async () => {
    await table(client, "lifecycle_state distribution:", `
      SELECT lifecycle_state, COUNT(*)::int AS n
        FROM nex.business_canonical
       GROUP BY lifecycle_state ORDER BY n DESC`);
    await table(client, "canonicals missing evidence (orphans · should be 0):", `
      SELECT 'orphans' AS kind, COUNT(*)::int AS n
        FROM nex.business_canonical bc
       WHERE NOT EXISTS (SELECT 1 FROM nex.business_evidence be WHERE be.canonical_business_id = bc.canonical_business_id)`);
    await table(client, "evidence rows citing an unregistered source (FK violation would prevent, this is a sanity count):", `
      SELECT COUNT(*)::int AS n
        FROM nex.business_evidence be
        LEFT JOIN nex.source_registry sr ON sr.source_id = be.source_id
       WHERE sr.source_id IS NULL`);
    await table(client, "source_registry can_display gates (what IS publishable per source):", `
      SELECT source_id, source_type, can_display, attribution_required, attribution_template
        FROM nex.source_registry
       ORDER BY source_id`);
  });

  await section("Separation: real-business POIs vs non-business tiles", async () => {
    // The OSM walker intentionally included tags that are not necessarily
    // owner-operated businesses: amenity=atm, amenity=bank, amenity=police,
    // amenity=bus_station, railway=station, amenity=hospital. These are
    // POI landmarks or institutions · counting them as "businesses" is
    // misleading. Separate the counts honestly.
    await table(client, "walker-sourced rows by category (poi vs business):", `
      WITH labelled AS (
        SELECT unnest(bc.category_ids) AS cat,
               CASE
                 WHEN bc.entity_type IN ('food','accommodation','marketplace_seller') THEN 'business'
                 WHEN bc.entity_type = 'service' AND unnest(bc.category_ids) IN ('bars','petrol-station','barber-hair','laundry','relax-therapy','laptop-repair','ac-service') THEN 'business'
                 WHEN bc.entity_type = 'professional' THEN 'business'
                 WHEN bc.entity_type = 'vehicle_rental' THEN 'business'
                 WHEN bc.entity_type = 'transport_operator' AND unnest(bc.category_ids) IN ('car-taxi','bike-taxi') THEN 'business'
                 WHEN unnest(bc.category_ids) IN ('atm-machines','banks','bus-service','train-service','police-stations','hospitals') THEN 'poi_or_institution'
                 ELSE 'other'
               END AS kind
          FROM nex.business_canonical bc
         WHERE EXISTS (
           SELECT 1 FROM nex.business_evidence be
            WHERE be.canonical_business_id = bc.canonical_business_id
              AND be.source_id = 'osm_overpass_products_v1'
         )
      )
      SELECT kind, cat, COUNT(*)::int AS n
        FROM labelled
       GROUP BY kind, cat
       ORDER BY kind, n DESC`);
    await table(client, "high-level breakdown · poi vs business across the walker set:", `
      WITH labelled AS (
        SELECT bc.canonical_business_id,
               CASE
                 WHEN EXISTS (SELECT 1 FROM unnest(bc.category_ids) c WHERE c IN ('atm-machines','banks','bus-service','train-service','police-stations','hospitals')) THEN 'poi_or_institution'
                 ELSE 'business'
               END AS kind
          FROM nex.business_canonical bc
         WHERE EXISTS (SELECT 1 FROM nex.business_evidence be WHERE be.canonical_business_id = bc.canonical_business_id AND be.source_id = 'osm_overpass_products_v1')
      )
      SELECT kind, COUNT(*)::int AS n FROM labelled GROUP BY kind ORDER BY n DESC`);
  });

  await section("Contact & enrichment coverage (sample scope: all rows)", async () => {
    await scalar(client, "canonicals with phone_e164 non-null:",
      "SELECT COUNT(*)::int FROM nex.business_canonical WHERE phone_e164 IS NOT NULL AND phone_e164 != ''");
    await scalar(client, "canonicals with website_apex non-null:",
      "SELECT COUNT(*)::int FROM nex.business_canonical WHERE website_apex IS NOT NULL AND website_apex != ''");
    await scalar(client, "canonicals with phone_e164 by source osm_overpass_products_v1:",
      `SELECT COUNT(*)::int
         FROM nex.business_canonical bc
        WHERE phone_e164 IS NOT NULL AND phone_e164 != ''
          AND EXISTS (SELECT 1 FROM nex.business_evidence be WHERE be.canonical_business_id = bc.canonical_business_id AND be.source_id = 'osm_overpass_products_v1')`);
    await scalar(client, "canonicals with website_apex by source osm_overpass_products_v1:",
      `SELECT COUNT(*)::int
         FROM nex.business_canonical bc
        WHERE website_apex IS NOT NULL AND website_apex != ''
          AND EXISTS (SELECT 1 FROM nex.business_evidence be WHERE be.canonical_business_id = bc.canonical_business_id AND be.source_id = 'osm_overpass_products_v1')`);
  });

  await section("Category-image resolution coverage", async () => {
    // For each directory_v row, do we have a library entry that would
    // match it (via categoryIds OR entity_type Tier-3 fallback)?
    await table(client, "resolver coverage per entity_type:", `
      WITH tier_match AS (
        SELECT bdv.canonical_business_id, bdv.entity_type,
               EXISTS (
                 SELECT 1
                   FROM nex.category_image_library cil
                  WHERE cil.active
                    AND (cil.category_slug = ANY(bdv.category_ids) OR cil.category_slug = bdv.entity_type OR cil.category_slug = '*')
               ) AS has_match
          FROM nex.business_directory_v bdv
      )
      SELECT entity_type,
             COUNT(*)::int AS total,
             SUM(CASE WHEN has_match THEN 1 ELSE 0 END)::int AS covered,
             SUM(CASE WHEN has_match THEN 0 ELSE 1 END)::int AS uncovered
        FROM tier_match
       GROUP BY entity_type
       ORDER BY entity_type`);
  });

  await client.end();
  console.log("\nAudit complete · no writes performed.\n");
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
