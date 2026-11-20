-- ============================================================================
-- CANDIDATE · UNAPPLIED · UNNUMBERED · PREVIEW ONLY
-- nex_create_group_call_session_tx · W2 session-creation RPC
-- ============================================================================
--
-- PURPOSE
-- -------
-- This candidate introduces a NEW PL/pgSQL function
-- `nex_create_group_call_session_tx` that wraps the session-creation
-- write path currently performed by
-- `src/lib/nex-native/calls/group-call-service.ts:createGroupCallSession`.
--
-- It does NOT supersede, replace, or conflict with:
--   · CANDIDATE_nex_group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW.sql
--     (v4 rewrites `nex_invite_to_call_tx` · the invite-only flow)
--   · Migration 356 (`nex_invite_to_call_tx`)
--   · Migration 133 (tables, trigger, RLS)
--
-- v4 and v5-W2 cover DIFFERENT code paths and can be applied
-- INDEPENDENTLY in any order:
--   · v4 → invite flow atomicity (nex_invite_to_call_tx)
--   · v5-W2 → session-creation atomicity (nex_create_group_call_session_tx)
--
-- RELATIONSHIP TO GB-4CAP
-- -----------------------
-- GB-4CAP (concurrent participant insert race) is THEORETICAL for this
-- writer. Because the session row is brand-new on every invocation, no
-- concurrent writer can know the session_id before this transaction
-- COMMITs. The cap-trigger (mig-133 `nex_group_call_participant_cap_tr`)
-- and the server-side `.slice(0, 3)` in the TS layer remain as
-- defence-in-depth. A FOR UPDATE lock on the new session row is
-- therefore UNNECESSARY here — unlike v4's invite path where an
-- existing session_id is published and concurrent callers can race.
-- See inline comment in function body.
--
-- WHAT THIS PREVIEW DOES NOT DO
-- --------------------------------
-- · Does NOT touch mig-133, mig-356, or any applied migration.
-- · Does NOT modify the mig-133 cap trigger.
-- · Does NOT add schema (no new columns, no new indexes, no new tables).
-- · Does NOT write `INSERT INTO nex_migration_history` — version number
--   is chosen at promote-time against sandbox `kdstoyyeygcopkogqsyv`.
-- · Does NOT touch application code. Live callers remain pointed at the
--   existing `createGroupCallSession` direct-write path until a feature
--   flag is flipped (separately authorised).
-- · Does NOT touch production. If/when applied: sandbox
--   `kdstoyyeygcopkogqsyv` ONLY. Production `ijvqdvsvwtwxzcqmoqit`
--   remains sealed.
--
-- HALT NOTICE
-- -----------
-- Do NOT apply this file without fresh owner authorisation naming the
-- sandbox ref `kdstoyyeygcopkogqsyv`. The migration number must be
-- chosen by inspecting `nex_migration_history` at promote-time.
--
-- ROLLBACK
-- --------
-- See companion file:
--   CANDIDATE_nex_call_session_create_rpc_v5_w2_PREVIEW_rollback.sql
-- ============================================================================

BEGIN;

-- ── Function definition ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nex_create_group_call_session_tx(
  p_media_type         TEXT,    -- 'audio' | 'video'
  p_from_call_link_id  UUID,    -- nullable · pass NULL when not link-initiated
  p_host_country       TEXT,    -- host's country string (e.g. 'ireland')
  p_invitee_account_ids UUID[]  -- up to 3 guest account IDs (server enforces cap)
) RETURNS TABLE (
  out_session_id      UUID,
  out_participants    JSONB,   -- JSON array of {id, session_id, account_id, role, invited_at, joined_at}
  out_rejected_count  INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_self_sb_user_id  UUID;
  v_self_account_id  UUID;
  v_session_id       UUID;
  v_host_participant JSONB;
  v_guest_row        JSONB;
  v_now              TIMESTAMPTZ;
  v_all_participants JSONB;
  v_capped_invitees  UUID[];
  v_rejected_count   INT;
  v_invitee_id       UUID;
  v_guest_id         UUID;
  v_invited_at_ts    TIMESTAMPTZ;
BEGIN
  -- ── Caller identity · fail-closed ────────────────────────────────────
  v_self_sb_user_id := auth.uid();
  IF v_self_sb_user_id IS NULL THEN
    RAISE EXCEPTION 'caller_identity_required · auth.uid() is NULL'
      USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_self_account_id
    FROM nex_account
   WHERE supabase_user_id = v_self_sb_user_id;
  IF v_self_account_id IS NULL THEN
    RAISE EXCEPTION 'caller_account_not_found · no nex_account for auth.uid()'
      USING ERRCODE = '42501';
  END IF;

  -- ── Media type validation ─────────────────────────────────────────────
  IF p_media_type NOT IN ('audio', 'video') THEN
    RAISE EXCEPTION 'invalid_media_type · must be audio or video, got: %', p_media_type
      USING ERRCODE = '22023';
  END IF;

  -- ── Server-side cap on invitees (defence in depth · TS slices too) ────
  -- Cap p_invitee_account_ids to the first 3 elements. Host + 3 = 4 max.
  v_capped_invitees  := p_invitee_account_ids[1:3];
  v_rejected_count   := GREATEST(0,
    COALESCE(array_length(p_invitee_account_ids, 1), 0)
    - COALESCE(array_length(v_capped_invitees, 1), 0)
  );

  -- ── Capture NOW() once for consistency ───────────────────────────────
  v_now := NOW();

  -- ── Insert session row ────────────────────────────────────────────────
  INSERT INTO nex_group_call_session (
    host_account_id,
    media_type,
    state,
    from_call_link_id
  ) VALUES (
    v_self_account_id,
    p_media_type,
    'ringing',
    p_from_call_link_id
  )
  RETURNING id INTO v_session_id;

  -- ── GB-4CAP note ──────────────────────────────────────────────────────
  -- A FOR UPDATE lock on v_session_id is NOT taken here. This is intentional:
  -- the session row was just inserted above inside this transaction; no
  -- concurrent transaction can know session_id before our COMMIT, so no
  -- race with another participant-insert caller is possible at this point.
  -- Cap enforcement rests on (1) the mig-133 BEFORE INSERT trigger
  -- `nex_group_call_participant_cap_tr` and (2) the TS-layer `.slice(0, 3)`.
  -- The FOR UPDATE pattern from v4 (`nex_invite_to_call_tx`) is appropriate
  -- for existing sessions (session_id already published); it is unnecessary
  -- for a brand-new session that only this transaction knows about.

  -- ── Insert host participant row ───────────────────────────────────────
  INSERT INTO nex_group_call_participant (
    session_id,
    account_id,
    role,
    invited_at,
    joined_at
  ) VALUES (
    v_session_id,
    v_self_account_id,
    'host',
    v_now,
    v_now        -- host joins immediately (matches current service contract)
  )
  RETURNING jsonb_build_object(
    'id',          id,
    'session_id',  session_id,
    'account_id',  account_id,
    'role',        role,
    'invited_at',  invited_at,
    'joined_at',   joined_at
  ) INTO v_host_participant;

  -- ── Insert guest participant rows (loop · unique_violation per row) ───
  v_all_participants := jsonb_build_array(v_host_participant);

  FOREACH v_invitee_id IN ARRAY v_capped_invitees LOOP
    BEGIN
      INSERT INTO nex_group_call_participant (
        session_id,
        account_id,
        role,
        invited_at,
        joined_at       -- NULL · guest has not joined yet
      ) VALUES (
        v_session_id,
        v_invitee_id,
        'guest',
        v_now,
        NULL
      )
      RETURNING jsonb_build_object(
        'id',          id,
        'session_id',  session_id,
        'account_id',  account_id,
        'role',        role,
        'invited_at',  invited_at,
        'joined_at',   joined_at
      ) INTO v_guest_row;

      v_all_participants := v_all_participants || v_guest_row;

    EXCEPTION
      WHEN unique_violation THEN
        -- Duplicate (session_id, account_id) · skip this guest.
        -- Consistent with the current service-layer behaviour at line 111
        -- of group-call-service.ts (error.code === "23505" → continue).
        NULL;
    END;
  END LOOP;

  -- ── Return ────────────────────────────────────────────────────────────
  RETURN QUERY SELECT
    v_session_id,
    v_all_participants,
    v_rejected_count;
END;
$$;

-- ── Permission envelope · least privilege ─────────────────────────────────────
REVOKE ALL ON FUNCTION nex_create_group_call_session_tx(TEXT, UUID, TEXT, UUID[])
  FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION nex_create_group_call_session_tx(TEXT, UUID, TEXT, UUID[])
  FROM anon;

REVOKE EXECUTE ON FUNCTION nex_create_group_call_session_tx(TEXT, UUID, TEXT, UUID[])
  FROM service_role;

GRANT EXECUTE ON FUNCTION nex_create_group_call_session_tx(TEXT, UUID, TEXT, UUID[])
  TO authenticated;

-- NOTE: No `INSERT INTO nex_migration_history` row.
-- This preview has no assigned version number; it is chosen at promote-time
-- by inspecting `nex_migration_history` on sandbox `kdstoyyeygcopkogqsyv`.

COMMIT;
