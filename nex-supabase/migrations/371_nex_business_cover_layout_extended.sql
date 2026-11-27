-- ============================================================================
-- NEX-native Migration 371 · extend nex_business_cover_layout_known
-- ============================================================================
-- Owner directive 2026-11-27: X-Rated Tool Belts shop page must render the
-- landscape product-card layout. The TS layout switch
-- (src/app/nex-native/cover/layout-ids.ts + layout-switch.tsx) already
-- supports `product_landscape`, `product_round`, `product_landscape_round`,
-- `cafe_landscape`, `cafe_round`, `personal_brand_landscape`,
-- `personal_brand_round`, and `accommodation`, but the DB CHECK constraint
-- `nex_business_cover_layout_known` was last updated pre-2026-09-30 and
-- predates those variants. Writing any of them to nex_business.cover_layout_id
-- currently fails with:
--   new row for relation "nex_business" violates check constraint
--   "nex_business_cover_layout_known"
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE
-- Application to sandbox (kdstoyyeygcopkogqsyv) requires the named approval
-- phrase: APPROVE MIG 371 SANDBOX APPLY. Production application
-- (ijvqdvsvwtwxzcqmoqit) is sealed per CLAUDE.md Rule 7 · requires separate
-- owner approval.
--
-- Scope
-- -----
-- Drops and recreates the CHECK constraint with the full TS enum set so DB
-- writes match COVER_LAYOUT_IDS. No row backfill required (all existing rows
-- already satisfy the expanded set).
--
-- Rollback
-- --------
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '371';
--     ALTER TABLE nex_business
--       DROP CONSTRAINT IF EXISTS nex_business_cover_layout_known;
--     ALTER TABLE nex_business
--       ADD CONSTRAINT nex_business_cover_layout_known CHECK (
--         cover_layout_id IS NULL OR cover_layout_id IN (
--           'restaurant','cafe','product','tradesperson','salon',
--           'creator','fashion','street_food','premium_business',
--           'personal_brand'
--         )
--       );
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  DROP CONSTRAINT IF EXISTS nex_business_cover_layout_known;

ALTER TABLE nex_business
  ADD CONSTRAINT nex_business_cover_layout_known CHECK (
    cover_layout_id IS NULL
    OR cover_layout_id IN (
      -- Pre-existing allowed set (preserved)
      'restaurant',
      'cafe',
      'product',
      'tradesperson',
      'salon',
      'creator',
      'fashion',
      'street_food',
      'premium_business',
      'personal_brand',
      -- 2026-11-27 extension · mirrors COVER_LAYOUT_IDS in
      -- src/app/nex-native/cover/layout-ids.ts
      'cafe_landscape',
      'cafe_round',
      'product_landscape',
      'product_round',
      'product_landscape_round',
      'personal_brand_landscape',
      'personal_brand_round',
      'accommodation',
      -- 2026-11-28 extension · Template 15 · landscape product cards
      -- with a vertical shop-brand strip on the LEFT edge of each row.
      -- Mirrors new entry in COVER_LAYOUT_IDS.
      'product_hero_landscape'
    )
  );

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '371',
    'extend nex_business_cover_layout_known · align DB CHECK with TS COVER_LAYOUT_IDS',
    'Cycle-8 owner directive 2026-11-27 · unblocks landscape / round / accommodation cover layouts · no row backfill required · pre-existing values preserved.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'nex_business_cover_layout_known';
--   -- expect 19 allowed values + NULL
--
--   SELECT version FROM nex_migration_history WHERE version = '371';
--   -- expect 1 row
-- ============================================================================
