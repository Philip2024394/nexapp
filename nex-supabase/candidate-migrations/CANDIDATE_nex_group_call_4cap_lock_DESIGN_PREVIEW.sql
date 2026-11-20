-- ============================================================================
-- CANDIDATE · DESIGN PREVIEW ONLY · nex_group_call_invite · 4-cap race lock
-- UNAPPLIED · UNASSIGNED NUMBER · DO NOT APPLY · GB-4CAP STAYS OPEN
-- ============================================================================
--
-- Lane-G Agent C · GB-4CAP investigation, 2026-11-19
--
-- This file is a DESIGN PREVIEW. It is NOT an applied migration.
-- It intentionally contains:
--   · NO `INSERT INTO nex_migration_history` row
--   · NO sequential migration number (`CANDIDATE_` prefix, same as A)
--   · NO apply script sibling
-- GB-4CAP remains OPEN. Nothing here closes GB-4CAP by its existence.
--
-- ─────────────────────────────────────────────────────────────────────
-- What this preview corrects (DESIGN)
-- ─────────────────────────────────────────────────────────────────────
-- Migration 133 (lines 83–102) enforces the 4-participant cap with a
-- BEFORE INSERT ROW TRIGGER whose body is:
--
--     SELECT COUNT(*) INTO cnt
--       FROM nex_group_call_participant
--       WHERE session_id = NEW.session_id;
--     IF cnt >= 4 THEN RAISE EXCEPTION ...;
--
-- Under READ COMMITTED (Postgres default) and under REPEATABLE READ,
-- the SELECT COUNT(*) in transaction T2 is NOT blocked by an
-- uncommitted INSERT from T1. Both T1 and T2 can observe cnt = 3,
-- both can pass the cap check, and both can COMMIT, producing a
-- 5-row session that silently violates the sealed invariant.
--
-- SECURITY DEFINER wrapping (mig 356) does NOT fix this race: the
-- function runs with elevated privileges, but the snapshot each
-- transaction sees is still per-transaction, and nothing serialises
-- the two concurrent executions against each other.
--
-- ─────────────────────────────────────────────────────────────────────
-- Minimal correction (DESIGN · not applied)
-- ─────────────────────────────────────────────────────────────────────
-- Insert ONE statement into the function body immediately after the
-- session ownership check (mig-356 lines 218–226), before the
-- participant INSERT triggers the cap check:
--
--     PERFORM 1
--       FROM nex_group_call_session
--       WHERE id = v_session_id
--       FOR UPDATE;
--
-- This acquires a FOR UPDATE row lock on the parent session row.
-- Under Postgres row-locking semantics:
--   · Only concurrent transactions touching the SAME session row
--     block (scope = `WHERE id = v_session_id`).
--   · Concurrent invites to DIFFERENT sessions acquire DIFFERENT
--     session row locks · no serialisation between them.
--   · T2 cannot enter the cap check until T1 commits or rolls back.
--     After T1 commits with 4 rows, T2 sees cnt = 4 and RAISEs.
--
-- Why this is the SMALLEST secure correction:
--   (i)   LOCK TABLE EXCLUSIVE — kills cross-session concurrency.
--         REJECTED.
--   (ii)  SELECT … FOR UPDATE on session row — minimal, one line,
--         same-session serialisation only, preserves existing
--         unique_violation idempotency catch, no schema change.
--         RECOMMENDED.
--   (iii) Partial UNIQUE INDEX with a position column — requires
--         new column + backfill, breaks "no schema change".
--         REJECTED.
--   (iv)  pg_advisory_xact_lock keyed on session_id — works, but
--         loses symmetry with existing FOR UPDATE idioms and adds
--         a hash-collision risk (session UUID → bigint). REJECTED
--         as equivalent-but-noisier than (ii).
--   (v)   SET TRANSACTION ISOLATION LEVEL SERIALIZABLE in the
--         function — requires retry logic on 40001 serialization_
--         failure and changes behaviour for all callers, including
--         the attachment INSERT. REJECTED as larger surface.
--
-- Deadlock analysis:
--   · Two concurrent invites, SAME session: both wait for the SAME
--     session row lock, serial order determined by lock arrival.
--     First wins, second observes cap. NO cycle.
--   · Two concurrent invites, DIFFERENT sessions: DIFFERENT row
--     locks, no overlap. NO cycle.
--   · Grep across the repo for other transactions that write
--     `nex_group_call_session` shows no other FOR UPDATE / FOR
--     SHARE / SELECT … FOR … on the session row. The only existing
--     session lock will be this one. NO cross-transaction cycle
--     from NEX code can exist today.
--   · Future risk: any new transaction that locks `nex_group_
--     call_participant` BEFORE `nex_group_call_session` could
--     create a cycle. Mitigation: document that the convention is
--     `session first, then participant`.
--
-- ─────────────────────────────────────────────────────────────────────
-- Coordination requirement (CRITICAL)
-- ─────────────────────────────────────────────────────────────────────
-- Agent A's CANDIDATE file
--   `CANDIDATE_nex_group_call_invite_v3_whitespace_strict_PREVIEW.sql`
-- rewrites the SAME `nex_invite_to_call_tx(...)` function body to
-- tighten the GB-WHITESPACE-GUARD. Two separate applied migrations
-- that both `DROP FUNCTION ... / CREATE FUNCTION ...` the same
-- signature is the biggest approved-write surface for the smallest
-- real change.
--
-- RECOMMENDATION FOR THE COORDINATOR (not for this agent to decide):
--   Merge Agent A's whitespace-strict guard AND this FOR UPDATE
--   session lock into ONE applied migration body. Both are
--   byte-additive to the function; they do not conflict; they
--   together close GB-WHITESPACE-GUARD and GB-4CAP in one write.
--
-- This file deliberately shows the FOR UPDATE change in isolation
-- so the diff is reviewable. The real apply must be coordinated.
--
-- ─────────────────────────────────────────────────────────────────────
-- What this preview does NOT do
-- ─────────────────────────────────────────────────────────────────────
--   · Does NOT touch mig-356 or mig-133 in place.
--   · Does NOT drop the mig-133 trigger · the trigger remains as a
--     defence-in-depth belt. The FOR UPDATE is the braces.
--   · Does NOT add schema (no new columns, no new indexes).
--   · Does NOT change the function signature.
--   · Does NOT write a `nex_migration_history` row.
--   · Does NOT touch application code
--     (`invite-service.transactional-candidate.ts` stays as-is).
--   · Does NOT touch production. If/when applied, sandbox
--     `kdstoyyeygcopkogqsyv` only.
-- ============================================================================

BEGIN;

-- ── Eliminate the mig-356 7-param signature ─────────────────────────
-- Same as mig-356 / Agent A's CANDIDATE. Idempotent drop.
DROP FUNCTION IF EXISTS nex_invite_to_call_tx(
  UUID,  -- p_invitee_account_id
  TEXT,  -- p_media_type
  TEXT,  -- p_host_country
  JSONB, -- p_attachment_meta
  TEXT,  -- p_invite_body
  TEXT,  -- p_attachment_url
  UUID   -- p_existing_session_id
);

-- ── New body · byte-equivalent to mig-356 EXCEPT the added PERFORM lock ──
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

  -- ── Session ownership + creation (unchanged from mig-356) ────
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

  -- ──────────────────────────────────────────────────────────────
  -- GB-4CAP · race-safe lock on the parent session row.
  --
  -- This PERFORM is the ONLY semantic addition vs mig-356.
  -- It acquires a row-level write lock on the session row BEFORE
  -- the participant INSERT fires the mig-133 BEFORE-INSERT cap
  -- trigger. Concurrent invites to the SAME session now serialise
  -- here; concurrent invites to DIFFERENT sessions are unaffected
  -- because the lock scope is `WHERE id = v_session_id`.
  --
  -- The trigger stays in place as defence-in-depth.
  -- ──────────────────────────────────────────────────────────────
  PERFORM 1
  FROM nex_group_call_session
  WHERE id = v_session_id
  FOR UPDATE;

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

  -- ── Peer conversation · ordered-pair convention (unchanged) ──
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

  -- ── Chat message (unchanged) ──────────────────────────────────
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

-- ── Permissions (unchanged from mig-356 · least privilege) ──────────
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

-- NO nex_migration_history INSERT · design preview only.
COMMIT;
