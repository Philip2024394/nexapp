-- ============================================================================
-- NEX-native Migration 313 · security_rate_limit CHECK widening · hq_admin_grant
-- ============================================================================
-- Phase 1 G3 follow-up · owner-authorised 2026-11-09. Author: Claude.
--
-- Mig 290 (owner-sealed 2026-11-08 initial) created nex_security_rate_limit
-- with a CHECK constraint allowing 8 action values. The same day, "round 11"
-- added a 9th action `hq_admin_grant` in the live service layer
-- (src/lib/nex-native/security-rate-limit.ts:63-77) but the migration file
-- was not updated. Applying mig 290 as-is to any environment leaves HQ admin
-- grant writes failing the DB CHECK · the service falls back to the
-- per-lambda in-memory limiter, which is strictly weaker than the sealed
-- doctrine of distributed enforcement.
--
-- Mig 313 is a FORWARD-ONLY correction. Mig 290 is already applied to
-- sandbox · we do not rewrite it. Mig 313 DROPs the existing 8-value CHECK
-- and ADDs the full 9-value CHECK, bringing the DB in line with the sealed
-- 9-action registry in security-rate-limit.ts.
--
-- Status · AUTHORED · applies to sandbox on explicit script · applies to
-- production only on explicit `apply mig 313 production` owner trigger.
--
-- Prerequisite · mig 290 must be applied in the target environment. Mig 313
-- guards on this · raises a clear exception if the prerequisite is absent.
--
-- Rollback · 313_nex_security_rate_limit_hq_admin_grant.rollback.sql ·
-- restores the 8-value CHECK · zero data loss · any existing
-- `hq_admin_grant` rows (if ANY exist post-313) would prevent the rollback
-- due to CHECK violation on the old constraint · operator must inspect and
-- decide (unlikely scenario · mig 313 and the code are aligned).
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(313000001);

DO $mig$
DECLARE
  v_mig_290_applied boolean;
  v_mig_313_applied boolean;
BEGIN
  -- Idempotency guard · refuse re-apply
  v_mig_313_applied := EXISTS (
    SELECT 1 FROM nex_migration_history WHERE version = '313'
  );
  IF v_mig_313_applied THEN
    RAISE EXCEPTION 'Migration 313 already recorded in nex_migration_history.';
  END IF;

  -- Prerequisite · mig 290 must be applied
  v_mig_290_applied := EXISTS (
    SELECT 1 FROM nex_migration_history WHERE version = '290'
  );
  IF NOT v_mig_290_applied THEN
    RAISE EXCEPTION 'Prerequisite migration 290 not applied · apply 290 first.';
  END IF;

  -- Replace the 8-value CHECK with the 9-value CHECK
  ALTER TABLE public.nex_security_rate_limit
    DROP CONSTRAINT IF EXISTS ck_sec_rl_action;

  ALTER TABLE public.nex_security_rate_limit
    ADD CONSTRAINT ck_sec_rl_action CHECK (
      action IN (
        'password_change',
        'session_revoke',
        'session_revoke_all',
        'chat_message',
        'account_create',
        'webauthn_assert',
        'webauthn_enroll',
        'visitor_bootstrap',
        'hq_admin_grant'
      )
    );

  -- Comment refresh so future readers see the full canonical list
  COMMENT ON CONSTRAINT ck_sec_rl_action ON public.nex_security_rate_limit IS
    'Sealed enum · 9 values · password_change | session_revoke | session_revoke_all | chat_message | account_create | webauthn_assert | webauthn_enroll | visitor_bootstrap | hq_admin_grant. Expanded by mig 313 (2026-11-09) · hq_admin_grant was added to security-rate-limit.ts round 11 of 2026-11-08 · mig 290 was sealed before that addition.';
END
$mig$;

INSERT INTO nex_migration_history (version, applied_at, description, notes)
VALUES (
  '313',
  NOW(),
  'nex_security_rate_limit action CHECK widened to 9 values · adds hq_admin_grant',
  'Phase 1 G3 follow-up · owner-authorised 2026-11-09. Aligns DB CHECK with the sealed 9-action registry in security-rate-limit.ts (hq_admin_grant added round 11 of 2026-11-08). Forward-only correction · does NOT rewrite mig 290. Prerequisite: mig 290. Rollback reinstates the 8-value CHECK.'
);

COMMIT;
