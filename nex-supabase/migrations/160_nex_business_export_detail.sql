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

-- 2026-10-31 · dropped the per-element ISO shape-validation CHECK.
-- Postgres disallows subqueries in CHECK constraints (NOT EXISTS over
-- unnest(array) is a subquery). The intent — every entry is an ISO
-- 3166-1 alpha-2 uppercase code — is already enforced in the
-- application write path (nex-business services validate country
-- codes on INSERT/UPDATE). The column-level cap `array_length(..) <= 60`
-- above is a plain scalar CHECK and still applies. If future DB-side
-- enforcement is wanted, it should be added via a BEFORE INSERT/UPDATE
-- trigger (allowed to use subqueries) or an IMMUTABLE SQL function —
-- not a bare CHECK with a subquery.

COMMENT ON COLUMN public.nex_business.exports_to_countries IS
  'ISO 3166-1 alpha-2 country codes this business ships to internationally. '
  'Empty array = no declared exports. Max 60 entries. Added 2026-10-13 '
  'by migration 160 for NEX Discover export-detail chips.';

COMMIT;
