-- ============================================================================
-- CANDIDATE · nex_group_call_invite v3 · whitespace-strict accept_href guard
-- UNAPPLIED · UNASSIGNED NUMBER · PREVIEW-ONLY · DO NOT APPLY
-- ============================================================================
--
-- Purpose: forward correction of GB-WHITESPACE-GUARD (ledger
--   `evidence/master-flow/RECONCILIATION-LEDGER-2026-11-18.md`
--   §16.41.7 · root-cause record · battery case D tab-newline sub-case
--   demonstrated a full chain-write through mig-356's `btrim`-based
--   body guard because PostgreSQL `btrim(text)` with no second argument
--   strips ONLY the ASCII space 0x20, so `\t \n \r \f \v` bypass).
--
-- Resolves §16.42.5: the earlier draft asked the owner to pick
-- shape (a) narrower whitespace guard vs shape (b) match the
-- established TypeScript contract at the SQL boundary. Owner
-- directive 2026-11-19 chose shape (b) — regex match of
-- `_LANE_G_ACCEPT_HREF_PATTERN` in
-- `src/lib/nex-native/peer-message-service.ts:768`.
--
-- Scope (byte-equivalent to mig-356 lines 142–373 EXCEPT the guard):
--   · Identity derivation from auth.uid() · fail-closed 42501
--   · Server-side v_self_account_id resolution
--   · Invitee + media_type + session ownership + idempotent participant
--   · Ordered-pair conversation get-or-create
--   · attachment_type='call_invite' + attachment_url=p_attachment_url
--   · SECURITY DEFINER · search_path = public, pg_temp
--   · REVOKE ALL FROM PUBLIC · REVOKE EXECUTE FROM anon + service_role
--   · GRANT EXECUTE TO authenticated ONLY
--
-- HALT NOTICE
--   Do NOT apply this file without fresh owner authorisation naming
--   the sandbox ref `kdstoyyeygcopkogqsyv`. Local inspection cannot
--   confirm whether another migration already holds a sequential
--   number (e.g. 357) that would collide; the final migration number
--   must be chosen with sandbox `nex_migration_history` inspection
--   at promote-time. For that reason this preview deliberately does
--   NOT contain an `INSERT INTO nex_migration_history (version, ...)`
--   row · promotion will add the row when the real number is decided.
--
-- ============================================================================

BEGIN;

-- ── Eliminate prior overload(s) ──────────────────────────────────────
-- Drop the 7-param signature carried by mig-356. Safe idempotent drop;
-- succeeds whether the function is present or not.
DROP FUNCTION IF EXISTS nex_invite_to_call_tx(
  UUID,  -- p_invitee_account_id
  TEXT,  -- p_media_type
  TEXT,  -- p_host_country
  JSONB, -- p_attachment_meta
  TEXT,  -- p_invite_body
  TEXT,  -- p_attachment_url
  UUID   -- p_existing_session_id
);

-- ── New body · byte-equivalent to mig-356 EXCEPT the attachment_url guard ──
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
  -- ── Caller identity · fail-closed (unchanged from mig-356) ──────
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

  -- ── Required attachment URL · contract-matching whitespace-strict guard ──
  -- Match the established TypeScript contract `_LANE_G_ACCEPT_HREF_PATTERN`
  -- in src/lib/nex-native/peer-message-service.ts:768.
  -- POSIX ERE equivalent, case-insensitive (`~*`), 36-char hex-with-hyphens
  -- session segment, exact full-string anchors.
  IF p_attachment_url IS NULL
     OR p_attachment_url !~* '^/nex-native/call/preview\?session=[0-9a-f-]{36}&accept=1$' THEN
    RAISE EXCEPTION 'attachment_url_required · call_invite needs a well-formed accept_href matching _LANE_G_ACCEPT_HREF_PATTERN'
      USING ERRCODE = '22023';
  END IF;

  -- ── Invitee validation ────────────────────────────────────────
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

  -- ── Session ──────────────────────────────────────────────────
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

  -- ── Participant · idempotent via UNIQUE(session_id, account_id) ─
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

  -- ── Peer conversation · ordered-pair convention ──────────────
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

  -- ── Chat message · attachment pair satisfied by construction ──
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

-- ── Permissions · least privilege (identical to mig-356 lines 328–364) ──
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

-- NOTE: no `INSERT INTO nex_migration_history` row. This preview has no
-- version number yet · the number is chosen at promote-time against
-- sandbox `kdstoyyeygcopkogqsyv`.

COMMIT;
