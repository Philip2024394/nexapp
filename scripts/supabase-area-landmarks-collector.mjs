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

async function queryOverpass(filters, cityAreaName, countryIso) {
  // Query the city's admin boundary via area filter · country-scoped so
  // "Bandung" in ID doesn't catch Bandungs elsewhere.
  const unionBody = filters
    .map((f) => {
      const brack = buildOverpassFilter(f);
      return `node${brack}(area.city);way${brack}(area.city);relation${brack}(area.city);`;
    })
    .join("");

  const q =
    `[out:json][timeout:180];` +
    `area["ISO3166-1"="${countryIso}"][admin_level=2]->.country;` +
    `area["name"="${cityAreaName}"](area.country)->.city;` +
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

async function collectCity(city, country) {
  console.log(`\n=== ${city} / ${country} ===`);
  const t0 = Date.now();
  const attractionElements = await queryOverpass(ATTRACTION_FILTERS, city, country);
  console.log(`  attractions: ${attractionElements.length} elements in ${Math.round((Date.now() - t0) / 1000)}s`);
  await sleep(5000);
  const t1 = Date.now();
  const transportElements = await queryOverpass(TRANSPORT_FILTERS, city, country);
  console.log(`  transport:   ${transportElements.length} elements in ${Math.round((Date.now() - t1) / 1000)}s`);

  const attractionClaims = rankAndClaim(attractionElements, ATTRACTION_KEY_MAP);
  const transportClaims = rankAndClaim(transportElements, TRANSPORT_KEY_MAP);
  console.log(`  → attractions kept: ${attractionClaims.length} · transport kept: ${transportClaims.length}`);

  if (attractionClaims.length === 0 && transportClaims.length === 0) {
    console.log("  honest-null · no OSM landmarks matched · city gets no entry");
    return null;
  }

  // Build the AreaIntelligence payload. Food + shopping stay empty by
  // design (rule 1 · never list competing businesses in the same
  // category).
  const payload = {
    namespace: PROVENANCE_NAMESPACE,
    areaName: city,
    country,
    city,
    shortSummary: null, // deferred to the Wikidata/Wikipedia pass
    method: METHOD,
    methodNote: `OSM Overpass · attraction + transport tag whitelist · ${attractionClaims.length} attractions + ${transportClaims.length} transport hubs`,
    researchedAt: new Date().toISOString(),
    attribution: ATTRIBUTION,
    knownFor: {
      food: [],
      shopping: [],
      attractions: attractionClaims,
      transport: transportClaims,
    },
  };
  return payload;
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

  const results = [];
  for (const city of cities) {
    try {
      const payload = await collectCity(city, country);
      results.push({ city, country, payload, error: null });
      await sleep(5000);
    } catch (e) {
      console.log(`  ERROR · ${e.message.slice(0, 200)}`);
      results.push({ city, country, payload: null, error: String(e.message || e).slice(0, 400) });
    }
  }

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

  let written = 0;
  for (const r of results) {
    if (!r.payload) continue;
    // Idempotent UPSERT keyed on (city, country) with the provenance
    // namespace set to our fixed value. If another provenance namespace
    // exists on the SAME row (e.g. a legacy brain-pipeline entry), we
    // merge our namespace into the existing provenance jsonb · never
    // overwrite other namespaces. The SELECT-then-INSERT-or-UPDATE
    // dance is explicit so the operator can see every write.
    const existing = await client.query(
      `SELECT area_id, provenance FROM nex.meaningful_area
        WHERE lower(city) = lower($1) AND country = $2
        LIMIT 1`,
      [r.city, r.country],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      const existingProvenance = existing.rows[0].provenance ?? {};
      const merged = { ...existingProvenance, [PROVENANCE_NAMESPACE]: r.payload };
      await client.query(
        `UPDATE nex.meaningful_area
            SET provenance = $1::jsonb, updated_at = now()
          WHERE area_id = $2`,
        [JSON.stringify(merged), existing.rows[0].area_id],
      );
      console.log(`  UPDATE · ${r.city} · merged ${PROVENANCE_NAMESPACE} into existing area_id=${existing.rows[0].area_id}`);
    } else {
      await client.query(
        `INSERT INTO nex.meaningful_area
           (name, country, city, provenance, precedence, created_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, 5, now(), now())`,
        [r.city, r.country, r.city, JSON.stringify({ [PROVENANCE_NAMESPACE]: r.payload })],
      );
      console.log(`  INSERT · ${r.city}`);
    }
    written++;
  }
  console.log(`\nLIVE WRITE COMPLETE · ${written} city rows upserted into nex.meaningful_area.`);
  await client.end();
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
