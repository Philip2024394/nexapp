// scripts/supabase-area-landmarks-replay.mjs
//
// Cache-replay for the 46-city Indonesia Overpass sweep whose write
// phase crashed on 2026-10-12 (the collector's INSERT was missing 7
// NOT NULL columns · see logs/stage-area-intel/collector-sweep.log
// trailing "FATAL: null value in column area_id..." for the exact
// failure). The 41 successfully-collected OSM payloads are safely
// cached in logs/stage-area-intel/review-2026-10-12.json. This script
// reads that bundle and writes ONE row per city into
// nex.meaningful_area, using schema-correct values that have been
// validated against:
//
//   · the CHECK constraints on nex.meaningful_area
//     (area_kind IN ('neighbourhood','corridor','belt','fallback'),
//      radius_km > 0)
//   · the existing area_id / precedence convention
//     (yogya-city-core is kind='fallback' at precedence=99 ·
//     neighbourhoods at 1 · corridors/belts at 2 · city-wide
//     fallbacks at 99 so more-specific curated rows will always win)
//   · the Discover-This-Area read path at
//     src/lib/nex-native/directory/area-intelligence-service.ts
//     (filters on lower(city)+country + jsonb_path_exists on our
//      namespace · ORDER BY precedence ASC LIMIT 1)
//
// Modes:
//   (default)  dry-run  · prints a per-city plan + coverage impact +
//                        collision checks. Writes nothing.
//   --commit            · opens one transaction, UPSERTs 41 rows,
//                        reports verification counts, exits.
//
// Hard-gates:
//   · Project must be ijvqdvsvwtwxzcqmoqit (NEX canonical Supabase).
//   · 5 known-failed cities (Kuta, Sleman, Pontianak, Jambi, Banda
//     Aceh) are explicitly skipped — this script never fabricates
//     their data.
//   · ON CONFLICT (area_id) DO UPDATE preserves existing provenance
//     keys; our namespace is merged in without overwriting others.
//   · Rows carrying a brain-pipeline source (`philip_2026_08_23_seed`,
//     etc.) are inspected but NEVER overwritten; if a collision on
//     area_id is detected, the script refuses to touch that row and
//     reports it as a skipped conflict.

import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const BUNDLE_PATH = "logs/stage-area-intel/review-2026-10-12.json";
const EXPECTED_PROJECT_ID = "ijvqdvsvwtwxzcqmoqit";
const PROVENANCE_NAMESPACE = "nex_directory_area_intelligence";
const AREA_KIND = "fallback";
const RADIUS_KM = 7;
const SOURCE_TAG = "osm-landmarks-collector-v1";
const PRECEDENCE = 99;
// Cities whose Overpass fetch failed in the original sweep · the
// script never writes rows for these. Investigate as a separate task.
const KNOWN_FAILED = new Set(["Kuta", "Sleman", "Pontianak", "Jambi", "Banda Aceh"]);

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function areaIdFor(city) {
  return `${slug(city)}-city-core`;
}

function characterTagsFor(payload) {
  const counts = {
    food: payload.known_for?.food?.length ?? 0,
    shopping: payload.known_for?.shopping?.length ?? 0,
    attractions: payload.known_for?.attractions?.length ?? 0,
    transport: payload.known_for?.transport?.length ?? 0,
  };
  const tags = [];
  if (counts.attractions > 0) tags.push("has-attractions");
  if (counts.transport > 0) tags.push("has-transport");
  return tags;
}

function verifyProjectId(connectionString) {
  // Supabase pooler connection string embeds the project id in the
  // username, e.g. postgres.ijvqdvsvwtwxzcqmoqit:password@... — grab it
  // from either the username or the hostname.
  const u = new URL(connectionString);
  const fromUser = u.username.includes(".") ? u.username.split(".")[1] : null;
  const fromHost = u.hostname.match(/^([a-z0-9]{20})\./)?.[1] ?? null;
  const projectId = fromUser ?? fromHost;
  if (!projectId) throw new Error(`Cannot extract project id from DATABASE_URL`);
  if (projectId !== EXPECTED_PROJECT_ID) {
    throw new Error(
      `Refusing to run: DATABASE_URL points at project '${projectId}'. ` +
        `Expected canonical NEX project '${EXPECTED_PROJECT_ID}'.`,
    );
  }
}

async function main() {
  const commit = process.argv.includes("--commit");
  const bundle = JSON.parse(await fs.readFile(BUNDLE_PATH, "utf8"));
  const results = bundle.results ?? [];
  const ok = results.filter((r) => r.payload);
  const failed = results.filter((r) => !r.payload).map((r) => r.city);

  console.log(`\n=== cache-replay for nex.meaningful_area ===`);
  console.log(`bundle: ${BUNDLE_PATH}`);
  console.log(`run_timestamp (original sweep): ${bundle.run_timestamp}`);
  console.log(`mode: ${commit ? "LIVE (--commit)" : "DRY-RUN (no writes)"}`);
  console.log(`collected OK cities: ${ok.length}`);
  console.log(`failed cities (skipped): ${failed.length} · ${failed.join(", ")}`);
  for (const c of failed) {
    if (!KNOWN_FAILED.has(c)) {
      throw new Error(`Unexpected failed city in bundle: ${c}`);
    }
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  verifyProjectId(url);

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  // Compute centroid per city from business_directory_v (same source
  // the sweep used · one small query per city).
  console.log(`\n=== computing centroids from business_directory_v ===`);
  const centroids = new Map();
  for (const r of ok) {
    const q = await client.query(
      `SELECT
         AVG(ST_Y(coordinates::geometry))::numeric AS lat,
         AVG(ST_X(coordinates::geometry))::numeric AS lng,
         count(*) AS n
       FROM nex.business_directory_v
       WHERE country = $1
         AND lower(city) = lower($2)
         AND coordinates IS NOT NULL`,
      [r.country, r.city],
    );
    const lat = q.rows[0]?.lat;
    const lng = q.rows[0]?.lng;
    const n = parseInt(q.rows[0]?.n ?? "0", 10);
    if (lat === null || lng === null || n === 0) {
      centroids.set(r.city, { ok: false, reason: "no listings with coordinates" });
    } else {
      centroids.set(r.city, { ok: true, lat: Number(lat), lng: Number(lng), n });
    }
  }

  // Collision + existing-row checks.
  console.log(`\n=== collision + existing-row checks ===`);
  const conflicts = [];
  const upserts = [];
  const skipped = [];
  for (const r of ok) {
    const centroid = centroids.get(r.city);
    if (!centroid.ok) {
      skipped.push({ city: r.city, reason: centroid.reason });
      continue;
    }
    const aid = areaIdFor(r.city);
    const pk = await client.query(
      `SELECT area_id, source, precedence, area_kind, provenance
         FROM nex.meaningful_area WHERE area_id = $1`,
      [aid],
    );
    if (pk.rowCount > 0) {
      const existing = pk.rows[0];
      const existingKeys = Object.keys(existing.provenance ?? {});
      // Allow safe UPSERT if the row's source is already our tag OR if
      // the only existing provenance namespace is ours.
      const safeToMerge =
        existing.source === SOURCE_TAG ||
        (existingKeys.length === 1 && existingKeys[0] === PROVENANCE_NAMESPACE) ||
        existingKeys.length === 0;
      if (!safeToMerge) {
        conflicts.push({
          city: r.city,
          area_id: aid,
          reason: `area_id already exists · source=${existing.source} precedence=${existing.precedence} kind=${existing.area_kind} · would require merge of foreign provenance`,
          existingProvenanceKeys: existingKeys,
        });
        continue;
      }
      upserts.push({
        city: r.city,
        country: r.country,
        area_id: aid,
        action: "UPDATE",
        existing_source: existing.source,
        centroid,
        payload: r.payload,
      });
    } else {
      // Also check (country, city) · if a brain-pipeline row exists
      // with our namespace already, we'd be creating a duplicate.
      const cc = await client.query(
        `SELECT area_id, area_kind, source, precedence
           FROM nex.meaningful_area
          WHERE country = $1 AND lower(city) = lower($2)
            AND jsonb_path_exists(provenance, '$.nex_directory_area_intelligence')`,
        [r.country, r.city],
      );
      if (cc.rowCount > 0) {
        skipped.push({
          city: r.city,
          area_id: aid,
          reason: `city already has a row carrying our namespace (area_id=${cc.rows[0].area_id} source=${cc.rows[0].source} prec=${cc.rows[0].precedence}) · skipping to avoid duplicate claim coverage`,
        });
        continue;
      }
      upserts.push({
        city: r.city,
        country: r.country,
        area_id: aid,
        action: "INSERT",
        centroid,
        payload: r.payload,
      });
    }
  }

  console.log(`conflicts (will NOT touch): ${conflicts.length}`);
  for (const c of conflicts) console.log(`  · ${c.city.padEnd(22)} ${c.area_id.padEnd(28)} ${c.reason}`);

  console.log(`skipped (already covered or no coords): ${skipped.length}`);
  for (const s of skipped) console.log(`  · ${s.city.padEnd(22)} ${(s.area_id ?? "").padEnd(28)} ${s.reason}`);

  console.log(`\nplanned upserts: ${upserts.length}`);
  console.log(`  action    city                    area_id                      kind       prec  source                        centroid                              radius_km  claims(food/shop/attr/transport)`);
  for (const u of upserts) {
    const kf = u.payload.known_for ?? {};
    const claims = `${kf.food?.length ?? 0}/${kf.shopping?.length ?? 0}/${kf.attractions?.length ?? 0}/${kf.transport?.length ?? 0}`;
    const centroidStr = `(${u.centroid.lat.toFixed(5)},${u.centroid.lng.toFixed(5)}, n=${u.centroid.n})`;
    console.log(
      `  ${u.action.padEnd(8)}  ${u.city.padEnd(22)}  ${u.area_id.padEnd(28)}  ${AREA_KIND.padEnd(10)}  ${String(PRECEDENCE).padEnd(4)}  ${SOURCE_TAG.padEnd(30)}  ${centroidStr.padEnd(38)}  ${String(RADIUS_KM).padEnd(9)}  ${claims}`,
    );
  }

  // Coverage impact estimate: how many Indonesian listings will be
  // served by these rows via the (lower(city), country) read path?
  console.log(`\n=== coverage impact (estimated) ===`);
  const totalId = await client.query(
    `SELECT count(*) AS n FROM nex.business_directory_v WHERE country = 'ID'`,
  );
  console.log(`total ID listings in business_directory_v: ${totalId.rows[0].n}`);

  const beforeCovered = await client.query(
    `SELECT count(DISTINCT (bdv.country, lower(bdv.city))) AS city_pairs,
            count(bdv.canonical_business_id) AS listings
       FROM nex.business_directory_v bdv
       JOIN nex.meaningful_area ma
         ON ma.country = bdv.country
        AND lower(ma.city) = lower(bdv.city)
        AND jsonb_path_exists(ma.provenance, '$.nex_directory_area_intelligence')
      WHERE bdv.country = 'ID'`,
  );
  console.log(`BEFORE replay · ID listings served: ${beforeCovered.rows[0].listings} across ${beforeCovered.rows[0].city_pairs} (country,city) tuples`);

  if (upserts.length > 0) {
    const cityList = upserts.map((u) => u.city.toLowerCase());
    const projected = await client.query(
      `SELECT count(*) AS n
         FROM nex.business_directory_v
        WHERE country = 'ID'
          AND lower(city) = ANY($1::text[])`,
      [cityList],
    );
    console.log(`PROJECTED after replay · additional ID listings served: ${projected.rows[0].n}`);
    console.log(`PROJECTED total ID listings served: ${Number(beforeCovered.rows[0].listings) + Number(projected.rows[0].n)}`);
  }

  if (!commit) {
    console.log(`\n=== DRY-RUN complete · nothing written ===`);
    console.log(`To execute: node --env-file=.env.local ${path.basename(process.argv[1])} --commit`);
    await client.end();
    return;
  }

  // ───────────── live write path (transactional) ─────────────
  console.log(`\n=== LIVE WRITE PATH (transactional) ===`);
  await client.query("BEGIN");
  try {
    let inserted = 0;
    let updated = 0;
    for (const u of upserts) {
      const provenanceEntry = {
        [PROVENANCE_NAMESPACE]: u.payload,
      };
      const tags = characterTagsFor(u.payload);
      // ON CONFLICT (area_id) · merge our namespace into existing
      // provenance, do not overwrite other keys. jsonb || (right-wins)
      // means our namespace replaces any prior value for the same
      // namespace key but leaves other namespaces intact.
      // ON CONFLICT guard: only merge if the existing row carries OUR
      // source tag (ie. this is a re-run of the same replay). If a
      // brain-pipeline or manually-seeded row sits at the same area_id,
      // the WHERE fails, no row is returned, and we log a SKIP. The
      // pre-check loop above already excludes conflicts proactively ·
      // this guard is a defense-in-depth against races between the
      // pre-check and the write.
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
      const result = await client.query(sql, [
        u.area_id,
        u.city,
        AREA_KIND,
        PRECEDENCE,
        u.country,
        u.city,
        u.centroid.lat,
        u.centroid.lng,
        RADIUS_KM,
        tags,
        SOURCE_TAG,
        JSON.stringify(provenanceEntry),
      ]);
      if (result.rowCount === 0) {
        console.log(`  SKIP (foreign provenance guard tripped) · ${u.city}`);
      } else if (result.rows[0].inserted) {
        inserted++;
        console.log(`  INSERT · ${u.city.padEnd(22)} area_id=${u.area_id}`);
      } else {
        updated++;
        console.log(`  UPDATE · ${u.city.padEnd(22)} area_id=${u.area_id} (merged namespace)`);
      }
    }
    await client.query("COMMIT");
    console.log(`\ntxn committed · inserted=${inserted} updated=${updated}`);

    // Post-write verification
    const afterCovered = await client.query(
      `SELECT count(DISTINCT (bdv.country, lower(bdv.city))) AS city_pairs,
              count(bdv.canonical_business_id) AS listings
         FROM nex.business_directory_v bdv
         JOIN nex.meaningful_area ma
           ON ma.country = bdv.country
          AND lower(ma.city) = lower(bdv.city)
          AND jsonb_path_exists(ma.provenance, '$.nex_directory_area_intelligence')
        WHERE bdv.country = 'ID'`,
    );
    console.log(`AFTER replay · ID listings served: ${afterCovered.rows[0].listings} across ${afterCovered.rows[0].city_pairs} (country,city) tuples`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`\nFATAL · rolled back:`, err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
