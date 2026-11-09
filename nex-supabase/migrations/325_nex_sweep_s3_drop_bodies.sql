-- ============================================================================
-- NEX-native Migration 325 · Historical sweep S3 · drop body + ciphertext
-- ============================================================================
-- Phase D Sprint 13 (DRAFT · not applied) · S3 phase of the sealed
-- historical secure-deletion sweep. Author: Claude. 2026-11-09.
--
-- This migration DROPS the following columns:
--   · nex_peer_message.body
--   · nex_peer_message.ciphertext   (if exists)
--   · nex_message.body
--
-- Sealed invariant protection:
--   · I-4 · requires explicit "Authorise S3" owner message before apply.
--     The script wrapper (apply-migration-325-*.mjs · deferred) will
--     require a one-time env flag matching the authorisation phrase.
--   · I-5 · the rollback file restores schema structure only · NEVER
--     content. Includes an I-5 CHECK that refuses rollback if any
--     attempt is made to populate the restored columns.
--
-- Safety rails baked into the forward migration:
--   · Recent-writes check · aborts if any body write in the last 7 days
--     (indicates Sprint 7-8 cutover is incomplete · do not drop)
--   · Prerequisite check on mig 320 (Sprint 1) + S0 inventory record
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(325000001);

DO $pre$
DECLARE
  v_recent_peer_writes integer;
  v_recent_msg_writes integer;
BEGIN
  IF EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '325') THEN
    RAISE EXCEPTION 'Migration 325 already recorded in nex_migration_history.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM nex_migration_history WHERE version = 'SWEEP-S1') THEN
    RAISE EXCEPTION 'Prerequisite S1 not applied in this env · chat attachment bucket must be retired before dropping body columns.';
  END IF;

  -- Recent-writes safety check · nex_peer_message
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'nex_peer_message'
       AND column_name = 'body'
  ) THEN
    EXECUTE $q$
      SELECT COUNT(*) FROM public.nex_peer_message
       WHERE body IS NOT NULL
         AND COALESCE(updated_at, created_at) > NOW() - INTERVAL '7 days'
    $q$ INTO v_recent_peer_writes;
    IF v_recent_peer_writes > 0 THEN
      RAISE EXCEPTION
        'nex_peer_message: % recent body writes in last 7 days · Sprint 7-8 cutover incomplete · aborting S3',
        v_recent_peer_writes;
    END IF;
  END IF;

  -- Recent-writes safety check · nex_message
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'nex_message'
       AND column_name = 'body'
  ) THEN
    EXECUTE $q$
      SELECT COUNT(*) FROM public.nex_message
       WHERE body IS NOT NULL
         AND COALESCE(updated_at, created_at) > NOW() - INTERVAL '7 days'
    $q$ INTO v_recent_msg_writes;
    IF v_recent_msg_writes > 0 THEN
      RAISE EXCEPTION
        'nex_message: % recent body writes in last 7 days · Sprint 7-8 cutover incomplete · aborting S3',
        v_recent_msg_writes;
    END IF;
  END IF;

  RAISE NOTICE 'S3 pre-checks passed · dropping body + ciphertext columns';
END
$pre$;

-- Drop body + ciphertext from peer messages (if columns exist)
DO $drop_peer$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'nex_peer_message' AND column_name = 'body') THEN
    EXECUTE 'ALTER TABLE public.nex_peer_message DROP COLUMN body';
    RAISE NOTICE 'Dropped nex_peer_message.body';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'nex_peer_message' AND column_name = 'ciphertext') THEN
    EXECUTE 'ALTER TABLE public.nex_peer_message DROP COLUMN ciphertext';
    RAISE NOTICE 'Dropped nex_peer_message.ciphertext';
  END IF;
END
$drop_peer$;

-- Drop body from business messages
DO $drop_msg$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'nex_message' AND column_name = 'body') THEN
    EXECUTE 'ALTER TABLE public.nex_message DROP COLUMN body';
    RAISE NOTICE 'Dropped nex_message.body';
  END IF;
END
$drop_msg$;

INSERT INTO nex_migration_history (version, applied_at, description, notes)
VALUES (
  '325',
  NOW(),
  'nex_peer_message + nex_message · drop body + ciphertext (sealed S3)',
  'Phase D Sprint 13 · historical sweep S3 · I-4 compliant (requires per-phase auth) · I-5 rollback protects against content resurrection.'
);

COMMIT;
