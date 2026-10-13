#!/usr/bin/env node
// scripts/e2e-harvest-proof.mjs
//
// End-to-end harvester proof against a disposable local Postgres.
// ---------------------------------------------------------------
// Exercises the real flow the production tick route runs:
//   1. Create scratch DB on localhost (NEVER touches production)
//   2. Apply migration 187 (US + AU) · opt ID in too so Indonesia
//      harvests work (Indonesia is where OSM coverage is richest)
//   3. Create minimal nex schema tables the writer actually touches
//   4. Pick a small bbox (id-yogyakarta · ~200 shops)
//   5. REAL Overpass API call · no mocks
//   6. Parse elements using the existing parseOverpassElements
//   7. Build canonical rows using the existing buildCanonicalMetadata
//   8. Insert into nex.business_canonical with cycle_id stamped
//   9. Insert nex.aof_cycle row with same cycle_id
//  10. Verify counts reconcile (claimed = verified)
//  11. Second cycle for id-bali · prove dedup leaves prior rows intact
//  12. Failure cycle · bogus host · verify aof_cycle records failure
//
// Exit code 0 on all-pass · 1 on any assertion failure.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const MIGRATION_PATH = join(
  REPO_ROOT,
  "nex-supabase",
  "migrations",
  "187_nex_world_country_us_au_seed.sql",
);

// Pure helpers imported from the existing harvester lib (no server-only).
import {
  CITY_ROTATION,
  pickNextCity,
} from "../src/lib/nex-native/harvest/city-rotation.ts";
import { parseOverpassElements } from "../src/lib/nex-native/harvest/overpass-parser.ts";
import { buildCanonicalMetadata } from "../src/lib/nex-native/harvest/canonical-metadata.ts";

const PG_HOST = "127.0.0.1";
const PG_PORT = Number(process.env.NEX_LOCALPG_PORT ?? 5433);
const PG_USER = process.env.NEX_LOCALPG_USER ?? "postgres";
const PG_PASSWORD = process.env.NEX_LOCALPG_PASSWORD ?? "Admin1phil";
const SCRATCH_DB = `nex_e2e_harvest_${Date.now()}`;

const ADMIN_URL = `postgres://${PG_USER}:${encodeURIComponent(PG_PASSWORD)}@${PG_HOST}:${PG_PORT}/postgres`;
const SCRATCH_URL = `postgres://${PG_USER}:${encodeURIComponent(PG_PASSWORD)}@${PG_HOST}:${PG_PORT}/${SCRATCH_DB}`;

// Hard localhost guard · same as the migration harness.
const FORBIDDEN = [
  "supabase.co",
  "supabase.com",
  "pooler.supabase",
  "amazonaws.com",
  "rds.amazonaws.com",
  "neon.tech",
];
for (const url of [ADMIN_URL, SCRATCH_URL]) {
  const low = url.toLowerCase();
  for (const bad of FORBIDDEN) {
    if (low.includes(bad)) {
      throw new Error(`REFUSED · URL contains ${bad}`);
    }
  }
  if (!/127\.0\.0\.1|localhost/.test(low)) {
    throw new Error("REFUSED · URL must be localhost");
  }
}

for (const k of [
  "NEX_POSTGRES_URL",
  "DATABASE_URL",
  "NEX_SUPABASE_URL",
  "NEXT_PUBLIC_NEX_SUPABASE_URL",
]) {
  delete process.env[k];
}

// ─── Schema the writer actually touches ─────────────────────────────

const FIXTURE_SCHEMA_SQL = `
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE SCHEMA IF NOT EXISTS nex;

  CREATE TABLE IF NOT EXISTS nex.world_country (
    iso_alpha_2    char(2) PRIMARY KEY,
    iso_alpha_3    char(3),
    numeric_code   text,
    name           text NOT NULL,
    official_name  text,
    region         text NOT NULL,
    subregion      text,
    un_member      boolean NOT NULL DEFAULT false,
    sovereign      boolean NOT NULL DEFAULT true,
    currency       text,
    languages      text[],
    metadata       jsonb NOT NULL DEFAULT '{}',
    active_in_nex  boolean NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS nex.discovery_programme (
    programme_id    uuid PRIMARY KEY,
    slug            text UNIQUE,
    display_name    text,
    topic           text,
    description     text,
    status          text,
    cadence_seconds int,
    policy_json     jsonb NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS nex.discovery_programme_country (
    programme_id   uuid NOT NULL REFERENCES nex.discovery_programme(programme_id),
    iso_alpha_2    char(2) NOT NULL REFERENCES nex.world_country(iso_alpha_2),
    included       boolean NOT NULL DEFAULT true,
    priority       int NOT NULL DEFAULT 100,
    policy_json    jsonb NOT NULL DEFAULT '{}',
    PRIMARY KEY (programme_id, iso_alpha_2)
  );

  CREATE TABLE IF NOT EXISTS nex_migration_history (
    version      text PRIMARY KEY,
    applied_at   timestamptz NOT NULL DEFAULT now(),
    description  text,
    notes        text
  );

  -- The writer inserts into nex.business_canonical. We only replicate
  -- the columns the writer actually sets, with the aliases uniqueness
  -- constraint it depends on for ON CONFLICT dedup.
  CREATE TABLE IF NOT EXISTS nex.business_canonical (
    canonical_business_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name_canonical           text NOT NULL,
    name_norm                text NOT NULL,
    entity_type              text NOT NULL,
    country                  char(2) NOT NULL,
    lifecycle_state          text NOT NULL,
    city                     text,
    district                 text,
    category_ids             text[] NOT NULL DEFAULT '{}',
    aliases                  text[] NOT NULL,
    metadata                 jsonb NOT NULL DEFAULT '{}',
    superseded_by_business_id uuid,
    created_at               timestamptz NOT NULL DEFAULT now(),
    last_verified_at         timestamptz,
    CONSTRAINT uq_business_canonical_aliases UNIQUE (aliases)
  );

  CREATE TABLE IF NOT EXISTS nex.aof_cycle (
    cycle_id            uuid PRIMARY KEY,
    started_at          timestamptz NOT NULL,
    ended_at            timestamptz,
    ended_kind          text,
    candidates_added    int NOT NULL DEFAULT 0,
    evidence_added      int NOT NULL DEFAULT 0,
    emails_captured     int NOT NULL DEFAULT 0,
    triggered_by        text,
    sources_attempted   text[] NOT NULL DEFAULT '{}',
    sources_succeeded   text[] NOT NULL DEFAULT '{}',
    sources_cooled_down text[] NOT NULL DEFAULT '{}'
  );
`;

const SEED_PROGRAMME_SQL = `
  INSERT INTO nex.discovery_programme
    (programme_id, slug, display_name, status, cadence_seconds, policy_json)
  VALUES
    ('00000000-0000-4000-8000-000000000001',
     'scaffolding',
     'Scaffolding programme',
     'active',
     300,
     jsonb_build_object('seeded_by', 'e2e-harvest-proof'));
`;

// Indonesia (ID) opt-in so the harvester picks id-* cities.
const OPT_IN_ID_SQL = `
  INSERT INTO nex.world_country (iso_alpha_2, iso_alpha_3, name, region, metadata)
  VALUES ('ID', 'IDN', 'Indonesia', 'Asia', jsonb_build_object('seeded_by', 'e2e-harvest-proof'))
  ON CONFLICT (iso_alpha_2) DO NOTHING;

  INSERT INTO nex.discovery_programme_country
    (programme_id, iso_alpha_2, included, priority, policy_json)
  VALUES
    ('00000000-0000-4000-8000-000000000001', 'ID', true, 100,
     jsonb_build_object('seeded_by', 'e2e-harvest-proof'))
  ON CONFLICT (programme_id, iso_alpha_2) DO NOTHING;
`;

// ─── Assertions ────────────────────────────────────────────────────

const results = [];
function check(name, ok, details = "") {
  results.push({ name, ok, details });
  const tag = ok ? "\x1b[32m[PASS]\x1b[0m" : "\x1b[31m[FAIL]\x1b[0m";
  console.log(`${tag} ${name}${details ? " · " + details : ""}`);
}

// ─── Postgres helpers ───────────────────────────────────────────────

async function withClient(url, fn) {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function createScratchDb() {
  console.log(`Creating scratch DB: ${SCRATCH_DB}`);
  await withClient(ADMIN_URL, async (c) => {
    await c.query(`CREATE DATABASE "${SCRATCH_DB}"`);
  });
}

async function dropScratchDb() {
  console.log(`Dropping scratch DB: ${SCRATCH_DB}`);
  await withClient(ADMIN_URL, async (c) => {
    await c.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
      [SCRATCH_DB],
    );
    await c.query(`DROP DATABASE IF EXISTS "${SCRATCH_DB}"`);
  }).catch(() => undefined);
}

// ─── Overpass fetch · same pattern as production fetcher ────────────

async function fetchOsmBusinessesInBbox(bbox, hostOverride = null) {
  const query = `
    [out:json][timeout:25];
    (
      nwr(${bbox.south},${bbox.west},${bbox.north},${bbox.east})[name][shop];
      nwr(${bbox.south},${bbox.west},${bbox.north},${bbox.east})[name][amenity~"^(restaurant|cafe|fast_food|bar|pub|bakery|ice_cream|pharmacy|bank|car_rental)$"];
      nwr(${bbox.south},${bbox.west},${bbox.north},${bbox.east})[name][tourism~"^(hotel|motel|hostel|guest_house|apartment|chalet)$"];
      nwr(${bbox.south},${bbox.west},${bbox.north},${bbox.east})[name][leisure~"^(fitness_centre|sports_centre|dance|golf_course)$"];
    );
    out tags center 500;
  `.trim();

  const hosts = hostOverride
    ? [hostOverride]
    : [
        // Order flipped · lz4 has been faster than primary in testing.
        "https://lz4.overpass-api.de/api/interpreter",
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
      ];

  const start = Date.now();
  let lastReason = "all_hosts_failed";

  for (const host of hosts) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    try {
      const res = await fetch(host, {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "nex-native/e2e-proof (support@nex.app)",
          Accept: "application/json",
        },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        lastReason = `upstream_error status=${res.status}`;
        continue;
      }
      const data = await res.json();
      const elements = parseOverpassElements(data);
      return { ok: true, host, elements, fetchMs: Date.now() - start };
    } catch (e) {
      clearTimeout(timer);
      lastReason = e?.name === "AbortError" ? "timeout" : "upstream_error";
    }
  }
  return {
    ok: false,
    host: null,
    elements: [],
    fetchMs: Date.now() - start,
    reason: lastReason,
  };
}

// ─── Canonical writer · same logic as production ────────────────────

function inferEntityType(tags) {
  if (tags.tourism) return "accommodation";
  const foodAmenities = new Set([
    "restaurant",
    "cafe",
    "fast_food",
    "bar",
    "pub",
    "bakery",
    "ice_cream",
  ]);
  if (tags.amenity && foodAmenities.has(tags.amenity)) return "food";
  if (tags.shop) return "marketplace_seller";
  if (tags.leisure) return "service";
  return "service";
}

function inferCategoryIds(tags) {
  const list = [];
  if (tags.amenity) list.push(`osm:amenity:${tags.amenity}`);
  if (tags.shop) list.push(`osm:shop:${tags.shop}`);
  if (tags.tourism) list.push(`osm:tourism:${tags.tourism}`);
  if (tags.leisure) list.push(`osm:leisure:${tags.leisure}`);
  if (tags.cuisine) list.push(`osm:cuisine:${tags.cuisine}`);
  return list.slice(0, 10);
}

function inferDistrict(tags) {
  return (
    tags["addr:suburb"] ??
    tags["addr:district"] ??
    tags["addr:neighbourhood"] ??
    null
  );
}

async function writeCanonicalRows(client, bbox, elements, cycleId) {
  let inserted = 0,
    duplicates = 0,
    skipped_no_name = 0,
    skipped_no_coords = 0,
    errors = 0;

  for (const el of elements) {
    const name = (el.tags.name ?? "").trim();
    if (!name) {
      skipped_no_name++;
      continue;
    }
    if (el.lat === null || el.lon === null) {
      skipped_no_coords++;
      continue;
    }
    const osmRef = `osm_${el.type}_${el.id}`;
    const metadata = buildCanonicalMetadata({
      bbox: bbox.id,
      osmLat: el.lat,
      osmLon: el.lon,
      cycleId,
    });
    try {
      const { rowCount } = await client.query(
        `
        INSERT INTO nex.business_canonical
          (canonical_business_id, name_canonical, name_norm,
           entity_type, country, lifecycle_state, city, district,
           category_ids, aliases, metadata)
        VALUES
          (gen_random_uuid(), $1, lower($1),
           $2, $3, 'DISCOVERED', $4, $5,
           $6::text[], ARRAY[$7]::text[], $8::jsonb)
        ON CONFLICT (aliases) DO NOTHING
        `,
        [
          name,
          inferEntityType(el.tags),
          bbox.isoAlpha2,
          bbox.cityName,
          inferDistrict(el.tags),
          inferCategoryIds(el.tags),
          osmRef,
          JSON.stringify(metadata),
        ],
      );
      if (rowCount && rowCount > 0) inserted++;
      else duplicates++;
    } catch {
      errors++;
    }
  }
  return { inserted, duplicates, skipped_no_name, skipped_no_coords, errors };
}

async function recordAofCycle(client, city, overpass, write, started, endedKind, cycleId) {
  const cooledDown = [];
  if (!overpass.ok) cooledDown.push("osm_overpass");
  else if (write.errors > 0) cooledDown.push("canonical_writer");

  await client.query(
    `
    INSERT INTO nex.aof_cycle (
      cycle_id, started_at, ended_at, ended_kind,
      candidates_added, evidence_added, emails_captured,
      triggered_by, sources_attempted, sources_succeeded, sources_cooled_down
    ) VALUES (
      $7::uuid, $1, now(), $2,
      $3, 0, 0,
      'nexapp-harvester-tick:' || $4,
      ARRAY['osm_overpass']::text[],
      CASE WHEN $5 THEN ARRAY['osm_overpass']::text[] ELSE ARRAY[]::text[] END,
      $6::text[]
    )
    `,
    [
      new Date(started).toISOString(),
      endedKind,
      write.inserted,
      city.id,
      overpass.ok,
      cooledDown,
      cycleId,
    ],
  );
}

// ─── Simulate one tick ──────────────────────────────────────────────

async function tick(label, bbox, { forceFailure = false } = {}) {
  const started = Date.now();
  const cycleId = randomUUID();
  console.log(`\n── ${label} · cycle_id=${cycleId}`);

  const overpass = forceFailure
    ? await fetchOsmBusinessesInBbox(bbox, "https://nonexistent-overpass-host.invalid/api")
    : await fetchOsmBusinessesInBbox(bbox);

  console.log(
    `  overpass: ok=${overpass.ok} host=${overpass.host ?? "(none)"} elements=${overpass.elements.length} fetchMs=${overpass.fetchMs}`,
  );

  let write = {
    inserted: 0,
    duplicates: 0,
    skipped_no_name: 0,
    skipped_no_coords: 0,
    errors: 0,
  };
  if (overpass.ok) {
    write = await withClient(SCRATCH_URL, (c) =>
      writeCanonicalRows(c, bbox, overpass.elements, cycleId),
    );
    console.log(
      `  writer: inserted=${write.inserted} dup=${write.duplicates} no_name=${write.skipped_no_name} no_coords=${write.skipped_no_coords} errors=${write.errors}`,
    );
  }

  const endedKind = overpass.ok ? "completed" : "failed";
  await withClient(SCRATCH_URL, (c) =>
    recordAofCycle(c, bbox, overpass, write, started, endedKind, cycleId),
  );

  return { cycleId, overpass, write, endedKind, bbox };
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(MIGRATION_PATH)) {
    throw new Error(`Missing migration file: ${MIGRATION_PATH}`);
  }
  console.log(`\nSetting up disposable Postgres at 127.0.0.1:${PG_PORT}/${SCRATCH_DB}`);

  await createScratchDb();

  try {
    // Fixtures + migration 187 + ID opt-in
    await withClient(SCRATCH_URL, async (c) => {
      await c.query(FIXTURE_SCHEMA_SQL);
      await c.query(SEED_PROGRAMME_SQL);
      await c.query(OPT_IN_ID_SQL);
      await c.query(readFileSync(MIGRATION_PATH, "utf8"));
    });

    const programmeCount = await withClient(SCRATCH_URL, async (c) => {
      const r = await c.query(
        `SELECT COUNT(*)::int AS n FROM nex.discovery_programme_country WHERE included = true`,
      );
      return r.rows[0].n;
    });
    check("setup · programme has opted-in countries (ID + US + AU)", programmeCount >= 3, `count=${programmeCount}`);

    // Rotate through Indonesian cities until Overpass gives us real
    // data · OSM mirrors can be flaky, and the test must prove the
    // pipeline on live-source data when the API is reachable at all.
    const idCities = CITY_ROTATION.filter((c) => c.isoAlpha2 === "ID");
    check("setup · city rotation has >= 3 Indonesian cities", idCities.length >= 3, `count=${idCities.length}`);

    // ─── Cycle 1 · real Overpass fetch · retry across cities if needed ───
    console.log("\n═══ CYCLE 1 · real Overpass fetch (rotating ID cities until success) ═══");
    let c1 = null;
    let cityA = null;
    for (const candidate of idCities) {
      cityA = candidate;
      c1 = await tick(`${candidate.id} cycle`, candidate);
      if (c1.overpass.ok && c1.write.inserted > 0) break;
      console.log(`  → ${candidate.id} did not yield data · trying next`);
    }

    check("cycle 1 · overpass returned OK on at least one ID city", c1.overpass.ok);
    check(
      "cycle 1 · at least 10 OSM elements received (sanity on real-source coverage)",
      c1.overpass.elements.length >= 10,
      `elements=${c1.overpass.elements.length}`,
    );
    check("cycle 1 · at least 1 canonical row inserted", c1.write.inserted >= 1, `inserted=${c1.write.inserted}`);

    // Verify DB: canonical rows carrying this cycle_id match claimed count
    const dbCount1 = await withClient(SCRATCH_URL, async (c) => {
      const r = await c.query(
        `SELECT COUNT(*)::int AS n FROM nex.business_canonical WHERE metadata->>'cycle_id' = $1`,
        [c1.cycleId],
      );
      return r.rows[0].n;
    });
    check(
      "cycle 1 · DB canonical count matches writer-claimed count",
      dbCount1 === c1.write.inserted,
      `claimed=${c1.write.inserted} · verified=${dbCount1}`,
    );

    // Verify source + bbox + lifecycle on a sample row
    const sampleRow = await withClient(SCRATCH_URL, async (c) => {
      const r = await c.query(
        `SELECT name_canonical, lifecycle_state, country, city, metadata, aliases
           FROM nex.business_canonical
          WHERE metadata->>'cycle_id' = $1
          LIMIT 1`,
        [c1.cycleId],
      );
      return r.rows[0];
    });
    check("cycle 1 · sample row has lifecycle_state='DISCOVERED'", sampleRow?.lifecycle_state === "DISCOVERED");
    check("cycle 1 · sample row metadata.source='osm_overpass'", sampleRow?.metadata?.source === "osm_overpass");
    check(`cycle 1 · sample row metadata.bbox=${cityA.id}`, sampleRow?.metadata?.bbox === cityA.id);
    check("cycle 1 · sample row aliases[0] starts with 'osm_'", (sampleRow?.aliases?.[0] ?? "").startsWith("osm_"));
    console.log(`  sample business: "${sampleRow?.name_canonical ?? "(none)"}" · city=${sampleRow?.city ?? "?"}`);

    // Verify aof_cycle row carries same cycle_id and ended_kind='completed'
    const cyc1 = await withClient(SCRATCH_URL, async (c) => {
      const r = await c.query(
        `SELECT cycle_id, ended_kind, candidates_added, triggered_by, sources_cooled_down
           FROM nex.aof_cycle WHERE cycle_id = $1`,
        [c1.cycleId],
      );
      return r.rows[0];
    });
    check("cycle 1 · aof_cycle row exists with matching cycle_id", !!cyc1);
    check("cycle 1 · aof_cycle.ended_kind='completed'", cyc1?.ended_kind === "completed");
    check("cycle 1 · aof_cycle.candidates_added = writer-claimed", cyc1?.candidates_added === c1.write.inserted);
    check("cycle 1 · aof_cycle.triggered_by starts with nexapp-harvester-tick:", (cyc1?.triggered_by ?? "").startsWith("nexapp-harvester-tick:"));
    check("cycle 1 · sources_cooled_down is empty on success", Array.isArray(cyc1?.sources_cooled_down) && cyc1.sources_cooled_down.length === 0);

    // ─── Cycle 2 · Bali · prove dedup leaves cycle-1 rows intact ───
    console.log("\n═══ CYCLE 2 · Bali · different city, prove dedup ═══");
    const cityB = CITY_ROTATION.find((c) => c.id === "id-bali");
    const canonicalBeforeC2 = await withClient(SCRATCH_URL, async (c) =>
      Number((await c.query(`SELECT COUNT(*)::text AS n FROM nex.business_canonical`)).rows[0].n),
    );
    const c2 = await tick("bali cycle", cityB);
    check("cycle 2 · overpass returned OK", c2.overpass.ok);

    const canonicalAfterC2 = await withClient(SCRATCH_URL, async (c) =>
      Number((await c.query(`SELECT COUNT(*)::text AS n FROM nex.business_canonical`)).rows[0].n),
    );
    check(
      "cycle 2 · canonical row count grew (cycle 1 rows preserved)",
      canonicalAfterC2 > canonicalBeforeC2,
      `before=${canonicalBeforeC2} · after=${canonicalAfterC2}`,
    );
    const cycle1StillThere = await withClient(SCRATCH_URL, async (c) =>
      Number((await c.query(`SELECT COUNT(*)::int AS n FROM nex.business_canonical WHERE metadata->>'cycle_id' = $1`, [c1.cycleId])).rows[0].n),
    );
    check(
      "cycle 2 · cycle-1 rows preserved (no dedup/overwrite caused them to disappear)",
      cycle1StillThere === dbCount1,
      `cycle1-rows-still-present=${cycle1StillThere} (was ${dbCount1})`,
    );

    // ─── Cycle 3 · Re-run SAME city as cycle 1 · prove ON CONFLICT dedup ───
    console.log(`\n═══ CYCLE 3 · ${cityA.id} AGAIN · prove re-harvest dedup ═══`);
    const sameCityBefore = await withClient(SCRATCH_URL, async (c) =>
      Number((await c.query(
        `SELECT COUNT(*)::int AS n FROM nex.business_canonical WHERE metadata->>'bbox' = $1`,
        [cityA.id],
      )).rows[0].n),
    );
    const c3 = await tick(`${cityA.id} re-run`, cityA);
    const sameCityAfter = await withClient(SCRATCH_URL, async (c) =>
      Number((await c.query(
        `SELECT COUNT(*)::int AS n FROM nex.business_canonical WHERE metadata->>'bbox' = $1`,
        [cityA.id],
      )).rows[0].n),
    );
    const addedByRerun = sameCityAfter - sameCityBefore;
    const totalElementsFetched = c3.overpass.ok ? c3.overpass.elements.length : 0;
    const dedupRatio = totalElementsFetched > 0 ? c3.write.duplicates / totalElementsFetched : 0;
    check(
      "cycle 3 · overpass returned OK on re-run",
      c3.overpass.ok,
    );
    check(
      "cycle 3 · re-harvest of same city produced near-zero new rows (dedup via aliases uniqueness)",
      addedByRerun <= 5,
      `added=${addedByRerun} · duplicates=${c3.write.duplicates} · fetched=${totalElementsFetched}`,
    );
    check(
      "cycle 3 · duplicate ratio exceeds 50% on re-run (ON CONFLICT fired for most elements)",
      dedupRatio > 0.5 || totalElementsFetched === 0,
      `ratio=${dedupRatio.toFixed(2)}`,
    );

    // ─── Cycle 4 · FAILURE case · bogus host · verify honest reporting ───
    console.log("\n═══ CYCLE 4 · FAILURE case · bogus Overpass host ═══");
    const c4 = await tick("failure cycle (bogus host)", cityB, { forceFailure: true });
    check("cycle 4 · overpass failed as expected", !c4.overpass.ok, `reason=${c4.overpass.reason}`);
    check("cycle 4 · writer did NOT run (inserted stayed 0)", c4.write.inserted === 0);

    const cyc4 = await withClient(SCRATCH_URL, async (c) => {
      const r = await c.query(
        `SELECT ended_kind, candidates_added, sources_succeeded, sources_cooled_down
           FROM nex.aof_cycle WHERE cycle_id = $1`,
        [c4.cycleId],
      );
      return r.rows[0];
    });
    check("cycle 4 · aof_cycle.ended_kind='failed'", cyc4?.ended_kind === "failed");
    check("cycle 4 · aof_cycle.candidates_added=0 (honest · no fabrication)", cyc4?.candidates_added === 0);
    check("cycle 4 · sources_succeeded is empty", Array.isArray(cyc4?.sources_succeeded) && cyc4.sources_succeeded.length === 0);
    check("cycle 4 · sources_cooled_down flags osm_overpass", (cyc4?.sources_cooled_down ?? []).includes("osm_overpass"));

    // ─── Final tally ───
    const totalCanonical = await withClient(SCRATCH_URL, async (c) =>
      Number((await c.query(`SELECT COUNT(*)::text AS n FROM nex.business_canonical`)).rows[0].n),
    );
    const totalCycles = await withClient(SCRATCH_URL, async (c) =>
      Number((await c.query(`SELECT COUNT(*)::text AS n FROM nex.aof_cycle WHERE triggered_by LIKE 'nexapp-harvester-tick:%'`)).rows[0].n),
    );
    console.log(`\n═══ FINAL DB STATE ═══`);
    console.log(`  canonical rows      : ${totalCanonical}`);
    console.log(`  harvest cycles      : ${totalCycles}`);
  } finally {
    await dropScratchDb();
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n═══ SUMMARY ═══`);
  console.log(`${passed} passed · ${failed} failed · ${results.length} total`);
  if (failed > 0) {
    console.log(`\nFailed:`);
    for (const r of results.filter((x) => !x.ok)) {
      console.log(`  · ${r.name}${r.details ? " · " + r.details : ""}`);
    }
    process.exit(1);
  }
  console.log("\n✅ End-to-end harvest proof passed against real Overpass + real Postgres.");
  process.exit(0);
}

process.on("unhandledRejection", async (e) => {
  console.error("UNHANDLED:", e);
  await dropScratchDb().catch(() => undefined);
  process.exit(1);
});

main().catch(async (e) => {
  console.error("HARNESS ERROR:", e.message);
  await dropScratchDb().catch(() => undefined);
  process.exit(1);
});
