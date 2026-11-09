-- ============================================================================
-- Rollback · Migration 321 · Signalling envelope
-- ============================================================================
-- Safe because this migration has no pre-existing user content. I-5 CHECK
-- refuses to proceed if any forbidden content column has been added to the
-- table later (defence-in-depth).
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(321000001);

DO $rb$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'nex_signalling_envelope'
       AND column_name IN ('body', 'ciphertext', 'message_body', 'attachment_bytes', 'plaintext', 'content')
  ) THEN
    RAISE EXCEPTION 'I-5 CHECK · nex_signalling_envelope has acquired a forbidden content column · rollback refuses to proceed · manual review required.';
  END IF;
END
$rb$;

DROP INDEX IF EXISTS nex_signalling_envelope_expires_at_idx;
DROP INDEX IF EXISTS nex_signalling_envelope_to_device_pending_idx;
DROP TABLE IF EXISTS nex_signalling_envelope;

DELETE FROM nex_migration_history WHERE version = '321';

COMMIT;
