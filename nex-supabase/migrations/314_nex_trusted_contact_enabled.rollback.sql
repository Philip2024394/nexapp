-- ============================================================================
-- Rollback for migration 314 · trusted_contact · enabled + updated_at
-- ============================================================================
--
-- Owner-authorised 2026-11-09 Step 1 build · DRAFT (NOT YET APPLIED).
-- Mirrors the forward migration. Destructive on the two added columns + the
-- touch trigger. Safe against production because the forward migration has
-- not been applied to prod.
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS nex.idx_nex_trusted_contact_owner_enabled;

DROP TRIGGER IF EXISTS trg_nex_trusted_contact_touch_updated_at
  ON nex.trusted_contact;

DROP FUNCTION IF EXISTS nex.trusted_contact_touch_updated_at();

ALTER TABLE nex.trusted_contact DROP COLUMN IF EXISTS updated_at;
ALTER TABLE nex.trusted_contact DROP COLUMN IF EXISTS enabled;

DELETE FROM nex_migration_history WHERE version = '314';

COMMIT;
