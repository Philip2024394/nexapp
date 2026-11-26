-- 368_nex_account_region_pref_rollback.sql
-- -----------------------------------------------------------------------------
-- Rollback for migration 368 · drops the explicit region_pref column.
-- Consumers (region-resolver tier 1) treat the column as nullable
-- and tolerate absence by falling through to tier 2+ · the rollback
-- is non-breaking even if application code is not re-deployed.

BEGIN;

ALTER TABLE nex_account
  DROP COLUMN IF EXISTS region_pref;

DELETE FROM nex_migration_history WHERE version = '368';

COMMIT;
