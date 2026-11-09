-- ============================================================================
-- NEX-native Migration 316 · support_ticket · short sequence number
-- ============================================================================
--
-- Owner-sealed 2026-11-10 Phase 2.1 · NOT YET APPLIED.
--
-- Adds a BIGSERIAL `sequence_number` column to nex.support_ticket so
-- the UI can display a short identifier (e.g. "Ticket #146") in
-- addition to the full NX1-YYYYMMDD-XXXX ticket_number. Postgres
-- automatically assigns values 1..N to existing rows + continues to
-- auto-increment for new inserts.
--
-- Rollback (destructive):
--   BEGIN;
--     ALTER TABLE nex.support_ticket DROP COLUMN IF EXISTS sequence_number;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex.support_ticket
  ADD COLUMN IF NOT EXISTS sequence_number BIGSERIAL UNIQUE;

CREATE INDEX IF NOT EXISTS idx_nex_support_ticket_sequence
  ON nex.support_ticket (sequence_number);

INSERT INTO nex_migration_history (version, description, applied_at)
VALUES ('316', 'nex.support_ticket · sequence_number BIGSERIAL', now())
ON CONFLICT (version) DO UPDATE
  SET description = EXCLUDED.description,
      applied_at  = EXCLUDED.applied_at;

COMMIT;
