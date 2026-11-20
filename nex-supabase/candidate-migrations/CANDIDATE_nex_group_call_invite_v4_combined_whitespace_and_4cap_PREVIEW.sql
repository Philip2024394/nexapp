-- ============================================================================
-- CANDIDATE · nex_group_call_invite v4 · COMBINED whitespace-strict guard
--             + GB-4CAP session-row FOR UPDATE lock
-- UNAPPLIED · UNASSIGNED NUMBER · PREVIEW-ONLY · DO NOT APPLY
-- ============================================================================
--
-- Combines two prior candidate previews into ONE function-body rewrite:
--   1. CANDIDATE_nex_group_call_invite_v3_whitespace_strict_PREVIEW.sql
--        (Agent A · GB-WHITESPACE-GUARD forward correction · derived
--         from `_LANE_G_ACCEPT_HREF_PATTERN` in
--         `src/lib/nex-native/peer-message-service.ts:768`)
--   2. CANDIDATE_nex_group_call_4cap_lock_DESIGN_PREVIEW.sql
--        (Agent C · GB-4CAP smallest correction · PERFORM 1 FROM
--         nex_group_call_session WHERE id = v_session_id FOR UPDATE)
--
-- Rationale for ONE combined candidate instead of two sequential applies:
--   · Both corrections rewrite the SAME `nex_invite_to_call_tx` 7-param
--     function body. Two separate DROP + CREATE OR REPLACE cycles is the
--     biggest approved-write surface for the smallest real change.
--   · Both corrections are byte-additive with respect to mig-356: one
--     new guard clause + one new PERFORM statement. They do not conflict
--     with each other at any line.
--   · Combined rollback is simpler · drops v4 · recreates mig-356.
--
-- Scope (byte-equivalent to mig-356 lines 142–373 EXCEPT):
--   · GB-WHITESPACE-GUARD · `length(btrim(p_attachment_url)) = 0` guard
--     is REPLACED by a POSIX ERE `!~*` contract-match against
--     `_LANE_G_ACCEPT_HREF_PATTERN`. ERRCODE 22023 preserved.
--   · GB-4CAP · ONE new `PERFORM 1 FROM nex_group_call_session WHERE
--     id = v_session_id FOR UPDATE;` statement is INSERTED between the
--     session-ownership/creation block and the participant INSERT.
--   · Identity derivation from auth.uid() · fail-closed 42501 (unchanged)
--   · Server-side v_self_account_id resolution (unchanged)
--   · Invitee + media_type + session ownership + idempotent participant
--     via UNIQUE(session_id, account_id) dedup catch (unchanged)
--   · Ordered-pair conversation get-or-create (unchanged)
--   · attachment_type='call_invite' + attachment_url=p_attachment_url
--     → pair CHECK `nex_peer_message_attachment_pair_check` satisfied by
--     construction (unchanged)
--   · SECURITY DEFINER · SET search_path = public, pg_temp (unchanged)
--   · REVOKE ALL FROM PUBLIC · REVOKE EXECUTE FROM anon + service_role ·
--     GRANT EXECUTE TO authenticated ONLY (unchanged)
--   · mig-133 BEFORE INSERT cap trigger (`nex_group_call_participant_
--     cap_tr`) UNCHANGED · remains as defence-in-depth belt. The new
--     FOR UPDATE is the braces.
--
-- What this preview does NOT do
--   · Does NOT touch mig-356 or mig-133 in place.
--   · Does NOT drop or modify the mig-133 cap trigger.
--   · Does NOT add schema (no new columns, no new indexes).
--   · Does NOT change the function signature.
--   · Does NOT write an `INSERT INTO nex_migration_history (version, …)`
--     row · the version number is chosen at promote-time against sandbox
--     `kdstoyyeygcopkogqsyv` by inspecting `nex_migration_history`.
--   · Does NOT touch application code · the TypeScript wrapper
--     `_LANE_G_ACCEPT_HREF_PATTERN`, `inviteToCall` body, and
--     `_invite-actions.ts` are unchanged.
--   · Does NOT touch production. If/when applied, sandbox
--     `kdstoyyeygcopkogqsyv` ONLY. Production `ijvqdvsvwtwxzcqmoqit`
--     remains sealed.
--
-- HALT NOTICE
--   Do NOT apply this file without fresh owner authorisation naming
--   the sandbox ref `kdstoyyeygcopkogqsyv`. Local inspection cannot
--   confirm whether another migration already holds a sequential
--   number that would collide; the final migration number must be
--   chosen with sandbox `nex_migration_history` inspection at
--   promote-time. The two source previews (v3 whitespace and v4
--   4cap DESIGN) are preserved on disk alongside this combined file
--   as traceable inputs · DO NOT delete them.
--
-- Known gaps that remain OPEN even after this preview is applied
--   · Case B · NULL `auth.uid()` fail-closed path: UNVERIFIED (no
--     authenticated-RPC coverage yet; code path is exercised only by
--     authorisation gate not by a test).
--   · Case G · bounded intermediate-write fault: STATE_BLOCKER
--     (unchanged · no safe mid-chain fault available after mig-356).
--   · The mig-133 trigger invariant is "at most 4 rows ever for a
--     given session_id" (counts without filtering `left_at`). This
--     preview preserves that invariant; it does NOT re-define it to
--     "at most 4 active rows". If the product requires 4 ACTIVE
--     rows, that is a separate schema/trigger change outside this
--     preview's scope.
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

-- ── New body · byte-equivalent to mig-356 EXCEPT:
--      (a) attachment_url guard replaced by contract-match regex, and
--      (b) session-row FOR UPDATE inserted before participant INSERT
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

  -- ── (a) Required attachment URL · contract-matching whitespace-strict guard ──
  -- GB-WHITESPACE-GUARD forward correction. Matches the established
  -- TypeScript contract `_LANE_G_ACCEPT_HREF_PATTERN` in
  -- `src/lib/nex-native/peer-message-service.ts:768`.
  -- POSIX ERE equivalent, case-insensitive (`~*`), 36-char hex-with-
  -- hyphens session segment, exact full-string anchors (^…$).
  -- NULL short-circuits before the regex (avoids NULL-regex-NULL footgun).
  IF p_attachment_url IS NULL
     OR p_attachment_url !~* '^/nex-native/call/preview\?session=[0-9a-f-]{36}&accept=1$' THEN
    RAISE EXCEPTION 'attachment_url_required · call_invite needs a well-formed accept_href matching _LANE_G_ACCEPT_HREF_PATTERN'
      USING ERRCODE = '22023';
  END IF;

  -- ── Invitee validation (unchanged from mig-356) ──────────────────
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

  -- ── Session ownership + creation (unchanged from mig-356) ────────
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

  -- ── (b) GB-4CAP · race-safe lock on the parent session row ───────
  -- This PERFORM is the ONLY semantic addition at this point vs mig-356.
  -- It acquires a row-level write lock on the session row BEFORE the
  -- participant INSERT fires the mig-133 BEFORE INSERT cap trigger.
  -- Concurrent invites to the SAME session now serialise here;
  -- concurrent invites to DIFFERENT sessions are unaffected because
  -- the lock scope is `WHERE id = v_session_id`.
  --
  -- The mig-133 cap trigger stays in place as defence-in-depth.
  -- Lock order convention (to document on promote): session first,
  -- participant second. No other transaction in the repo currently
  -- locks `nex_group_call_session` with FOR UPDATE / FOR SHARE, so
  -- no deadlock cycle exists today.
  PERFORM 1
  FROM nex_group_call_session
  WHERE id = v_session_id
  FOR UPDATE;

  -- ── Participant · idempotent via UNIQUE(session_id, account_id) ──
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

  -- ── Peer conversation · ordered-pair convention (unchanged) ──────
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

  -- ── Chat message · attachment pair satisfied by construction ─────
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
