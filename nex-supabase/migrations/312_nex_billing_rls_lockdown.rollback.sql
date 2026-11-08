-- ============================================================================
-- Rollback for migration 312 · Billing tables RLS lockdown
-- ============================================================================
-- DANGER · this rollback DISABLES the RLS protection on the three billing
-- tables. If no re-grant is issued, the tables become unreadable to the
-- Supabase-auto-granted anon/authenticated roles anyway (because RLS-off
-- defaults still honour revokes). Defence-in-depth: we deliberately do NOT
-- re-grant on anon/authenticated so a forced rollback leaves the tables
-- not-readable rather than world-readable.
--
-- Intended use · immediate post-apply rollback if the apply broke a legitimate
-- service-role code path (not expected since service-role bypasses RLS). Not
-- intended as an ongoing service-recovery tool.
--
-- Per owner-sealed invariant I-5 (2026-11-09) · rollbacks must not restore
-- private content storage. This rollback does not interact with private
-- chat content; the invariant is honoured.
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(312000002);

DO $mig$
DECLARE
  v_mig_312_applied boolean;
  v_mig_258_applied boolean;
BEGIN
  v_mig_312_applied :=
    EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '312');
  IF NOT v_mig_312_applied THEN
    RAISE EXCEPTION 'Migration 312 not applied · rollback has nothing to undo.';
  END IF;

  v_mig_258_applied :=
    EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '258');

  IF v_mig_258_applied THEN
    -- Unwind the RLS protection. Revokes stay in place deliberately.
    EXECUTE 'ALTER TABLE nex_billing_event_log DISABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE nex_billing_adverse_event DISABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE nex_billing_checkout_session DISABLE ROW LEVEL SECURITY';
    -- No GRANT TO anon/authenticated · deliberately left revoked.
    -- If the owner needs to restore legacy wide-open access after the
    -- rollback, they must author a separate explicit grant migration.
    RAISE NOTICE 'Mig 312 rollback complete · RLS disabled on three billing tables · revokes preserved for defence-in-depth.';
  ELSE
    RAISE NOTICE 'Mig 258 not applied in this env · 312 was a no-op here · rollback is also a no-op.';
  END IF;
END
$mig$;

DELETE FROM nex_migration_history WHERE version = '312';

COMMIT;
