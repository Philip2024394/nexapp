-- ============================================================================
-- NEX-native Migration 335 · revoke open EXECUTE grants on mutating SECDEF fns
-- ============================================================================
-- Owner-authorised 2026-11-10. Forward-only correction.
--
-- Discovery · while writing the world-class safety matrix and auditing every
-- SECURITY DEFINER function in sandbox, 7 state-mutating functions were
-- found with the Supabase-default EXECUTE grant open to public + anon +
-- authenticated. Each is callable by any logged-in or anonymous user,
-- which is strictly weaker than the sealed defence-in-depth posture.
--
-- Severity notes per function:
--   · nex_purge_delivered_encrypted_messages  · CRITICAL · DELETEs from
--     nex_peer_message where delivered_at is old. Sealed invariant I-4:
--     "no historical deletion without separate auth". Anon-callable
--     deletion is a direct I-4 violation.
--   · nex_bridge99_create_first_message        · HIGH     · INSERTs
--     messages in the provisional-account bridge flow. Anon-callable
--     forgery / spam risk.
--   · nex_allocate_handle                      · HIGH     · writes
--     handle rows. Anon handle squatting.
--   · nex_lease_generation_jobs                · HIGH     · leases
--     generation-queue jobs. Anon-callable theft / disruption.
--   · nex_reclaim_expired_leases               · MEDIUM   · reclaims
--     leases. Anon-callable churn.
--   · nex_transition_generation_job_failure    · MEDIUM   · marks jobs
--     failed. Anon-callable denial of service.
--   · nex_follow_recompute_counters            · LOW      · recounts
--     follow stats. Anon-callable but low-impact.
--
-- Caller audit (sandbox probe 2026-11-10):
--   · All 7 functions have legitimate callers in `src/lib/nex-native/*`
--     that use `nexSupabaseAdmin` (service_role).
--   · No file uses the client-side Supabase SDK to call any of them.
--   · Revoking EXECUTE from public/anon/authenticated has ZERO impact
--     on legitimate code paths. service_role bypasses RLS and ignores
--     function EXECUTE grants (role attribute BYPASSRLS + superuser-like).
--
-- Functions deliberately NOT touched by this migration (require anon
-- or authenticated callability by design):
--   · nex_current_account_ids              · RLS helper (SELECT policy use)
--   · nex_current_owned_business_ids       · RLS helper
--   · nex_current_participant_conversation_ids · RLS helper
--   · nex_conversations_of_my_businesses   · RLS helper
--   · nex_peer_message_enforce_immutability · trigger function (must fire
--                                              on anon/authenticated DML)
--   · nex_generation_queue_depth           · pure read-only count
--   · st_estimatedextent                   · PostGIS internal
--
-- Prerequisite · none (idempotent REVOKEs).
-- Rollback · 335_...rollback.sql restores the open grants (NOT
-- recommended · retained only for symmetry).
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(335000001);

DO $pre$
BEGIN
  IF EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '335') THEN
    RAISE EXCEPTION 'Migration 335 already recorded in nex_migration_history.';
  END IF;
END
$pre$;

-- Per-function revokes. Using the simplified form that revokes all
-- overloads of each name · safe because none of these functions have
-- legitimate overloads.

DO $fn$
DECLARE
  target text;
  fn_sig text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'nex_purge_delivered_encrypted_messages',
    'nex_bridge99_create_first_message',
    'nex_allocate_handle',
    'nex_lease_generation_jobs',
    'nex_reclaim_expired_leases',
    'nex_transition_generation_job_failure',
    'nex_follow_recompute_counters'
  ]
  LOOP
    FOR fn_sig IN
      SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = target
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM public',       fn_sig);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon',         fn_sig);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', fn_sig);
      EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO service_role',   fn_sig);
      RAISE NOTICE 'Secured %', fn_sig;
    END LOOP;
  END LOOP;
END
$fn$;

INSERT INTO nex_migration_history (version, applied_at, description, notes)
VALUES (
  '335',
  NOW(),
  'Revoke open EXECUTE grants from 7 mutating SECURITY DEFINER functions · defence-in-depth',
  'Closes an I-4-violating hole: nex_purge_delivered_encrypted_messages was callable by anon/authenticated. Six other mutating SECDEF functions tightened to service_role EXECUTE only. All legitimate callers use nexSupabaseAdmin (service_role) · zero legitimate paths affected. World-class safety matrix row 7 invariant restored.'
);

COMMIT;
