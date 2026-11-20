-- scripts/gate-a-connected-matrix/00_preflight.sql
--
-- Gate A Connected Matrix — preflight verification sweep.
-- Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
-- Execution is Agent DB's responsibility.
--
-- Purpose: re-runs §16.47.6 checks 1-8 post-apply as a verification sweep.
-- All checks are READ-ONLY. No mutations.
--
-- Expected: every row has passed_bool = TRUE.
-- If any row has passed_bool = FALSE, the runner stops and does not proceed
-- to the connected test scripts.
--
-- Sandbox target: kdstoyyeygcopkogqsyv ONLY.
-- Production ref ijvqdvsvwtwxzcqmoqit must never appear in the connection.

-- ── Check 1-3 · nex_invite_to_call_tx · anon / service_role / authenticated ──

SELECT
  'check_1_w1_anon' AS check_name,
  'false' AS expected,
  has_function_privilege(
    'anon',
    'public.nex_invite_to_call_tx(uuid,text,text,jsonb,text,text,uuid)',
    'EXECUTE'
  )::TEXT AS observed,
  NOT has_function_privilege(
    'anon',
    'public.nex_invite_to_call_tx(uuid,text,text,jsonb,text,text,uuid)',
    'EXECUTE'
  ) AS passed_bool

UNION ALL

SELECT
  'check_2_w1_service_role',
  'false',
  has_function_privilege(
    'service_role',
    'public.nex_invite_to_call_tx(uuid,text,text,jsonb,text,text,uuid)',
    'EXECUTE'
  )::TEXT,
  NOT has_function_privilege(
    'service_role',
    'public.nex_invite_to_call_tx(uuid,text,text,jsonb,text,text,uuid)',
    'EXECUTE'
  )

UNION ALL

SELECT
  'check_3_w1_authenticated',
  'true',
  has_function_privilege(
    'authenticated',
    'public.nex_invite_to_call_tx(uuid,text,text,jsonb,text,text,uuid)',
    'EXECUTE'
  )::TEXT,
  has_function_privilege(
    'authenticated',
    'public.nex_invite_to_call_tx(uuid,text,text,jsonb,text,text,uuid)',
    'EXECUTE'
  )

-- ── Check 4-6 · nex_create_group_call_session_tx · anon / service_role / authenticated ──

UNION ALL

SELECT
  'check_4_w2_anon',
  'false',
  has_function_privilege(
    'anon',
    'public.nex_create_group_call_session_tx(text,uuid,text,uuid[])',
    'EXECUTE'
  )::TEXT,
  NOT has_function_privilege(
    'anon',
    'public.nex_create_group_call_session_tx(text,uuid,text,uuid[])',
    'EXECUTE'
  )

UNION ALL

SELECT
  'check_5_w2_service_role',
  'false',
  has_function_privilege(
    'service_role',
    'public.nex_create_group_call_session_tx(text,uuid,text,uuid[])',
    'EXECUTE'
  )::TEXT,
  NOT has_function_privilege(
    'service_role',
    'public.nex_create_group_call_session_tx(text,uuid,text,uuid[])',
    'EXECUTE'
  )

UNION ALL

SELECT
  'check_6_w2_authenticated',
  'true',
  has_function_privilege(
    'authenticated',
    'public.nex_create_group_call_session_tx(text,uuid,text,uuid[])',
    'EXECUTE'
  )::TEXT,
  has_function_privilege(
    'authenticated',
    'public.nex_create_group_call_session_tx(text,uuid,text,uuid[])',
    'EXECUTE'
  )

-- ── Check 7-9 · nex_join_group_call_session_tx · anon / service_role / authenticated ──

UNION ALL

SELECT
  'check_7_w3_anon',
  'false',
  has_function_privilege(
    'anon',
    'public.nex_join_group_call_session_tx(uuid,text)',
    'EXECUTE'
  )::TEXT,
  NOT has_function_privilege(
    'anon',
    'public.nex_join_group_call_session_tx(uuid,text)',
    'EXECUTE'
  )

UNION ALL

SELECT
  'check_8_w3_service_role',
  'false',
  has_function_privilege(
    'service_role',
    'public.nex_join_group_call_session_tx(uuid,text)',
    'EXECUTE'
  )::TEXT,
  NOT has_function_privilege(
    'service_role',
    'public.nex_join_group_call_session_tx(uuid,text)',
    'EXECUTE'
  )

UNION ALL

SELECT
  'check_9_w3_authenticated',
  'true',
  has_function_privilege(
    'authenticated',
    'public.nex_join_group_call_session_tx(uuid,text)',
    'EXECUTE'
  )::TEXT,
  has_function_privilege(
    'authenticated',
    'public.nex_join_group_call_session_tx(uuid,text)',
    'EXECUTE'
  )

-- ── Check 10-12 · pg_proc · prosecdef + proconfig + proowner ─────────────────

UNION ALL

SELECT
  'check_10_w1_prosecdef' AS check_name,
  'true' AS expected,
  prosecdef::TEXT AS observed,
  prosecdef AS passed_bool
FROM pg_proc
WHERE proname = 'nex_invite_to_call_tx'
  AND pronargs = 7

UNION ALL

SELECT
  'check_11_w2_prosecdef',
  'true',
  prosecdef::TEXT,
  prosecdef
FROM pg_proc
WHERE proname = 'nex_create_group_call_session_tx'
  AND pronargs = 4

UNION ALL

SELECT
  'check_12_w3_prosecdef',
  'true',
  prosecdef::TEXT,
  prosecdef
FROM pg_proc
WHERE proname = 'nex_join_group_call_session_tx'
  AND pronargs = 2

-- ── Check 13-15 · proconfig contains correct search_path ─────────────────────

UNION ALL

SELECT
  'check_13_w1_search_path',
  'search_path=public,pg_temp (or similar)',
  COALESCE(array_to_string(proconfig, ','), '(null)'),
  (proconfig IS NOT NULL AND proconfig::TEXT LIKE '%search_path%')
FROM pg_proc
WHERE proname = 'nex_invite_to_call_tx'
  AND pronargs = 7

UNION ALL

SELECT
  'check_14_w2_search_path',
  'search_path=public,pg_temp (or similar)',
  COALESCE(array_to_string(proconfig, ','), '(null)'),
  (proconfig IS NOT NULL AND proconfig::TEXT LIKE '%search_path%')
FROM pg_proc
WHERE proname = 'nex_create_group_call_session_tx'
  AND pronargs = 4

UNION ALL

SELECT
  'check_15_w3_search_path',
  'search_path=public,pg_temp (or similar)',
  COALESCE(array_to_string(proconfig, ','), '(null)'),
  (proconfig IS NOT NULL AND proconfig::TEXT LIKE '%search_path%')
FROM pg_proc
WHERE proname = 'nex_join_group_call_session_tx'
  AND pronargs = 2

-- ── Check 16-21 · mig-133 RLS policies unchanged ─────────────────────────────

UNION ALL

SELECT
  'check_16_rls_participant_insert_policy_exists',
  'nex_group_call_participant_insert_self',
  COALESCE(polname, '(missing)'),
  (polname IS NOT NULL)
FROM pg_policy
JOIN pg_class ON pg_class.oid = pg_policy.polrelid
WHERE pg_class.relname = 'nex_group_call_participant'
  AND polname = 'nex_group_call_participant_insert_self'
  AND polcmd = 'a'  -- INSERT

UNION ALL

SELECT
  'check_17_rls_participant_select_policy_exists',
  'nex_group_call_participant_select_scoped',
  COALESCE(polname, '(missing)'),
  (polname IS NOT NULL)
FROM pg_policy
JOIN pg_class ON pg_class.oid = pg_policy.polrelid
WHERE pg_class.relname = 'nex_group_call_participant'
  AND polname = 'nex_group_call_participant_select_scoped'
  AND polcmd = 'r'  -- SELECT

UNION ALL

SELECT
  'check_18_rls_session_insert_policy_exists',
  'nex_group_call_session_insert_host',
  COALESCE(polname, '(missing)'),
  (polname IS NOT NULL)
FROM pg_policy
JOIN pg_class ON pg_class.oid = pg_policy.polrelid
WHERE pg_class.relname = 'nex_group_call_session'
  AND polname = 'nex_group_call_session_insert_host'
  AND polcmd = 'a'

-- ── Check 19-20 · cap trigger present and enabled ─────────────────────────────

UNION ALL

SELECT
  'check_19_cap_trigger_exists',
  'nex_group_call_participant_cap_tr',
  COALESCE(tgname, '(missing)'),
  (tgname IS NOT NULL)
FROM pg_trigger
JOIN pg_class ON pg_class.oid = pg_trigger.tgrelid
WHERE pg_class.relname = 'nex_group_call_participant'
  AND tgname = 'nex_group_call_participant_cap_tr'

UNION ALL

SELECT
  'check_20_cap_trigger_enabled',
  'O (origin fires = enabled)',
  COALESCE(tgenabled::TEXT, '(missing)'),
  (tgenabled = 'O')
FROM pg_trigger
JOIN pg_class ON pg_class.oid = pg_trigger.tgrelid
WHERE pg_class.relname = 'nex_group_call_participant'
  AND tgname = 'nex_group_call_participant_cap_tr'

-- ── Check 21 · server identity — not production ───────────────────────────────

UNION ALL

SELECT
  'check_21_server_not_production',
  'must not contain ijvqdvsvwtwxzcqmoqit',
  inet_server_addr()::TEXT,
  (inet_server_addr()::TEXT NOT LIKE '%ijvqdvsvwtwxzcqmoqit%')

-- ── Check 22 · no PUBLIC execute on W1 ───────────────────────────────────────
--
-- Prior version used has_function_privilege('PUBLIC', ...) which raises
-- `role "PUBLIC" does not exist` because PUBLIC is a pseudo-role (role OID
-- 0, not a row in pg_roles). The correct way is to inspect proacl directly.
--
-- Semantics (per owner spec 2026-11-19):
--   · Use aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) so a
--     NULL proacl correctly expands to the DEFAULT function ACL — which
--     includes PUBLIC EXECUTE. A NULL proacl therefore FAILS the
--     "no PUBLIC execute" assertion.
--   · Resolve each RPC by exact signature (argument types, not name/count
--     alone). A missing function FAILS the check — no silent NOT EXISTS
--     short-circuit to passed.
--   · grantee = 0 is the PUBLIC pseudo-role identifier in aclexplode.

UNION ALL

SELECT
  'check_22_w1_no_public_execute',
  'false',
  COALESCE((
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
       WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
    ) THEN 'true' ELSE 'false' END
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'nex_invite_to_call_tx'
       AND pg_get_function_identity_arguments(p.oid) =
           'p_invitee_account_id uuid, p_media_type text, p_host_country text, p_attachment_meta jsonb, p_invite_body text, p_attachment_url text, p_existing_session_id uuid'
     LIMIT 1
  ), 'missing'),
  (
    EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'nex_invite_to_call_tx'
         AND pg_get_function_identity_arguments(p.oid) =
             'p_invitee_account_id uuid, p_media_type text, p_host_country text, p_attachment_meta jsonb, p_invite_body text, p_attachment_url text, p_existing_session_id uuid'
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
       WHERE n.nspname = 'public' AND p.proname = 'nex_invite_to_call_tx'
         AND pg_get_function_identity_arguments(p.oid) =
             'p_invitee_account_id uuid, p_media_type text, p_host_country text, p_attachment_meta jsonb, p_invite_body text, p_attachment_url text, p_existing_session_id uuid'
         AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
    )
  )

UNION ALL

SELECT
  'check_23_w2_no_public_execute',
  'false',
  COALESCE((
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
       WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
    ) THEN 'true' ELSE 'false' END
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'nex_create_group_call_session_tx'
       AND pg_get_function_identity_arguments(p.oid) =
           'p_media_type text, p_from_call_link_id uuid, p_host_country text, p_invitee_account_ids uuid[]'
     LIMIT 1
  ), 'missing'),
  (
    EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'nex_create_group_call_session_tx'
         AND pg_get_function_identity_arguments(p.oid) =
             'p_media_type text, p_from_call_link_id uuid, p_host_country text, p_invitee_account_ids uuid[]'
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
       WHERE n.nspname = 'public' AND p.proname = 'nex_create_group_call_session_tx'
         AND pg_get_function_identity_arguments(p.oid) =
             'p_media_type text, p_from_call_link_id uuid, p_host_country text, p_invitee_account_ids uuid[]'
         AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
    )
  )

UNION ALL

SELECT
  'check_24_w3_no_public_execute',
  'false',
  COALESCE((
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
       WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
    ) THEN 'true' ELSE 'false' END
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'nex_join_group_call_session_tx'
       AND pg_get_function_identity_arguments(p.oid) =
           'p_session_id uuid, p_role text'
     LIMIT 1
  ), 'missing'),
  (
    EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'nex_join_group_call_session_tx'
         AND pg_get_function_identity_arguments(p.oid) =
             'p_session_id uuid, p_role text'
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
       WHERE n.nspname = 'public' AND p.proname = 'nex_join_group_call_session_tx'
         AND pg_get_function_identity_arguments(p.oid) =
             'p_session_id uuid, p_role text'
         AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
    )
  )

ORDER BY check_name;
