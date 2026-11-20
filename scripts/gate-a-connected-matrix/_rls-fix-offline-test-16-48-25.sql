-- ============================================================================
-- NEX Gate A Connected Matrix §16.48.25 · Offline RLS-fix audit checklist
-- ============================================================================
--
-- Anchor : §16.48.25 (migration 360_fix_group_call_rls_recursion.sql)
-- Dated  : 2026-11-20
-- Scope  : SANDBOX ONLY (kdstoyyeygcopkogqsyv). Prod remains sealed.
-- Status : STATIC AUDIT FILE — DO NOT EXECUTE.
--
-- This file is a checklist of queries a test harness WOULD run after
-- migration 360 is applied to sandbox, to verify the recursion fix is
-- in place and byte-shape correct. Nothing here is auto-run; no node
-- script wraps it. Reviewers execute selectively via psql if desired.
--
-- Pass criteria for each check are inline. All must pass before
-- Gate A §16.48.25 is considered VERIFIED (sandbox tier).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- CHECK 1 · Helper function exists with correct attributes
-- ----------------------------------------------------------------------------
-- Expect exactly 1 row with:
--   prosecdef  = true   (SECURITY DEFINER)
--   provolatile = 's'   (STABLE)
--   proconfig  contains 'search_path=public'
--   prolang    = (SELECT oid FROM pg_language WHERE lanname = 'sql')
--
-- SELECT
--   p.proname,
--   p.prosecdef,
--   p.provolatile,
--   p.proconfig,
--   l.lanname
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- JOIN pg_language   l ON l.oid = p.prolang
-- WHERE n.nspname = 'public'
--   AND p.proname = 'nex_is_participant_in_session'
--   AND pg_get_function_identity_arguments(p.oid) = 'p_session_id uuid';
--
-- PASS: prosecdef=t, provolatile='s', proconfig @> ARRAY['search_path=public'],
--       lanname='sql'.


-- ----------------------------------------------------------------------------
-- CHECK 2 · REVOKE ALL FROM PUBLIC is effective
-- ----------------------------------------------------------------------------
-- The pseudo-role PUBLIC must NOT hold EXECUTE on the helper.
--
-- SELECT has_function_privilege(
--   'public',
--   'public.nex_is_participant_in_session(uuid)',
--   'EXECUTE'
-- );
--
-- PASS: returns false.
--
-- Supplementary: inspect raw ACL for completeness.
--
-- SELECT p.proacl
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname = 'nex_is_participant_in_session';
--
-- PASS: proacl contains an 'authenticated=X/<owner>' entry and NO
--       '=X/<owner>' (PUBLIC) entry.


-- ----------------------------------------------------------------------------
-- CHECK 3 · GRANT EXECUTE TO authenticated is effective
-- ----------------------------------------------------------------------------
-- SELECT has_function_privilege(
--   'authenticated',
--   'public.nex_is_participant_in_session(uuid)',
--   'EXECUTE'
-- );
--
-- PASS: returns true.


-- ----------------------------------------------------------------------------
-- CHECK 4 · nex_group_call_participant_select_scoped USING text has
--           NO self-table subquery
-- ----------------------------------------------------------------------------
-- The rewritten policy must not contain the string
-- 'FROM nex_group_call_participant' (case-insensitive) anywhere in
-- its qual expression.
--
-- SELECT
--   pol.polname,
--   pg_get_expr(pol.polqual, pol.polrelid) AS using_expr
-- FROM pg_policy pol
-- JOIN pg_class  c ON c.oid = pol.polrelid
-- WHERE c.relname = 'nex_group_call_participant'
--   AND pol.polname = 'nex_group_call_participant_select_scoped';
--
-- PASS: using_expr DOES contain
--         'nex_is_participant_in_session(session_id)'
--       using_expr DOES NOT contain (ILIKE)
--         '%FROM nex_group_call_participant%'


-- ----------------------------------------------------------------------------
-- CHECK 5 · nex_group_call_session_select_participants USING text has
--           NO participant-table subquery
-- ----------------------------------------------------------------------------
-- SELECT
--   pol.polname,
--   pg_get_expr(pol.polqual, pol.polrelid) AS using_expr
-- FROM pg_policy pol
-- JOIN pg_class  c ON c.oid = pol.polrelid
-- WHERE c.relname = 'nex_group_call_session'
--   AND pol.polname = 'nex_group_call_session_select_participants';
--
-- PASS: using_expr DOES contain
--         'nex_is_participant_in_session(id)'
--       using_expr DOES contain the preserved host branch
--         'host_account_id IN (SELECT id FROM nex_account'
--       using_expr DOES NOT contain (ILIKE)
--         '%FROM nex_group_call_participant%'


-- ----------------------------------------------------------------------------
-- CHECK 6 · Other migration-133 policies are unchanged
-- ----------------------------------------------------------------------------
-- The fix must only rewrite the two recursive SELECT policies. The
-- other four (insert_host, update_host, insert_self, update_scoped)
-- must still exist unmodified.
--
-- SELECT pol.polname, c.relname, pol.polcmd
-- FROM pg_policy pol
-- JOIN pg_class c ON c.oid = pol.polrelid
-- WHERE c.relname IN ('nex_group_call_session', 'nex_group_call_participant')
-- ORDER BY c.relname, pol.polname;
--
-- PASS: six policies present:
--   nex_group_call_participant_insert_self       (c = r)
--   nex_group_call_participant_select_scoped     (c = r)  ← rewritten
--   nex_group_call_participant_update_scoped     (c = r)
--   nex_group_call_session_insert_host           (c = a)
--   nex_group_call_session_select_participants   (c = r)  ← rewritten
--   nex_group_call_session_update_host           (c = w)


-- ----------------------------------------------------------------------------
-- CHECK 7 · Migration history row recorded
-- ----------------------------------------------------------------------------
-- SELECT version, description
-- FROM nex_migration_history
-- WHERE version = '360';
--
-- PASS: exactly one row with description beginning
--       'Fix 42P17 recursion in nex_group_call_participant'.


-- ============================================================================
-- End checklist. Reviewer signs off §16.48.25 when all 7 PASS on sandbox.
-- ============================================================================
