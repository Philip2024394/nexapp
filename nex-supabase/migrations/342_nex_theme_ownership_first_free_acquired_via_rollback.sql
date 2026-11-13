-- 342_nex_theme_ownership_first_free_acquired_via_rollback.sql
-- -----------------------------------------------------------------------------
-- Rollback for migration 342 · restores the pre-apply CHECK definitions.
-- MUST delete first_free rows first so the restricted CHECK can be
-- recreated without constraint-violation errors.

BEGIN;

-- Delete any rows that would violate the restored CHECK.
DELETE FROM nex_theme_ownership WHERE acquired_via = 'first_free';

ALTER TABLE nex_theme_ownership
  DROP CONSTRAINT IF EXISTS nex_theme_ownership_acquired_via_known;

ALTER TABLE nex_theme_ownership
  ADD CONSTRAINT nex_theme_ownership_acquired_via_known
  CHECK (
    acquired_via = ANY (
      ARRAY['bespoke'::text, 'direct_purchase'::text, 'grant'::text]
    )
  );

ALTER TABLE nex_theme_ownership
  DROP CONSTRAINT IF EXISTS nex_theme_ownership_purchase_id_matches_source;

ALTER TABLE nex_theme_ownership
  ADD CONSTRAINT nex_theme_ownership_purchase_id_matches_source
  CHECK (
    (acquired_via = 'direct_purchase' AND purchase_id IS NOT NULL)
    OR
    (acquired_via = ANY (ARRAY['bespoke'::text, 'grant'::text])
     AND purchase_id IS NULL)
  );

DELETE FROM nex_migration_history WHERE version = '342';

COMMIT;
