#!/usr/bin/env node
// scripts/supabase-bulk-promote-batched.mjs
//
// Batched admin-attested promotion from a vertical legacy table into
// business_canonical + business_evidence + lifecycle_log on the
// sealed Supabase project.
//
// Replaces the per-row scripts (supabase-bulk-promote-accommodation.mjs,
// supabase-bulk-promote-service.mjs) with a single batched engine that
// executes 100 rows per round-trip batch · ~60× faster for the same
// outcome.
//
// Pre-computes canonical_business_id client-side (randomUUID) so one
// batch INSERT can refer to those IDs from the subsequent evidence +
// lifecycle_log + vertical-backlink INSERT/UPDATE batches without a
// RETURNING round-trip.
//
// Safety: hard-gates on Supabase project id ijvqdvsvwtwxzcqmoqit via
// the pooler username.
//
// Usage:
//   node --env-file=.env.local scripts/supabase-bulk-promote-batched.mjs \
//       --vertical=accommodation|service [--limit=N] [--dry-run]

import pg from "pg";
import { createHash, randomUUID } from "node:crypto";

const APPROVED_PROJECT_ID = "ijvqdvsvwtwxzcqmoqit";
const ADMIN_ID = "philip";
const TRANSITION_REASON = "admin_verify";
const BATCH = 100;

const verticalArg = process.argv.find((a) => a.startsWith("--vertical="));
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const VERTICAL = verticalArg ? verticalArg.slice(11) : null;
const LIMIT = limitArg ? Number(limitArg.slice(8)) : 20000;
const DRY_RUN = process.argv.includes("--dry-run");

const CONFIGS = {
  accommodation: {
    legacyTable: "nex.accommodation_business",
    sourceId: "nex_accommodation_business_legacy",
    entityType: "accommodation",
    observationGenerator: "scripts/supabase-bulk-promote-batched · accommodation · 2026-10-12",
    candidateIdPrefix: "cand-nex-accommodation-",
    defaultCategoryIds: ["accommodation"],
    categoryColumn: "category",
    hasStreetLine: false,
    hasCountryColumn: true,
    carveOut: null,
  },
  service: {
    legacyTable: "nex.service_business",
    sourceId: "nex_service_business_legacy",
    entityType: "service",
    observationGenerator: "scripts/supabase-bulk-promote-batched · service · 2026-10-12",
    candidateIdPrefix: "cand-nex-service-",
    defaultCategoryIds: ["service"],
    categoryColumn: "category_slug",
    hasStreetLine: false,
    hasCountryColumn: false,
    carveOut: ["pharmacies", "dentists", "opticians"],
  },
};

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
  const t = p.trim();
  return /^\+[1-9][0-9]{6,14}$/.test(t) ? t : null;
};
const canonWeb = (w) => {
  if (!w || typeof w !== "string") return null;
  const s = w.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "").toLowerCase();
  return s.includes(".") ? s : null;
};
const osmRef = (ref) => (ref && /^(node|way|relation)\/\d+$/.test(ref) ? ref : null);

async function main() {
  if (!VERTICAL || !CONFIGS[VERTICAL]) {
    console.error("Usage: --vertical=accommodation|service [--limit=N] [--dry-run]");
    process.exit(1);
  }
  const cfg = CONFIGS[VERTICAL];
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL unset");
  verifyTarget(url);

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const countryClause = cfg.hasCountryColumn ? "AND country = 'ID'" : "";
  const carveOutClause =
    cfg.carveOut !== null
      ? `AND (${cfg.categoryColumn} IS NULL OR ${cfg.categoryColumn} NOT IN (${cfg.carveOut.map((c) => "'" + c + "'").join(",")}))`
      : "";
  const selectSql =
    `SELECT internal_id, public_listing_ref, business_name,
            ${cfg.categoryColumn} AS category, categories,
            address, city, district,
            coordinates_lat, coordinates_lng, phone, website,
            source_reference, last_verified_at
       FROM ${cfg.legacyTable}
      WHERE business_name IS NOT NULL
        AND length(trim(business_name)) > 0
        AND city IS NOT NULL
        AND coordinates_lat IS NOT NULL
        AND coordinates_lng IS NOT NULL
        AND canonical_business_id IS NULL
        AND source_reference ~ '^(node|way|relation)/[0-9]+$'
        ${countryClause}
        ${carveOutClause}
      ORDER BY internal_id
      LIMIT $1`;

  const candidates = await client.query(selectSql, [LIMIT]);
  console.log(`vertical=${VERTICAL} · candidates=${candidates.rowCount} · batch=${BATCH} · mode=${DRY_RUN ? "DRY-RUN" : "LIVE"}`);
  if (DRY_RUN) {
    const byCat = {};
    for (const r of candidates.rows) byCat[r.category] = (byCat[r.category] ?? 0) + 1;
    console.log("by category:", byCat);
    await client.end();
    return;
  }

  const runId = `bulk-${VERTICAL}-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const t0 = Date.now();
  let totalCanon = 0;
  let totalEvidence = 0;
  let totalLifecycle = 0;
  let totalBacklink = 0;
  let failedBatches = 0;
  const batchFailures = [];

  for (let i = 0; i < candidates.rows.length; i += BATCH) {
    const batch = candidates.rows.slice(i, i + BATCH);
    try {
      await client.query("BEGIN");

      // === 1 · batch INSERT business_canonical ===
      const canonValues = [];
      const canonParams = [];
      const canonicalIds = []; // pre-computed per-row
      for (let k = 0; k < batch.length; k++) {
        const r = batch[k];
        const cid = randomUUID();
        canonicalIds.push(cid);
        const osmId = osmRef(r.source_reference);
        const catIds = Array.isArray(r.categories) && r.categories.length > 0
          ? r.categories
          : r.category ? [r.category] : cfg.defaultCategoryIds;
        const addrJsonb = r.address || r.district
          ? JSON.stringify({ line1: null, address_free: r.address || null, neighbourhood: null, district: r.district || null })
          : null;
        const base = k * 11 + 1;
        canonValues.push(
          `($${base}::uuid, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}::jsonb, ST_SetSRID(ST_MakePoint($${base + 8}::float8, $${base + 9}::float8), 4326)::geography, $${base + 10}::text[])`,
        );
        canonParams.push(
          cid,
          r.business_name.trim(),
          normPhone(r.phone),
          canonWeb(r.website),
          osmId,
          r.city,
          r.district,
          addrJsonb,
          r.coordinates_lng,
          r.coordinates_lat,
          catIds,
        );
      }
      const canonSql =
        `INSERT INTO nex.business_canonical
           (canonical_business_id, name_canonical, phone_e164, website_apex, osm_id, city, district, address, coordinates, category_ids,
            entity_type, country, lifecycle_state, last_verified_at)
         SELECT v.canonical_business_id, v.name_canonical, v.phone_e164, v.website_apex, v.osm_id, v.city, v.district, v.address, v.coordinates, v.category_ids,
                '${cfg.entityType}', 'ID', 'VERIFIED', now()
           FROM (VALUES ${canonValues.join(", ")}) AS v(canonical_business_id, name_canonical, phone_e164, website_apex, osm_id, city, district, address, coordinates, category_ids)
         ON CONFLICT (country, osm_id) WHERE osm_id IS NOT NULL
         DO NOTHING
         RETURNING canonical_business_id`;
      const canonResult = await client.query(canonSql, canonParams);
      const insertedCanonIds = new Set(canonResult.rows.map((r) => r.canonical_business_id));
      totalCanon += canonResult.rowCount;

      // Only continue with rows that were actually inserted
      const insertedBatch = batch.filter((_, k) => insertedCanonIds.has(canonicalIds[k]));
      const insertedIds = canonicalIds.filter((cid) => insertedCanonIds.has(cid));
      if (insertedBatch.length === 0) {
        await client.query("COMMIT");
        continue;
      }

      // === 2 · batch INSERT business_evidence ===
      const evValues = [];
      const evParams = [];
      for (let k = 0; k < insertedBatch.length; k++) {
        const r = insertedBatch[k];
        const cid = insertedIds[k];
        const candidateIdStr = cfg.candidateIdPrefix + r.internal_id;
        const candidatePayload = JSON.stringify({
          name_canonical: r.business_name.trim(),
          country: "ID",
          city: r.city,
          osm_id: osmRef(r.source_reference),
          coordinates: { lat: r.coordinates_lat, lng: r.coordinates_lng },
        });
        const candidateHash = sha256(candidatePayload);
        const decisionRecordId = sha256(candidateIdStr + "|decision|" + runId);
        const reviewPackageId = sha256(candidateIdStr + "|review-pkg|" + runId);
        const base = k * 10 + 1;
        evValues.push(`($${base}::uuid, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`);
        evParams.push(
          cid,
          candidateIdStr,
          candidateHash,
          decisionRecordId,
          reviewPackageId,
          r.public_listing_ref || r.source_reference,
          r.internal_id,
          cfg.observationGenerator,
          runId,
          cfg.sourceId,
        );
      }
      const evSql =
        `INSERT INTO nex.business_evidence
           (canonical_business_id, candidate_id, candidate_integrity_hash, decision_record_id, review_package_id,
            legacy_source_ref, legacy_source_internal_id, observation_generator, observation_run_id, source_id,
            schema_version, legacy_source_table, resolver_verdict_kind, resolver_score,
            observation_generated_at, observation_decision_timestamp, observation_founder_id)
         SELECT v.canonical_business_id, v.candidate_id, v.candidate_integrity_hash, v.decision_record_id, v.review_package_id,
                v.legacy_source_ref, v.legacy_source_internal_id, v.observation_generator, v.observation_run_id, v.source_id,
                'evidence-v1', '${cfg.legacyTable}', 'NO_MATCH', 0.9,
                now(), now(), '${ADMIN_ID}'
           FROM (VALUES ${evValues.join(", ")}) AS v(canonical_business_id, candidate_id, candidate_integrity_hash, decision_record_id, review_package_id, legacy_source_ref, legacy_source_internal_id, observation_generator, observation_run_id, source_id)
         ON CONFLICT DO NOTHING`;
      const evResult = await client.query(evSql, evParams);
      totalEvidence += evResult.rowCount;

      // === 3 · batch INSERT lifecycle_log ===
      const lifeValues = [];
      const lifeParams = [];
      for (let k = 0; k < insertedBatch.length; k++) {
        const r = insertedBatch[k];
        const cid = insertedIds[k];
        const candidateIdStr = cfg.candidateIdPrefix + r.internal_id;
        const decisionRecordId = sha256(candidateIdStr + "|decision|" + runId);
        const base = k * 2 + 1;
        lifeValues.push(`($${base}::uuid, $${base + 1})`);
        lifeParams.push(cid, decisionRecordId);
      }
      const lifeSql =
        `INSERT INTO nex.business_canonical_lifecycle_log
           (canonical_business_id, from_state, to_state, transition_reason, transitioned_by, transitioned_at, decision_record_id)
         SELECT v.canonical_business_id, 'DISCOVERED', 'VERIFIED', '${TRANSITION_REASON}', '${ADMIN_ID}', now(), v.decision_record_id
           FROM (VALUES ${lifeValues.join(", ")}) AS v(canonical_business_id, decision_record_id)`;
      const lifeResult = await client.query(lifeSql, lifeParams);
      totalLifecycle += lifeResult.rowCount;

      // === 4 · batch UPDATE vertical backlink ===
      // Pair canonical_business_id ↔ internal_id for the inserted batch.
      const backlinkValues = [];
      const backlinkParams = [];
      for (let k = 0; k < insertedBatch.length; k++) {
        const base = k * 2 + 1;
        backlinkValues.push(`($${base}::uuid, $${base + 1}::uuid)`);
        backlinkParams.push(insertedBatch[k].internal_id, insertedIds[k]);
      }
      const backlinkSql =
        `UPDATE ${cfg.legacyTable} SET canonical_business_id = v.cid
         FROM (VALUES ${backlinkValues.join(", ")}) AS v(internal_id, cid)
         WHERE ${cfg.legacyTable}.internal_id = v.internal_id
           AND ${cfg.legacyTable}.canonical_business_id IS NULL`;
      const backlinkResult = await client.query(backlinkSql, backlinkParams);
      totalBacklink += backlinkResult.rowCount;

      await client.query("COMMIT");

      if ((i + BATCH) % 1000 === 0 || i + BATCH >= candidates.rows.length) {
        console.log(`  ${Math.min(i + BATCH, candidates.rows.length)} / ${candidates.rows.length} processed · canon+${totalCanon} · evidence+${totalEvidence} · life+${totalLifecycle} · backlink+${totalBacklink}`);
      }
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      failedBatches++;
      if (batchFailures.length < 3) batchFailures.push({ batch_start: i, reason: String(e.message || e).slice(0, 200) });
    }
  }

  const afterCanon = (await client.query("SELECT COUNT(*)::int AS n FROM nex.business_canonical WHERE entity_type = $1", [cfg.entityType])).rows[0].n;
  const afterDirectory = (await client.query("SELECT COUNT(*)::int AS n FROM nex.business_directory_v")).rows[0].n;
  console.log("");
  console.log(JSON.stringify({
    elapsed_s: Math.round((Date.now() - t0) / 1000),
    vertical: VERTICAL,
    run_id: runId,
    candidates_pulled: candidates.rowCount,
    inserted_canonical: totalCanon,
    inserted_evidence: totalEvidence,
    inserted_lifecycle_log: totalLifecycle,
    updated_backlinks: totalBacklink,
    failed_batches: failedBatches,
    sample_batch_failures: batchFailures,
    canonical_total_after: afterCanon,
    business_directory_v_after: afterDirectory,
  }, null, 2));

  await client.end();
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
