-- Migration 338 ROLLBACK · nex_account.themes_plus_until
BEGIN;
ALTER TABLE nex_account DROP COLUMN IF EXISTS themes_plus_until;
DELETE FROM nex_migration_history WHERE version = '338';
COMMIT;
