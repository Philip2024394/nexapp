-- ============================================================================
-- ROLLBACK · nex_join_group_call_session_tx · v5-W3
-- CANDIDATE · UNAPPLIED · UNNUMBERED · PREVIEW ONLY · DO NOT APPLY
-- ============================================================================
--
-- WARNING: Running this rollback removes `nex_join_group_call_session_tx`
-- and leaves the codebase using the current UPDATE-then-INSERT lock-less
-- path in `group-call-service.ts:joinGroupCallSession` (lines 152-195).
--
-- After rollback:
--   · The INSERT-fallback race (two concurrent cold-joins to the same
--     session) is NOT closed by any FOR UPDATE lock. The mig-133 BEFORE
--     INSERT trigger remains in place as defence-in-depth and will RAISE
--     EXCEPTION if the 4-cap is exceeded, but two concurrent inserts below
--     the cap remain theoretically possible without serialisation.
--   · The W3 severity is THEORETICAL until a live caller exists (no
--     grep-confirmed live caller in src/app/ as of 2026-11-19).
--   · The TypeScript wrapper `group-call-join.v5-candidate.ts` remains
--     on disk but is fail-closed / default-off; production code does not
--     import it and it has no effect without the RPC.
--
-- What this rollback does NOT touch
--   · mig-133 (`133_nex_group_call.sql`) — untouched.
--   · v4 combined preview / `nex_invite_to_call_tx` — untouched.
--   · Applied migrations in `nex-supabase/migrations/` — untouched.
--   · Application code in `src/` — untouched.
--   · Production `ijvqdvsvwtwxzcqmoqit` — untouched (this preview was
--     sandbox-only and has never been applied to prod).
--
-- HALT NOTICE
-- -----------
-- Do NOT apply this rollback without fresh owner authorisation naming the
-- target DB. If the forward migration was never applied, this rollback is
-- a no-op (the IF EXISTS guard makes it safe either way).
-- ============================================================================

BEGIN;

-- Drop the v5-W3 RPC. No-op if it was never applied.
DROP FUNCTION IF EXISTS nex_join_group_call_session_tx(UUID, TEXT);

COMMIT;
