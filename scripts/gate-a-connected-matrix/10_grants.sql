-- scripts/gate-a-connected-matrix/10_grants.sql
--
-- Gate A Connected Matrix — expanded effective-privilege checks.
-- Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
-- Execution is Agent DB's responsibility.
--
-- Checks proacl for all three RPCs. Decodes who-has-what and verifies:
-- · no silent GRANT TO PUBLIC
-- · no pg_read_all_data overlap
-- · no unexpected grantees
--
-- All queries are READ-ONLY. No mutations.

-- ── Raw ACL strings for all three RPCs ───────────────────────────────────────
SELECT
  proname,
  pronargs,
  proacl::TEXT AS raw_acl,
  prosecdef,
  proowner::regrole::TEXT AS owner_role
FROM pg_proc
WHERE proname IN (
  'nex_invite_to_call_tx',
  'nex_create_group_call_session_tx',
  'nex_join_group_call_session_tx'
)
ORDER BY proname, pronargs;

-- ── Expanded: who actually has EXECUTE on each RPC ───────────────────────────
-- This uses information_schema.routine_privileges which decodes ACL entries.
SELECT
  routine_name,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    'nex_invite_to_call_tx',
    'nex_create_group_call_session_tx',
    'nex_join_group_call_session_tx'
  )
ORDER BY routine_name, grantee;

-- ── Check: no PUBLIC grantee on any of the three RPCs ────────────────────────
-- Expected: 0 rows. If any row appears, PUBLIC has EXECUTE — that is a defect.
SELECT
  'ALERT_PUBLIC_HAS_EXECUTE' AS alert,
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    'nex_invite_to_call_tx',
    'nex_create_group_call_session_tx',
    'nex_join_group_call_session_tx'
  )
  AND grantee IN ('PUBLIC', 'public');

-- ── Check: no pg_read_all_data membership that would shadow REVOKE ────────────
-- pg_read_all_data is a predefined role; if anon or service_role inherit from
-- it they could bypass function-level REVOKE on table reads, though not on
-- function EXECUTE. Report as informational.
SELECT
  rolname AS member_role,
  pg_get_userbyid(roleid)::TEXT AS inherits_from,
  admin_option
FROM pg_auth_members
JOIN pg_roles ON pg_roles.oid = pg_auth_members.member
WHERE rolname IN ('anon', 'service_role', 'authenticated')
  AND pg_get_userbyid(roleid)::TEXT IN ('pg_read_all_data', 'pg_write_all_data')
ORDER BY rolname;

-- ── Check: no unexpected grantees beyond authenticated ───────────────────────
-- Expected grantees: only 'authenticated' (and owner). anon + service_role
-- must NOT appear. Report any unexpected grantee.
SELECT
  'ALERT_UNEXPECTED_GRANTEE' AS alert,
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    'nex_invite_to_call_tx',
    'nex_create_group_call_session_tx',
    'nex_join_group_call_session_tx'
  )
  AND grantee NOT IN (
    'authenticated',
    -- Owner will appear as grantee for GRANT OPTION in some Postgres versions;
    -- include the two most common owner names for the sandbox migrator role
    'postgres',
    'supabase_admin'
  )
  AND grantee != routine_name  -- self-grant pattern
ORDER BY routine_name, grantee;

-- ── Supplemental: RLS enabled on both tables ────────────────────────────────
SELECT
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relname IN ('nex_group_call_session', 'nex_group_call_participant')
ORDER BY relname;

-- ── Supplemental: full policy list for group-call tables ─────────────────────
SELECT
  pc.relname AS table_name,
  pp.polname AS policy_name,
  pp.polcmd AS cmd,
  pg_get_expr(pp.polqual, pp.polrelid) AS using_expr,
  pg_get_expr(pp.polwithcheck, pp.polrelid) AS with_check_expr
FROM pg_policy pp
JOIN pg_class pc ON pc.oid = pp.polrelid
WHERE pc.relname IN ('nex_group_call_session', 'nex_group_call_participant')
ORDER BY pc.relname, pp.polname;
