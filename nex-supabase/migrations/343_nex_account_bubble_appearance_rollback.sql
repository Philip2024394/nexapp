-- 343_nex_account_bubble_appearance_rollback.sql
-- -----------------------------------------------------------------------------
-- Rollback for migration 343 · drops both appearance columns +
-- associated CHECK constraints. Service reads degrade to NULL (treated
-- as theme default · 100 = solid).

BEGIN;

ALTER TABLE nex_account
  DROP CONSTRAINT IF EXISTS nex_account_bubble_self_appearance_valid;

ALTER TABLE nex_account
  DROP CONSTRAINT IF EXISTS nex_account_bubble_peer_appearance_valid;

ALTER TABLE nex_account
  DROP COLUMN IF EXISTS bubble_self_appearance,
  DROP COLUMN IF EXISTS bubble_peer_appearance;

DELETE FROM nex_migration_history WHERE version = '343';

COMMIT;
