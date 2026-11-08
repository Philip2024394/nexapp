-- ============================================================================
-- NEX-native Migration 312 · Billing tables RLS lockdown
-- ============================================================================
-- Phase 1 · F-1 · owner-authorised 2026-11-09. Author: Claude.
--
-- Corrects an oversight in migration 258 (owner-authorised 2026-11-02): the
-- three nex_billing_* tables were CREATE'd without explicit REVOKE statements
-- and without enabling Row Level Security. Supabase auto-grants anon and
-- authenticated roles access on new tables via PostgREST unless explicitly
-- revoked. Migration 290 (owner-sealed 2026-11-08) learned this lesson and
-- shipped the correct pattern; migration 258 pre-dates that lesson.
--
-- This migration applies the mig-290 pattern to the three billing tables:
--
--   · nex_billing_event_log         (Stripe webhook idempotency + audit · PII)
--   · nex_billing_adverse_event     (disputes · refunds · fraud · admin)
--   · nex_billing_checkout_session  (purchase-intent records · Stripe linkage)
--
-- Post-apply, authenticated and anon callers via PostgREST see zero rows.
-- Service-role connections continue to bypass RLS as before · the NEX server
-- paths (webhook processor, checkout service) are unaffected.
--
-- Severity before this migration: P0-CURRENT on any environment where mig
-- 258 is applied. §17.1 inventory (2026-11-09) confirmed mig 258 IS applied
-- to production (ijvqdvsvwtwxzcqmoqit).
--
-- Conditional no-op · if mig 258 has NOT been applied in the target env, the
-- RLS/revoke/grant statements target tables that do not exist. The guard
-- block at the top makes this a NO-OP in that case so the same SQL file is
-- safe to apply to both sandbox (where 258 is absent per inventory) and
-- production (where 258 is applied). The migration-history insert still
-- records the application so later audits confirm the file ran.
--
-- Rollback · see 312_nex_billing_rls_lockdown.rollback.sql.
--
-- Prerequisites · none (conditional on 258 presence at runtime).
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(312000001);

DO $mig$
DECLARE
  v_mig_258_applied boolean;
BEGIN
  -- Idempotency · refuse re-apply.
  IF EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '312') THEN
    RAISE EXCEPTION 'Migration 312 already recorded in nex_migration_history.';
  END IF;

  -- Conditional detection · is mig 258 applied in this env?
  v_mig_258_applied :=
    EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '258');

  IF NOT v_mig_258_applied THEN
    RAISE NOTICE 'Migration 258 not applied in this env · 312 is a no-op lockdown here (recording ledger only).';
  ELSE
    -- Apply the lockdown pattern to each of the three billing tables.
    -- Each statement is idempotent · safe to re-run if a prior transaction
    -- partially applied this.

    -- nex_billing_event_log
    EXECUTE 'ALTER TABLE nex_billing_event_log ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON nex_billing_event_log FROM public';
    EXECUTE 'REVOKE ALL ON nex_billing_event_log FROM authenticated';
    EXECUTE 'REVOKE ALL ON nex_billing_event_log FROM anon';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON nex_billing_event_log TO service_role';

    -- nex_billing_adverse_event
    EXECUTE 'ALTER TABLE nex_billing_adverse_event ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON nex_billing_adverse_event FROM public';
    EXECUTE 'REVOKE ALL ON nex_billing_adverse_event FROM authenticated';
    EXECUTE 'REVOKE ALL ON nex_billing_adverse_event FROM anon';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON nex_billing_adverse_event TO service_role';

    -- nex_billing_checkout_session
    EXECUTE 'ALTER TABLE nex_billing_checkout_session ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON nex_billing_checkout_session FROM public';
    EXECUTE 'REVOKE ALL ON nex_billing_checkout_session FROM authenticated';
    EXECUTE 'REVOKE ALL ON nex_billing_checkout_session FROM anon';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON nex_billing_checkout_session TO service_role';
  END IF;
END
$mig$;

-- Ledger write (runs whether or not 258 was present · records that this
-- file was applied in the target env).
INSERT INTO nex_migration_history (version, applied_at, description, notes)
VALUES (
  '312',
  NOW(),
  'nex_billing tables RLS lockdown · explicit REVOKE + RLS enable + service-role-only grants',
  'Phase 1 F-1 · owner-authorised 2026-11-09. Corrects mig 258 omission: Supabase auto-grants anon+authenticated on new tables and mig 258 did not revoke. Three tables: event_log, adverse_event, checkout_session. Mirrors mig 290 pattern (sealed 2026-11-08). Conditional no-op when mig 258 is not applied in target env.'
);

COMMIT;
