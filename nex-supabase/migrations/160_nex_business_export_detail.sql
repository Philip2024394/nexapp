-- Migration 160 · nex_business export detail
-- -------------------------------------------
-- Adds two columns so product sellers can declare the destinations
-- they export to and (reuse existing) their minimum order quantity.
-- Consumed by NEX Discover's chip row to render:
--
--   · "🌍 Ships to 12 countries" when exports_to_countries ≠ []
--   · "📦 MOQ 10" when min_order_quantity > 0 (already-existing col ·
--     this migration does NOT alter it, just documents the usage)
--
-- Why: current `🌍 Exports` chip is yes/no. International buyers want
-- *where* and *how much* before tapping Chat with owner (see audit
-- 2026-10-13). Honest-null: when exports_to_countries is empty, no
-- chip renders.
--
-- Status: DRAFT · founder authorisation required before applying to
-- `ijvqdvsvwtwxzcqmoqit`. Safe: additive, no backfill, no downtime.
--
-- Author: NEX Discover build, 2026-10-13
--
BEGIN;

ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS exports_to_countries text[]
    NOT NULL DEFAULT ARRAY[]::text[]
    CHECK (array_length(exports_to_countries, 1) IS NULL
           OR array_length(exports_to_countries, 1) <= 60);

-- Each entry MUST be an ISO 3166-1 alpha-2 code (uppercase 2 letters).
ALTER TABLE public.nex_business
  ADD CONSTRAINT nex_business_exports_to_countries_iso_shape
  CHECK (
    exports_to_countries = ARRAY[]::text[]
    OR NOT EXISTS (
      SELECT 1 FROM unnest(exports_to_countries) AS c
      WHERE c IS NULL OR c !~ '^[A-Z]{2}$'
    )
  );

COMMENT ON COLUMN public.nex_business.exports_to_countries IS
  'ISO 3166-1 alpha-2 country codes this business ships to internationally. '
  'Empty array = no declared exports. Max 60 entries. Added 2026-10-13 '
  'by migration 160 for NEX Discover export-detail chips.';

COMMIT;
