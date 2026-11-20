-- ============================================================================
-- CANDIDATE · ROLLBACK for v4 combined whitespace + 4cap preview
-- UNAPPLIED · PREVIEW-ONLY · OPERATOR SEQUENCE DOCUMENTED BELOW
-- ============================================================================
--
-- Intent: restore the `nex_invite_to_call_tx` function body to the
-- mig-356 state (btrim-based guard · no FOR UPDATE lock) if the v4
-- combined preview is applied and then needs to be reverted.
--
-- This file is an OFFLINE rollback draft. It is NOT verified-rollback.
-- Sandbox migration history has not been inspected this batch, so the
-- promote-time operator must confirm that mig-356 is the correct prior
-- function state before running this rollback.
--
-- ─────────────────────────────────────────────────────────────────────
-- WARNING · reintroducing the mig-356 body REOPENS two known defects
-- ─────────────────────────────────────────────────────────────────────
--   · GB-WHITESPACE-GUARD · the `length(btrim(x)) = 0` guard strips
--     only ASCII space (0x20). Tab/LF/CR/FF/VT bypass. Non-contract
--     destinations (e.g. `/evil/path?session=…`) pass the guard.
--   · GB-4CAP · the BEFORE INSERT cap trigger in mig-133 counts rows
--     non-serialisably. Concurrent invites to the SAME session can
--     exceed the 4-participant invariant.
--
-- Do NOT run this rollback unless:
--   (i)  the operator explicitly accepts that both defects become
--        LIVE again on sandbox `kdstoyyeygcopkogqsyv`, AND
--   (ii) a separate forward-only correction is already in flight
--        (otherwise the sandbox is worse off than pre-v4), AND
--   (iii) an explicit owner authorisation names rollback as the
--         intended action (promotion is a separate gate from
--         rollback; a prior promote-to-v4 authorisation does NOT
--         imply authorisation to roll back).
--
-- ─────────────────────────────────────────────────────────────────────
-- Operator sequence (two statements · one transaction)
-- ─────────────────────────────────────────────────────────────────────
--   1. DROP the v4 7-param signature.
--   2. CREATE the mig-356 function body (see below · copied verbatim
--      from the applied `nex-supabase/migrations/356_nex_group_call_
--      invite_v2.sql` lines 142–373). Permissions re-applied.
--
-- The rollback is a TEXT-level copy of mig-356. It does NOT read from
-- the migrations folder at run time; the function body is embedded
-- here so the rollback is self-contained.
-- ============================================================================

BEGIN;

-- ── Drop the v4 combined function ────────────────────────────────────
DROP FUNCTION IF EXISTS nex_invite_to_call_tx(
  UUID,  -- p_invitee_account_id
  TEXT,  -- p_media_type
  TEXT,  -- p_host_country
  JSONB, -- p_attachment_meta
  TEXT,  -- p_invite_body
  TEXT,  -- p_attachment_url
  UUID   -- p_existing_session_id
);

-- ── Recreate mig-356 body (verbatim · reopens both defects) ──────────
CREATE FUNCTION nex_invite_to_call_tx(
  p_invitee_account_id UUID,
  p_media_type TEXT,
  p_host_country TEXT,
  p_attachment_meta JSONB,
  p_invite_body TEXT,
  p_attachment_url TEXT,
  p_existing_session_id UUID DEFAULT NULL
) RETURNS TABLE (
  out_session_id UUID,
  out_participant_id UUID,
  out_conversation_id UUID,
  out_message_id UUID,
  out_skipped TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_sb_user_id UUID;
  v_self_account_id UUID;
  v_session_id UUID;
  v_participant_id UUID;
  v_conversation_id UUID;
  v_message_id UUID;
  v_a UUID;
  v_b UUID;
BEGIN
  v_caller_sb_user_id := auth.uid();
  IF v_caller_sb_user_id IS NULL THEN
    RAISE EXCEPTION 'caller_identity_required · auth.uid() is NULL'
      USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_self_account_id
  FROM nex_account
  WHERE supabase_user_id = v_caller_sb_user_id;
  IF v_self_account_id IS NULL THEN
    RAISE EXCEPTION 'caller_account_not_found · no nex_account for auth.uid()'
      USING ERRCODE = '42501';
  END IF;

  -- NOTE · reopens GB-WHITESPACE-GUARD. btrim strips only ASCII space.
  IF p_attachment_url IS NULL OR length(btrim(p_attachment_url)) = 0 THEN
    RAISE EXCEPTION 'attachment_url_required · call_invite needs an accept_href'
      USING ERRCODE = '22023';
  END IF;

  IF p_invitee_account_id IS NULL THEN
    RAISE EXCEPTION 'invitee_account_id_required'
      USING ERRCODE = '22023';
  END IF;

  IF v_self_account_id = p_invitee_account_id THEN
    RAISE EXCEPTION 'self_invite_denied'
      USING ERRCODE = '22023';
  END IF;

  IF p_media_type NOT IN ('audio', 'video') THEN
    RAISE EXCEPTION 'invalid_media_type · must be audio or video'
      USING ERRCODE = '22023';
  END IF;

  IF p_existing_session_id IS NOT NULL THEN
    SELECT id INTO v_session_id
    FROM nex_group_call_session
    WHERE id = p_existing_session_id
      AND host_account_id = v_self_account_id;
    IF v_session_id IS NULL THEN
      RAISE EXCEPTION 'session_not_owned'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    INSERT INTO nex_group_call_session (
      host_account_id,
      media_type,
      state,
      host_country
    ) VALUES (
      v_self_account_id,
      p_media_type,
      'ringing',
      p_host_country
    )
    RETURNING id INTO v_session_id;
  END IF;

  -- NOTE · reopens GB-4CAP. No FOR UPDATE here.

  BEGIN
    INSERT INTO nex_group_call_participant (
      session_id,
      account_id,
      invited_at
    ) VALUES (
      v_session_id,
      p_invitee_account_id,
      NOW()
    )
    RETURNING id INTO v_participant_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT id INTO v_participant_id
      FROM nex_group_call_participant
      WHERE session_id = v_session_id
        AND account_id = p_invitee_account_id;
      RETURN QUERY SELECT
        v_session_id,
        v_participant_id,
        NULL::UUID,
        NULL::UUID,
        'already_invited'::TEXT;
      RETURN;
  END;

  IF v_self_account_id < p_invitee_account_id THEN
    v_a := v_self_account_id;
    v_b := p_invitee_account_id;
  ELSE
    v_a := p_invitee_account_id;
    v_b := v_self_account_id;
  END IF;

  SELECT id INTO v_conversation_id
  FROM nex_peer_conversation
  WHERE participant_a_id = v_a
    AND participant_b_id = v_b;
  IF v_conversation_id IS NULL THEN
    BEGIN
      INSERT INTO nex_peer_conversation (
        participant_a_id,
        participant_b_id
      ) VALUES (
        v_a,
        v_b
      )
      RETURNING id INTO v_conversation_id;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT id INTO v_conversation_id
        FROM nex_peer_conversation
        WHERE participant_a_id = v_a
          AND participant_b_id = v_b;
    END;
  END IF;

  INSERT INTO nex_peer_message (
    conversation_id,
    sender_account_id,
    body,
    attachment_type,
    attachment_url,
    attachment_meta
  ) VALUES (
    v_conversation_id,
    v_self_account_id,
    p_invite_body,
    'call_invite',
    p_attachment_url,
    p_attachment_meta
  )
  RETURNING id INTO v_message_id;

  RETURN QUERY SELECT
    v_session_id,
    v_participant_id,
    v_conversation_id,
    v_message_id,
    NULL::TEXT;
END;
$$;

-- ── Permissions re-applied · mig-356 envelope ────────────────────────
REVOKE ALL ON FUNCTION nex_invite_to_call_tx(
  UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION nex_invite_to_call_tx(
  UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID
) FROM anon;

REVOKE EXECUTE ON FUNCTION nex_invite_to_call_tx(
  UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID
) FROM service_role;

GRANT EXECUTE ON FUNCTION nex_invite_to_call_tx(
  UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID
) TO authenticated;

-- NOTE: no `nex_migration_history` DELETE. Migration-history housekeeping
-- is a separate operator decision · the rollback deliberately does not
-- fabricate a history edit.

COMMIT;
