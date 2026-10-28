-- ============================================================================
-- NEX-native Migration 231 · nex_watch_listing_deletion_audit
-- R3 remediation 2026-10-26 · retention + deletion audit log · NOT APPLIED
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Must not be applied to the sealed production project
-- `ijvqdvsvwtwxzcqmoqit` without explicit owner approval.
--
-- Purpose (owner directive R3 · 2026-10-26)
-- ----------------------------------------------------------------------------
-- Durable record of every retention-cleanup pass. Captures per-listing
-- outcome, per-storage-object outcome, and the retention trigger that
-- caused the delete. Supports auditable "right to erasure" claims and
-- lets a human operator trace partial-failure cases without reading
-- app logs.
--
-- Design notes
-- ----------------------------------------------------------------------------
-- · `listing_id` is NULLABLE · the DB row may be hard-deleted after a
--   successful cleanup; keeping the audit row intact is the whole
--   point of the audit. Owner account id stays non-null so the audit
--   remains queryable per account.
-- · `storage_outcome` is a jsonb array · each element is `{bucket,
--   path, outcome: 'deleted'|'missing'|'failed', error?: string}`.
--   The service layer writes this during the sweep.
-- · `db_row_deleted` is boolean · true iff the retention sweep hard-
--   deleted the `nex_watch_listing` row (not for soft-remove flips).
-- · `trigger_reason` is a stable enum-shaped text so historic rows
--   stay readable even if the sweep logic evolves.
--
-- RLS
-- ----------------------------------------------------------------------------
-- SELECT · authenticated · owner_account_id must match
-- nex_current_account_ids(). This lets an account view their own
-- retention history for a GDPR "what did you delete" response.
--
-- INSERT / UPDATE / DELETE · service-role only. The sweep writes via
-- `nexSupabaseAdmin` after a bounded transaction. No INSERT policy
-- for `authenticated`.
--
-- Dependencies
-- ----------------------------------------------------------------------------
--   PREREQUISITE:
--     001 · nex_account
--     010 · SECURITY DEFINER helpers (nex_current_account_ids)
--     217 · search_path hardening
--     227 · nex_watch_listing (FK target · ON DELETE SET NULL)
--
-- Rollback
-- ----------------------------------------------------------------------------
--   BEGIN;
--     DROP TABLE IF EXISTS nex_watch_listing_deletion_audit CASCADE;
--     DELETE FROM nex_migration_history WHERE version = '231';
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_watch_listing_deletion_audit (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Listing + owner · listing nullable (row may be gone post-sweep)
  listing_id          uuid        NULL
    REFERENCES nex_watch_listing(id) ON DELETE SET NULL,
  owner_account_id    uuid        NOT NULL
    REFERENCES nex_account(id) ON DELETE CASCADE,

  -- Why the sweep touched this listing
  trigger_reason      text        NOT NULL,

  -- Per-storage-object results (array of {bucket, path, outcome, error?})
  storage_outcome     jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- Did the sweep hard-delete the DB row?
  db_row_deleted      boolean     NOT NULL DEFAULT false,

  -- Did ALL required storage deletions succeed (or were missing-is-ok)?
  storage_complete    boolean     NOT NULL DEFAULT false,

  -- Freeform operator note (never user-authored)
  notes               text        NULL,

  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT nex_watch_listing_deletion_audit_trigger_values
    CHECK (trigger_reason IN (
      'entitlement_expired',
      'owner_soft_removed',
      'account_deletion',
      'owner_requested',
      'admin_manual'
    )),

  CONSTRAINT nex_watch_listing_deletion_audit_storage_outcome_is_array
    CHECK (jsonb_typeof(storage_outcome) = 'array')
);

COMMENT ON TABLE nex_watch_listing_deletion_audit IS
  'R3 remediation 2026-10-26 · auditable record of every retention-cleanup pass. One row per listing per sweep attempt. Enables "what was deleted and when" responses and partial-failure diagnosis.';

COMMENT ON COLUMN nex_watch_listing_deletion_audit.storage_outcome IS
  'jsonb array · each element shaped as {bucket, path, outcome: "deleted"|"missing"|"failed", error?: string}. Written by the retention service after each storage API call.';

COMMENT ON COLUMN nex_watch_listing_deletion_audit.db_row_deleted IS
  'True iff the retention sweep hard-deleted the nex_watch_listing row. False for soft flips (published → expired) that happen earlier in the retention lifecycle.';

COMMENT ON COLUMN nex_watch_listing_deletion_audit.storage_complete IS
  'True iff all storage objects for this listing were either deleted or confirmed missing on the storage backend. If false, the sweep retains the DB row for safe retry.';

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_nex_watch_listing_deletion_audit_owner
  ON nex_watch_listing_deletion_audit (owner_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_watch_listing_deletion_audit_listing
  ON nex_watch_listing_deletion_audit (listing_id)
  WHERE listing_id IS NOT NULL;

-- Retry queue · "which listings still need a cleanup retry"
CREATE INDEX IF NOT EXISTS idx_nex_watch_listing_deletion_audit_retry
  ON nex_watch_listing_deletion_audit (storage_complete, created_at)
  WHERE storage_complete = false;

-- ----------------------------------------------------------------------------
-- RLS policies
-- ----------------------------------------------------------------------------

ALTER TABLE nex_watch_listing_deletion_audit ENABLE ROW LEVEL SECURITY;

-- Owners read their own audit history (GDPR surface).
CREATE POLICY nex_watch_listing_deletion_audit_owner_select
  ON nex_watch_listing_deletion_audit FOR SELECT
  TO authenticated
  USING (owner_account_id IN (SELECT nex_current_account_ids()));

-- No public SELECT, no authenticated INSERT/UPDATE/DELETE · service-role
-- only (sweep writes via nexSupabaseAdmin).

COMMIT;
