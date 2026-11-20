-- ============================================================================
-- APPLY-VERSION PREVIEW · candidate migration 356
-- UNAPPLIED · REVIEW REQUIRED · DO NOT APPLY WITHOUT SEPARATE AUTHORISATION
-- ============================================================================
--
-- Purpose: forward-correction of the mig 353 function applied to sandbox
-- `kdstoyyeygcopkogqsyv` on 2026-11-19 (ledger §16.39).  Two issues
-- surfaced post-apply and are addressed here by an ADDITIVE replacement
-- function, NOT by editing migration 353 in place.
--
-- Issue A · GB-ATTACH-PAIR (BLOCKER opened in §16.39.5)
--   The applied mig 353 body hardcodes `attachment_type = 'call_invite'`
--   but writes no `attachment_url`.  CHECK constraint
--   `nex_peer_message_attachment_pair_check` is
--     ((attachment_url IS NULL) = (attachment_type IS NULL))
--   so every happy-path invite raises Postgres error 23514.  Production
--   TypeScript caller (src/lib/nex-native/peer-message-service.ts:844)
--   passes `attachment_url: input.accept_href` on every call_invite · the
--   function signature is simply missing the parameter and the INSERT is
--   missing the column.
--
-- Issue B · Narrow fail-open-NULL body gap (defense-in-depth)
--   Applied mig 353 body guard reads
--     IF auth.uid() IS NOT NULL AND auth.uid() <> p_self_supabase_user_id
--        THEN RAISE 'caller_identity_mismatch'
--   This guard is fail-CLOSED for mismatched non-NULL callers.  It is
--   fail-OPEN only for `auth.uid() IS NULL` (unauthenticated) callers ·
--   those callers would fall through the guard and the function would
--   trust `p_self_supabase_user_id` as identity proof.
--
--   The §16.39.3 `REVOKE EXECUTE … FROM anon` already closes that path
--   at the PERMISSION BOUNDARY: anon JWTs cannot reach the function at
--   all.  So Issue B is NOT a currently-exploitable vulnerability ·
--   it is a defense-in-depth gap in the function body.  This migration
--   removes the gap by deriving identity solely from `auth.uid()` and
--   raising when `auth.uid()` is NULL, so the body no longer depends on
--   the grant pattern for correctness.
--
-- Design
--   1. DROP the old 7-param signature.  Eliminates the alternate entry
--      point · reviewers do not have to prove that no caller passed a
--      spoofed `p_self_supabase_user_id` while anon-grant residue
--      existed.  Any surviving caller of the 7-param signature will
--      fail fast at `function does not exist` rather than silently
--      invoking an old body.
--   2. CREATE a new 7-param signature with `p_self_supabase_user_id`
--      REMOVED and `p_attachment_url` ADDED.  Same parameter count,
--      new parameter list, so no accidental overload.
--   3. Body derives `v_caller_sb_user_id := auth.uid()` ONCE.  Fail-
--      closed on NULL.  Resolves `v_self_account_id` from the verified
--      caller identity only · the function NEVER trusts a supplied
--      account identifier as identity proof.
--   4. Reject NULL or empty `p_attachment_url` before any write · the
--      pair-check will be satisfied by construction because we write
--      BOTH `attachment_type = 'call_invite'` AND the given
--      `attachment_url` together, or we raise and write nothing.
--
--      SHAPE validation (ensuring `accept_href` matches the
--      /nex-native/call/preview?session=<uuid>&accept=1 contract)
--      lives in the TypeScript gate at
--      `src/lib/nex-native/peer-message-service.ts:820` (constant
--      `_LANE_G_ACCEPT_HREF_PATTERN`).  This function intentionally
--      does NOT duplicate that regex: duplication would (a) create
--      drift risk if the TS contract evolves, (b) require a second
--      round-trip to update both sites in lockstep, (c) make the SQL
--      error message diverge from the TS error message a caller
--      already handles.  The SQL enforces only the DB-level invariant
--      (pair-check satisfaction) and trusts the upstream TS gate for
--      shape.  Since mig-356 grants EXECUTE ONLY to `authenticated`
--      (not anon, not service_role), every caller that reaches the
--      function has already been admitted by the Supabase auth stack ·
--      production callers reach the function only through the
--      TypeScript wrapper, which enforces the regex before calling.
--   5. SECURITY DEFINER + `SET search_path = public, pg_temp` ·
--      unchanged from 353.
--   6. REVOKE EXECUTE FROM PUBLIC · REVOKE EXECUTE FROM anon ·
--      GRANT EXECUTE TO authenticated ONLY.  service_role is NOT
--      granted · service_role calls would raise `caller_identity_
--      required` anyway (no `auth.uid()`) so the grant would be
--      inert · omitting it matches least-privilege.
--
-- Prerequisites (same as 353 · verified against sandbox on 2026-11-19)
--   · Migration 306 applied · attachment_type CHECK permits 'call_invite'.
--   · UNIQUE(session_id, account_id) index present.
--   · UNIQUE(participant_a_id, participant_b_id) index present.
--   · `nex_group_call_session.state` accepts 'ringing'; host_country is
--     constrained by `ck_group_call_session_host_country` to
--     ('ireland', 'indonesia', 'worldwide', 'global').
--   · GB-4CAP (SELECT COUNT(*) BEFORE INSERT race) is NOT fixed by this
--     migration · it remains OPEN per §16.39.6.
--
-- What this migration does NOT do
--   · Does NOT add race-safe four-cap enforcement · GB-4CAP stays OPEN.
--   · Does NOT change the TypeScript wrapper
--     `src/lib/nex-native/calls/invite-service.transactional-candidate.ts`
--     · wrapper signature change is a SEPARATE commit/push and is OUT
--     OF SCOPE here.  Browser activation + feature flag flip are also
--     separate authorisations.
--   · Does NOT touch production · sandbox only.
--   · Does NOT touch D:/trades · nexapp session boundary.
--
-- Rollback (see sibling `_rollback_PREVIEW.sql`)
--   Rollback DROPs the new function only.  It does NOT restore the
--   mig 353 body · doing so would reintroduce Issue A (CHECK
--   violation on every call) and Issue B (fail-open-NULL body gap).
--   After rollback, callers of `nex_invite_to_call_tx` will error at
--   `function does not exist` and the TypeScript wrapper stays
--   disabled.  The legacy 4-insert call-site in
--   `src/lib/nex-native/calls/invite-service.ts` is UNTOUCHED and
--   continues to work.  §16.39 evidence anchored to mig 353 remains
--   valid historically · the function body it described simply no
--   longer exists post-rollback.
--
-- Activation (one-way file moves · require separate authorisation)
--   1. Move this file to
--      `nex-supabase/migrations/356_nex_group_call_invite_v2.sql`.
--   2. Move the matching rollback to
--      `nex-supabase/migrations/356_nex_group_call_invite_v2_rollback.sql`.
--   3. Promote `apply-migration-356-sandbox.mjs.PREVIEW` to
--      `scripts/apply-migration-356-sandbox.mjs`.
--   4. Run `node scripts/apply-migration-356-sandbox.mjs` ONCE against
--      sandbox `kdstoyyeygcopkogqsyv`.  The script hard-refuses
--      production.
-- ============================================================================

BEGIN;

-- ── Eliminate the old 7-param signature entirely ────────────────────
-- Fails with a clear error if the function is missing · succeeds idempotently
-- if a prior rollback already dropped it.  Both outcomes are safe.
DROP FUNCTION IF EXISTS nex_invite_to_call_tx(
  UUID,  -- p_self_supabase_user_id
  UUID,  -- p_invitee_account_id
  TEXT,  -- p_media_type
  TEXT,  -- p_host_country
  JSONB, -- p_attachment_meta
  TEXT,  -- p_invite_body
  UUID   -- p_existing_session_id
);

-- ── New signature · identity derived from auth.uid() only ──────────
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
  -- ── Caller identity · fail-closed ─────────────────────────────
  -- Derived from auth.uid() ONLY.  Never trust any supplied identity
  -- parameter.  The function raises before any write if the caller is
  -- unauthenticated.  This removes the §16.39.3 fail-open-NULL body
  -- gap even if the anon REVOKE ever regresses.
  v_caller_sb_user_id := auth.uid();
  IF v_caller_sb_user_id IS NULL THEN
    RAISE EXCEPTION 'caller_identity_required · auth.uid() is NULL'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  SELECT id INTO v_self_account_id
  FROM nex_account
  WHERE supabase_user_id = v_caller_sb_user_id;
  IF v_self_account_id IS NULL THEN
    RAISE EXCEPTION 'caller_account_not_found · no nex_account for auth.uid()'
      USING ERRCODE = '42501';
  END IF;

  -- ── Required attachment URL · satisfies pair-check by construction ─
  -- `nex_peer_message_attachment_pair_check` is
  --   ((attachment_url IS NULL) = (attachment_type IS NULL))
  -- We hardcode attachment_type = 'call_invite' below, so attachment_url
  -- MUST be non-NULL · reject NULL and empty/whitespace-only strings
  -- before any write.
  IF p_attachment_url IS NULL OR length(btrim(p_attachment_url)) = 0 THEN
    RAISE EXCEPTION 'attachment_url_required · call_invite needs an accept_href'
      USING ERRCODE = '22023'; -- invalid_parameter_value
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

-- ── Permissions · least privilege ────────────────────────────────────
REVOKE ALL ON FUNCTION nex_invite_to_call_tx(
  UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID
) FROM PUBLIC;

-- Supabase default-privilege residue would grant anon EXECUTE on new
-- public-schema functions.  Strip it explicitly · the body guard would
-- reject anon callers at `caller_identity_required` anyway, but
-- stripping the grant blocks them at the permission boundary FIRST.
-- This preserves the §16.39.3 defense-in-depth posture.
REVOKE EXECUTE ON FUNCTION nex_invite_to_call_tx(
  UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID
) FROM anon;

-- service_role is deliberately NOT granted.  service_role callers have
-- no `auth.uid()` so would hit `caller_identity_required` regardless ·
-- the grant would be inert.  Omitting it matches least-privilege and
-- makes service_role misuse impossible by design.
--
-- Supabase applies `ALTER DEFAULT PRIVILEGES … GRANT EXECUTE ON
-- FUNCTIONS TO anon, authenticated, service_role` on new public-schema
-- functions, which survives `REVOKE … FROM PUBLIC`.  The explicit
-- `REVOKE … FROM anon` above handles the anon case; the explicit
-- `REVOKE … FROM service_role` below handles the service_role case.
-- Without that explicit REVOKE, service_role retains EXECUTE from the
-- default-privilege grant even though this migration's intent is to
-- withhold it (observed in sandbox 2026-11-19 post-apply · the body
-- guard rejects service_role calls anyway because `auth.uid()` is NULL,
-- so the residue was never an exploitable vulnerability · the REVOKE
-- is defense-in-depth that matches stated intent).
REVOKE EXECUTE ON FUNCTION nex_invite_to_call_tx(
  UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID
) FROM service_role;

GRANT EXECUTE ON FUNCTION nex_invite_to_call_tx(
  UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID
) TO authenticated;

-- ── Migration history · sandbox target only ─────────────────────────
INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '356',
  'nex_group_call_invite_v2 · fail-closed auth.uid() identity + required attachment_url',
  'Closes GB-ATTACH-PAIR · narrows §16.39.3 body fail-open-NULL gap · DROPs mig-353 signature · sandbox only'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
