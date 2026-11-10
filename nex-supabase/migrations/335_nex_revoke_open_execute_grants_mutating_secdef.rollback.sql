-- Rollback for mig 335 · restores the open EXECUTE grants (NOT recommended).
BEGIN;
SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(335000001);

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
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = target
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO public',        fn_sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon',          fn_sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn_sig);
    END LOOP;
  END LOOP;
END
$fn$;

DELETE FROM nex_migration_history WHERE version = '335';
COMMIT;
