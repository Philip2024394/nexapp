-- ============================================================================
-- NEX-native Migration 317 · support_ticket · resolved_at
-- ============================================================================
--
-- Owner-sealed 2026-11-10 Phase 2.2 · DRAFT (sandbox apply only · prod
-- requires separate authorisation).
--
-- Adds a `resolved_at timestamptz` column to nex.support_ticket so the
-- admin "Resolved" flow can record WHEN a ticket was resolved. The
-- user-side query hides resolved tickets that were resolved more than
-- 1 hour ago (chat appears to "clear" for the user) · admin queue
-- continues to show every ticket regardless of age.
--
-- Rollback:
--   BEGIN;
--     ALTER TABLE nex.support_ticket DROP COLUMN IF EXISTS resolved_at;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex.support_ticket
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_nex_support_ticket_resolved
  ON nex.support_ticket (resolved_at)
  WHERE status = 'resolved';

INSERT INTO nex_migration_history (version, description, applied_at)
VALUES ('317', 'nex.support_ticket · resolved_at + partial index', now())
ON CONFLICT (version) DO UPDATE
  SET description = EXCLUDED.description,
      applied_at  = EXCLUDED.applied_at;

COMMIT;
