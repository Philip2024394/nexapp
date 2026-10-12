#!/usr/bin/env node
// scripts/nex-directory-area/seed-area-intelligence-2026-10-12.mjs
//
// Idempotent seed for the NEX Directory "Discover this area" feature.
//
// Reads evidence JSON files produced by the five research subagents
// (one per city) and writes them into the existing nex.meaningful_area
// table. The research payload lives inside the existing `provenance`
// jsonb column under a dedicated namespace key:
//
//     provenance.nex_directory_area_intelligence
//
// so it never collides with any existing brain-pipeline provenance.
//
// Safety:
//   · No schema change · reuses the existing table.
//   · ON CONFLICT (area_id) DO NOTHING by default · preserves any
//     existing area with the same area_id. Pass --force to overwrite
//     (NOT recommended · opt-in).
//   · Each area is written with area_kind='city' + a NEW area_id, so
//     existing entries like yogya-city-core (area_kind='fallback') and
//     malioboro (area_kind='neighbourhood') stay intact.
//   · Verifies the DB target before writing · refuses to run against
//     anything that isn't localhost / 127.0.0.1.
//   · Prints a readback-verified summary.
//
// Usage:
//   node --env-file=.env.local scripts/nex-directory-area/seed-area-intelligence-2026-10-12.mjs

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = join(__dirname, "evidence-2026-10-12");

// Approved city-level centroids verified earlier against real
// food_business coordinates (nex-directory-area-geocoder).
const CITY_CENTROIDS = {
  Jakarta: { lat: -6.2224, lng: 106.8135, radiusKm: 12 },
  Denpasar: { lat: -8.6863, lng: 115.1894, radiusKm: 6 },
  Bandung: { lat: -6.9175, lng: 107.6191, radiusKm: 8 },
  Yogyakarta: { lat: -7.7956, lng: 110.3695, radiusKm: 5 },
  Surabaya: { lat: -7.2575, lng: 112.7521, radiusKm: 10 },
};

const AREA_ID_BY_CITY = {
  Jakarta: "jakarta-city-overview",
  Denpasar: "denpasar-city-overview",
  Bandung: "bandung-city-overview",
  Yogyakarta: "yogyakarta-city-overview",
  Surabaya: "surabaya-city-overview",
};

/** Pure helper · derive character tags from the known-for buckets so
 *  downstream UI (card chip) can categorise an area at a glance.
 *  Deterministic. Never fabricates — only derives from the categories
 *  that actually have evidence. */
function deriveCharacterTags(knownFor) {
  const tags = [];
  if ((knownFor.food ?? []).length > 0) tags.push("food");
  if ((knownFor.shopping ?? []).length > 0) tags.push("shopping");
  if ((knownFor.attractions ?? []).length > 0) tags.push("attractions");
  if ((knownFor.transport ?? []).length > 0) tags.push("transport");
  return tags;
}

function verifyDbTarget(url) {
  try {
    const u = new URL(url.replace(/^postgres(ql)?:\/\//, "http://"));
    const host = u.hostname;
    const safeHosts = new Set(["localhost", "127.0.0.1"]);
    if (!safeHosts.has(host)) {
      throw new Error(
        `REFUSED · unsafe DB target host=${host}. Only localhost / 127.0.0.1 is permitted. Set NEX_POSTGRES_URL correctly.`,
      );
    }
    return { host, port: u.port, db: u.pathname.slice(1) };
  } catch (err) {
    throw new Error("Could not parse NEX_POSTGRES_URL: " + err.message);
  }
}

function loadEvidenceFiles() {
  const files = readdirSync(EVIDENCE_DIR).filter((f) => f.endsWith(".json"));
  const payloads = [];
  for (const f of files) {
    const text = readFileSync(join(EVIDENCE_DIR, f), "utf8");
    const data = JSON.parse(text);
    if (typeof data.city !== "string" || typeof data.country !== "string") {
      throw new Error(`${f}: missing city/country`);
    }
    payloads.push({ file: f, data });
  }
  payloads.sort((a, b) => a.data.city.localeCompare(b.data.city));
  return payloads;
}

async function main() {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) {
    throw new Error("NEX_POSTGRES_URL is not set · load .env.local first");
  }
  const target = verifyDbTarget(url);
  console.log(
    "DB target  :  host=" +
      target.host +
      " port=" +
      target.port +
      " db=" +
      target.db,
  );

  const force = process.argv.includes("--force");
  console.log("mode       :  " + (force ? "FORCE (overwrites)" : "idempotent (ON CONFLICT DO NOTHING)"));

  const pool = new Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();

  try {
    const payloads = loadEvidenceFiles();
    console.log("evidence   :  " + payloads.length + " files loaded");
    console.log("");

    const existingResult = await client.query(
      "SELECT area_id FROM nex.meaningful_area ORDER BY area_id",
    );
    const existing = new Set(existingResult.rows.map((r) => r.area_id));
    console.log("existing meaningful_area rows: " + existingResult.rows.length);
    for (const row of existingResult.rows) console.log("  · " + row.area_id);
    console.log("");

    const summary = {
      inserted: [],
      skipped_already_present: [],
      overwritten: [],
    };

    for (const { file, data } of payloads) {
      const areaId = AREA_ID_BY_CITY[data.city];
      if (!areaId) {
        console.log("[skip] " + file + " · no area_id mapping for city=" + data.city);
        continue;
      }
      const centroid = CITY_CENTROIDS[data.city];
      if (!centroid) {
        console.log("[skip] " + file + " · no centroid for city=" + data.city);
        continue;
      }
      const characterTags = deriveCharacterTags(data.known_for);
      const provenancePayload = {
        nex_directory_area_intelligence: {
          schema_version: 1,
          method: data.method ?? "nexapp-subagent-explore-v1",
          method_note: data.method_note ?? null,
          researched_at: data.researched_at ?? new Date().toISOString(),
          short_summary: data.short_summary,
          known_for: data.known_for,
          excluded_claims: data.excluded_claims ?? [],
        },
      };

      const alreadyPresent = existing.has(areaId);
      if (alreadyPresent && !force) {
        summary.skipped_already_present.push(areaId);
        console.log("[skip] " + areaId + " · already exists · pass --force to overwrite");
        continue;
      }

      const insertSql = `
        INSERT INTO nex.meaningful_area (
          area_id, name, area_kind, precedence, country, city,
          centroid_lat, centroid_lng, radius_km,
          character_tags, description, brain_phrasing_hint,
          source, provenance,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now())
        ON CONFLICT (area_id) DO UPDATE SET
          name              = EXCLUDED.name,
          area_kind         = EXCLUDED.area_kind,
          country           = EXCLUDED.country,
          city              = EXCLUDED.city,
          centroid_lat      = EXCLUDED.centroid_lat,
          centroid_lng      = EXCLUDED.centroid_lng,
          radius_km         = EXCLUDED.radius_km,
          character_tags    = EXCLUDED.character_tags,
          description       = EXCLUDED.description,
          provenance        = EXCLUDED.provenance,
          updated_at        = now()
        WHERE ${force ? "TRUE" : "FALSE"}
      `;
      await client.query(insertSql, [
        areaId,
        data.city,
        // meaningful_area.area_kind check constraint only permits
        // {neighbourhood, corridor, belt, fallback}. "city" is not
        // allowed and a migration to add it was explicitly avoided.
        // "fallback" is semantically correct here (city-wide default
        // when no more-specific neighbourhood matches) and matches
        // the existing yogya-city-core pattern. The service's lookup
        // uses the provenance.nex_directory_area_intelligence key
        // to discriminate, not area_kind.
        "fallback",
        // precedence=5 keeps us BELOW any sealed brain-pipeline
        // entry (yogya-city-core uses precedence 1) · the brain's
        // row still wins for consumers that only sort by precedence.
        // The directory-presentation service matches by the
        // provenance namespace instead so order is unambiguous.
        5,
        data.country,
        data.city,
        centroid.lat,
        centroid.lng,
        centroid.radiusKm,
        characterTags,
        data.short_summary,
        null,
        "nexapp-subagent-research-2026-10-12",
        provenancePayload,
      ]);

      if (alreadyPresent && force) {
        summary.overwritten.push(areaId);
        console.log("[overwrite] " + areaId);
      } else {
        summary.inserted.push(areaId);
        console.log("[insert] " + areaId + " · " + data.city + " · " + characterTags.join(","));
      }
    }

    console.log("");
    console.log("=== readback verification ===");
    const readback = await client.query(
      "SELECT area_id, name, area_kind, country, city, character_tags, " +
        "jsonb_path_exists(provenance, '$.nex_directory_area_intelligence') AS has_intel " +
        "FROM nex.meaningful_area " +
        "WHERE area_id = ANY($1) ORDER BY area_id",
      [Object.values(AREA_ID_BY_CITY)],
    );
    for (const row of readback.rows) {
      console.log(
        "  · " +
          row.area_id +
          " · " +
          row.area_kind +
          " · " +
          row.country +
          "/" +
          row.city +
          " · tags=" +
          (row.character_tags ?? []).join(",") +
          " · has_intel=" +
          row.has_intel,
      );
    }

    console.log("");
    console.log("=== coverage · join to business_directory_v ===");
    const cov = await client.query(
      `SELECT ma.city AS area_city, COUNT(bc.canonical_business_id)::int AS listings
         FROM nex.meaningful_area ma
         LEFT JOIN nex.business_directory_v bc
           ON lower(bc.city) = lower(ma.city) AND bc.country = ma.country
        WHERE ma.area_id = ANY($1)
          AND jsonb_path_exists(ma.provenance, '$.nex_directory_area_intelligence')
        GROUP BY ma.city
        ORDER BY listings DESC`,
      [Object.values(AREA_ID_BY_CITY)],
    );
    let totalCovered = 0;
    for (const row of cov.rows) {
      console.log("  " + row.area_city + " · " + row.listings + " publishable listings linked");
      totalCovered += row.listings;
    }
    const totalPub = await client.query(
      "SELECT COUNT(*)::int AS n FROM nex.business_directory_v",
    );
    const pub = totalPub.rows[0].n;
    console.log("");
    console.log(
      "  TOTAL : " +
        totalCovered +
        " / " +
        pub +
        " = " +
        ((100 * totalCovered) / pub).toFixed(1) +
        "% of publishable listings now have area intel",
    );

    console.log("");
    console.log("=== summary ===");
    console.log("  inserted              : " + summary.inserted.length);
    console.log("  skipped already present : " + summary.skipped_already_present.length);
    console.log("  overwritten (--force)  : " + summary.overwritten.length);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("SEED FAILED:", err.message);
  process.exit(1);
});
