-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 361 · ACL correction for public.nex_is_participant_in_session(uuid)
-- ─────────────────────────────────────────────────────────────────────────────
-- NEX Gate A Connected Matrix · §16.48.25 anchor (continuation)
-- Dated: 2026-11-20
-- Sandbox project ref: kdstoyyeygcopkogqsyv (ONLY)
-- Production project ref: ijvqdvsvwtwxzcqmoqit (SEALED · DO NOT APPLY)
--
-- DO NOT APPLY TO PRODUCTION WITHOUT SEPARATE EXPLICIT AUTHORISATION.
--
-- Purpose
-- -------
-- Migration 360 (applied to sandbox 2026-11-20) created the SECURITY DEFINER
-- helper `public.nex_is_participant_in_session(uuid)` used by the rewritten
-- non-recursive SELECT policies on `nex_group_call_participant` and
-- `nex_group_call_session`. Migration 360 issued only:
--
--     REVOKE ALL ON FUNCTION … FROM PUBLIC;
--     GRANT  EXECUTE ON FUNCTION … TO authenticated;
--
-- Supabase's default ACL also hands `anon` + `service_role` EXECUTE on
-- functions in schema `public` unless those roles are explicitly revoked.
-- The canonical pattern used elsewhere in this tree (see
-- `nex-supabase/migrations/359_nex_join_group_call_session_tx.sql`
-- lines 240–250) is the three-REVOKE envelope:
--
--     REVOKE EXECUTE … FROM anon;
--     REVOKE EXECUTE … FROM service_role;
--     REVOKE EXECUTE … FROM public;
--     GRANT  EXECUTE … TO authenticated;
--
-- Migration 361 closes this ACL gap for the helper function. It is a
-- pure ACL rewrite · the function body, STABLE volatility, SECURITY DEFINER
-- attribute, pinned search_path, and owner are unchanged.
--
-- Follow-up to migration 360.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- REVOKE is idempotent in PostgreSQL · safe to re-run · `IF EXISTS` is not
-- valid on REVOKE, so we REVOKE unconditionally.
REVOKE EXECUTE ON FUNCTION public.nex_is_participant_in_session(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.nex_is_participant_in_session(uuid) FROM service_role;

-- Redundant with migration 360 (which issued REVOKE ALL FROM PUBLIC) but
-- restated defensively so this migration is self-contained and re-runnable.
REVOKE EXECUTE ON FUNCTION public.nex_is_participant_in_session(uuid) FROM public;

-- Defensive restatement of the intended end-state grant. GRANT is idempotent.
GRANT EXECUTE ON FUNCTION public.nex_is_participant_in_session(uuid) TO authenticated;

INSERT INTO nex_migration_history(version, description, notes)
VALUES (
  '361',
  'ACL correction for public.nex_is_participant_in_session · REVOKE from anon + service_role + public · defensive re-GRANT to authenticated',
  'Gate A §16.48.25 follow-up. Closes helper ACL gap surfaced by apply-migration-360-sandbox.mjs post-check matrix. Sandbox-only authorisation 2026-11-20; prod ijvqdvsvwtwxzcqmoqit remains sealed.'
);

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback (commented · for reference only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Note: this is NOT a true restore of the pre-361 state. Migration 360's
-- end state intentionally left `anon` + `service_role` with the Supabase
-- default EXECUTE grant by omission (i.e. the grants were implicit, never
-- issued by a migration file). Applying the block below re-creates that
-- functional state explicitly.
--
-- BEGIN;
--   GRANT EXECUTE ON FUNCTION public.nex_is_participant_in_session(uuid) TO anon;
--   GRANT EXECUTE ON FUNCTION public.nex_is_participant_in_session(uuid) TO service_role;
--   -- `authenticated` EXECUTE is intentionally retained (it is the correct state).
--   DELETE FROM nex_migration_history WHERE version = '361';
-- COMMIT;
-- ─────────────────────────────────────────────────────────────────────────────
