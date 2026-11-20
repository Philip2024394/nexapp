-- ============================================================================
-- NEX-native Migration 360 · Fix infinite RLS recursion on nex_group_call_*
-- ============================================================================
--
-- Anchor: NEX Gate A Connected Matrix §16.48.25
-- Dated : 2026-11-20
-- Scope : SANDBOX ONLY (kdstoyyeygcopkogqsyv)
-- DO NOT APPLY TO PRODUCTION (ijvqdvsvwtwxzcqmoqit) without separate
-- explicit owner authorisation. Production remains SEALED.
--
-- Problem
-- -------
-- Migration 133 created two SELECT policies whose USING clauses contain
-- subqueries over the SAME base table (or a cross-referenced table whose
-- own policy subqueries back), triggering:
--
--     42P17 infinite recursion detected in policy for relation
--           "nex_group_call_participant"
--
-- on every authenticated SELECT against nex_group_call_participant and
-- (transitively) nex_group_call_session.
--
-- The two offending policies from migration 133 are:
--
--   (a) nex_group_call_participant_select_scoped
--         USING (
--           account_id IN (SELECT id FROM nex_account
--                          WHERE supabase_user_id = auth.uid())
--           OR session_id IN (
--             SELECT session_id FROM nex_group_call_participant  -- ← self
--             WHERE account_id IN (SELECT id FROM nex_account
--                                  WHERE supabase_user_id = auth.uid())
--           )
--         );
--
--   (b) nex_group_call_session_select_participants
--         USING (
--           host_account_id IN (SELECT id FROM nex_account
--                               WHERE supabase_user_id = auth.uid())
--           OR id IN (
--             SELECT session_id FROM nex_group_call_participant  -- ← fires
--             WHERE account_id IN (SELECT id FROM nex_account
--                                  WHERE supabase_user_id = auth.uid())
--           )
--         );
--
-- When (b) evaluates its subquery, policy (a) fires on
-- nex_group_call_participant, and (a)'s own subquery re-enters (a) —
-- unbounded recursion.
--
-- Fix
-- ---
-- Introduce a SECURITY DEFINER helper `public.nex_is_participant_in_session`.
-- Because SECURITY DEFINER runs as the function owner (NOT the invoking
-- role) and the function owner is a superuser/role for which RLS is
-- bypassed, the EXISTS subquery reads the participant table WITHOUT
-- re-triggering the recursive policy. This is the standard Postgres
-- pattern for "self-referential RLS" cases.
--
-- The non-recursive branches from 133 (account_id = me, host_account_id
-- = me) are preserved verbatim-in-meaning. Only the recursive subquery
-- branch is replaced by a call to the helper.
--
-- Migration 133 is NOT edited. This migration is a FORWARD-ONLY fix.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Helper: SECURITY DEFINER bypass of participant-table RLS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nex_is_participant_in_session(
  p_session_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM nex_group_call_participant p
      JOIN nex_account a ON a.id = p.account_id
     WHERE p.session_id = p_session_id
       AND a.supabase_user_id = (select auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.nex_is_participant_in_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nex_is_participant_in_session(uuid) TO authenticated;

COMMENT ON FUNCTION public.nex_is_participant_in_session(uuid) IS
  'SECURITY DEFINER predicate: does the current auth.uid() own a participant row in the given group-call session? Used by nex_group_call_* SELECT RLS to break the self-referential recursion created by migration 133. Pinned search_path=public. Execute granted only to authenticated.';

-- ---------------------------------------------------------------------------
-- 2. Rewrite nex_group_call_participant_select_scoped (no self-subquery)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS nex_group_call_participant_select_scoped
  ON nex_group_call_participant;

CREATE POLICY nex_group_call_participant_select_scoped
  ON nex_group_call_participant FOR SELECT
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = (select auth.uid()))
    OR nex_is_participant_in_session(session_id)
  );

-- ---------------------------------------------------------------------------
-- 3. Rewrite nex_group_call_session_select_participants
--
--    Non-recursive branch preserved verbatim from migration 133:
--      host_account_id IN (SELECT id FROM nex_account
--                          WHERE supabase_user_id = auth.uid())
--
--    Recursive branch (id IN SELECT session_id FROM
--    nex_group_call_participant ...) replaced by
--    nex_is_participant_in_session(id).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS nex_group_call_session_select_participants
  ON nex_group_call_session;

CREATE POLICY nex_group_call_session_select_participants
  ON nex_group_call_session FOR SELECT
  USING (
    host_account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = (select auth.uid()))
    OR nex_is_participant_in_session(id)
  );

-- ---------------------------------------------------------------------------
-- 4. Migration history
-- ---------------------------------------------------------------------------
INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '360',
    'Fix 42P17 recursion in nex_group_call_participant + nex_group_call_session SELECT policies',
    'Gate A Connected Matrix §16.48.25. Adds public.nex_is_participant_in_session SECURITY DEFINER helper and rewrites the two recursive SELECT policies from migration 133. Sandbox-only authorisation 2026-11-20; prod ijvqdvsvwtwxzcqmoqit remains sealed.'
  );

COMMIT;

-- ============================================================================
-- ROLLBACK (NOT EXECUTED — reference only)
-- ============================================================================
-- Restores the two policies to their migration-133 definitions verbatim
-- and drops the helper. Run only if the fix needs to be reverted on the
-- sandbox. DO NOT run on production.
--
-- BEGIN;
--
--   DROP POLICY IF EXISTS nex_group_call_participant_select_scoped
--     ON nex_group_call_participant;
--
--   CREATE POLICY nex_group_call_participant_select_scoped
--     ON nex_group_call_participant FOR SELECT
--     USING (
--       account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
--       OR session_id IN (
--         SELECT session_id FROM nex_group_call_participant
--         WHERE account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
--       )
--     );
--
--   DROP POLICY IF EXISTS nex_group_call_session_select_participants
--     ON nex_group_call_session;
--
--   CREATE POLICY nex_group_call_session_select_participants
--     ON nex_group_call_session FOR SELECT
--     USING (
--       host_account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
--       OR id IN (
--         SELECT session_id FROM nex_group_call_participant
--         WHERE account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
--       )
--     );
--
--   REVOKE EXECUTE ON FUNCTION public.nex_is_participant_in_session(uuid) FROM authenticated;
--   DROP FUNCTION IF EXISTS public.nex_is_participant_in_session(uuid);
--
--   DELETE FROM nex_migration_history WHERE version = '360';
--
-- COMMIT;
-- ============================================================================
