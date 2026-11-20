-- ============================================================================
-- CANDIDATE MIGRATION · C001 · nex_invite_to_call_tx
-- UNAPPLIED · REVIEW REQUIRED · DO NOT APPLY WITHOUT SEPARATE AUTHORISATION
-- ============================================================================
--
-- Target gap: §16.31 + §16.32 documented atomicity gap in
-- `inviteToCall` (src/lib/nex-native/calls/invite-service.ts). That
-- function performs four writes in sequence (nex_group_call_session,
-- nex_group_call_participant, nex_peer_conversation,
-- nex_peer_message) with no transaction wrapping them. A failure
-- after writes 1 or 2 leaves an orphan session + participant row
-- with no invite message in the recipient's chat thread.
--
-- This candidate wraps those four writes in a single PL/pgSQL
-- function. Postgres executes each function body as an atomic
-- subtransaction: any unhandled EXCEPTION rolls back ALL writes the
-- function has performed so far. That is the rollback property the
-- application layer currently cannot provide.
--
-- Security posture
-- ----------------
-- · SECURITY DEFINER with a FIXED search_path (`public, pg_temp`) ·
--   prevents a schema-poisoning attack from re-defining `nex_account`
--   or `nex_peer_message` into a schema reachable by the caller's
--   search_path.
-- · Explicit caller-identity check: caller passes their own
--   `supabase_user_id`; we verify it matches `auth.uid()` when the
--   call is routed through a Supabase auth session. (When the caller
--   is service_role, `auth.uid()` returns NULL · we accept the
--   passed value as authoritative because service_role already has
--   broader privileges and the TypeScript wrapper NEVER accepts a
--   client-supplied `supabase_user_id` · it always passes the one
--   resolved from `resolveNexAppSessionFromContext`.)
-- · The function RESOLVES the caller's nex_account.id from the
--   verified supabase_user_id · it does NOT accept a
--   caller-supplied owner account id. This closes the
--   smuggled-owner-id class of attack by construction.
-- · Session ownership check: when `p_existing_session_id` is NOT
--   NULL, we require that the session's host_account_id matches the
--   just-derived caller account.
-- · Self-invite denial: caller cannot invite themselves.
-- · The function does NOT expose a general message-insert bypass ·
--   it hardcodes `attachment_type = 'call_invite'` and the body
--   bounded enum. Any attempt to insert a different attachment_type
--   would require writing a different function.
--
-- Rate limiting, freeze-guard check, participant-of-conversation
-- check, and push notification are DELIBERATELY left in the
-- TypeScript wrapper · they run BEFORE this function is called and
-- are orthogonal to transactional atomicity.
--
-- Pre-migration-306 compatibility
-- --------------------------------
-- The existing TypeScript CHECK-fallback matches the error message
-- pattern `/check constraint|nex_peer_message_attachment_type_check/i`
-- and surfaces `skipped: "attachment_type_not_available"`. The RPC
-- preserves this · a CHECK violation propagates as a standard
-- Postgres exception with that constraint name, which the
-- TypeScript wrapper maps the same way as the direct-insert path.
--
-- Duplicate / retry behaviour
-- ---------------------------
-- · nex_group_call_participant has UNIQUE(session_id, account_id)
--   from migration 133. A re-invite of the same (session, invitee)
--   pair raises `unique_violation` · the function catches it and
--   returns `skipped='already_invited'` · it does NOT re-insert the
--   message. This matches the current TypeScript path at line
--   297-299 of invite-service.ts.
-- · nex_peer_conversation uses the sealed ordered-pair convention
--   (participant_a_id < participant_b_id, migration 047). The
--   function SELECTs first · INSERTs on miss. Under concurrency, a
--   second concurrent inviter could race and both try to INSERT.
--   A UNIQUE constraint on (participant_a_id, participant_b_id) on
--   nex_peer_conversation is RECOMMENDED but NOT required by this
--   candidate · check the existing index before applying. If the
--   UNIQUE already exists, the second concurrent INSERT will raise
--   unique_violation · the function catches it + re-selects the
--   row. If UNIQUE is missing, the function will insert a duplicate
--   pair row · remediation is a separate migration adding the
--   constraint + a one-time dedup.
--
-- The 4-participant cap trigger (migration 133) runs BEFORE INSERT
-- ON nex_group_call_participant · if cap exceeded, raises · the
-- function propagates the exception and the whole subtransaction
-- rolls back (no orphan session).
--
-- Compensation / cleanup
-- ----------------------
-- There is NO destructive compensating DELETE path. A caller that
-- retries after a partial failure sees:
--   · If session was already created on a previous call and this
--     retry passes `p_existing_session_id`, the function reuses it.
--   · If session was created but participant/message failed, and
--     retry passes NULL for `p_existing_session_id`, the function
--     creates a NEW session. The orphan session from the failed
--     attempt is left alone · it will be aged out by whatever
--     ringing-timeout job the system has (or the host explicitly
--     ends it). We do NOT delete sessions here to avoid the risk
--     of a double-session attack where a crafted retry deletes an
--     unrelated session the caller doesn't own.
--
-- What will be applied after approval
-- -----------------------------------
-- 1. This function (nex_invite_to_call_tx) created in the target DB.
-- 2. REVOKE on PUBLIC, GRANT EXECUTE on authenticated + service_role.
-- 3. A `nex_migration_history` row (sandbox or prod · per approval).
-- 4. The TypeScript wrapper (unactivated until approval) is turned
--    on behind a feature flag, with the direct-write path kept as a
--    fallback until BROWSER-tier verification passes in the target
--    environment. The flag flip is a SEPARATE authorisation.
-- ============================================================================

-- CANDIDATE · intentionally wrapped in BEGIN/ROLLBACK so a
-- hand-run against a target DB WITHOUT the separate authorisation
-- step produces no net effect. The approved apply path replaces the
-- final line with `COMMIT`.

BEGIN;

CREATE OR REPLACE FUNCTION nex_invite_to_call_tx(
  p_self_supabase_user_id UUID,
  p_invitee_account_id UUID,
  p_media_type TEXT,
  p_host_country TEXT,
  p_attachment_meta JSONB,
  p_invite_body TEXT,
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
  v_self_account_id UUID;
  v_session_id UUID;
  v_participant_id UUID;
  v_conversation_id UUID;
  v_message_id UUID;
  v_a UUID;
  v_b UUID;
BEGIN
  -- ── Caller identity ───────────────────────────────────────────
  -- When invoked through a Supabase auth session, auth.uid() is
  -- the authoritative caller · we require the passed
  -- supabase_user_id to match. When invoked by service_role,
  -- auth.uid() returns NULL · we accept the passed value (the
  -- TypeScript wrapper NEVER accepts a client-supplied value here).
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_self_supabase_user_id THEN
    RAISE EXCEPTION 'caller_identity_mismatch · auth.uid != p_self_supabase_user_id';
  END IF;

  -- Derive caller's nex_account.id from the verified supabase_user_id.
  SELECT id INTO v_self_account_id
  FROM nex_account
  WHERE supabase_user_id = p_self_supabase_user_id;
  IF v_self_account_id IS NULL THEN
    RAISE EXCEPTION 'caller_account_not_found';
  END IF;

  -- Self-invite denial.
  IF v_self_account_id = p_invitee_account_id THEN
    RAISE EXCEPTION 'self_invite_denied';
  END IF;

  -- Media type guard (parallels TypeScript invariant).
  IF p_media_type NOT IN ('audio', 'video') THEN
    RAISE EXCEPTION 'invalid_media_type';
  END IF;

  -- ── Session ──────────────────────────────────────────────────
  -- Branch A · reuse an existing session · must be owned by caller.
  IF p_existing_session_id IS NOT NULL THEN
    SELECT id INTO v_session_id
    FROM nex_group_call_session
    WHERE id = p_existing_session_id
      AND host_account_id = v_self_account_id;
    IF v_session_id IS NULL THEN
      RAISE EXCEPTION 'session_not_owned';
    END IF;
  ELSE
    -- Branch B · create a new session as host.
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
      -- Already invited · pick up existing row id · do NOT re-send
      -- the invite message · return skipped='already_invited'.
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
        -- Concurrent inviter just created the row · re-select.
        SELECT id INTO v_conversation_id
        FROM nex_peer_conversation
        WHERE participant_a_id = v_a
          AND participant_b_id = v_b;
    END;
  END IF;

  -- ── Chat message · attachment_type='call_invite' hard-coded ──
  -- The CHECK on nex_peer_message.attachment_type enforces valid
  -- values (mig 306). A pre-306 target DB raises
  -- check_violation on this INSERT · the whole function
  -- subtransaction rolls back · the TypeScript wrapper maps the
  -- error to skipped='attachment_type_not_available' using the
  -- same regex it uses today.
  INSERT INTO nex_peer_message (
    conversation_id,
    sender_account_id,
    body,
    attachment_type,
    attachment_meta
  ) VALUES (
    v_conversation_id,
    v_self_account_id,
    p_invite_body,
    'call_invite',
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

-- Grants · deny PUBLIC by default, grant to the two legitimate
-- callers.
REVOKE ALL ON FUNCTION nex_invite_to_call_tx(
  UUID, UUID, TEXT, TEXT, JSONB, TEXT, UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION nex_invite_to_call_tx(
  UUID, UUID, TEXT, TEXT, JSONB, TEXT, UUID
) TO authenticated, service_role;

-- NOTE · deliberate ROLLBACK · this file is a candidate. A hand-run
-- against any DB without the separate authorisation produces no net
-- effect. The approved apply path replaces this line with `COMMIT`
-- plus an INSERT into `nex_migration_history`.
ROLLBACK;
