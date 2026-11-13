-- 340_nex_account_theme_sharing_globally_enabled_rollback.sql
-- -----------------------------------------------------------------------------
-- Rollback for migration 340 · drops the global theme-sharing column.
-- Consumers (theme-sharing-service · isThemeMutuallyVisibleSafe) must
-- already have degraded or been reverted before this rollback runs,
-- because they expect the column to exist in their "apply happy path".
-- Service-layer safety: both reader + writer catch the "column does
-- not exist" error and return `true` (grandfather semantics) so the
-- rollback is non-breaking even if application code hasn't been
-- re-deployed.

BEGIN;

ALTER TABLE nex_account
  DROP COLUMN IF EXISTS theme_sharing_globally_enabled;

DELETE FROM nex_migration_history WHERE version = '340';

COMMIT;
