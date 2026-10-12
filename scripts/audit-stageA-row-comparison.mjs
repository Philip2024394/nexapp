#!/usr/bin/env node
// scripts/audit-stageA-row-comparison.mjs
//
// Stage A · row-level comparison of nex.business_canonical vs
// nex.business_directory_v · READ-ONLY.
//
// Deliverables requested by owner on 2026-10-13:
//   · Confirm the 197-row gap between canonical and directory_v is
//     EXACTLY the orphan set from Stage 0.
//   · Cross-reference the saved JSON dump (orphans-2026-10-13.json)
//     against the live DB so the dump still represents reality.
//   · Produce row-level set diffs so no silent drift is possible.
//
// Zero writes. Zero migrations. Face-cover untouched.

import pg from "pg";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

const APPROVED_PROJECT_ID = "ijvqdvsvwtwxzcqmoqit";

function verifyTarget(url) {
  const u = new URL(url.replace(/^postgres(ql)?:\/\//, "http://"));
  const m = /^postgres\.([a-z0-9]+)$/.exec(u.username);
  if (!m || m[1] !== APPROVED_PROJECT_ID) {
    throw new Error(`REFUSED · pooler user is not sealed project '${APPROVED_PROJECT_ID}'`);
  }
}

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL unset");
  verifyTarget(url);
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  console.log("Stage A · row-level comparison + orphan provenance");
  console.log("run_timestamp: " + new Date().toISOString());
  console.log("project:       " + APPROVED_PROJECT_ID);
  console.log("");

  // ── 1 · Pull both id sets straight from the DB ──
  const canonical = await client.query(
    "SELECT canonical_business_id FROM nex.business_canonical ORDER BY canonical_business_id",
  );
  const directoryV = await client.query(
    "SELECT canonical_business_id FROM nex.business_directory_v ORDER BY canonical_business_id",
  );
  const canonicalIds = new Set(canonical.rows.map((r) => r.canonical_business_id));
  const directoryIds = new Set(directoryV.rows.map((r) => r.canonical_business_id));

  console.log(`canonical rows:      ${canonicalIds.size}`);
  console.log(`directory_v rows:    ${directoryIds.size}`);
  console.log(`gap (canonical − v): ${canonicalIds.size - directoryIds.size}`);

  // ── 2 · Compute strict set differences ──
  const inCanonicalNotInView = [...canonicalIds].filter((id) => !directoryIds.has(id));
  const inViewNotInCanonical = [...directoryIds].filter((id) => !canonicalIds.has(id));

  console.log("");
  console.log(`in canonical ∩ ¬view:   ${inCanonicalNotInView.length}  ← the orphan set`);
  console.log(`in view      ∩ ¬canon:  ${inViewNotInCanonical.length}  ← should be 0 (FK integrity)`);

  if (inViewNotInCanonical.length !== 0) {
    console.log("UNEXPECTED · directory_v has rows that are not in business_canonical:");
    console.log(inViewNotInCanonical.slice(0, 10));
  }

  // ── 3 · Reclassify "the gap" from Stage 0 ──
  // Fetch which of the gap ids are missing evidence vs filtered for
  // some other reason (lifecycle_state, superseded_by, source
  // can_display=FALSE).
  const gapIdsParam = inCanonicalNotInView;
  const gapDetails = await client.query(
    `
    SELECT bc.canonical_business_id,
           bc.lifecycle_state,
           bc.superseded_by_business_id IS NOT NULL AS is_superseded,
           EXISTS (
             SELECT 1 FROM nex.business_evidence be
              WHERE be.canonical_business_id = bc.canonical_business_id
           ) AS has_any_evidence,
           EXISTS (
             SELECT 1 FROM nex.business_evidence be
              JOIN nex.source_registry sr ON sr.source_id = be.source_id
              WHERE be.canonical_business_id = bc.canonical_business_id
                AND sr.can_display = true
           ) AS has_can_display_evidence
      FROM nex.business_canonical bc
     WHERE bc.canonical_business_id = ANY($1::uuid[])
    `,
    [gapIdsParam],
  );

  let noEvidence = 0;
  let evidenceButNoCanDisplay = 0;
  let supersededCount = 0;
  let unverifiedState = 0;
  for (const r of gapDetails.rows) {
    if (!r.has_any_evidence) noEvidence++;
    else if (!r.has_can_display_evidence) evidenceButNoCanDisplay++;
    if (r.is_superseded) supersededCount++;
    if (r.lifecycle_state !== "VERIFIED" && r.lifecycle_state !== "OWNER_CLAIMED" && r.lifecycle_state !== "OWNER_VERIFIED") unverifiedState++;
  }
  console.log("");
  console.log("Gap-row classification (orthogonal · a row can fail multiple gates):");
  console.log(`  no evidence row at all (true orphans):              ${noEvidence}`);
  console.log(`  has evidence but no can_display=TRUE source:        ${evidenceButNoCanDisplay}`);
  console.log(`  superseded_by_business_id NOT NULL:                 ${supersededCount}`);
  console.log(`  lifecycle_state not in VERIFIED/OWNER_CLAIMED/OWNER_VERIFIED: ${unverifiedState}`);

  // ── 4 · Compare against the Stage 0 saved JSON dump ──
  const stage0DumpPath = "logs/stage0-evidence/orphans-2026-10-13.json";
  const stage0Dump = JSON.parse(readFileSync(stage0DumpPath, "utf8"));
  const dumpIds = new Set(stage0Dump.map((r) => r.canonical_business_id));

  const dumpVsCanonical = {
    in_dump_still_in_canonical: 0,
    in_dump_gone_from_canonical: [],
    in_dump_still_orphaned: 0,
    in_dump_now_has_evidence: [],
    new_orphans_since_dump: [],
  };
  // Build the orphan set from the current DB
  const currentOrphanIds = new Set(
    gapDetails.rows.filter((r) => !r.has_any_evidence).map((r) => r.canonical_business_id),
  );

  for (const id of dumpIds) {
    if (canonicalIds.has(id)) dumpVsCanonical.in_dump_still_in_canonical++;
    else dumpVsCanonical.in_dump_gone_from_canonical.push(id);

    if (currentOrphanIds.has(id)) dumpVsCanonical.in_dump_still_orphaned++;
    else if (canonicalIds.has(id)) dumpVsCanonical.in_dump_now_has_evidence.push(id);
  }
  for (const id of currentOrphanIds) {
    if (!dumpIds.has(id)) dumpVsCanonical.new_orphans_since_dump.push(id);
  }

  console.log("");
  console.log("Dump vs current DB (Stage 0 dump has " + stage0Dump.length + " rows):");
  console.log("  still in canonical table:          " + dumpVsCanonical.in_dump_still_in_canonical);
  console.log("  gone from canonical (deleted):     " + dumpVsCanonical.in_dump_gone_from_canonical.length);
  console.log("  still orphaned (no evidence):      " + dumpVsCanonical.in_dump_still_orphaned);
  console.log("  now has evidence (repaired):       " + dumpVsCanonical.in_dump_now_has_evidence.length);
  console.log("  NEW orphans since dump:            " + dumpVsCanonical.new_orphans_since_dump.length);

  // ── 5 · Fingerprint re-check against Stage 0 ──
  const currentOrphanFingerprint = sha256(
    [...currentOrphanIds].sort().join(","),
  );
  const stage0Fingerprint = JSON.parse(
    readFileSync("logs/stage0-evidence/baseline-2026-10-13.json", "utf8"),
  ).orphan_ids_fingerprint;
  console.log("");
  console.log("Orphan-set fingerprint:");
  console.log("  Stage 0 (saved):  " + stage0Fingerprint);
  console.log("  Stage A (live):   " + currentOrphanFingerprint);
  console.log("  match:            " + (currentOrphanFingerprint === stage0Fingerprint));

  // ── 6 · Provenance correlation sketch ──
  // The hypothesis is: the 197 orphans are rows copied from nex_dev
  // by scripts/supabase-backfill-directory-canonical.mjs where
  // business_evidence copy skipped on ON CONFLICT (candidate_id)
  // collisions. We can't query nex_dev from here (that would require
  // NEX_POSTGRES_URL which is a localhost-only cred), but we CAN:
  //   · check if the orphan canonical_business_ids match the SAME ids
  //     in nex_dev
  //   · correlate their created_at timestamps with the backfill run
  //     window
  console.log("");
  console.log("Provenance sketch (created_at distribution of orphans):");
  const buckets = new Map();
  for (const row of stage0Dump) {
    const date = row.created_at.slice(0, 10);
    buckets.set(date, (buckets.get(date) ?? 0) + 1);
  }
  for (const [d, n] of [...buckets].sort()) {
    console.log(`  ${d}  ${n}`);
  }

  // ── 7 · Persist the comparison dump ──
  mkdirSync("logs/stage-ab-prep", { recursive: true });
  const outPath = "logs/stage-ab-prep/stageA-row-comparison-2026-10-13.json";
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        run_timestamp: new Date().toISOString(),
        project_id: APPROVED_PROJECT_ID,
        canonical_count: canonicalIds.size,
        directory_v_count: directoryIds.size,
        gap_count: canonicalIds.size - directoryIds.size,
        gap_classification: {
          no_evidence: noEvidence,
          evidence_but_no_can_display: evidenceButNoCanDisplay,
          superseded: supersededCount,
          unverified_state: unverifiedState,
        },
        in_view_not_in_canonical: inViewNotInCanonical,
        dump_vs_current: dumpVsCanonical,
        orphan_fingerprint_stage0: stage0Fingerprint,
        orphan_fingerprint_stageA: currentOrphanFingerprint,
        orphan_fingerprint_match: currentOrphanFingerprint === stage0Fingerprint,
        orphan_creation_distribution: Object.fromEntries(buckets),
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log("\n→ full row-comparison report written to " + outPath);

  await client.end();
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
