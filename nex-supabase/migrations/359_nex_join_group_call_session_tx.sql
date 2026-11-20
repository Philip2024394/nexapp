-- ============================================================================
-- CANDIDATE · nex_join_group_call_session_tx · v5-W3
-- UNAPPLIED · UNNUMBERED · PREVIEW ONLY · DO NOT APPLY
-- ============================================================================
--
-- Purpose
-- -------
-- Provides a server-side, SECURITY DEFINER, FOR-UPDATE-locked PL/pgSQL
-- RPC that wraps the two-step UPDATE-then-INSERT logic currently in
-- `src/lib/nex-native/calls/group-call-service.ts:joinGroupCallSession`
-- (lines 152-195).
--
-- This RPC is ADDITIONAL to v4. It does NOT supersede
-- `nex_invite_to_call_tx` (mig-356 / v4 combined preview). Those
-- functions serve DIFFERENT operations:
--   · v4  (`nex_invite_to_call_tx`) — host-side invite: creates session,
--     inserts participant row on behalf of invitee, writes the call-invite
--     peer message in one transaction.
--   · v5-W3 (`nex_join_group_call_session_tx`) — joinee-side join:
--     the person accepting an invite (or joining cold) writes their OWN
--     participant row, optionally promoting session ringing→live.
-- The two RPCs CAN coexist in the same DB and are called at different
-- points in the call lifecycle.
--
-- Live function being wrapped
-- ---------------------------
-- `joinGroupCallSession` at group-call-service.ts:152
--   UPDATE path  (lines 161-174): sets joined_at / clears left_at on a
--     pre-existing participant row (created by the host-invite path).
--   INSERT path  (lines 177-195): writes a fresh participant row when
--     none exists (cold join or bug recovery).
--   Both paths call `promoteSessionToLive` (line 199-205) afterward.
--
-- Cap-count semantics for W3 (important)
-- ----------------------------------------
-- `nex_group_call_participant_cap_tr` (mig-133) counts ALL rows for the
-- session_id WITHOUT filtering on left_at. This means:
--   · The UPDATE path (pre-invited row): the row already exists and
--     already counts toward the cap. The BEFORE INSERT trigger does NOT
--     fire on UPDATE. So updating joined_at / clearing left_at DOES NOT
--     change the cap-counted population. The UPDATE path is cap-neutral.
--   · The INSERT path (fresh row): this DOES increment the cap-counted
--     population and the trigger fires. The FOR UPDATE lock (see below)
--     closes the race between two concurrent INSERT-path callers who both
--     see zero rows for themselves.
-- Therefore: the FOR UPDATE lock is only semantically necessary for the
-- INSERT fallback, but acquiring it unconditionally (before the UPDATE
-- attempt) is cheaper than conditional locking and consistent with the
-- v4 pattern.
--
-- FOR UPDATE lock order (matches v4 convention)
-- -----------------------------------------------
-- Session row is locked BEFORE participant mutation. No other transaction
-- in this codebase currently acquires FOR UPDATE on nex_group_call_session,
-- so no deadlock cycle exists as of 2026-11-19.
--
-- Role constraint note
-- ---------------------
-- mig-133 defines `nex_group_call_participant.role CHECK (role IN
-- ('host', 'guest'))`. The 'cohost' value specified in the task brief
-- would violate this CHECK at INSERT time. This RPC therefore validates
-- role IN ('host', 'guest') only, matching the live schema. If 'cohost'
-- is added to the CHECK in a future migration, this RPC's validation
-- clause can be extended at that time.
--
-- Live callers
-- ------------
-- No grep-confirmed live caller for `joinGroupCallSession` in src/app/.
-- The W3 severity flag is THEORETICAL until a live caller is identified.
-- This preview is authored for safety-first atomicity; it does not
-- indicate that the race condition has been observed in production.
--
-- What this preview does NOT do
-- -------------------------------
-- · Does NOT touch mig-133, mig-356, or any applied migration.
-- · Does NOT add columns, tables, or indexes.
-- · Does NOT write `INSERT INTO nex_migration_history`.
-- · Does NOT touch production `ijvqdvsvwtwxzcqmoqit`.
-- · Does NOT activate or wire the TS wrapper.
-- · Migration number is chosen at promote-time against sandbox
--   `kdstoyyeygcopkogqsyv` by inspecting `nex_migration_history`.
--
-- HALT NOTICE
-- -----------
-- Do NOT apply this file without fresh owner authorisation naming the
-- sandbox ref `kdstoyyeygcopkogqsyv`. Activation of the TypeScript
-- wrapper (`group-call-join.v5-candidate.ts`) requires separate
-- authorisation + a feature flag flip. See wrapper header for details.
-- ============================================================================

BEGIN;

-- ── Drop any prior overload with this name + signature ──────────────
-- Safe idempotent; succeeds whether or not the function exists.
DROP FUNCTION IF EXISTS nex_join_group_call_session_tx(UUID, TEXT);

-- ── New RPC · nex_join_group_call_session_tx ────────────────────────
CREATE FUNCTION nex_join_group_call_session_tx(
  p_session_id  UUID,
  p_role        TEXT DEFAULT 'guest'  -- 'host' | 'guest' (see role-note above)
) RETURNS TABLE (
  out_participant_id    UUID,
  out_was_update        BOOLEAN,  -- TRUE  = UPDATE path (pre-invited row existed)
                                  -- FALSE = INSERT path (fresh row written)
  out_session_promoted  BOOLEAN   -- TRUE  = session was ringing and is now live
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_sb_user_id  UUID;
  v_self_account_id    UUID;
  v_participant_id     UUID;
  v_was_update         BOOLEAN := FALSE;
  v_session_promoted   BOOLEAN := FALSE;
  v_rows_updated       INT;
BEGIN
  -- ── 1. Fail-closed: caller identity ─────────────────────────────
  v_caller_sb_user_id := auth.uid();
  IF v_caller_sb_user_id IS NULL THEN
    RAISE EXCEPTION 'caller_identity_required · auth.uid() is NULL'
      USING ERRCODE = '42501';
  END IF;

  -- ── 2. Resolve account from supabase_user_id ────────────────────
  SELECT id INTO v_self_account_id
  FROM nex_account
  WHERE supabase_user_id = v_caller_sb_user_id;

  IF v_self_account_id IS NULL THEN
    RAISE EXCEPTION 'caller_account_not_found · no nex_account for auth.uid()'
      USING ERRCODE = '42501';
  END IF;

  -- ── 3. Validate role ────────────────────────────────────────────
  -- Matches the mig-133 CHECK constraint. 'cohost' is NOT permitted
  -- until the schema CHECK is extended in a future migration.
  IF p_role NOT IN ('host', 'guest') THEN
    RAISE EXCEPTION 'invalid_role · must be host or guest (mig-133 CHECK constraint)'
      USING ERRCODE = '22023';
  END IF;

  -- ── 4. Verify session exists ────────────────────────────────────
  PERFORM 1
  FROM nex_group_call_session
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found · no nex_group_call_session with id %', p_session_id
      USING ERRCODE = '42501';
  END IF;

  -- ── 5. Session-row FOR UPDATE lock ──────────────────────────────
  -- Acquired BEFORE participant mutation. Closes the INSERT-fallback
  -- race: two concurrent callers both seeing "no row for me" serialise
  -- here. Lock order matches v4 (nex_invite_to_call_tx): session first,
  -- participant second.
  PERFORM 1
  FROM nex_group_call_session
  WHERE id = p_session_id
  FOR UPDATE;

  -- ── 6. Try UPDATE first (pre-invited row) ───────────────────────
  -- Mirrors group-call-service.ts:161-173.
  -- This is cap-neutral: the row already counted toward the 4-cap;
  -- setting joined_at / clearing left_at does not change row count.
  -- BEFORE INSERT trigger does NOT fire on UPDATE.
  UPDATE nex_group_call_participant
  SET
    joined_at = NOW(),
    left_at   = NULL
  WHERE session_id = p_session_id
    AND account_id = v_self_account_id
  RETURNING id INTO v_participant_id;

  IF FOUND THEN
    v_was_update := TRUE;
  ELSE
    -- ── 7. INSERT fallback (no pre-invite row / cold join) ────────
    -- Mirrors group-call-service.ts:177-195.
    -- mig-133 BEFORE INSERT trigger fires here. FOR UPDATE above has
    -- already serialised concurrent INSERT attempts for this session.
    BEGIN
      INSERT INTO nex_group_call_participant (
        session_id,
        account_id,
        role,
        joined_at
      ) VALUES (
        p_session_id,
        v_self_account_id,
        p_role,
        NOW()
      )
      RETURNING id INTO v_participant_id;

      v_was_update := FALSE;

    EXCEPTION
      WHEN unique_violation THEN
        -- Race closed by FOR UPDATE, but defend anyway (idempotent join).
        -- Treat as a successful re-join rather than an error; surface as
        -- was_update=TRUE to the TS layer (the row already existed).
        SELECT id INTO v_participant_id
        FROM nex_group_call_participant
        WHERE session_id = p_session_id
          AND account_id = v_self_account_id;

        v_was_update := TRUE;
    END;
  END IF;

  -- ── 8. Session promotion ringing→live ───────────────────────────
  -- Mirrors promoteSessionToLive at group-call-service.ts:199-205.
  -- Fires when the session is currently 'ringing' — the first non-host
  -- join (or any join, since the host's own row was written at session
  -- creation) flips state→live.
  -- The UPDATE is a no-op if state is already 'live' or 'ended'.
  UPDATE nex_group_call_session
  SET
    state   = 'live',
    live_at = NOW()
  WHERE id    = p_session_id
    AND state = 'ringing';

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  v_session_promoted := (v_rows_updated > 0);

  -- ── 9. Return ────────────────────────────────────────────────────
  RETURN QUERY SELECT
    v_participant_id,
    v_was_update,
    v_session_promoted;
END;
$$;

-- ── Permissions · least privilege ────────────────────────────────────
-- Identical envelope pattern to mig-356 / v4 combined preview.
REVOKE ALL ON FUNCTION nex_join_group_call_session_tx(UUID, TEXT)
  FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION nex_join_group_call_session_tx(UUID, TEXT)
  FROM anon;

REVOKE EXECUTE ON FUNCTION nex_join_group_call_session_tx(UUID, TEXT)
  FROM service_role;

GRANT EXECUTE ON FUNCTION nex_join_group_call_session_tx(UUID, TEXT)
  TO authenticated;

-- NOTE: no `INSERT INTO nex_migration_history` row.
-- The migration number is assigned at promote-time by inspecting
-- `nex_migration_history` on sandbox `kdstoyyeygcopkogqsyv`.

COMMIT;
