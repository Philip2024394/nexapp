-- 342_nex_theme_ownership_first_free_acquired_via.sql
-- -----------------------------------------------------------------------------
-- NEX Themes+ · extend `nex_theme_ownership.acquired_via` CHECK list
-- so first-free perk grants can land. Owner-sealed 2026-11-13 Phase A
-- (UI + service wiring); this migration is DRAFTED ONLY and requires
-- separate explicit sandbox authorisation before apply.
-- -----------------------------------------------------------------------------
-- Problem · the existing constraint restricts `acquired_via` to:
--   bespoke | direct_purchase | grant
-- The first-paid-theme-free perk (sealed 2026-11-13, restating
-- 2026-11-11) writes a row with `acquired_via = 'first_free'` so it
-- can be distinguished from owner-initiated grants, legacy bespoke
-- grants, and completed Stripe purchases. The write currently fails
-- with CHECK violation (confirmed sandbox probe 2026-11-13).
--
-- Fix · drop + recreate the CHECK with `'first_free'` added. Also
-- extends the purchase-consistency constraint so `first_free` rows
-- behave like `grant` (purchase_id MUST be NULL).
--
-- Scope-restricted:
--   · DROP + CREATE on the two existing CHECK constraints only.
--   · No column add / drop · no RLS change · no trigger change.
--   · No row mutation · no existing data touched.
--
-- Rollback compatibility:
--   · Rollback migration restores the pre-apply CHECK definitions
--     exactly. Any first_free rows written between apply + rollback
--     would be invalidated by the restricted CHECK · the rollback
--     SQL deletes `acquired_via='first_free'` rows BEFORE restoring
--     the CHECK to avoid constraint-violation on the drop.
--
-- Downstream consumer:
--   · src/lib/nex-native/library/entitlement-service.ts
--     claimFirstFreeTheme writes `acquired_via='first_free'`.
--
-- NOT YET APPLIED. Requires separate explicit owner authorisation
-- naming sandbox ref kdstoyyeygcopkogqsyv before apply. Production
-- project ijvqdvsvwtwxzcqmoqit remains sealed.

BEGIN;

ALTER TABLE nex_theme_ownership
  DROP CONSTRAINT IF EXISTS nex_theme_ownership_acquired_via_known;

ALTER TABLE nex_theme_ownership
  ADD CONSTRAINT nex_theme_ownership_acquired_via_known
  CHECK (
    acquired_via = ANY (
      ARRAY['bespoke'::text, 'direct_purchase'::text, 'grant'::text, 'first_free'::text]
    )
  );

ALTER TABLE nex_theme_ownership
  DROP CONSTRAINT IF EXISTS nex_theme_ownership_purchase_id_matches_source;

ALTER TABLE nex_theme_ownership
  ADD CONSTRAINT nex_theme_ownership_purchase_id_matches_source
  CHECK (
    (acquired_via = 'direct_purchase' AND purchase_id IS NOT NULL)
    OR
    (acquired_via = ANY (ARRAY['bespoke'::text, 'grant'::text, 'first_free'::text])
     AND purchase_id IS NULL)
  );

INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '342',
  'nex_theme_ownership.acquired_via · extend CHECK for first_free perk',
  'Owner directive 2026-11-13 Themes+ Phase A. Adds first_free to the '
  'acquired_via CHECK list + purchase_consistency CHECK. No row '
  'mutation · no RLS change. Consumed by claimFirstFreeTheme in '
  'src/lib/nex-native/library/entitlement-service.ts.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
