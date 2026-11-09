-- ============================================================================
-- Rollback · Migration 291 · atomic rate-limit RPC
-- ============================================================================
-- Removes the RPC function. Service layer gracefully falls back to the
-- 2-phase read-then-upsert path when the function is missing (via
-- error code 42883). No data loss · the nex_security_rate_limit
-- counter table is untouched.
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(291000001);

DROP FUNCTION IF EXISTS public.nex_security_rate_limit_claim(text, text, integer, integer);

DELETE FROM nex_migration_history WHERE version = '291';

COMMIT;
