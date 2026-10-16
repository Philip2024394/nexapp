#!/usr/bin/env node
// scripts/nex-images/reconcile-legacy-to-business-media.mjs
//
// Founder-authorised 2026-10-13 (decision #3 · B).
//
// Reconciles the 1,635 legacy ID images from vertical tables
// (food_business / accommodation_business / service_business) and the
// polymorphic `nex.business_image` layer into the canonical
// `nex.business_media` + approval queue `nex.business_media_review`.
//
// Dry-run default · requires `--commit` for live writes.
// Hard-gated on project ijvqdvsvwtwxzcqmoqit.
//
// Reconciliation rules
//
//   1. Each candidate image gets a row in `nex.business_media_review`.
//
//   2. If a canonical_business_id can be resolved WITH HIGH CONFIDENCE
//      (≥ 0.95), ALSO insert a row into `nex.business_media` with
//      `approved = false`. The review row's `approved_media_id`
//      points at it. Admin approval later flips `approved` to true.
//
//   3. If no canonical_business_id can be resolved, OR the match
//      confidence is < 0.95, OR multiple candidates match, the review
//      row is `review_state = 'quarantined'` with
//      `candidate_canonical_business_id = NULL` (or best guess) and
//      `match_evidence` populated. NO business_media row is created.
//
//   4. The legacy columns remain untouched. This script is additive
//      only · zero DELETE / zero UPDATE on legacy tables.
//
// Match methods tried, in order (first high-confidence wins):
//
//   M1 · direct_canonical_fk · the legacy row already carries
//        canonical_business_id. Confidence 1.0.
//
//   M2 · public_listing_ref_lookup · the legacy row has
//        public_listing_ref AND business_canonical has an entry whose
//        internal_id (via food_business/accommodation_business
//        parentage) matches. Confidence 0.98.
//
//   M3 · business_image_polymorphic · business_image.business_type +
//        business_ref joins to the vertical table whose canonical fk
//        is set. Confidence 0.97.
//
//   M4 · name_and_coords_fuzzy · fuzzy name match + geographic
//        proximity. ONLY runs when confidence ≥ 0.95 can be
//        demonstrated · otherwise quarantine. (Deferred to a
//        follow-up pass · this pass does NOT attempt fuzzy matching.
//        Rows that reach M4 are quarantined with reason='fuzzy_match_deferred'.)
//
// Source mapping (legacy hero_image_source → source_registry.source_id):
//
//   walker:wikimedia_commons   → wikimedia_commons
//   walker:business_website    → business_website
//   walker:curated_owner_asset → owner_upload
//   official_website           → business_website
//
// MIME-type inference: from URL extension. If unknown, `image/unknown`
// placeholder (CHECK constraint allows any non-blank string). An
// admin-approval step would re-validate the actual mime by HEAD-probe.

import pg from "pg";

const APPROVED_PROJECT_ID = "ijvqdvsvwtwxzcqmoqit";
const CONFIDENCE_THRESHOLD = 0.95;

const SOURCE_MAP = {
  "walker:wikimedia_commons": "wikimedia_commons",
  "walker:business_website": "business_website",
  "walker:curated_owner_asset": "owner_upload",
  "walker:official_website": "business_website",
  "official_website": "business_website",
};

// Legacy source values that require admin reclassification before they
// can be treated as owner-provided. Founder decision #2 (2026-10-13):
// Quarantine, don't remap. The walker tagged these as
// `walker:curated_owner_asset` but we have no verified owner-upload
// provenance for them; the review row carries SOURCE_CLASSIFICATION_
// PENDING_NOTE so the admin cannot silently approve them as owner-
// uploaded without reconsidering the attribution.
const SOURCE_CLASSIFICATION_PENDING_LEGACY_VALUES = new Set([
  "walker:curated_owner_asset",
]);

const SOURCE_CLASSIFICATION_PENDING_NOTE =
  "SOURCE CLASSIFICATION PENDING · This image was tagged `walker:curated_owner_asset` " +
  "by the legacy walker but no verified owner-upload provenance exists. " +
  "Verify independently (owner interview · website match · claim-flow attestation) " +
  "before approving. If evidence is missing, reject or re-tag.";

function verifyTarget(url) {
  try {
    const u = new URL(url);
    const fromUser = u.username.includes(".") ? u.username.split(".")[1] : null;
    const fromHost = u.hostname.match(/^([a-z0-9]{20})\./)?.[1] ?? null;
    const id = fromUser ?? fromHost;
    if (!id) throw new Error("cannot extract project id from DATABASE_URL");
    if (id !== APPROVED_PROJECT_ID) {
      throw new Error(
        `refusing to run · DATABASE_URL points at project '${id}' · expected '${APPROVED_PROJECT_ID}'`,
      );
    }
  } catch (e) {
    throw new Error(`DATABASE_URL check failed · ${e.message}`);
  }
}

function inferMimeFromUrl(url) {
  const m = url.toLowerCase().match(/\.(jpe?g|png|webp|gif|svg|avif|bmp|tiff?)(?:$|\?)/);
  if (!m) return "image/unknown";
  const ext = m[1];
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "tif" || ext === "tiff") return "image/tiff";
  return `image/${ext}`;
}

function mapSource(legacySource) {
  if (legacySource === null || legacySource === undefined) return null;
  const key = String(legacySource).trim();
  return SOURCE_MAP[key] ?? null;
}

async function loadFoodImages(client) {
  const r = await client.query(
    `SELECT public_listing_ref,
            canonical_business_id,
            hero_image_url,
            hero_image_source,
            hero_image_provenance
       FROM nex.food_business
      WHERE country = 'ID'
        AND hero_image_url IS NOT NULL
        AND length(hero_image_url) > 0`,
  );
  return r.rows.map((row) => ({
    legacy_source_table: "food_business",
    legacy_source_ref: row.public_listing_ref,
    legacy_canonical_fk: row.canonical_business_id, // uuid or null
    url: row.hero_image_url,
    legacy_hero_image_source: row.hero_image_source,
    legacy_provenance: row.hero_image_provenance ?? {},
  }));
}

async function loadAccommodationImages(client) {
  const r = await client.query(
    `SELECT public_listing_ref,
            canonical_business_id,
            hero_image_url,
            hero_image_source,
            hero_image_provenance
       FROM nex.accommodation_business
      WHERE country = 'ID'
        AND hero_image_url IS NOT NULL
        AND length(hero_image_url) > 0`,
  );
  return r.rows.map((row) => ({
    legacy_source_table: "accommodation_business",
    legacy_source_ref: row.public_listing_ref,
    legacy_canonical_fk: row.canonical_business_id,
    url: row.hero_image_url,
    legacy_hero_image_source: row.hero_image_source,
    legacy_provenance: row.hero_image_provenance ?? {},
  }));
}

async function loadServiceImages(client) {
  // service_business has NO country column AND NO hero_image_source /
  // hero_image_provenance columns.
  const r = await client.query(
    `SELECT public_listing_ref,
            canonical_business_id,
            hero_image_url
       FROM nex.service_business
      WHERE hero_image_url IS NOT NULL
        AND length(hero_image_url) > 0`,
  );
  return r.rows.map((row) => ({
    legacy_source_table: "service_business",
    legacy_source_ref: row.public_listing_ref,
    legacy_canonical_fk: row.canonical_business_id,
    url: row.hero_image_url,
    legacy_hero_image_source: null, // column absent
    legacy_provenance: {},
  }));
}

async function loadBusinessImages(client) {
  const r = await client.query(
    `SELECT business_type,
            business_country,
            business_ref,
            image_type,
            url,
            source,
            provenance
       FROM nex.business_image
      WHERE business_country = 'ID'
        AND url IS NOT NULL
        AND length(url) > 0`,
  );
  return r.rows.map((row) => ({
    legacy_source_table: "business_image",
    legacy_source_ref: row.business_ref,
    legacy_canonical_fk: null, // polymorphic · needs join
    url: row.url,
    legacy_hero_image_source: row.source ? `walker:${row.source}` : null,
    legacy_provenance: row.provenance ?? {},
    _polymorphic_business_type: row.business_type,
  }));
}

async function resolveCanonical(client, candidate) {
  // M1 · direct FK
  if (candidate.legacy_canonical_fk) {
    return {
      canonical_business_id: candidate.legacy_canonical_fk,
      match_method: "direct_canonical_fk",
      match_confidence: 1.0,
      match_evidence: { via: "legacy_table_fk" },
    };
  }
  // M3 · business_image polymorphic · join via public_listing_ref
  if (candidate.legacy_source_table === "business_image" && candidate.legacy_source_ref) {
    const btype = candidate._polymorphic_business_type;
    const vt = btype === "food" ? "food_business"
      : btype === "accommodation" ? "accommodation_business"
      : btype === "services" ? "service_business"
      : null;
    if (vt !== null) {
      const r = await client.query(
        `SELECT canonical_business_id FROM nex.${vt} WHERE public_listing_ref = $1 LIMIT 2`,
        [candidate.legacy_source_ref],
      );
      if (r.rowCount === 1 && r.rows[0].canonical_business_id) {
        return {
          canonical_business_id: r.rows[0].canonical_business_id,
          match_method: "business_image_polymorphic",
          match_confidence: 0.97,
          match_evidence: {
            via: "public_listing_ref",
            vertical_table: vt,
            ref: candidate.legacy_source_ref,
          },
        };
      }
      if (r.rowCount > 1) {
        return {
          canonical_business_id: null,
          match_method: null,
          match_confidence: 0.5,
          match_evidence: {
            via: "public_listing_ref",
            vertical_table: vt,
            ref: candidate.legacy_source_ref,
            ambiguous: `${r.rowCount} rows match`,
          },
        };
      }
    }
    return {
      canonical_business_id: null,
      match_method: null,
      match_confidence: 0.0,
      match_evidence: {
        via: "public_listing_ref",
        reason: "no vertical row matched",
        polymorphic_type: btype,
      },
    };
  }
  // M2 · public_listing_ref_lookup · food_business has no canonical FK
  // on its own rows (confirmed by audit). Attempt to find a canonical
  // row via (name_canonical, country, city, coordinates proximity).
  // DEFERRED: fuzzy matching requires explicit review of each case to
  // avoid wrong matches. For this pass we quarantine instead.
  return {
    canonical_business_id: null,
    match_method: null,
    match_confidence: 0.0,
    match_evidence: {
      reason: "no_canonical_fk_available",
      note: "fuzzy_match_deferred_to_admin",
    },
  };
}

function pickReviewState(resolution, cand) {
  // Decision #2 (2026-10-13) · founder-sealed quarantine rule.
  // Any `walker:curated_owner_asset` legacy row is force-quarantined
  // regardless of match confidence · its source attribution must be
  // reclassified by an admin before it can enter the owner-upload path.
  if (SOURCE_CLASSIFICATION_PENDING_LEGACY_VALUES.has(cand.legacy_hero_image_source)) {
    return "quarantined";
  }
  if (resolution.canonical_business_id !== null && resolution.match_confidence >= CONFIDENCE_THRESHOLD) {
    return "pending"; // high-confidence match · admin approves or rejects
  }
  return "quarantined"; // low confidence or no match
}

async function reconcile(client, candidates, commit, stats) {
  for (const cand of candidates) {
    stats.total++;
    const resolution = await resolveCanonical(client, cand);
    const reviewState = pickReviewState(resolution, cand);
    const sourceId = mapSource(cand.legacy_hero_image_source);
    const sourceClassificationPending =
      SOURCE_CLASSIFICATION_PENDING_LEGACY_VALUES.has(cand.legacy_hero_image_source);
    if (sourceId === null) {
      stats.skipped_unknown_source++;
      if (!commit) {
        console.log(
          `  SKIP · unknown source · ${cand.legacy_source_table}:${cand.legacy_source_ref} · hero_image_source=${cand.legacy_hero_image_source}`,
        );
      }
      continue;
    }

    const mime = inferMimeFromUrl(cand.url);

    // Dedup guard · the UNIQUE partial index on business_media_review
    // (source_id, source_url, candidate_canonical_business_id) WHERE
    // review_state='pending' prevents duplicate pending rows. For
    // quarantined/approved we accept duplicates (admin may re-queue).

    if (!commit) {
      stats[reviewState]++;
      if (resolution.canonical_business_id !== null) stats.with_canonical++;
      else stats.without_canonical++;
      if (sourceClassificationPending) stats.classification_pending++;
      const marker = sourceClassificationPending
        ? "QUARANTINE·CLASS"
        : reviewState === "pending"
          ? "PENDING        "
          : "QUARANTINE     ";
      console.log(
        `  ${marker} · ` +
          `${cand.legacy_source_table.padEnd(26)} ref=${(cand.legacy_source_ref || "").padEnd(18)} ` +
          `source=${sourceId.padEnd(20)} canonical=${(resolution.canonical_business_id || "(none)").slice(0, 8)} ` +
          `conf=${resolution.match_confidence.toFixed(2)} ` +
          `method=${resolution.match_method || "none"}`,
      );
      continue;
    }

    // Commit path · atomic per candidate.
    await client.query("BEGIN");
    try {
      let mediaId = null;

      // Decision #2 (2026-10-13) · source-classification-pending rows
      // NEVER create a business_media row. They sit in the review
      // queue only, waiting for admin reclassification. The resolver's
      // owner-upload bypass therefore cannot surface them.
      if (
        resolution.canonical_business_id !== null &&
        reviewState === "pending" &&
        !sourceClassificationPending
      ) {
        // Insert into business_media (approved=false). Idempotency
        // guard: the UNIQUE (canonical, kind, source_id) index means
        // ON CONFLICT DO NOTHING is safe. We select the id either way.
        const mr = await client.query(
          `INSERT INTO nex.business_media
             (canonical_business_id, media_kind, source_id, storage_key,
              mime_type, approved, owner_approved)
           VALUES ($1, 'verified_real', $2, $3, $4, false, false)
           ON CONFLICT (canonical_business_id, media_kind, source_id)
             DO UPDATE SET updated_at = now()
           RETURNING media_id`,
          [resolution.canonical_business_id, sourceId, cand.url, mime],
        );
        mediaId = mr.rows[0]?.media_id ?? null;
      }

      // For source-classification-pending rows, overwrite match_evidence
      // with the explicit ambiguity marker; set confidence=0 so the
      // admin UI shows "needs review" rather than a stale fuzzy score.
      const effectiveMatchEvidence = sourceClassificationPending
        ? {
            reason: "walker_curated_asset_classification_pending",
            original_hero_image_source: cand.legacy_hero_image_source,
            canonical_fk_present: resolution.canonical_business_id !== null,
            original_match_method: resolution.match_method,
            original_match_confidence: resolution.match_confidence,
          }
        : resolution.match_evidence;
      const effectiveMatchConfidence = sourceClassificationPending
        ? 0
        : resolution.match_confidence;
      const effectiveMatchMethod = sourceClassificationPending
        ? null
        : resolution.match_method;
      const reviewNotes = sourceClassificationPending
        ? SOURCE_CLASSIFICATION_PENDING_NOTE
        : null;

      // Always insert the review row. Idempotency key: for legacy
      // reconciliation, (legacy_source_table, legacy_source_ref) is
      // the "input identity" · same legacy row → same review row.
      // The unique index uq_bmr_legacy_origin enforces this. ON CONFLICT
      // DO UPDATE refreshes the dynamic fields (source_url can change
      // if a legacy walker re-ran; match_* can change if admin tooling
      // runs again with better matching).
      await client.query(
        `INSERT INTO nex.business_media_review
           (candidate_canonical_business_id, source_id, source_url,
            mime_type, legacy_source_table, legacy_source_ref,
            legacy_hero_image_source, legacy_provenance,
            match_confidence, match_method, match_evidence,
            review_state, approved_media_id, review_notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11::jsonb, $12, $13, $14)
         ON CONFLICT (legacy_source_table, legacy_source_ref)
           WHERE legacy_source_table IS NOT NULL AND legacy_source_ref IS NOT NULL
         DO UPDATE SET
           source_url = EXCLUDED.source_url,
           mime_type = EXCLUDED.mime_type,
           candidate_canonical_business_id = COALESCE(EXCLUDED.candidate_canonical_business_id, nex.business_media_review.candidate_canonical_business_id),
           match_confidence = EXCLUDED.match_confidence,
           match_method = EXCLUDED.match_method,
           match_evidence = EXCLUDED.match_evidence,
           approved_media_id = COALESCE(EXCLUDED.approved_media_id, nex.business_media_review.approved_media_id),
           review_notes = COALESCE(EXCLUDED.review_notes, nex.business_media_review.review_notes),
           updated_at = now()
         WHERE
           -- Guard: never clobber a row that has already been reviewed.
           nex.business_media_review.review_state = 'pending'
           OR nex.business_media_review.review_state = 'quarantined'`,
        [
          resolution.canonical_business_id,
          sourceId,
          cand.url,
          mime,
          cand.legacy_source_table,
          cand.legacy_source_ref,
          cand.legacy_hero_image_source,
          JSON.stringify(cand.legacy_provenance),
          effectiveMatchConfidence,
          effectiveMatchMethod,
          JSON.stringify(effectiveMatchEvidence),
          reviewState,
          mediaId,
          reviewNotes,
        ],
      );

      await client.query("COMMIT");
      stats[reviewState]++;
      if (resolution.canonical_business_id !== null) stats.with_canonical++;
      else stats.without_canonical++;
      console.log(
        `  ✓ ${reviewState.padEnd(12)} · ${cand.legacy_source_table}:${cand.legacy_source_ref} → canonical=${(resolution.canonical_business_id || "(quarantined)").slice(0, 8)} media_id=${mediaId ? mediaId.slice(0, 8) : "-"}`,
      );
    } catch (err) {
      await client.query("ROLLBACK");
      stats.errors++;
      console.error(`  ✗ ERROR · ${cand.legacy_source_table}:${cand.legacy_source_ref} · ${err.message.slice(0, 160)}`);
    }
  }
}

async function main() {
  const commit = process.argv.includes("--commit");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL unset");
  verifyTarget(url);

  console.log(`\n=== legacy → business_media reconciliation ===`);
  console.log(`mode: ${commit ? "LIVE (--commit)" : "DRY-RUN (default)"}`);
  console.log(`project: ${APPROVED_PROJECT_ID} (verified)\n`);

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  // Note: service_business.hero_image_url is REDUNDANT with
  // business_image.business_type='services' · the 59 rows in each
  // table are the same images. We read business_image instead because
  // it preserves the source attribution (service_business has no
  // hero_image_source column).
  const [food, accommodation, biPoly] = await Promise.all([
    loadFoodImages(client),
    loadAccommodationImages(client),
    loadBusinessImages(client),
  ]);
  const services = []; // intentionally empty · see note above

  console.log(`candidates loaded:`);
  console.log(`  food_business (ID):          ${food.length}`);
  console.log(`  accommodation_business (ID): ${accommodation.length}`);
  console.log(`  service_business:            SKIPPED (redundant with business_image polymorphic)`);
  console.log(`  business_image (ID):         ${biPoly.length}`);
  console.log(`  TOTAL:                       ${food.length + accommodation.length + biPoly.length}\n`);

  const stats = {
    total: 0,
    pending: 0,
    quarantined: 0,
    classification_pending: 0, // subset of quarantined · walker:curated_owner_asset
    with_canonical: 0,
    without_canonical: 0,
    skipped_unknown_source: 0,
    errors: 0,
  };

  for (const [label, batch] of [
    ["food_business", food],
    ["accommodation_business", accommodation],
    ["service_business", services],
    ["business_image", biPoly],
  ]) {
    console.log(`--- ${label} ---`);
    await reconcile(client, batch, commit, stats);
  }

  console.log(`\n=== summary ===`);
  console.log(JSON.stringify(stats, null, 2));
  console.log(`\ndirect-canonical matches (would create business_media rows): ${stats.with_canonical}`);
  console.log(`quarantined (admin review needed): ${stats.quarantined}`);
  console.log(`skipped due to unknown source: ${stats.skipped_unknown_source}`);

  if (!commit) {
    console.log(`\n=== DRY-RUN complete · nothing written ===`);
    console.log(`to execute: node --env-file=.env.local scripts/nex-images/reconcile-legacy-to-business-media.mjs --commit`);
  } else {
    console.log(`\n=== LIVE WRITE complete ===`);
    const bm = await client.query(`SELECT count(*) AS n FROM nex.business_media`);
    const bmr = await client.query(`SELECT count(*) AS n FROM nex.business_media_review`);
    console.log(`  business_media rows now: ${bm.rows[0].n}`);
    console.log(`  business_media_review rows now: ${bmr.rows[0].n}`);
  }

  await client.end();
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
