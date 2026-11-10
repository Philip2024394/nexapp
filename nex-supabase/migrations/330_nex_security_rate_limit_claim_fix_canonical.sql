-- ============================================================================
-- NEX-native Migration 330 · rate-limit_claim canonical body fix
-- ============================================================================
-- Owner-authorised 2026-11-10. Forward-only correction.
--
-- Discovery · sandbox probe 2026-11-10 showed `nex_security_rate_limit_claim`
-- was installed from the OLD `_claim.sql` body (dated 2026-11-08) rather than
-- the canonical `_claim_rpc.sql` body (dated 2026-11-09). The old body
-- hardcodes an 8-value action enum inside the function · it REJECTS every
-- `hq_admin_grant` call (returns `(false, 1)`), breaking HQ admin
-- workflows the moment they issue grants.
--
-- Proof of defect · live test against sandbox `kdstoyyeygcopkogqsyv` 2026-11-10:
--   SELECT * FROM nex_security_rate_limit_claim(
--     'acct:00000000-aaaa-4aaa-aaaa-999999999999', 'hq_admin_grant', 15, 30);
--   → allowed=false retry_after=1
--
-- Fix · CREATE OR REPLACE the function body with the canonical content.
-- The canonical body defers action-enum validation to the base-table CHECK
-- (widened to 9 values by mig 313) instead of hardcoding it. Signature,
-- SECURITY DEFINER, service_role-only EXECUTE grant, and return shape
-- are all preserved · callers do NOT change.
--
-- The `nex_security_rate_limit_prune()` function installed by the old
-- `_claim.sql` stays as-is · it's a pure cleanup helper independent of
-- the claim function's body. The canonical `_claim_rpc.sql` did not
-- include a prune function · losing it would mean no automated cleanup.
-- Keeping it is a pragmatic merge.
--
-- Prerequisite · mig 290 + 313 + 291 all applied (verified via probe).
-- Rollback · 330_...rollback.sql reinstates the 8-value hardcoded enum.
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(330000001);

DO $pre$
BEGIN
  IF EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '330') THEN
    RAISE EXCEPTION 'Migration 330 already recorded in nex_migration_history.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '291') THEN
    RAISE EXCEPTION 'Prerequisite: migration 291 must be applied first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '313') THEN
    RAISE EXCEPTION 'Prerequisite: migration 313 (CHECK widening) must be applied first.';
  END IF;
END
$pre$;

CREATE OR REPLACE FUNCTION public.nex_security_rate_limit_claim(
  _key text,
  _action text,
  _window_minutes integer,
  _max_per_window integer
)
RETURNS TABLE (allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_window_started_at timestamptz;
  v_window_ends_at    timestamptz;
  v_new_count         integer;
  v_now               timestamptz := clock_timestamp();
BEGIN
  IF _key IS NULL OR _action IS NULL OR _window_minutes IS NULL OR _max_per_window IS NULL THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;
  IF _window_minutes < 1 OR _window_minutes > 1440 THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;
  IF _max_per_window < 1 THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  v_window_started_at := date_trunc('minute', v_now)
    - make_interval(mins := MOD(EXTRACT(MINUTE FROM v_now)::integer, _window_minutes));
  v_window_ends_at := v_window_started_at + make_interval(mins := _window_minutes);

  INSERT INTO nex_security_rate_limit AS t (
    key, action, window_started_at, count, updated_at
  )
  VALUES (_key, _action, v_window_started_at, 1, v_now)
  ON CONFLICT (key, action, window_started_at)
    DO UPDATE SET
      count      = t.count + 1,
      updated_at = v_now
    WHERE t.count < _max_per_window
  RETURNING t.count INTO v_new_count;

  IF v_new_count IS NOT NULL THEN
    RETURN QUERY SELECT true, 0;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT false,
           GREATEST(
             1,
             CEIL(EXTRACT(EPOCH FROM (v_window_ends_at - v_now)))::integer
           );
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.nex_security_rate_limit_claim IS
  'Mig 330 (2026-11-10) · canonical body replacing mig 291 _claim.sql. Defers
   action-enum validation to base-table CHECK (widened by mig 313) · supports
   hq_admin_grant. SECURITY DEFINER · search_path pinned to public,pg_temp.
   EXECUTE grant service_role only (preserved from prior migration).';

-- Re-assert the grant posture · defensive · prior grants should already be
-- in place but a fresh REVOKE/GRANT ensures nothing drifted.
REVOKE EXECUTE ON FUNCTION public.nex_security_rate_limit_claim(text, text, integer, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.nex_security_rate_limit_claim(text, text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.nex_security_rate_limit_claim(text, text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.nex_security_rate_limit_claim(text, text, integer, integer) TO service_role;

INSERT INTO nex_migration_history (version, applied_at, description, notes)
VALUES (
  '330',
  NOW(),
  'nex_security_rate_limit_claim body replaced with canonical _claim_rpc.sql · hq_admin_grant unblocked',
  'Mig 330 corrects a sandbox discovery where mig 291 had been applied from the OLD _claim.sql file with a hardcoded 8-value action enum. The old body rejected hq_admin_grant calls. Mig 330 CREATEs OR REPLACEs the function body with the canonical content · no hardcoded enum · defers to base-table CHECK (widened by mig 313). nex_security_rate_limit_prune() is unchanged · remains available.'
);

COMMIT;
