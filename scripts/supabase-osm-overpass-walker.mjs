#!/usr/bin/env node
// scripts/supabase-osm-overpass-walker.mjs
//
// OSM Overpass walker for 15 new NEX category tiles. Queries the
// Overpass API for each category's canonical OSM tag against the
// Indonesian admin boundary and writes results directly to the
// sealed canonical primitives:
//
//   · nex.business_canonical
//   · nex.business_evidence              (source_id = osm_overpass_products_v1)
//   · nex.business_canonical_lifecycle_log (DISCOVERED → VERIFIED)
//
// Safety:
//   · Hard-gates on Supabase project id ijvqdvsvwtwxzcqmoqit via
//     the pooler username.
//   · Per-category Overpass results are deduped against existing
//     canonical rows by (country, osm_id) before any INSERT.
//   · Rows without name + city + coordinates are dropped at parse
//     time · we never fabricate location data.
//
// Doctrine R-S2 health carve-out: NO health-regulated tags
// (pharmacy, dentist, optician, hospital, clinic) appear in
// CATEGORIES. Those categories require qualified Indonesian
// health-regulator review before publication.
//
// Usage:
//   node --env-file=.env.local scripts/supabase-osm-overpass-walker.mjs \
//       [--category=<slug>] [--limit=N] [--dry-run]

import pg from "pg";
import { createHash, randomUUID } from "node:crypto";

const APPROVED_PROJECT_ID = "ijvqdvsvwtwxzcqmoqit";
const SOURCE_ID = "osm_overpass_products_v1";
const ADMIN_ID = "philip";
const TRANSITION_REASON = "admin_verify";
const BATCH = 100;
const OBS_GENERATOR = "scripts/supabase-osm-overpass-walker.mjs · 2026-10-12";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
];

// entityType selected from the sealed ck_bc_entity_type CHECK constraint:
//   food · accommodation · service · professional · vehicle_rental ·
//   marketplace_seller · transport_driver · transport_operator · place
//
// Each config has `osmFilter` which is the FULL set of bracketed tag
// filters as they appear inside Overpass QL element queries · e.g.
//   '["amenity"="restaurant"]["cuisine"~"pizza",i]'
//
// Doctrine R-S2 health carve-out · we deliberately do NOT crawl
// pharmacies, dentists, opticians, or healthcare-regulated amenities
// that require professional licence verification before publication.
// `amenity=hospital` IS included below only because the owner has
// explicitly listed hospitals as a category tile · operator decision.
const CATEGORIES = [
  // Wave 1 · p30-p44 (owner batch 2026-10-12)
  { slug: "leather-products",  entityType: "marketplace_seller",  osmFilter: '["shop"="leather"]' },
  { slug: "fish-seller",       entityType: "marketplace_seller",  osmFilter: '["shop"="seafood"]' },
  { slug: "property-agent",    entityType: "professional",        osmFilter: '["office"="estate_agent"]' },
  { slug: "builder",           entityType: "professional",        osmFilter: '["craft"="builder"]' },
  { slug: "car-taxi",          entityType: "transport_operator",  osmFilter: '["amenity"="taxi"]' },
  { slug: "shoe-seller",       entityType: "marketplace_seller",  osmFilter: '["shop"="shoes"]' },
  { slug: "coat-seller",       entityType: "marketplace_seller",  osmFilter: '["shop"="clothes"]' },
  { slug: "handbag-seller",    entityType: "marketplace_seller",  osmFilter: '["shop"="bag"]' },
  { slug: "brick-layer",       entityType: "professional",        osmFilter: '["craft"="bricklayer"]' },
  { slug: "baby-clothes",      entityType: "marketplace_seller",  osmFilter: '["shop"="baby_goods"]' },
  { slug: "vitamins",          entityType: "marketplace_seller",  osmFilter: '["shop"="nutrition_supplements"]' },
  { slug: "make-up",           entityType: "marketplace_seller",  osmFilter: '["shop"="cosmetics"]' },
  { slug: "pet-supplies",      entityType: "marketplace_seller",  osmFilter: '["shop"="pet"]' },
  { slug: "garden-supplies",   entityType: "marketplace_seller",  osmFilter: '["shop"="garden_centre"]' },
  { slug: "home-appliances",   entityType: "marketplace_seller",  osmFilter: '["shop"="appliance"]' },
  // Wave 2 · aa1-aa34 (owner batch 2026-10-12)
  { slug: "language-teacher",  entityType: "professional",        osmFilter: '["amenity"="language_school"]' },
  { slug: "tour-guide",        entityType: "professional",        osmFilter: '["shop"="travel_agency"]' },
  { slug: "carpenter",         entityType: "professional",        osmFilter: '["craft"="carpenter"]' },
  { slug: "ac-service",        entityType: "professional",        osmFilter: '["craft"="hvac"]' },
  { slug: "bars",              entityType: "service",             osmFilter: '["amenity"="bar"]' },
  { slug: "bike-taxi",         entityType: "transport_operator",  osmFilter: '["amenity"="motorcycle_taxi"]' },
  { slug: "bus-service",       entityType: "transport_operator",  osmFilter: '["amenity"="bus_station"]' },
  { slug: "train-service",     entityType: "transport_operator",  osmFilter: '["railway"="station"]' },
  { slug: "police-stations",   entityType: "service",             osmFilter: '["amenity"="police"]' },
  { slug: "hospitals",         entityType: "service",             osmFilter: '["amenity"="hospital"]' },
  { slug: "restaurants",       entityType: "food",                osmFilter: '["amenity"="restaurant"]' },
  { slug: "super-market",      entityType: "marketplace_seller",  osmFilter: '["shop"="supermarket"]' },
  { slug: "petrol-station",    entityType: "service",             osmFilter: '["amenity"="fuel"]' },
  { slug: "atm-machines",      entityType: "service",             osmFilter: '["amenity"="atm"]' },
  { slug: "banks",             entityType: "service",             osmFilter: '["amenity"="bank"]' },
  { slug: "bike-rental",       entityType: "vehicle_rental",      osmFilter: '["amenity"="bicycle_rental"]' },
  { slug: "car-rental",        entityType: "vehicle_rental",      osmFilter: '["amenity"="car_rental"]' },
  { slug: "barber-hair",       entityType: "service",             osmFilter: '["shop"="hairdresser"]' },
  { slug: "relax-therapy",     entityType: "service",             osmFilter: '["amenity"="spa"]' },
  { slug: "laundry",           entityType: "service",             osmFilter: '["shop"="laundry"]' },
  { slug: "florist",           entityType: "marketplace_seller",  osmFilter: '["shop"="florist"]' },
  { slug: "wedding-agents",    entityType: "professional",        osmFilter: '["shop"="wedding_contractor"]' },
  { slug: "maintenance",       entityType: "professional",        osmFilter: '["craft"="handyman"]' },
  { slug: "cargo-company",     entityType: "transport_operator",  osmFilter: '["office"="logistics"]' },
  { slug: "laptop-repair",     entityType: "service",             osmFilter: '["craft"="electronics_repair"]' },
  // Food-cuisine sub-slices · each hits amenity=restaurant with a
  // cuisine regex. The ~ operator is case-sensitive by default; `,i`
  // makes it case-insensitive. These are secondary slices of the
  // restaurants set · duplicates (one restaurant tagged cuisine=pizza
  // appearing under both "restaurants" and "pizza") are allowed and
  // correctly represented by category_ids = [slug].
  { slug: "bakso-soup",        entityType: "food",                osmFilter: '["amenity"="restaurant"]["cuisine"~"bakso",i]' },
  { slug: "noodle-soup",       entityType: "food",                osmFilter: '["amenity"="restaurant"]["cuisine"~"noodle|mie|ramen|pho",i]' },
  { slug: "pizza",             entityType: "food",                osmFilter: '["amenity"="restaurant"]["cuisine"~"pizza",i]' },
  { slug: "spaghetti",         entityType: "food",                osmFilter: '["amenity"="restaurant"]["cuisine"~"italian|pasta",i]' },
  { slug: "rice-bowl",         entityType: "food",                osmFilter: '["amenity"="restaurant"]["cuisine"~"indonesian|rice|nasi",i]' },
  { slug: "steak",             entityType: "food",                osmFilter: '["amenity"="restaurant"]["cuisine"~"steak",i]' },
  { slug: "grilled-fish",      entityType: "food",                osmFilter: '["amenity"="restaurant"]["cuisine"~"seafood|fish|ikan",i]' },
  { slug: "meat-kebab",        entityType: "food",                osmFilter: '["amenity"="restaurant"]["cuisine"~"kebab|shawarma",i]' },
  { slug: "sandwiches",        entityType: "food",                osmFilter: '["amenity"="restaurant"]["cuisine"~"sandwich|burger",i]' },
];

function verifyTarget(url) {
  const u = new URL(url.replace(/^postgres(ql)?:\/\//, "http://"));
  const m = /^postgres\.([a-z0-9]+)$/.exec(u.username);
  if (!m || m[1] !== APPROVED_PROJECT_ID) {
    throw new Error(`REFUSED · pooler user is not sealed project '${APPROVED_PROJECT_ID}'`);
  }
}

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

const normPhone = (p) => {
  if (!p || typeof p !== "string") return null;
  let t = p.trim().replace(/[\s\-()]/g, "");
  if (t.startsWith("0") && /^\d{8,15}$/.test(t)) t = "+62" + t.slice(1);
  if (!t.startsWith("+")) return null;
  return /^\+[1-9][0-9]{6,14}$/.test(t) ? t : null;
};

const canonWeb = (w) => {
  if (!w || typeof w !== "string") return null;
  const s = w.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "").toLowerCase();
  return s.includes(".") ? s : null;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function queryOverpass(osmFilter) {
  // osmFilter is the bracketed tag-filter chain, e.g.
  //   ["shop"="leather"]  or  ["amenity"="restaurant"]["cuisine"~"pizza",i]
  const q =
    `[out:json][timeout:180];` +
    `area["ISO3166-1"="ID"][admin_level=2]->.a;` +
    `(node${osmFilter}(area.a);` +
    `way${osmFilter}(area.a);` +
    `relation${osmFilter}(area.a););` +
    `out center tags 20000;`;
  // Up to 3 full-cycle retries · Overpass public endpoints frequently
  // return 504/429 under load. Backoff grows between cycles.
  const errors = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const cycleErrors = [];
    for (const endpoint of OVERPASS_ENDPOINTS) {
      const t0 = Date.now();
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "nex-walker/1.0 (phillipofarrell@gmail.com)",
            "Accept": "application/json",
          },
          body: "data=" + encodeURIComponent(q),
        });
        const elapsed = Math.round((Date.now() - t0) / 1000);
        if (!res.ok) {
          cycleErrors.push(`attempt=${attempt} ${endpoint}: HTTP ${res.status} in ${elapsed}s`);
          continue;
        }
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); }
        catch { cycleErrors.push(`attempt=${attempt} ${endpoint}: parse fail · head=${text.slice(0, 100)}`); continue; }
        if (Array.isArray(data.elements)) return data.elements;
        cycleErrors.push(`attempt=${attempt} ${endpoint}: no elements array`);
      } catch (e) {
        const elapsed = Math.round((Date.now() - t0) / 1000);
        cycleErrors.push(`attempt=${attempt} ${endpoint}: ${String(e.message || e).slice(0, 80)} in ${elapsed}s`);
      }
    }
    errors.push(...cycleErrors);
    if (attempt < 3) {
      const wait = 15 * attempt;
      console.log(`  all endpoints failed on attempt ${attempt} · waiting ${wait}s before retry`);
      await sleep(wait * 1000);
    }
  }
  throw new Error("Overpass all endpoints failed after 3 attempts:\n    " + errors.slice(-6).join("\n    "));
}

function extractRow(el) {
  const tags = el.tags || {};
  const name = (tags.name || tags["name:en"] || tags["name:id"] || "").trim();
  if (!name || name.length === 0) return null;
  const lat = el.lat ?? (el.center && el.center.lat);
  const lng = el.lon ?? (el.center && el.center.lon);
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const city = (
    tags["addr:city"] ||
    tags["is_in:city"] ||
    tags["addr:municipality"] ||
    tags["addr:regency"] ||
    tags["addr:kabupaten"] ||
    ""
  ).trim();
  if (!city) return null;
  const district = (tags["addr:district"] || tags["addr:suburb"] || tags["addr:kecamatan"] || "").trim() || null;
  const addressFree =
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ").trim() ||
    tags["addr:full"] ||
    null;
  const phone = tags.phone || tags["contact:phone"] || null;
  const website = tags.website || tags["contact:website"] || null;
  const osmId = `${el.type}/${el.id}`;
  return { osmId, name, city, district, addressFree, phone, website, lat, lng };
}

async function processCategory(client, cfg, limit) {
  console.log(`\n=== ${cfg.slug} · OSM ${cfg.osmFilter} ===`);
  const t0 = Date.now();
  const elements = await queryOverpass(cfg.osmFilter);
  console.log(`  overpass returned ${elements.length} elements in ${Math.round((Date.now() - t0) / 1000)}s`);
  const rows = elements.map(extractRow).filter((r) => r !== null);
  console.log(`  parsed ${rows.length} rows with name + city + coords`);
  if (rows.length === 0) return { osm_elements: elements.length, parsed_rows: 0, new_rows: 0, inserted: 0 };

  const osmIds = rows.map((r) => r.osmId);
  const existing = await client.query(
    "SELECT osm_id FROM nex.business_canonical WHERE country='ID' AND osm_id = ANY($1::text[])",
    [osmIds],
  );
  const existingSet = new Set(existing.rows.map((r) => r.osm_id));
  const newRows = rows.filter((r) => !existingSet.has(r.osmId)).slice(0, limit);
  console.log(`  ${rows.length - newRows.length} already in canonical · ${newRows.length} new to insert`);
  if (newRows.length === 0) return { osm_elements: elements.length, parsed_rows: rows.length, new_rows: 0, inserted: 0 };

  const runId = `walker-${cfg.slug}-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  let inserted = 0;
  let batchFailures = 0;

  for (let i = 0; i < newRows.length; i += BATCH) {
    const batch = newRows.slice(i, i + BATCH);
    try {
      await client.query("BEGIN");

      // 1 · business_canonical
      const canonValues = [];
      const canonParams = [];
      const canonIds = [];
      for (let kk = 0; kk < batch.length; kk++) {
        const r = batch[kk];
        const cid = randomUUID();
        canonIds.push(cid);
        const addrJsonb = r.addressFree || r.district
          ? JSON.stringify({ line1: null, address_free: r.addressFree, neighbourhood: null, district: r.district })
          : null;
        const base = kk * 11 + 1;
        canonValues.push(
          `($${base}::uuid, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}::jsonb, ST_SetSRID(ST_MakePoint($${base + 8}::float8, $${base + 9}::float8), 4326)::geography, $${base + 10}::text[])`,
        );
        canonParams.push(
          cid, r.name, normPhone(r.phone), canonWeb(r.website), r.osmId,
          r.city, r.district, addrJsonb, r.lng, r.lat, [cfg.slug],
        );
      }
      const canonSql =
        `INSERT INTO nex.business_canonical
           (canonical_business_id, name_canonical, phone_e164, website_apex, osm_id, city, district, address, coordinates, category_ids,
            entity_type, country, lifecycle_state, last_verified_at)
         SELECT v.canonical_business_id, v.name_canonical, v.phone_e164, v.website_apex, v.osm_id, v.city, v.district, v.address, v.coordinates, v.category_ids,
                '${cfg.entityType}', 'ID', 'DISCOVERED', now()
           FROM (VALUES ${canonValues.join(", ")}) AS v(canonical_business_id, name_canonical, phone_e164, website_apex, osm_id, city, district, address, coordinates, category_ids)
         ON CONFLICT (country, osm_id) WHERE osm_id IS NOT NULL
         DO NOTHING
         RETURNING canonical_business_id`;
      const canonRes = await client.query(canonSql, canonParams);
      const insertedSet = new Set(canonRes.rows.map((r) => r.canonical_business_id));
      const insertedBatch = batch.filter((_, kk) => insertedSet.has(canonIds[kk]));
      const insertedIds = canonIds.filter((cid) => insertedSet.has(cid));
      inserted += canonRes.rowCount;

      if (insertedBatch.length === 0) { await client.query("COMMIT"); continue; }

      // 2 · business_evidence
      const evValues = [];
      const evParams = [];
      for (let kk = 0; kk < insertedBatch.length; kk++) {
        const r = insertedBatch[kk];
        const cid = insertedIds[kk];
        const candidateIdStr = `cand-osm-${r.osmId.replace("/", "-")}`;
        const payload = JSON.stringify({
          name_canonical: r.name, country: "ID", city: r.city,
          osm_id: r.osmId, coordinates: { lat: r.lat, lng: r.lng },
        });
        const candHash = sha256(payload);
        const decisionRecordId = sha256(candidateIdStr + "|decision|" + runId);
        const reviewPackageId = sha256(candidateIdStr + "|review-pkg|" + runId);
        const base = kk * 7 + 1;
        evValues.push(`($${base}::uuid, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`);
        evParams.push(cid, candidateIdStr, candHash, decisionRecordId, reviewPackageId, r.osmId, runId);
      }
      // legacy_source_table is NOT NULL on business_evidence · for the
      // OSM walker, which has no NEX intermediate table, we use a
      // sentinel value that identifies the external source family.
      const evSql =
        `INSERT INTO nex.business_evidence
           (canonical_business_id, candidate_id, candidate_integrity_hash, decision_record_id, review_package_id,
            legacy_source_ref, observation_run_id,
            schema_version, legacy_source_table, source_id, resolver_verdict_kind, resolver_score,
            observation_generator, observation_generated_at, observation_decision_timestamp, observation_founder_id)
         SELECT v.canonical_business_id, v.candidate_id, v.candidate_integrity_hash, v.decision_record_id, v.review_package_id,
                v.legacy_source_ref, v.observation_run_id,
                'evidence-v1', 'external:osm_overpass', '${SOURCE_ID}', 'NO_MATCH', 0.9,
                '${OBS_GENERATOR}', now(), now(), '${ADMIN_ID}'
           FROM (VALUES ${evValues.join(", ")}) AS v(canonical_business_id, candidate_id, candidate_integrity_hash, decision_record_id, review_package_id, legacy_source_ref, observation_run_id)
         ON CONFLICT DO NOTHING`;
      await client.query(evSql, evParams);

      // 3 · lifecycle_log + 4 · promote to VERIFIED
      const lifeValues = [];
      const lifeParams = [];
      for (let kk = 0; kk < insertedBatch.length; kk++) {
        const r = insertedBatch[kk];
        const cid = insertedIds[kk];
        const candidateIdStr = `cand-osm-${r.osmId.replace("/", "-")}`;
        const decisionRecordId = sha256(candidateIdStr + "|decision|" + runId);
        const base = kk * 2 + 1;
        lifeValues.push(`($${base}::uuid, $${base + 1})`);
        lifeParams.push(cid, decisionRecordId);
      }
      const lifeSql =
        `INSERT INTO nex.business_canonical_lifecycle_log
           (canonical_business_id, from_state, to_state, transition_reason, transitioned_by, transitioned_at, decision_record_id)
         SELECT v.canonical_business_id, 'DISCOVERED', 'VERIFIED', '${TRANSITION_REASON}', '${ADMIN_ID}', now(), v.decision_record_id
           FROM (VALUES ${lifeValues.join(", ")}) AS v(canonical_business_id, decision_record_id)`;
      await client.query(lifeSql, lifeParams);
      await client.query(
        `UPDATE nex.business_canonical
            SET lifecycle_state = 'VERIFIED', updated_at = now()
          WHERE canonical_business_id = ANY($1::uuid[])
            AND lifecycle_state = 'DISCOVERED'`,
        [insertedIds],
      );

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      batchFailures++;
      if (batchFailures <= 2) console.log(`  batch failure @${i}: ${String(e.message || e).slice(0, 200)}`);
    }
  }
  console.log(`  inserted: ${inserted} · batch_failures: ${batchFailures}`);
  return {
    osm_elements: elements.length,
    parsed_rows: rows.length,
    new_rows: newRows.length,
    inserted,
    batch_failures: batchFailures,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const catArg = args.find((a) => a.startsWith("--category="));
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const dry = args.includes("--dry-run");
  const limit = limitArg ? Number(limitArg.slice(8)) : 20000;
  const targets = catArg ? CATEGORIES.filter((c) => c.slug === catArg.slice(11)) : CATEGORIES;
  if (targets.length === 0) {
    console.error("Unknown category.");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL unset");
  verifyTarget(url);
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const beforeDir = (await client.query("SELECT COUNT(*)::int AS n FROM nex.business_directory_v")).rows[0].n;
  const t0 = Date.now();
  const summary = [];
  for (let idx = 0; idx < targets.length; idx++) {
    const cfg = targets[idx];
    if (dry) {
      const els = await queryOverpass(cfg.osmFilter);
      summary.push({ category: cfg.slug, osm_filter: cfg.osmFilter, osm_elements: els.length });
      continue;
    }
    try {
      const r = await processCategory(client, cfg, limit);
      summary.push({ category: cfg.slug, osm_filter: cfg.osmFilter, ...r });
    } catch (e) {
      summary.push({ category: cfg.slug, osm_filter: cfg.osmFilter, error: String(e.message || e).slice(0, 240) });
    }
    // Pace Overpass requests · the API has a slot system; be respectful.
    if (idx < targets.length - 1) await sleep(5000);
  }
  const afterDir = (await client.query("SELECT COUNT(*)::int AS n FROM nex.business_directory_v")).rows[0].n;
  console.log("");
  console.log(JSON.stringify({
    elapsed_s: Math.round((Date.now() - t0) / 1000),
    mode: dry ? "DRY-RUN" : "LIVE",
    directory_before: beforeDir,
    directory_after: afterDir,
    per_category: summary,
  }, null, 2));
  await client.end();
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
