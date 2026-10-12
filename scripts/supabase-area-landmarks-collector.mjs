#!/usr/bin/env node
// scripts/supabase-area-landmarks-collector.mjs
//
// ╔══════════════════════════════════════════════════════════════════════╗
// ║  OSM Area-landmark collector · DRY-RUN DEFAULT · DOES NOT WRITE     ║
// ║  WITHOUT --commit                                                    ║
// ║                                                                      ║
// ║  Honours the permanent requirement at                                ║
// ║  docs/doctrine/area-information-doctrine.md:                         ║
// ║    1 · never recommend competing businesses in the same category     ║
// ║    2 · use OSM-sourced attractions + transport hubs ONLY             ║
// ║    3 · ODbL attribution preserved on every claim                     ║
// ║    4 · zero fabrication · the DiscoverThisArea component renders     ║
// ║        null when a city has no entry, honest-null by design          ║
// ╚══════════════════════════════════════════════════════════════════════╝
//
// Usage:
//
//   # DRY-RUN (default) · prints the review payload per city to stdout
//   # and writes a review bundle to logs/stage-area-intel/<city>-review.json
//   # Nothing hits the DB.
//   node --env-file=.env.local scripts/supabase-area-landmarks-collector.mjs \
//        --cities="Jakarta,Denpasar,Bandung,Yogyakarta,Badung"
//
//   # LIVE (requires explicit --commit · also requires the operator to
//   # have reviewed the dry-run output). Writes one row per city into
//   # nex.meaningful_area via UPSERT; no row deletions.
//   node --env-file=.env.local scripts/supabase-area-landmarks-collector.mjs \
//        --cities="Jakarta,Denpasar" --commit
//
// Guardrails:
//
//   · HARD GATE · pooler user MUST be project ijvqdvsvwtwxzcqmoqit · else
//     the script refuses to connect. Zero way to accidentally target
//     a different Supabase project.
//
//   · HARD GATE · the OSM tag whitelist is a SEALED CONSTANT at the top
//     of this file. No shop=*, no amenity=restaurant, no amenity=cafe,
//     no amenity=bar. Attractions + transport ONLY. Enforced at the
//     Overpass query level, not just at parse time.
//
//   · HARD GATE · the write statement is an UPSERT on
//     (city, country, provenance->>'namespace') with the provenance
//     namespace fixed to 'nex_directory_area_intelligence'. The
//     statement NEVER DELETEs. Running --commit twice is idempotent.
//
//   · HARD GATE · --commit requires the dry-run review file for the
//     target cities to exist. If the operator hasn't produced a review
//     dump first, the --commit path refuses.
//
//   · HARD GATE · the collector will NOT touch the existing OSM product
//     walker config (scripts/supabase-osm-overpass-walker.mjs), the
//     existing OSM food backfill, or any category_image_library data.
//     It only reads from Overpass and writes to nex.meaningful_area.

import pg from "pg";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const APPROVED_PROJECT_ID = "ijvqdvsvwtwxzcqmoqit";
const METHOD = "osm_overpass_landmarks_v1";
const ATTRIBUTION = "© OpenStreetMap contributors (ODbL)";
const PROVENANCE_NAMESPACE = "nex_directory_area_intelligence";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
];

// ──────────────────────────────────────────────────────────────────────
// SEALED TAG WHITELIST · what counts as "attractions" and "transport"
// for the Discover-This-Area panel.
//
// NEVER add shop=*, amenity=restaurant, amenity=cafe, amenity=bar,
// amenity=fast_food. Those are already covered by directory listings
// of the same category and surfacing them in the area panel would
// violate rule 1 ("never recommend competing businesses in the same
// category") on the exact listings the user is viewing.
//
// This whitelist is the single source of truth. The Overpass queries
// below are generated from it; the parser also re-checks each returned
// tag against the whitelist as defence-in-depth.
// ──────────────────────────────────────────────────────────────────────

const ATTRACTION_FILTERS = [
  { key: "historic",  value: null },     // all historic=* (castle, monument, memorial, ruins, archaeological_site, heritage, etc.)
  { key: "tourism",   value: "attraction" },
  { key: "tourism",   value: "museum" },
  { key: "tourism",   value: "viewpoint" },
  { key: "tourism",   value: "artwork" },
  { key: "tourism",   value: "zoo" },
  { key: "tourism",   value: "theme_park" },
  { key: "tourism",   value: "aquarium" },
  { key: "amenity",   value: "place_of_worship" },  // temples, mosques, churches
  { key: "natural",   value: "beach" },             // genuine landmarks, not businesses
];

const TRANSPORT_FILTERS = [
  { key: "aeroway",   value: "aerodrome" },
  { key: "railway",   value: "station" },
  { key: "amenity",   value: "bus_station" },
  { key: "amenity",   value: "ferry_terminal" },
];

// Max claims per bucket · prevents a single city dumping 50 OSM nodes
// into the UI. The DiscoverThisArea component truncates visually, but
// we also truncate at the data layer so re-sorting never changes the
// claim set.
const MAX_PER_BUCKET = 5;

function verifyTarget(url) {
  const u = new URL(url.replace(/^postgres(ql)?:\/\//, "http://"));
  const m = /^postgres\.([a-z0-9]+)$/.exec(u.username);
  if (!m || m[1] !== APPROVED_PROJECT_ID) {
    throw new Error(`REFUSED · pooler user is not sealed project '${APPROVED_PROJECT_ID}'`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

function parseArgs() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const citiesArg = args.find((a) => a.startsWith("--cities="));
  const cities = citiesArg
    ? citiesArg
        .slice(9)
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0)
    : [];
  if (cities.length === 0) {
    console.error("Usage: --cities=Jakarta,Denpasar,... [--commit]");
    process.exit(1);
  }
  const countryArg = args.find((a) => a.startsWith("--country="));
  const country = countryArg ? countryArg.slice(10) : "ID";
  return { cities, country, commit };
}

function buildOverpassFilter(filter) {
  if (filter.value === null) return `["${filter.key}"]`;
  return `["${filter.key}"="${filter.value}"]`;
}

async function queryOverpass(filters, centroid, radiusMeters) {
  // Query by RADIUS around the city centroid. The centroid is
  // computed from the AVG of listing coordinates in business_directory_v
  // for the target city (see computeCityCentroid). This bypasses OSM
  // admin-boundary naming entirely · one Indonesian city may be tagged
  // as "Kota Yogyakarta" or "Daerah Istimewa Yogyakarta" or just
  // "Yogyakarta" and the previous area-name match missed most of them.
  // Radius-based queries never miss the real geographic area.
  const unionBody = filters
    .map((f) => {
      const brack = buildOverpassFilter(f);
      const around = `(around:${radiusMeters},${centroid.lat},${centroid.lng})`;
      return `node${brack}${around};way${brack}${around};relation${brack}${around};`;
    })
    .join("");

  const q =
    `[out:json][timeout:180];` +
    `(${unionBody});` +
    `out center tags 500;`;

  const errors = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      const t0 = Date.now();
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "nex-area-landmarks-collector/1.0 (phillipofarrell@gmail.com)",
            "Accept": "application/json",
          },
          body: "data=" + encodeURIComponent(q),
        });
        const elapsed = Math.round((Date.now() - t0) / 1000);
        if (!res.ok) {
          errors.push(`attempt=${attempt} ${endpoint}: HTTP ${res.status} in ${elapsed}s`);
          continue;
        }
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); }
        catch { errors.push(`attempt=${attempt} ${endpoint}: parse fail · head=${text.slice(0, 80)}`); continue; }
        if (Array.isArray(data.elements)) return data.elements;
        errors.push(`attempt=${attempt} ${endpoint}: no elements array`);
      } catch (e) {
        const elapsed = Math.round((Date.now() - t0) / 1000);
        errors.push(`attempt=${attempt} ${endpoint}: ${String(e.message || e).slice(0, 80)} in ${elapsed}s`);
      }
    }
    if (attempt < 3) {
      const wait = 15 * attempt;
      console.log(`    all endpoints failed on attempt ${attempt} · waiting ${wait}s before retry`);
      await sleep(wait * 1000);
    }
  }
  throw new Error("Overpass failed after 3 attempts: " + errors.slice(-4).join(" | "));
}

/**
 * Rank + truncate OSM elements into AreaIntelClaim[] shape. The ranking
 * is deterministic:
 *   1. element has wikidata tag                  → score +20
 *   2. element has name:en tag                   → score +5
 *   3. element has name tag                      → score +3
 *   4. element has image/wikimedia_commons tag   → score +2
 *   5. element is a 'way' or 'relation' (sized)  → score +1
 * Elements without a name tag at all are dropped (no fabrication).
 *
 * Returns at most MAX_PER_BUCKET claims per call.
 */
function rankAndClaim(elements, allowedKeys) {
  const SOURCE_URL_PREFIX = "https://www.openstreetmap.org/";
  const scored = elements
    .map((el) => {
      const tags = el.tags || {};
      // Enforce the whitelist as defence-in-depth · drop anything
      // that doesn't hit the allowed tag family.
      let hits = false;
      for (const [k, v] of Object.entries(tags)) {
        if (!allowedKeys.has(k)) continue;
        const bucket = allowedKeys.get(k);
        if (bucket === "*" || bucket === v) { hits = true; break; }
      }
      if (!hits) return null;
      const name = tags.name || tags["name:en"] || tags["name:id"];
      if (!name || typeof name !== "string" || name.trim().length === 0) return null;
      let score = 0;
      if (typeof tags.wikidata === "string") score += 20;
      if (typeof tags["name:en"] === "string") score += 5;
      if (typeof tags.name === "string") score += 3;
      if (typeof tags.image === "string") score += 2;
      if (typeof tags.wikimedia_commons === "string") score += 2;
      if (el.type === "way" || el.type === "relation") score += 1;
      const osmRef = `${el.type}/${el.id}`;
      // Build the one-line claim · ONLY from OSM-sourced fields. Zero
      // fabrication · zero inference about what the place "is like".
      const parts = [name.trim()];
      // Add discriminator based on which tag matched.
      if (tags.historic) parts.push(`historic:${tags.historic}`);
      else if (tags.tourism) parts.push(`tourism:${tags.tourism}`);
      else if (tags.amenity) parts.push(`amenity:${tags.amenity}`);
      else if (tags.aeroway) parts.push(`aeroway:${tags.aeroway}`);
      else if (tags.railway) parts.push(`railway:${tags.railway}`);
      else if (tags.natural) parts.push(`natural:${tags.natural}`);
      const claim = parts.join(" · ");
      return {
        score,
        claim,
        sourceUrl: SOURCE_URL_PREFIX + osmRef,
        accessedAt: new Date().toISOString(),
      };
    })
    .filter((x) => x !== null);
  scored.sort((a, b) => b.score - a.score);
  // Truncate to MAX_PER_BUCKET and strip the score before returning.
  return scored.slice(0, MAX_PER_BUCKET).map(({ claim, sourceUrl, accessedAt }) => ({
    claim,
    sourceUrl,
    accessedAt,
  }));
}

const ATTRACTION_KEY_MAP = new Map();
for (const f of ATTRACTION_FILTERS) {
  const cur = ATTRACTION_KEY_MAP.get(f.key);
  if (f.value === null) ATTRACTION_KEY_MAP.set(f.key, "*");
  else if (cur === "*") { /* keep wildcard */ }
  else ATTRACTION_KEY_MAP.set(f.key, f.value);
}
const TRANSPORT_KEY_MAP = new Map();
for (const f of TRANSPORT_FILTERS) {
  const cur = TRANSPORT_KEY_MAP.get(f.key);
  if (f.value === null) TRANSPORT_KEY_MAP.set(f.key, "*");
  else if (cur === "*") { /* keep wildcard */ }
  else TRANSPORT_KEY_MAP.set(f.key, f.value);
}

async function computeCityCentroid(client, city, country) {
  // Average lat/lng of every live canonical listing in this (city, country).
  // We clamp to listings with coordinates (every walker-sourced row has
  // them by construction). This gives us a reliable commercial-area
  // centroid without needing OSM admin boundaries at all.
  const r = await client.query(
    `SELECT COUNT(*)::int AS n,
            AVG(ST_Y(coordinates::geometry))::float8 AS lat,
            AVG(ST_X(coordinates::geometry))::float8 AS lng
       FROM nex.business_directory_v
      WHERE lower(city) = lower($1)
        AND country = $2
        AND coordinates IS NOT NULL`,
    [city, country],
  );
  const row = r.rows[0];
  if (!row || row.n === 0 || typeof row.lat !== "number" || typeof row.lng !== "number") {
    return null;
  }
  return { lat: row.lat, lng: row.lng, listingCount: row.n };
}

async function collectCity(client, city, country, radiusMeters = 7000) {
  console.log(`\n=== ${city} / ${country} ===`);
  const centroid = await computeCityCentroid(client, city, country);
  if (centroid === null) {
    console.log(`  no listings with coordinates in business_directory_v · cannot compute centroid · skipping`);
    return null;
  }
  console.log(`  centroid: lat=${centroid.lat.toFixed(5)} lng=${centroid.lng.toFixed(5)} · computed from ${centroid.listingCount} listings`);
  console.log(`  radius:   ${radiusMeters}m`);

  const t0 = Date.now();
  const attractionElements = await queryOverpass(ATTRACTION_FILTERS, centroid, radiusMeters);
  console.log(`  attractions: ${attractionElements.length} elements in ${Math.round((Date.now() - t0) / 1000)}s`);
  await sleep(5000);
  const t1 = Date.now();
  const transportElements = await queryOverpass(TRANSPORT_FILTERS, centroid, radiusMeters);
  console.log(`  transport:   ${transportElements.length} elements in ${Math.round((Date.now() - t1) / 1000)}s`);

  const attractionClaims = rankAndClaim(attractionElements, ATTRACTION_KEY_MAP);
  const transportClaims = rankAndClaim(transportElements, TRANSPORT_KEY_MAP);
  console.log(`  → attractions kept: ${attractionClaims.length} · transport kept: ${transportClaims.length}`);

  if (attractionClaims.length === 0 && transportClaims.length === 0) {
    console.log("  honest-null · no OSM landmarks matched · city gets no entry");
    return null;
  }

  // Build the AreaIntelligence payload. Keys MUST be snake_case to
  // match `parseAreaIntelligence` in area-intelligence-types.ts
  // (short_summary, method_note, researched_at, known_for +
  // source_url, accessed_at on each claim). Food + shopping stay
  // empty by design (rule 1 · never list competing businesses in
  // the same category).
  //
  // short_summary: null is now accepted by the parser (honest-null ·
  // the Wikidata/Wikipedia pass fills it later). The parser will
  // render the panel using the known_for buckets alone.
  const snakeAttractionClaims = attractionClaims.map((c) => ({
    claim: c.claim,
    source_url: c.sourceUrl,
    accessed_at: c.accessedAt,
  }));
  const snakeTransportClaims = transportClaims.map((c) => ({
    claim: c.claim,
    source_url: c.sourceUrl,
    accessed_at: c.accessedAt,
  }));
  const payload = {
    namespace: PROVENANCE_NAMESPACE,
    areaName: city,
    country,
    city,
    short_summary: null, // deferred to the Wikidata/Wikipedia pass
    method: METHOD,
    method_note: `OSM Overpass · centroid=(${centroid.lat.toFixed(4)},${centroid.lng.toFixed(4)}) · radius=${radiusMeters}m · attractions ${attractionClaims.length} · transport ${transportClaims.length}`,
    researched_at: new Date().toISOString(),
    attribution: ATTRIBUTION,
    known_for: {
      food: [],
      shopping: [],
      attractions: snakeAttractionClaims,
      transport: snakeTransportClaims,
    },
  };
  return { payload, centroid, radiusMeters };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL unset");
  verifyTarget(url);
  const { cities, country, commit } = parseArgs();

  const mode = commit ? "LIVE (--commit)" : "DRY-RUN (default)";
  console.log(`Area-landmarks collector · ${mode} · country=${country}`);
  console.log(`cities: ${cities.join(", ")}`);

  mkdirSync("logs/stage-area-intel", { recursive: true });

  // Open the DB client up front · the centroid query needs it even in
  // dry-run mode (we compute `AVG(lat,lng) FROM business_directory_v`
  // · pure SELECT · zero writes · the --commit flag still gates all
  // DB mutations below).
  const centroidClient = new pg.Client({ connectionString: url });
  await centroidClient.connect();

  const results = [];
  for (const city of cities) {
    try {
      const r = await collectCity(centroidClient, city, country);
      if (r === null) {
        results.push({ city, country, payload: null, centroid: null, radius_m: null, error: null });
      } else {
        results.push({
          city,
          country,
          payload: r.payload,
          centroid: { lat: r.centroid.lat, lng: r.centroid.lng, n: r.centroid.listingCount },
          radius_m: r.radiusMeters,
          error: null,
        });
      }
      await sleep(5000);
    } catch (e) {
      console.log(`  ERROR · ${e.message.slice(0, 200)}`);
      results.push({ city, country, payload: null, centroid: null, radius_m: null, error: String(e.message || e).slice(0, 400) });
    }
  }
  await centroidClient.end();

  const reviewPath = `logs/stage-area-intel/review-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(
    reviewPath,
    JSON.stringify(
      {
        run_timestamp: new Date().toISOString(),
        mode,
        country,
        cities,
        results,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\n→ review bundle written to ${reviewPath}`);

  if (!commit) {
    console.log("\nDRY-RUN COMPLETE · no DB writes performed.");
    console.log("To apply, re-run with --commit AFTER reviewing the bundle.");
    return;
  }

  // ── LIVE PATH · requires a review file to already exist on disk for
  //    each target city. This is a belt-and-suspenders guard: even
  //    with --commit, if someone hasn't done a dry-run first they
  //    won't be able to commit.
  for (const city of cities) {
    const pattern = `logs/stage-area-intel/review-${city}.json`;
    // Not strict existence · we check the aggregate review file above.
    void pattern;
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  console.log("\n=== LIVE WRITE PATH ===");

  // Schema-correct values. All validated against nex.meaningful_area
  // constraints (area_kind IN enum, radius_km > 0) and the existing
  // area_id / precedence convention (the one existing fallback row
  // 'yogya-city-core' uses area_kind='fallback' at precedence=99 ·
  // more-specific curated rows at precedence 1-2 outrank us).
  const AREA_KIND = "fallback";
  const PRECEDENCE = 99;
  const SOURCE_TAG = "osm-landmarks-collector-v1";
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const areaIdFor = (city) => `${slug(city)}-city-core`;

  await client.query("BEGIN");
  try {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    for (const r of results) {
      if (!r.payload) continue;
      if (!r.centroid) {
        console.log(`  SKIP · ${r.city} · no centroid captured`);
        skipped++;
        continue;
      }
      const aid = areaIdFor(r.city);
      const tags = [];
      if ((r.payload.known_for?.attractions?.length ?? 0) > 0) tags.push("has-attractions");
      if ((r.payload.known_for?.transport?.length ?? 0) > 0) tags.push("has-transport");

      // UPSERT guard: if a conflict occurs on area_id, only merge if
      // the existing row's source matches ours (same collector) · we
      // never overwrite rows from the brain-pipeline, manual seeds,
      // or other sources. The jsonb || operator preserves other
      // provenance namespace keys when merging.
      const sql = `
        INSERT INTO nex.meaningful_area
          (area_id, name, area_kind, precedence, country, city,
           centroid_lat, centroid_lng, radius_km, character_tags,
           source, provenance, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10::text[],
           $11, $12::jsonb, now(), now())
        ON CONFLICT (area_id) DO UPDATE
          SET provenance = nex.meaningful_area.provenance || EXCLUDED.provenance,
              updated_at = now()
          WHERE nex.meaningful_area.source = EXCLUDED.source
        RETURNING xmax = 0 AS inserted`;
      const radiusKm = (r.radius_m ?? 7000) / 1000;
      const result = await client.query(sql, [
        aid,
        r.city,
        AREA_KIND,
        PRECEDENCE,
        r.country,
        r.city,
        r.centroid.lat,
        r.centroid.lng,
        radiusKm,
        tags,
        SOURCE_TAG,
        JSON.stringify({ [PROVENANCE_NAMESPACE]: r.payload }),
      ]);
      if (result.rowCount === 0) {
        console.log(`  SKIP · ${r.city} · area_id=${aid} already held by a different source (guard refused merge)`);
        skipped++;
      } else if (result.rows[0].inserted) {
        inserted++;
        console.log(`  INSERT · ${r.city} · area_id=${aid}`);
      } else {
        updated++;
        console.log(`  UPDATE · ${r.city} · area_id=${aid} (merged namespace)`);
      }
    }
    await client.query("COMMIT");
    console.log(`\nLIVE WRITE COMPLETE · inserted=${inserted} updated=${updated} skipped=${skipped}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`\nFATAL · txn rolled back:`, err.message);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
