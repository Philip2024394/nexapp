-- ============================================================================
-- Rollback · Migration 325 · S3 body column drop
-- ============================================================================
-- Restores the DROPPED columns as NULL-only structure.
--
-- I-5 CHECK: this rollback MUST NOT be used to restore content. The
-- newly-restored columns are NULL for every row and will remain so.
-- If someone writes to them in an attempt to resurrect historical
-- plaintext from a backup, the I-5 trigger refuses.
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(325000001);

DO $rb$
BEGIN
  RAISE NOTICE 'I-5 enforcement · rollback restores column structure only · content cannot be resurrected';
END
$rb$;

-- Restore columns as NULL
ALTER TABLE public.nex_peer_message ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE public.nex_peer_message ADD COLUMN IF NOT EXISTS ciphertext text;
ALTER TABLE public.nex_message      ADD COLUMN IF NOT EXISTS body text;

-- I-5 trigger function: refuses INSERT or UPDATE that sets body or
-- ciphertext to anything other than NULL. The rollback operator is
-- expected to drop this trigger function only if the migration is
-- being re-forwarded in a fresh env (test).
CREATE OR REPLACE FUNCTION nex_i5_reject_content_restore()
RETURNS trigger AS $$
BEGIN
  IF (TG_TABLE_NAME = 'nex_peer_message' AND (NEW.body IS NOT NULL OR NEW.ciphertext IS NOT NULL))
     OR (TG_TABLE_NAME = 'nex_message' AND NEW.body IS NOT NULL) THEN
    RAISE EXCEPTION 'I-5 CHECK · attempt to restore private message content after sealed S3 sweep · refused';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nex_i5_peer_no_restore ON public.nex_peer_message;
CREATE TRIGGER nex_i5_peer_no_restore
  BEFORE INSERT OR UPDATE ON public.nex_peer_message
  FOR EACH ROW EXECUTE FUNCTION nex_i5_reject_content_restore();

DROP TRIGGER IF EXISTS nex_i5_msg_no_restore ON public.nex_message;
CREATE TRIGGER nex_i5_msg_no_restore
  BEFORE INSERT OR UPDATE ON public.nex_message
  FOR EACH ROW EXECUTE FUNCTION nex_i5_reject_content_restore();

DELETE FROM nex_migration_history WHERE version = '325';

COMMIT;
