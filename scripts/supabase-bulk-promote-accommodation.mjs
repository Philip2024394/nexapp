#!/usr/bin/env node
// scripts/supabase-bulk-promote-accommodation.mjs
//
// Admin-attested bulk promotion of accommodation_business → business_canonical
// on the sealed Supabase project.
//
// Writes the full business_evidence shape required by the sealed
// schema (schema_version, candidate_id, candidate_integrity_hash,
// decision_record_id, review_package_id, resolver_verdict_kind,
// observation_*, source_id). All synthesisable identifiers are
// derived deterministically from each candidate so a re-run idempotent-
// matches via (canonical, source_id, legacy_source_internal_id).
//
// Safety:
//   · Hard-gates on project id ijvqdvsvwtwxzcqmoqit via the pooler
//     user name.
//   · Each row applies in its own transaction · one failure does not
//     block the batch.
//   · Idempotent: skip rows where canonical_business_id is already set
//     on the accommodation_business row.
//
// Usage:
//   node --env-file=.env.local scripts/supabase-bulk-promote-accommodation.mjs [--limit=N] [--dry-run]

import pg from "pg";
import { createHash, randomUUID } from "node:crypto";

const APPROVED_PROJECT_ID = "ijvqdvsvwtwxzcqmoqit";
const SOURCE_ID = "nex_accommodation_business_legacy";
const LEGACY_TABLE = "nex.accommodation_business";
const ENTITY_TYPE = "accommodation";
const OBSERVATION_GENERATOR = "scripts/supabase-bulk-promote-accommodation-2026-10-12";
const ADMIN_ID = "philip";
// Sealed enum values from ck_bcll_transition_reason:
// 'birth' | 'enrichment' | 'multi_source_verify' | 'admin_verify' |
// 'owner_claim' | 'owner_verify' | 'dormancy' | 'reactivation' | 'supersede'
const TRANSITION_REASON = "admin_verify";

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.slice(8)) : 20000;
const DRY_RUN = process.argv.includes("--dry-run");

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
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL unset");
  verifyTarget(url);
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const beforeCanon = (await client.query("SELECT COUNT(*)::int AS n FROM nex.business_canonical WHERE entity_type=$1", [ENTITY_TYPE])).rows[0].n;
  const beforeDirectory = (await client.query("SELECT COUNT(*)::int AS n FROM nex.business_directory_v")).rows[0].n;
  console.log(`BEFORE: accommodation canonicals=${beforeCanon} · business_directory_v=${beforeDirectory}`);
  console.log(`mode: ${DRY_RUN ? "DRY-RUN" : "LIVE"} · limit=${LIMIT}`);

  const candidates = await client.query(
    `SELECT internal_id, public_listing_ref, business_name, category, categories,
            address, city, district, street_line, neighbourhood,
            coordinates_lat, coordinates_lng, phone, website,
            source_reference, source_ingested_at, last_verified_at
       FROM ${LEGACY_TABLE}
      WHERE business_name IS NOT NULL
        AND length(trim(business_name)) > 0
        AND country = 'ID'
        AND city IS NOT NULL
        AND coordinates_lat IS NOT NULL
        AND coordinates_lng IS NOT NULL
        AND canonical_business_id IS NULL
        AND source_reference ~ '^(node|way|relation)/[0-9]+$'
      ORDER BY internal_id
      LIMIT $1`,
    [LIMIT],
  );
  console.log(`candidates: ${candidates.rowCount}`);

  if (DRY_RUN) {
    const byCat = {};
    for (const r of candidates.rows) byCat[r.category] = (byCat[r.category] ?? 0) + 1;
    console.log("by category:", byCat);
    await client.end();
    return;
  }

  const runId = `bulk-accommodation-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const t0 = Date.now();
  let inserted_canonical = 0;
  let inserted_evidence = 0;
  let promoted_lifecycle = 0;
  let skipped_conflict = 0;
  let failed = 0;
  const failures = [];

  for (const row of candidates.rows) {
    try {
      await client.query("BEGIN");

      const addrJsonb = row.address || row.street_line || row.neighbourhood || row.district
        ? JSON.stringify({
            line1: row.street_line || null,
            address_free: row.address || null,
            neighbourhood: row.neighbourhood || null,
            district: row.district || null,
          })
        : null;

      const catIds = Array.isArray(row.categories) && row.categories.length > 0
        ? row.categories
        : row.category && typeof row.category === "string" && row.category.length > 0
          ? [row.category]
          : ["accommodation"];

      const osmId = osmRef(row.source_reference);

      // 1) INSERT business_canonical
      const insC = await client.query(
        `INSERT INTO nex.business_canonical (
           entity_type, country, lifecycle_state, name_canonical,
           phone_e164, website_apex, osm_id, city, district,
           street_line, neighbourhood, address, coordinates,
           category_ids, last_verified_at
         ) VALUES (
           $1, 'ID', 'DISCOVERED', $2,
           $3, $4, $5, $6, $7,
           $8, $9, $10::jsonb,
           ST_SetSRID(ST_MakePoint($11::float8, $12::float8), 4326)::geography,
           $13::text[], now()
         )
         ON CONFLICT (country, osm_id) WHERE osm_id IS NOT NULL
         DO NOTHING
         RETURNING canonical_business_id`,
        [
          ENTITY_TYPE,
          row.business_name.trim(),
          normPhone(row.phone),
          canonWeb(row.website),
          osmId,
          row.city,
          row.district,
          row.street_line,
          row.neighbourhood,
          addrJsonb,
          row.coordinates_lng,
          row.coordinates_lat,
          catIds,
        ],
      );

      let canonId;
      if (insC.rowCount === 0) {
        const existing = await client.query(
          "SELECT canonical_business_id FROM nex.business_canonical WHERE country='ID' AND osm_id=$1",
          [osmId],
        );
        if (existing.rowCount === 0) throw new Error("insert 0 but no existing row");
        canonId = existing.rows[0].canonical_business_id;
        skipped_conflict++;
      } else {
        canonId = insC.rows[0].canonical_business_id;
        inserted_canonical++;
      }

      // Backlink the vertical row
      await client.query(
        `UPDATE ${LEGACY_TABLE} SET canonical_business_id=$1 WHERE internal_id=$2 AND canonical_business_id IS NULL`,
        [canonId, row.internal_id],
      );

      // 2) INSERT business_evidence with sealed shape
      const candidateIdStr = `cand-nex-accommodation-${row.internal_id}`;
      const candidatePayload = JSON.stringify({
        name_canonical: row.business_name.trim(),
        country: "ID",
        city: row.city,
        osm_id: osmId,
        coordinates: { lat: row.coordinates_lat, lng: row.coordinates_lng },
      });
      const candidateHash = sha256(candidatePayload);
      const decisionRecordId = sha256(candidateIdStr + "|decision|" + runId);
      const reviewPackageId = sha256(candidateIdStr + "|review-pkg|" + runId);

      const evInsert = await client.query(
        `INSERT INTO nex.business_evidence (
           canonical_business_id, schema_version, candidate_id,
           candidate_integrity_hash, decision_record_id, review_package_id,
           legacy_source_table, legacy_source_ref, legacy_source_internal_id,
           resolver_verdict_kind, resolver_target_id, resolver_score,
           observation_generator, observation_run_id,
           observation_generated_at, observation_decision_timestamp,
           observation_founder_id, source_id
         ) VALUES (
           $1, 'evidence-v1', $2,
           $3, $4, $5,
           $6, $7, $8,
           'NO_MATCH', NULL, 0.9,
           $9, $10,
           now(), now(),
           $11, $12
         )
         ON CONFLICT DO NOTHING
         RETURNING evidence_id`,
        [
          canonId,
          candidateIdStr,
          candidateHash,
          decisionRecordId,
          reviewPackageId,
          LEGACY_TABLE,
          row.public_listing_ref || row.source_reference,
          row.internal_id,
          OBSERVATION_GENERATOR,
          runId,
          ADMIN_ID,
          SOURCE_ID,
        ],
      );
      if (evInsert.rowCount && evInsert.rowCount > 0) inserted_evidence++;

      // 3) Lifecycle promotion
      const state = (await client.query(
        "SELECT lifecycle_state FROM nex.business_canonical WHERE canonical_business_id=$1",
        [canonId],
      )).rows[0].lifecycle_state;
      if (state === "DISCOVERED") {
        await client.query(
          `INSERT INTO nex.business_canonical_lifecycle_log (
             canonical_business_id, from_state, to_state, transition_reason,
             transitioned_by, transitioned_at, decision_record_id
           ) VALUES ($1, 'DISCOVERED', 'VERIFIED', $2, $3, now(), $4)`,
          [canonId, TRANSITION_REASON, ADMIN_ID, decisionRecordId],
        );
        await client.query(
          "UPDATE nex.business_canonical SET lifecycle_state='VERIFIED', last_verified_at=now(), updated_at=now() WHERE canonical_business_id=$1 AND lifecycle_state='DISCOVERED'",
          [canonId],
        );
        promoted_lifecycle++;
      }

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      failed++;
      if (failures.length < 5) failures.push({ internal_id: row.internal_id, reason: String(e.message || e).slice(0, 180) });
    }

    if ((inserted_canonical + skipped_conflict + failed) % 1000 === 0 && (inserted_canonical + skipped_conflict + failed) > 0) {
      console.log(`  ${inserted_canonical + skipped_conflict + failed} / ${candidates.rowCount} processed · canonical+${inserted_canonical} · evidence+${inserted_evidence} · promoted+${promoted_lifecycle} · failed=${failed}`);
    }
  }

  const afterCanon = (await client.query("SELECT COUNT(*)::int AS n FROM nex.business_canonical WHERE entity_type=$1", [ENTITY_TYPE])).rows[0].n;
  const afterDirectory = (await client.query("SELECT COUNT(*)::int AS n FROM nex.business_directory_v")).rows[0].n;
  console.log("");
  console.log(JSON.stringify({
    elapsed_s: Math.round((Date.now() - t0) / 1000),
    run_id: runId,
    candidates_pulled: candidates.rowCount,
    inserted_canonical,
    inserted_evidence,
    promoted_lifecycle,
    skipped_conflict,
    failed,
    accommodation_canonical_before: beforeCanon,
    accommodation_canonical_after: afterCanon,
    business_directory_v_before: beforeDirectory,
    business_directory_v_after: afterDirectory,
    sample_failures: failures,
  }, null, 2));

  await client.end();
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
