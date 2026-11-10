-- ============================================================================
-- NEX-native Migration 331 · security-audit tables · RLS defence-in-depth
-- ============================================================================
-- Owner-authorised 2026-11-10. Forward-only correction.
--
-- Discovery · sandbox probe 2026-11-10 showed mig 292 enabled RLS only on
-- `nex_security_audit_log` · the two sibling tables
-- `nex_security_audit_retention` and `nex_security_audit_reconciliation`
-- were created with REVOKE-only grants but without ALTER TABLE ENABLE
-- ROW LEVEL SECURITY. The REVOKE-only posture already prevents anon /
-- authenticated access · enabling RLS adds defence-in-depth so a future
-- accidental GRANT does not open the door.
--
-- Fix · ALTER TABLE ENABLE ROW LEVEL SECURITY on both tables · no
-- policies added · service_role connections bypass RLS · anon /
-- authenticated see zero rows even if a future migration grants them
-- SELECT.
--
-- Prerequisite · mig 292 applied.
-- Rollback · 331_...rollback.sql · DISABLE ROW LEVEL SECURITY on both.
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(331000001);

DO $pre$
BEGIN
  IF EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '331') THEN
    RAISE EXCEPTION 'Migration 331 already recorded in nex_migration_history.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '292') THEN
    RAISE EXCEPTION 'Prerequisite: migration 292 (audit tables) must be applied first.';
  END IF;
END
$pre$;

ALTER TABLE public.nex_security_audit_retention ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_security_audit_reconciliation ENABLE ROW LEVEL SECURITY;

INSERT INTO nex_migration_history (version, applied_at, description, notes)
VALUES (
  '331',
  NOW(),
  'nex_security_audit_retention + nex_security_audit_reconciliation · RLS defence-in-depth',
  'Mig 331 enables ROW LEVEL SECURITY on the two sibling audit tables that mig 292 left without the explicit ENABLE. REVOKE-only posture already prevented access · RLS is defence-in-depth. No policies added · service_role bypasses RLS.'
);

COMMIT;
