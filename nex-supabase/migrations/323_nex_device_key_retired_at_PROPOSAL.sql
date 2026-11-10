-- Migration 323 · nex_account_device_key.retired_at · D1 + D2 · 2026-11-10
-- =========================================================================
-- STATUS: PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY · SANDBOX ONLY
-- =========================================================================
--
-- Owner-sealed 2026-11-10 (chat-decisions-locked-2026-11-10.md):
--   · D1 · bare key rotation (in-place public-key replacement · no history
--     surfaced to the public key lookup).
--   · D2 · server-side retired-device filter (service-role fan-out reader
--     applies WHERE retired_at IS NULL so clients never see retired-device
--     metadata).
--
-- This migration is the DB half of D2. It adds a nullable retired_at
-- timestamp to the sealed nex_account_device_key table (mig 092) and
-- the partial index that keeps active-key lookups O(log n). The
-- fan-out server action change that filters on this column is a
-- separate code commit · it is NOT authorised by this document.
--
-- Non-breaking · additive · all existing rows get retired_at = NULL
-- (treated as active).
--
-- I-4 compliance · retired_at is additive metadata · no row is ever
-- deleted by this migration · legacy device rows are not touched.
--
-- Apply target: SANDBOX ONLY (kdstoyyeygcopkogqsyv) · production
-- (ijvqdvsvwtwxzcqmoqit) stays sealed.

BEGIN;

ALTER TABLE nex_account_device_key
  ADD COLUMN IF NOT EXISTS retired_at timestamptz NULL;

COMMENT ON COLUMN nex_account_device_key.retired_at IS
  'D2 · nullable soft-retirement marker. NULL = device is active and eligible for fan-out. NOT NULL = device is retired · service-role fan-out reader filters these out so senders never encrypt to a retired device. Does NOT revoke the device · historical ciphertext addressed to this device_id can still be decrypted locally by the owner. Sealed 2026-11-10.';

CREATE INDEX IF NOT EXISTS nex_device_key_active
  ON nex_account_device_key (account_id)
  WHERE retired_at IS NULL;

COMMENT ON INDEX nex_device_key_active IS
  'D2 · partial index covering active devices only. Keeps listAccountDeviceKeysAction fan-out lookup cheap after retired rows accumulate. Sealed 2026-11-10.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '323',
    'D1+D2 · nex_account_device_key.retired_at + partial index nex_device_key_active',
    'Sealed 2026-11-10. Additive column + partial index. Server-side retired filter lives in code (fan-out reader) · not enforced at DB level. Existing rows get retired_at = NULL (active).'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--    WHERE table_name = 'nex_account_device_key' AND column_name = 'retired_at';
--
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'nex_account_device_key' AND indexname = 'nex_device_key_active';
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '323';
--     DROP INDEX IF EXISTS nex_device_key_active;
--     ALTER TABLE nex_account_device_key DROP COLUMN IF EXISTS retired_at;
--   COMMIT;
--
--   Rollback consequence: active-filter metadata disappears · all device
--   rows become eligible for fan-out again. No private content is
--   restored or exposed. Satisfies I-5.
