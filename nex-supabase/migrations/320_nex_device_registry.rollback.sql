-- ============================================================================
-- Rollback · Migration 320 · Device registry
-- ============================================================================
-- Reverts the `nex_device` table. Safe because migration 320 did not touch
-- any pre-existing user content · there is no I-5-protected content to
-- preserve in the table itself. Rollback drops the table outright.
--
-- Any dependent code (device-registry library · API routes) will fail after
-- rollback until re-applied · which is correct · we never want half-state.
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(320000001);

DO $rb$
BEGIN
  -- I-5 safety check · future sprints will add body/ciphertext columns
  -- elsewhere · never on this table. If some future hand ever added such
  -- columns here, refuse to drop · require explicit intervention.
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'nex_device'
       AND column_name IN ('body', 'ciphertext', 'message_body', 'attachment_bytes')
  ) THEN
    RAISE EXCEPTION 'I-5 CHECK · nex_device has acquired a forbidden content column · rollback refuses to proceed · manual review required.';
  END IF;
END
$rb$;

DROP INDEX IF EXISTS nex_device_account_pubkey_active_unique;
DROP INDEX IF EXISTS nex_device_account_id_active_idx;
DROP TABLE IF EXISTS nex_device;

DELETE FROM nex_migration_history WHERE version = '320';

COMMIT;
