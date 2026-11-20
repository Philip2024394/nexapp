-- ============================================================================
-- APPLY-VERSION PREVIEW · candidate migration 353
-- UNAPPLIED · REVIEW REQUIRED · DO NOT APPLY WITHOUT SEPARATE AUTHORISATION
-- ============================================================================
--
-- This file is the REVIEWABLE APPLY-VERSION sibling of
-- `C001_nex_group_call_invite_transactional.sql` (the rollback-wrapped
-- quarantined candidate).
--
-- Status: still quarantined.
--   · Lives under `nex-supabase/candidate-migrations/`, NOT under
--     `nex-supabase/migrations/`.
--   · Not scanned by `apply-all-P-RLS-sandbox.mjs` or any
--     `apply-migration-*.mjs` helper.
--   · No `scripts/apply-migration-353-sandbox.mjs` exists · a PREVIEW
--     version of that script is in this same directory with a
--     `.PREVIEW` extension so it cannot be invoked by the standard
--     apply convention.
--
-- Differences from `C001_...sql`:
--   · This file is wrapped in BEGIN; … COMMIT; (not ROLLBACK).
--   · This file writes one row into `nex_migration_history` (sandbox
--     only · the apply-version PREVIEW records a sandbox ref).
--   · The function body is byte-for-byte the same body as `C001_...sql`
--     · the ONLY intended differences between the two files are the
--     transaction verb and the migration-history INSERT. Reviewers
--     should diff the two files and confirm this.
--
-- Activation requires (unchanged from `C001_...sql`):
--   1. Owner authorisation naming the target DB (sandbox
--      kdstoyyeygcopkogqsyv or prod ijvqdvsvwtwxzcqmoqit).
--   2. Move this file to `nex-supabase/migrations/` keeping the numeric
--      prefix 353 (the next free prefix as of 2026-11-19) OR renumber
--      to the next-free prefix at the time of authorisation.
--   3. Move the matching rollback file to the same directory.
--   4. Promote the apply-script PREVIEW to `scripts/apply-migration-353-
--      sandbox.mjs`.
--   5. The TypeScript wrapper
--      (`src/lib/nex-native/calls/invite-service.transactional-candidate.ts`)
--      stays disabled behind a feature flag until BROWSER-tier
--      verification passes · the flag flip is a SEPARATE authorisation.
--
-- Security posture, duplicate/retry behaviour, pre-mig-306 CHECK
-- compatibility, and compensation policy are ALL identical to
-- `C001_...sql` and the long preamble there · not duplicated here.
-- Reviewers should read `C001_...sql`'s preamble FIRST, then diff the
-- two SQL bodies.
--
-- Prerequisites (verified against sandbox kdstoyyeygcopkogqsyv
-- 2026-11-19 before promotion · see ledger §16.39.2):
--   · Migration 306 applied · nex_peer_message.attachment_type CHECK
--     permits 'call_invite' (verified by direct pg_constraint read).
--     Migration 309 is NOT required for this function · it only
--     widens the CHECK to the pre-306 enum superset, which the
--     call-invite path does not need. 309 remains a separate
--     authorisation (not covered by this round).
--   · nex_group_call_participant has UNIQUE(session_id, account_id)
--     via index `nex_group_call_participant_unique_in_session`
--     (sealed migration 133) · the function's duplicate-invite
--     handler relies on this to raise unique_violation.
--   · nex_peer_conversation has UNIQUE(participant_a_id,
--     participant_b_id) via index `nex_peer_conversation_unique_pair`
--     · the function's concurrent-conversation-insert handler relies
--     on this to raise unique_violation and re-select.
--   · nex_group_call_session.state accepts 'ringing'; host_country is
--     a nullable TEXT (migration 307).
--   · The 4-participant-cap BEFORE INSERT trigger on
--     nex_group_call_participant is a KNOWN GAP (GB-4CAP) that this
--     function does NOT close · SELECT COUNT(*) race remains open ·
--     see §16.33 and §16.39.6.
-- ============================================================================

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
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_self_supabase_user_id THEN
    RAISE EXCEPTION 'caller_identity_mismatch · auth.uid != p_self_supabase_user_id';
  END IF;

  SELECT id INTO v_self_account_id
  FROM nex_account
  WHERE supabase_user_id = p_self_supabase_user_id;
  IF v_self_account_id IS NULL THEN
    RAISE EXCEPTION 'caller_account_not_found';
  END IF;

  IF v_self_account_id = p_invitee_account_id THEN
    RAISE EXCEPTION 'self_invite_denied';
  END IF;

  IF p_media_type NOT IN ('audio', 'video') THEN
    RAISE EXCEPTION 'invalid_media_type';
  END IF;

  -- ── Session ──────────────────────────────────────────────────
  IF p_existing_session_id IS NOT NULL THEN
    SELECT id INTO v_session_id
    FROM nex_group_call_session
    WHERE id = p_existing_session_id
      AND host_account_id = v_self_account_id;
    IF v_session_id IS NULL THEN
      RAISE EXCEPTION 'session_not_owned';
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

  -- ── Chat message · attachment_type='call_invite' hard-coded ──
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

REVOKE ALL ON FUNCTION nex_invite_to_call_tx(
  UUID, UUID, TEXT, TEXT, JSONB, TEXT, UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION nex_invite_to_call_tx(
  UUID, UUID, TEXT, TEXT, JSONB, TEXT, UUID
) TO authenticated, service_role;

-- Migration history row · sandbox target only · the apply-script
-- PREVIEW guards hard against production ref. Column list corrected
-- round 17 (2026-11-19) to match the live `nex_migration_history`
-- schema (version text, description text, notes text · see mig 343
-- for the latest-applied example). Prior preview used fictional
-- (migration_number, migration_name, applied_at) columns · the
-- column-name error has been FIXED here before any apply attempt.
INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '353',
  'nex_group_call_invite_transactional · SECURITY DEFINER wrapper for inviteToCall',
  'Closes §16.31/§16.32/§16.33 atomicity gap · sandbox only'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
