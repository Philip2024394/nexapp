-- 188_nex_business_media_backfill_ddl.sql
--
-- DECLARATIVE BACKFILL · 2026-10-13
--
-- `nex.business_media` already exists in production (Supabase project
-- ijvqdvsvwtwxzcqmoqit · 0 rows at the time of this migration). The
-- table was applied directly without a corresponding migration file,
-- so this migration serves ONLY as the on-repo source of truth for its
-- schema. It is 100% idempotent · every statement uses `IF NOT EXISTS`
-- or `DO $$ ... IF NOT EXISTS ... $$` guards so that re-applying it
-- against production is a no-op.
--
-- Scope · founder-authorised 2026-10-13
--   · Decision #3 (B): the 1,635 legacy images on vertical tables and
--     the 660 rows on `nex.business_image` must be preserved and
--     copied into `nex.business_media`. This migration provides the
--     DDL truth source; the reconciliation itself happens in
--     scripts/nex-images/reconcile-legacy-to-business-media.mjs after
--     separate authorisation.
--   · Decision #4: the Directory read path will fetch from
--     `nex.business_media` once approved rows exist; see
--     src/lib/nex-native/directory/media-resolver.ts.
--
-- What this migration is NOT
--   · Not a schema change. If the live table drifts from this spec,
--     the migration will NOT force reconciliation — instead the
--     dry-run harness in scripts/audit-harvest-schema.mjs flags
--     drift and the operator decides the next step.
--   · Not a data write. Zero INSERT/UPDATE/DELETE. Only CREATE IF NOT
--     EXISTS.

BEGIN;

CREATE SCHEMA IF NOT EXISTS nex;

CREATE TABLE IF NOT EXISTS nex.business_media (
  media_id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_business_id uuid        NOT NULL
    REFERENCES nex.business_canonical(canonical_business_id) ON DELETE CASCADE,
  -- Universal image doctrine (ADR-0022) · one of four kinds.
  media_kind            text        NOT NULL
    CHECK (media_kind IN ('owner_image','verified_real','crowdsourced','category_fallback')),
  -- FK into source_registry · the governance layer that holds
  -- can_display / can_derive / can_redistribute / attribution_required /
  -- attribution_template. The read path joins through this FK.
  source_id             text        NOT NULL
    REFERENCES nex.source_registry(source_id) ON DELETE RESTRICT,
  -- Opaque pointer. May be a bucket-relative path in nex-media OR a
  -- full http(s) URL (hotlink · temporary until download/rehost).
  -- The resolver detects the shape and builds the public URL.
  storage_key           text        NOT NULL CHECK (length(trim(storage_key)) > 0),
  mime_type             text        NOT NULL CHECK (length(trim(mime_type)) > 0),
  width_px              integer     CHECK (width_px IS NULL OR width_px > 0),
  height_px             integer     CHECK (height_px IS NULL OR height_px > 0),
  content_sha256        text        CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[a-f0-9]{64}$'),
  -- Match confidence for verified_real · 0..1. Null for other kinds.
  confidence            numeric     CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  -- Only populated when media_kind = 'category_fallback'; enforced by
  -- a consistency check.
  fallback_category     text,
  -- Two approval axes:
  --   owner_approved: the business owner has blessed this image.
  --   approved: NEX admin has blessed this image for display.
  -- The read path requires `approved = true` AND source_registry
  -- `can_display = true`. owner_approved can grant the display gate
  -- for sources that trust the owner path (future wave; today the
  -- resolver only reads `approved`).
  owner_approved        boolean     NOT NULL DEFAULT false,
  approved              boolean     NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_bm_fallback_category_consistency
    CHECK (
      (media_kind = 'category_fallback' AND fallback_category IS NOT NULL)
      OR (media_kind <> 'category_fallback' AND fallback_category IS NULL)
    )
);

-- One row per (business, kind, source). A business can hold one owner
-- image AND one verified_real from Wikimedia Commons AND one
-- verified_real from the business website · they are distinct rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bm_canonical_kind_source
  ON nex.business_media (canonical_business_id, media_kind, source_id);

-- Hot path · the Directory read query fetches by canonical id and
-- orders by media_kind precedence. PARTIAL on `approved = true` so
-- the hot resolver path only scans display-eligible rows.
CREATE INDEX IF NOT EXISTS idx_bm_canonical_kind
  ON nex.business_media (canonical_business_id, media_kind) WHERE approved = true;

-- Secondary lookups.
CREATE INDEX IF NOT EXISTS idx_bm_source
  ON nex.business_media (source_id);

CREATE INDEX IF NOT EXISTS idx_bm_content_sha256
  ON nex.business_media (content_sha256) WHERE content_sha256 IS NOT NULL;

-- Admin dashboard · newest pending-approval rows first.
CREATE INDEX IF NOT EXISTS idx_bm_pending_approval
  ON nex.business_media (created_at DESC) WHERE approved = false;

-- Documentation COMMENT only · no behavioural change.
COMMENT ON TABLE nex.business_media IS
  'Canonical per-business media. Sealed by migration 173 (schema) and backfilled on-repo by migration 188 (2026-10-13).';

COMMIT;
