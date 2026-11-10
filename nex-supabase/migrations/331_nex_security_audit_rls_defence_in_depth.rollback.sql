-- Rollback for mig 331.
BEGIN;
SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(331000001);
ALTER TABLE public.nex_security_audit_retention DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_security_audit_reconciliation DISABLE ROW LEVEL SECURITY;
DELETE FROM nex_migration_history WHERE version = '331';
COMMIT;
