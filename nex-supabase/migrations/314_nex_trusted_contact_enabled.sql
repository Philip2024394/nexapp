-- ============================================================================
-- NEX-native Migration 314 · trusted_contact · enabled + updated_at
-- ============================================================================
--
-- Owner-authorised 2026-11-09 Step 1 build · DRAFT (NOT YET APPLIED).
--
-- STATUS: AUTHORED FOR REVIEW ONLY · NOT APPLIED TO ANY DATABASE.
-- Requires separate explicit owner approval (sandbox-only first, never prod
-- without a second approval) under Safety Constitution §5.
--
-- Purpose
--   Supports the sealed 2026-11-09 Emergency Help design (personal-contacts-
--   only, device-local location). Adds per-contact enable/disable so a user
--   can keep a contact on file without having them receive alerts (e.g.
--   "away on holiday · disable until next week"), and an updated_at timestamp
--   so the UI can show when a contact row was last edited.
--
-- Changes
--   · ADD COLUMN enabled    boolean NOT NULL DEFAULT TRUE
--   · ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now()
--   · Trigger nex.trusted_contact_touch_updated_at → updates updated_at on
--     any UPDATE (BEFORE UPDATE, row-level).
--   · Backfill: all existing rows get enabled=TRUE, updated_at=added_at.
--
-- Does NOT add RLS. mig 224 §40-45 sealed the "service-role-only writes ·
-- no RLS yet" posture · that remains until a separate RLS migration is
-- authored + approved.
--
-- Rollback (destructive · safe when no production data exists):
--   BEGIN;
--     DROP TRIGGER IF EXISTS trg_nex_trusted_contact_touch_updated_at
--       ON nex.trusted_contact;
--     DROP FUNCTION IF EXISTS nex.trusted_contact_touch_updated_at();
--     ALTER TABLE nex.trusted_contact DROP COLUMN IF EXISTS updated_at;
--     ALTER TABLE nex.trusted_contact DROP COLUMN IF EXISTS enabled;
--   COMMIT;
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Part 1 · Add columns
-- ---------------------------------------------------------------------------

ALTER TABLE nex.trusted_contact
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT TRUE;

ALTER TABLE nex.trusted_contact
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill: updated_at for existing rows should reflect the original added_at
-- so the UI never shows "just edited" for rows that pre-date this migration.
UPDATE nex.trusted_contact
   SET updated_at = added_at
 WHERE updated_at > added_at;

-- ---------------------------------------------------------------------------
-- Part 2 · updated_at touch trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION nex.trusted_contact_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nex_trusted_contact_touch_updated_at
  ON nex.trusted_contact;

CREATE TRIGGER trg_nex_trusted_contact_touch_updated_at
  BEFORE UPDATE ON nex.trusted_contact
  FOR EACH ROW
  EXECUTE FUNCTION nex.trusted_contact_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Part 3 · Query-optimising index for "enabled contacts only" fan-out reads
-- ---------------------------------------------------------------------------
--
-- The recipient resolver's L1 layer will filter to enabled=TRUE on every
-- incident. A partial index keeps that scan cheap.

CREATE INDEX IF NOT EXISTS idx_nex_trusted_contact_owner_enabled
  ON nex.trusted_contact (owner_account_id)
  WHERE enabled = TRUE;

-- ---------------------------------------------------------------------------
-- Part 4 · Migration history
-- ---------------------------------------------------------------------------

INSERT INTO nex_migration_history (version, description, applied_at)
VALUES ('314', 'nex.trusted_contact · enabled + updated_at + touch trigger', now())
ON CONFLICT (version) DO UPDATE
  SET description = EXCLUDED.description,
      applied_at  = EXCLUDED.applied_at;

COMMIT;
