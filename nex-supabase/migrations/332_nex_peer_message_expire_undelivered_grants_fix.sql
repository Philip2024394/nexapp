-- ============================================================================
-- NEX-native Migration 332 · expire_undelivered · grants defence-in-depth
-- ============================================================================
-- Owner-authorised 2026-11-10. Forward-only correction.
--
-- Discovery · sandbox apply of mig 326 showed `nex_peer_message_expire_undelivered`
-- carried the Supabase default EXECUTE grant to anon + authenticated. Any
-- authenticated or anonymous caller could invoke the function and expire
-- every pending encrypted message in the system · sealed invariant I-4
-- (no plaintext/ciphertext deletion without separate auth) violated by
-- status-flip as well.
--
-- Fix · REVOKE EXECUTE from public, anon, authenticated · GRANT EXECUTE
-- to service_role only · mirrors the sealed pattern used by mig 291,
-- 293, 294, 330.
--
-- Prerequisite · mig 326 applied.
-- Rollback · 332_...rollback.sql restores the default auto-grants (NOT
-- recommended · retained only for symmetry).
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(332000001);

DO $pre$
BEGIN
  IF EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '332') THEN
    RAISE EXCEPTION 'Migration 332 already recorded in nex_migration_history.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '326') THEN
    RAISE EXCEPTION 'Prerequisite: migration 326 (expire function) must be applied first.';
  END IF;
END
$pre$;

REVOKE EXECUTE ON FUNCTION public.nex_peer_message_expire_undelivered(int) FROM public;
REVOKE EXECUTE ON FUNCTION public.nex_peer_message_expire_undelivered(int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.nex_peer_message_expire_undelivered(int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.nex_peer_message_expire_undelivered(int) TO service_role;

INSERT INTO nex_migration_history (version, applied_at, description, notes)
VALUES (
  '332',
  NOW(),
  'nex_peer_message_expire_undelivered · EXECUTE revoked from public/anon/authenticated · granted to service_role only',
  'Mig 332 closes a Supabase default-grant hole in mig 326. Without this revoke an authenticated or anonymous user could invoke the sweep function and flip every pending encrypted peer message to expired. Owner-sealed defence-in-depth posture restored.'
);

COMMIT;
