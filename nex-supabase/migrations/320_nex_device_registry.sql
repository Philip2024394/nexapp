-- ============================================================================
-- NEX-native Migration 320 · Device registry (Phase 2 Sprint 1 foundation)
-- ============================================================================
-- Phase D · Sprint 1 · owner-authorised 2026-11-09 under sandbox-only
-- conditions. Author: Claude.
--
-- Introduces the `nex_device` table · the first server-side component of the
-- sealed device-only private chat architecture (Phase 2 Interp 1). Each NEX
-- account registers 1..N devices · each device publishes a public key that
-- other users encrypt-to when sending a private message. Private keys NEVER
-- appear in this table or anywhere else server-side (sealed invariant I-1).
--
-- I-1 compliance:
--   · No `body` column
--   · No `ciphertext` column
--   · No attachment column
--   · Stores PUBLIC keys only · never private material
--
-- I-4 compliance:
--   · No historical deletion in this migration
--   · Devices can only be `revoked` (soft tombstone) · never hard-deleted
--     except via ON DELETE CASCADE on account deletion (which is itself a
--     separately-authorised path)
--
-- RLS posture:
--   · ENABLE RLS
--   · REVOKE all from public · authenticated · anon
--   · GRANT to service_role only
--   · All reads/writes go through the server-side device-registry library
--     using nexSupabaseAdmin · never directly from the browser
--
-- Rollback · see 320_nex_device_registry.rollback.sql · drops the table
-- outright. No I-5 violation because this migration has no pre-existing
-- user content to protect.
--
-- Prerequisites · requires `nex_account` (mig 001).
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(320000001);

DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '320') THEN
    RAISE EXCEPTION 'Migration 320 already recorded in nex_migration_history.';
  END IF;
END
$mig$;

CREATE TABLE IF NOT EXISTS nex_device (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid        NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  public_key      text        NOT NULL,
  key_algorithm   text        NOT NULL DEFAULT 'ECDSA-P256',
  device_nickname text,
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,

  CONSTRAINT nex_device_public_key_format
    CHECK (length(public_key) BETWEEN 32 AND 2048),
  CONSTRAINT nex_device_nickname_length
    CHECK (device_nickname IS NULL OR length(device_nickname) BETWEEN 1 AND 64),
  CONSTRAINT nex_device_key_algorithm_whitelist
    CHECK (key_algorithm IN ('ECDSA-P256', 'Ed25519', 'ECDH-P256'))
);

-- Active-devices index · common query is "list this account's active devices"
CREATE INDEX IF NOT EXISTS nex_device_account_id_active_idx
  ON nex_device (account_id)
  WHERE revoked_at IS NULL;

-- Idempotency for device registration · prevents duplicate active rows for
-- the same (account, public_key) pair. Allows revoked-then-re-registered.
CREATE UNIQUE INDEX IF NOT EXISTS nex_device_account_pubkey_active_unique
  ON nex_device (account_id, public_key)
  WHERE revoked_at IS NULL;

-- Comments pinned to the sealed architecture so future maintainers see them.
COMMENT ON TABLE nex_device IS
  'Phase 2 Sprint 1 · device registry. One row per registered device public key. Private keys NEVER appear here (I-1). Soft-tombstone via revoked_at (I-4). Service-role only (RLS enforces).';
COMMENT ON COLUMN nex_device.public_key IS
  'Base64-encoded raw public key. 32..2048 chars. Never the private half.';
COMMENT ON COLUMN nex_device.key_algorithm IS
  'ECDSA-P256 | Ed25519 | ECDH-P256. Determines how other clients encrypt-to or verify-from this device.';
COMMENT ON COLUMN nex_device.revoked_at IS
  'Soft-tombstone. Cleared row stays for audit · device no longer trusted.';

-- RLS lockdown · mirror of mig 290 + 312 pattern.
ALTER TABLE nex_device ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON nex_device FROM public;
REVOKE ALL ON nex_device FROM authenticated;
REVOKE ALL ON nex_device FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON nex_device TO service_role;

-- Ledger
INSERT INTO nex_migration_history (version, applied_at, description, notes)
VALUES (
  '320',
  NOW(),
  'nex_device registry · Phase 2 Sprint 1 foundation · public keys only',
  'Phase D Sprint 1 · owner-authorised 2026-11-09 under sandbox-only conditions. I-1 compliant: no body/ciphertext/attachment columns, public keys only. I-4 compliant: soft-tombstone via revoked_at. RLS: service_role only. References nex_account(id) ON DELETE CASCADE.'
);

COMMIT;
