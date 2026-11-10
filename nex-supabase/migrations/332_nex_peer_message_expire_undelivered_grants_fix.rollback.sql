-- Rollback for mig 332 · restores the default auto-grants (NOT recommended).
BEGIN;
SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(332000001);
GRANT EXECUTE ON FUNCTION public.nex_peer_message_expire_undelivered(int) TO public;
DELETE FROM nex_migration_history WHERE version = '332';
COMMIT;
