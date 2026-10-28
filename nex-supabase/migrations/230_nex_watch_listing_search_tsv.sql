-- ============================================================================
-- NEX-native Migration 230 · nex_watch_listing · search_tsv + GIN
-- NEX Watches v1 · real text search in v1 · 2026-10-26
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Must not be applied to the sealed production project
-- `ijvqdvsvwtwxzcqmoqit` without explicit owner approval.
--
-- Purpose (owner-approved P0 · 2026-10-26 · "real text search in v1")
-- ----------------------------------------------------------------------------
-- Adds a generated `search_tsv` column + GIN index to
-- `nex_watch_listing` so the v1 search surface can run
-- `websearch_to_tsquery` queries against brand / model / reference /
-- description / type / movement / dial_color without a sequential
-- scan.
--
-- `GENERATED ALWAYS AS ... STORED` auto-maintains the column on
-- every INSERT / UPDATE · no trigger required. The weights are:
--
--   · 'A' · brand, model_name            · strongest match
--   · 'B' · reference_number              · exact-id search
--   · 'C' · description                   · free-text match (english)
--   · 'D' · watch_type, movement, dial_color · facet-ish fallback
--
-- Config choice (simple vs english) per field
-- ----------------------------------------------------------------------------
--   · brand / model_name / reference_number / watch_type / movement /
--     dial_color use the `simple` config: these are brand terms and
--     short facets · stemming can harm precision ("rolex" should not
--     stem to "role"-prefixed matches, "sub" should not partial-match
--     "submarine").
--   · description uses `english` so free-text sentences stem
--     normally and stopwords are dropped.
--
-- Fallback at the search surface
-- ----------------------------------------------------------------------------
-- The v1 search service layer still accepts a bare `ILIKE` fallback
-- for queries containing non-tokenisable characters (short numeric
-- reference numbers, etc.). The GIN index is the hot path for the
-- common case.
--
-- Zero schema change to existing columns
-- ----------------------------------------------------------------------------
-- Pure additive · one new column + one new index. No existing column
-- is modified. Safe to apply on a table that already has rows.
--
-- Dependencies
-- ----------------------------------------------------------------------------
--   PREREQUISITE:
--     227 · nex_watch_listing
--
-- Rollback
-- ----------------------------------------------------------------------------
--   BEGIN;
--     DROP INDEX IF EXISTS idx_nex_watch_listing_search_tsv;
--     ALTER TABLE nex_watch_listing DROP COLUMN IF EXISTS search_tsv;
--     DELETE FROM nex_migration_history WHERE version = '230';
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_watch_listing
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple',  coalesce(brand, '')),            'A') ||
    setweight(to_tsvector('simple',  coalesce(model_name, '')),       'A') ||
    setweight(to_tsvector('simple',  coalesce(reference_number, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')),      'C') ||
    setweight(to_tsvector('simple',  coalesce(watch_type, '')),       'D') ||
    setweight(to_tsvector('simple',  coalesce(movement, '')),         'D') ||
    setweight(to_tsvector('simple',  coalesce(dial_color, '')),       'D')
  ) STORED;

COMMENT ON COLUMN nex_watch_listing.search_tsv IS
  'Generated full-text search vector · auto-maintained on write · weights A (brand/model) > B (reference) > C (description/english) > D (facets). Consumer: websearch_to_tsquery via watch-listing-service.ts.';

CREATE INDEX IF NOT EXISTS idx_nex_watch_listing_search_tsv
  ON nex_watch_listing USING GIN (search_tsv);

COMMIT;
