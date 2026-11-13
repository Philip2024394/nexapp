-- 341_nex_account_bubble_colours_rollback.sql
-- -----------------------------------------------------------------------------
-- Rollback for migration 341 · drops the bubble colour columns.
-- Service-layer safety: the reader + writer catch missing-column
-- errors and fall back to the cookie-only path, so running this
-- rollback with application code still deployed continues to work ·
-- users just lose the cross-device aspect.

BEGIN;

ALTER TABLE nex_account
  DROP CONSTRAINT IF EXISTS nex_account_bubble_self_hex_valid;

ALTER TABLE nex_account
  DROP CONSTRAINT IF EXISTS nex_account_bubble_peer_hex_valid;

ALTER TABLE nex_account
  DROP COLUMN IF EXISTS bubble_self_hex,
  DROP COLUMN IF EXISTS bubble_peer_hex;

DELETE FROM nex_migration_history WHERE version = '341';

COMMIT;
