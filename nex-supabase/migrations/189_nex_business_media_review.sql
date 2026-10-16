-- 189_nex_business_media_review.sql
--
-- NEW TABLE · 2026-10-13
--
-- The approval queue for business media. Every image proposed by a
-- harvest agent, imported from a legacy source, or submitted by any
-- non-owner path lands here FIRST. An admin reviews each row and
-- either approves (triggering an insert/update on business_media with
-- `approved = true`) or rejects/quarantines it.
--
-- Design principles (founder decision #2 · 2026-10-13):
--   · can_display stays FALSE on wikimedia_commons / business_website /
--     osm_overpass / wikidata / owner_upload. Rows discovered against
--     those sources land here in `pending` state.
--   · Owner-uploaded images sent through the already-approved
--     owner-upload path can bypass this queue (future work · owner
--     upload UI is sealed on its own gates).
--   · Ambiguous matches (confidence < threshold, or multiple canonical
--     candidates) land in `quarantined` state with the evidence
--     recorded in match_evidence. They are NOT auto-approved.
--   · A single business CAN have multiple pending candidates from
--     different sources · the review decision chooses which (if any)
--     become the business_media.verified_real row.
--
-- Scope boundaries:
--   · This table is written by harvest executors and the reconciliation
--     script. It is NOT exposed to end users.
--   · The admin dashboard (/nex-native/admin/image-review) reads
--     this table and writes decisions via server actions · same auth
--     model as the existing /admin/tier page.

BEGIN;

CREATE SCHEMA IF NOT EXISTS nex;

CREATE TABLE IF NOT EXISTS nex.business_media_review (
  review_id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Target canonical business id. NULLABLE because quarantined
  -- (ambiguous) candidates may not yet be matched to a specific row.
  candidate_canonical_business_id  uuid        REFERENCES nex.business_canonical(canonical_business_id) ON DELETE SET NULL,
  -- Source registry FK · governs whether this image can ever display
  -- (can_display) and whether attribution is required.
  source_id                        text        NOT NULL
    REFERENCES nex.source_registry(source_id) ON DELETE RESTRICT,
  -- The URL the agent/importer proposes. May become the storage_key
  -- on business_media verbatim (hotlink) or be downloaded first.
  source_url                       text        NOT NULL CHECK (length(trim(source_url)) > 0),
  -- Candidate-stage media metadata · may be null until the image is
  -- fetched and probed.
  mime_type                        text,
  width_px                         integer     CHECK (width_px IS NULL OR width_px > 0),
  height_px                        integer     CHECK (height_px IS NULL OR height_px > 0),
  content_sha256                   text        CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[a-f0-9]{64}$'),
  -- Legacy provenance (the reconciliation script fills these so the
  -- origin of a legacy row is never lost).
  legacy_source_table              text,
  legacy_source_ref                text,
  legacy_hero_image_source         text,
  legacy_provenance                jsonb       NOT NULL DEFAULT '{}'::jsonb,
  -- Matching evidence.
  match_confidence                 numeric     CHECK (match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 1)),
  match_method                     text        CHECK (match_method IS NULL OR match_method IN (
    'direct_canonical_fk',
    'public_listing_ref_lookup',
    'business_image_polymorphic',
    'name_and_coords_fuzzy',
    'operator_manual'
  )),
  match_evidence                   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  -- Review state machine.
  review_state                     text        NOT NULL DEFAULT 'pending'
    CHECK (review_state IN ('pending','approved','rejected','quarantined','merged')),
  reviewed_by                      text,
  reviewed_at                      timestamptz,
  review_notes                     text,
  -- When review_state = 'approved' AND an insert into business_media
  -- succeeds, this is set to the resulting media_id. The business_media
  -- row then has approved = true and the resolver renders it.
  approved_media_id                uuid        REFERENCES nex.business_media(media_id) ON DELETE SET NULL,
  created_at                       timestamptz NOT NULL DEFAULT now(),
  updated_at                       timestamptz NOT NULL DEFAULT now()
);

-- Admin dashboard loads pending first, then quarantined.
CREATE INDEX IF NOT EXISTS idx_bmr_review_state
  ON nex.business_media_review (review_state, created_at DESC);

-- Lookup by candidate business.
CREATE INDEX IF NOT EXISTS idx_bmr_candidate
  ON nex.business_media_review (candidate_canonical_business_id)
  WHERE candidate_canonical_business_id IS NOT NULL;

-- Deduplication guard A · legacy-reconciliation idempotency.
-- Every row from the legacy reconciliation script carries non-null
-- legacy_source_table + legacy_source_ref. A UNIQUE on that pair makes
-- repeated reconciliation runs idempotent (same legacy row → same
-- review row forever · ON CONFLICT DO UPDATE refreshes source_url /
-- mime_type if they change). Partial on legacy_source_ref IS NOT NULL
-- so the harvest path (which has null legacy_*) is unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bmr_legacy_origin
  ON nex.business_media_review (legacy_source_table, legacy_source_ref)
  WHERE legacy_source_table IS NOT NULL AND legacy_source_ref IS NOT NULL;

-- Deduplication guard B · harvest-origin pending dedup.
-- When a harvest executor proposes an image (legacy_* null, candidate
-- set), the same (source, url, candidate) triple in pending state is
-- a duplicate submission · DO NOTHING on conflict.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bmr_pending_harvest_origin
  ON nex.business_media_review (source_id, source_url, candidate_canonical_business_id)
  WHERE legacy_source_table IS NULL
    AND candidate_canonical_business_id IS NOT NULL
    AND review_state = 'pending';

-- Secondary lookup · reconciliation script joins back to legacy for audit.
CREATE INDEX IF NOT EXISTS idx_bmr_legacy
  ON nex.business_media_review (legacy_source_table, legacy_source_ref)
  WHERE legacy_source_table IS NOT NULL;

COMMENT ON TABLE nex.business_media_review IS
  'Approval queue for business images. Every non-owner-upload path writes here first. See docs/doctrine/image-approval-rules.md (migration 189 · 2026-10-13).';

COMMIT;
