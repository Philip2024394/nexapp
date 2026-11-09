-- ============================================================================
-- Rollback for migration 315 · Support Tickets
-- ============================================================================
-- Owner-sealed 2026-11-10 DRAFT. Safe to re-apply.
-- ============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_nex_support_ticket_touch_updated_at
  ON nex.support_ticket;
DROP FUNCTION IF EXISTS nex.support_ticket_touch_updated_at();

DROP TABLE IF EXISTS nex.support_message;
DROP TABLE IF EXISTS nex.support_ticket;
DROP TABLE IF EXISTS nex.support_admin_grant;

DELETE FROM nex_migration_history WHERE version = '315';

COMMIT;
