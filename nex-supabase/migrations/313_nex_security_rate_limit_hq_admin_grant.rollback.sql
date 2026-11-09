-- ============================================================================
-- Rollback for migration 313 · restores the 8-value CHECK on
-- nex_security_rate_limit.action
-- ============================================================================
-- WARNING · if any `hq_admin_grant` rows exist in the table at rollback time,
-- the restored 8-value CHECK will be INVALID against them · PostgreSQL will
-- reject the ADD CONSTRAINT. The operator must inspect + decide before
-- rolling back:
--   SELECT COUNT(*) FROM public.nex_security_rate_limit WHERE action = 'hq_admin_grant';
-- If count > 0, either delete those rows first (service-role) OR accept the
-- rollback failure and author a forward correction instead.
--
-- Per owner-sealed invariant I-5 (2026-11-09) · rollbacks must not restore
-- private content. This rollback touches a CHECK on a rate-limit counter
-- table · no private content involved · I-5 trivially satisfied.
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(313000002);

DO $mig$
DECLARE
  v_mig_313_applied boolean;
  v_hq_rows bigint;
BEGIN
  v_mig_313_applied := EXISTS (
    SELECT 1 FROM nex_migration_history WHERE version = '313'
  );
  IF NOT v_mig_313_applied THEN
    RAISE EXCEPTION 'Migration 313 not applied · rollback has nothing to undo.';
  END IF;

  -- Pre-rollback safety · refuse if hq_admin_grant rows exist
  SELECT COUNT(*) INTO v_hq_rows
  FROM public.nex_security_rate_limit
  WHERE action = 'hq_admin_grant';

  IF v_hq_rows > 0 THEN
    RAISE EXCEPTION 'Rollback refused · % hq_admin_grant row(s) present · would violate restored CHECK. Delete those rows first OR author a forward fix.', v_hq_rows;
  END IF;

  -- Replace the 9-value CHECK with the 8-value CHECK (mig 290 state)
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
        'visitor_bootstrap'
      )
    );
END
$mig$;

DELETE FROM nex_migration_history WHERE version = '313';

COMMIT;
