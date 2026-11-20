-- ============================================================================
-- ROLLBACK · CANDIDATE_nex_call_session_create_rpc_v5_w2_PREVIEW
-- CANDIDATE · UNAPPLIED · UNNUMBERED · PREVIEW ONLY
-- ============================================================================
--
-- WARNING: Applying this rollback drops `nex_create_group_call_session_tx`.
-- After rollback, any TypeScript caller that was routing through the v5-W2
-- wrapper (`group-call-service.v5-candidate.ts`) will receive a
-- `V5RpcUnavailableError` (SQLSTATE 42883 · function does not exist).
-- The wrapper is designed to surface this as `rpc_unavailable` and
-- expects the operator to fall back to the pre-RPC direct-admin INSERT
-- path in `group-call-service.ts:createGroupCallSession`.
--
-- Because the v5-W2 wrapper is default-off (no live caller imports it),
-- rolling back this migration has NO effect on live traffic in a
-- correctly configured deployment. The direct-write path in
-- `group-call-service.ts` remains in place and is the active code path
-- at all times until a feature flag is explicitly activated.
--
-- REMAINING THEORETICAL RISK AFTER ROLLBACK
-- ------------------------------------------
-- The pre-RPC direct-admin INSERT path performs the session INSERT and
-- participant INSERTs in sequential round-trips (not a single DB
-- transaction). If the process dies between the session INSERT and the
-- participant INSERTs, an orphan session row can result. This race
-- window is the original motivation for the W2 RPC. Rolling back
-- restores this theoretical exposure (GB-4CAP-adjacent for the
-- session-creation path). It is "theoretical" because the new session_id
-- is not visible to concurrent writers before the COMMIT of the
-- session INSERT.
--
-- MIGRATION-133 AND MIGRATION-356 ARE UNAFFECTED
-- -----------------------------------------------
-- This rollback touches ONLY `nex_create_group_call_session_tx`.
-- `nex_invite_to_call_tx` (mig-356 / v4 candidate),
-- `nex_group_call_participant_cap_tr` (mig-133 trigger),
-- and all tables and RLS policies are left intact.
--
-- HALT NOTICE
-- -----------
-- Do NOT apply this rollback to production `ijvqdvsvwtwxzcqmoqit`
-- without fresh owner authorisation. Production remains sealed.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS nex_create_group_call_session_tx(TEXT, UUID, TEXT, UUID[]);

COMMIT;
