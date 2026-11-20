-- ============================================================================
-- CANDIDATE ROLLBACK · nex_group_call_invite v3 whitespace-strict
-- UNAPPLIED · PREVIEW-ONLY · DO NOT RUN
-- ============================================================================
--
-- Scope: drop ONLY the v3 overload created by the sibling
-- `CANDIDATE_nex_group_call_invite_v3_whitespace_strict_PREVIEW.sql`.
--
-- This rollback does NOT restore mig-356. Rationale: mig-356 is the
-- currently-applied good state at the time this candidate was drafted;
-- rolling back v3 must land back on mig-356, not on mig-353 and not on
-- "no function". Because v3 uses the SAME 7-param signature as mig-356
-- (UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID), a plain DROP of v3 would
-- leave the DB with NO function of that signature. To return to mig-356
-- the operator must therefore re-apply mig-356 after running this
-- rollback. The sibling PREVIEW performs `DROP FUNCTION IF EXISTS`
-- before creating v3, so the replacement is destructive in the same
-- sense.
--
-- Operator sequence for rollback-to-mig-356:
--   1. Run this file against sandbox kdstoyyeygcopkogqsyv.
--   2. Re-apply `nex-supabase/migrations/356_nex_group_call_invite_v2.sql`
--      (same signature; brings back the mig-356 body guard).
--
-- NOTE: no `DELETE FROM nex_migration_history` statement. This preview
-- never wrote a history row (no version assigned), so none exists to
-- delete. If the preview is later promoted to a numbered migration and
-- gains a history row, THAT migration's rollback script will include
-- the matching DELETE at promote-time.
--
-- HALT NOTICE
--   Do NOT run without fresh owner authorisation naming the sandbox
--   ref `kdstoyyeygcopkogqsyv`.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS nex_invite_to_call_tx(
  UUID,  -- p_invitee_account_id
  TEXT,  -- p_media_type
  TEXT,  -- p_host_country
  JSONB, -- p_attachment_meta
  TEXT,  -- p_invite_body
  TEXT,  -- p_attachment_url
  UUID   -- p_existing_session_id
);

COMMIT;
