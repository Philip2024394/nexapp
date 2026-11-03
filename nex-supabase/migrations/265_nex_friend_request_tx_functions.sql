-- ============================================================================
-- NEX Migration 265 · Scope-A transactional functions · 5 plpgsql RPCs
-- ============================================================================
--
-- STATUS: DRAFT · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised preparation only (Scope-A · PR-1 · 2026-11-03). DO NOT
-- APPLY to the sealed Supabase project `ijvqdvsvwtwxzcqmoqit` without a
-- SEPARATE explicit owner authorisation naming this file.
--
-- Purpose:
--   Replace the current separate-REST-call pattern on nex_friend_request
--   state transitions with transactional RPCs that bundle the state
--   change and the corresponding `nex_invite_event` emission into a
--   single PostgreSQL transaction.
--
--   Prior design claim (previous Scope-A revision):
--     "friend-request-service.ts does the state update and the event
--      insert in the same transaction."
--   This was INCORRECT. PostgREST issues one HTTP request per
--   `.from().update()` or `.from().insert()` call · each is a distinct
--   pg transaction. The two writes were NOT atomic. The functions
--   below correct that: one `.rpc()` call = one pg transaction = both
--   writes atomic.
--
--   Five functions:
--     1. nex_friend_request_create_tx    · idempotent create
--     2. nex_friend_request_accept_tx    · state-based idempotent accept
--     3. nex_friend_request_cancel_tx    · state-based idempotent cancel
--     4. nex_friend_request_sweep_run    · advisory-locked expiry sweep
--     5. nex_invite_event_retention_run  · two-pass bounded retention
--
-- Trust contract (owner-corrected final revision):
--   · All functions are SECURITY DEFINER with fixed search_path.
--   · REVOKE EXECUTE from PUBLIC, anon, authenticated.
--   · GRANT EXECUTE only to service_role.
--   · The server session binds the acting account_id and passes it as
--     an argument; the function re-validates existence and ownership
--     before any state change.
--   · Idempotency fast-path binds (sender, key) → fingerprint. Payload
--     mismatch returns idempotency_key_conflict · never silently returns
--     an unrelated row.
--   · Structured exception diagnostics via GET STACKED DIAGNOSTICS.
--     No SQLERRM substring parsing.
--   · Unexpected unique-constraint violations re-raise with the
--     constraint name preserved.
--
-- Dependencies:
--   · Migration 215 · nex_friend_request (pre-existing)
--   · Migration 220 · intro_note column (applied 2026-10-25)
--   · Migration 025 · nex_friend_edge (pre-existing)
--   · Migration 047 · nex_peer_conversation (pre-existing)
--   · Migration 260 · nex_invite_event_type registry
--   · Migration 261 · 15-event registry seed
--   · Migration 262 · nex_invite_event table (compound FK target)
--   · Migration 263 · nex_invite_event_hold (referenced by retention)
--   · Migration 264 · idempotency columns on nex_friend_request
--   · pgcrypto extension (for digest(), encode())
--
-- Scope (strictly):
--   · CREATE OR REPLACE 5 plpgsql functions
--   · REVOKE/GRANT execution per function
--
-- NOT in scope:
--   · The sweep cron route · future PR-3
--   · The watcher cron route · future PR-3
--   · The retention cron route · future PR-3
--   · Service-layer rewiring · future PR-2
--   · Reconciliation on uncertain outcomes · future PR-3
--
-- Backfill: NONE. Pure function definitions.
--
-- Rollback:
--   DROP FUNCTION public.nex_invite_event_retention_run(uuid);
--   DROP FUNCTION public.nex_friend_request_sweep_run(uuid);
--   DROP FUNCTION public.nex_friend_request_cancel_tx(uuid, uuid, uuid);
--   DROP FUNCTION public.nex_friend_request_accept_tx(uuid, uuid, text, uuid);
--   DROP FUNCTION public.nex_friend_request_create_tx(uuid, text, text, text, uuid);
--
-- Risk level: MEDIUM · functions are SECURITY DEFINER and bypass RLS.
--   Mitigated by: service-role-only grant, in-function ownership
--   validation, structured diagnostics, no dynamic SQL anywhere.
--
-- NOT CHECKED by these functions (documented limitations):
--   · Blocked-user list (not implemented in NEX today)
--   · Account suspension state
--   · Per-sender rate limits beyond the 72h cooldown
-- These checks become policy in a later scope.
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Apply guard
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  RAISE EXCEPTION 'Migration 265 is DRAFT · requires explicit owner authorisation naming this file to apply. Comment out this guard block only when authorised.';
END $$;

-- ---------------------------------------------------------------------------
-- Pre-flight · verify every dependency table exists.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='nex_friend_request') THEN
    RAISE EXCEPTION 'Migration 265 refused: nex_friend_request missing (migration 215).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='nex_friend_edge') THEN
    RAISE EXCEPTION 'Migration 265 refused: nex_friend_edge missing (migration 025).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='nex_peer_conversation') THEN
    RAISE EXCEPTION 'Migration 265 refused: nex_peer_conversation missing (migration 047).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='nex_invite_event_type') THEN
    RAISE EXCEPTION 'Migration 265 refused: nex_invite_event_type missing (migration 260).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='nex_invite_event') THEN
    RAISE EXCEPTION 'Migration 265 refused: nex_invite_event missing (migration 262).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='nex_invite_event_hold') THEN
    RAISE EXCEPTION 'Migration 265 refused: nex_invite_event_hold missing (migration 263).';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nex_friend_request' AND column_name='idempotency_fingerprint'
  ) THEN
    RAISE EXCEPTION 'Migration 265 refused: idempotency columns missing on nex_friend_request (migration 264).';
  END IF;
  IF (SELECT count(*) FROM public.nex_invite_event_type) < 15 THEN
    RAISE EXCEPTION 'Migration 265 refused: event registry contains % rows (expected >= 15). Apply migration 261 first.',
      (SELECT count(*) FROM public.nex_invite_event_type);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pgcrypto') THEN
    RAISE EXCEPTION 'Migration 265 refused: pgcrypto extension missing. Install with: CREATE EXTENSION IF NOT EXISTS pgcrypto;';
  END IF;
END $$;

-- ===========================================================================
-- FUNCTION 1 · nex_friend_request_create_tx
-- ===========================================================================
-- Atomic create · idempotency fast-path + fingerprint match + payload-
-- aware conflict detection + atomic event emission.
--
-- Trust contract:
--   · Caller (server-side route) passes p_sender_account_id from the
--     authenticated session. Service-role-only EXECUTE grant prevents
--     clients from supplying arbitrary IDs.
--   · Function validates sender exists, handle format, recipient
--     existence, self-invite rejection, cooldown, duplicate-pending
--     and idempotency.
--
-- Returns (jsonb):
--   { ok: true,  already_created: true,  request_id, status }           // idempotent retry
--   { ok: true,  already_created: false, request_id, status, expires_at } // fresh create
--   { ok: false, reason: 'invalid_sender' }
--   { ok: false, reason: 'invalid_handle' }
--   { ok: false, reason: 'unknown_handle' }
--   { ok: false, reason: 'self_invite' }
--   { ok: false, reason: 'cooldown', cooldown_ends_at }
--   { ok: false, reason: 'duplicate_pending' }
--   { ok: false, reason: 'idempotency_key_conflict', request_id }
--   { ok: false, reason: 'idempotency_lookup_lost', constraint }
--   { ok: false, reason: 'event_type_unregistered', constraint }
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.nex_friend_request_create_tx(
  p_sender_account_id uuid,
  p_recipient_handle  text,
  p_intro_note        text,
  p_idempotency_key   text,
  p_correlation_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  v_fingerprint        bytea;
  v_sender_exists      boolean;
  v_recipient_id       uuid;
  v_cooldown_ends_at   timestamptz;
  v_existing_id        uuid;
  v_existing_status    text;
  v_existing_fp        bytea;
  v_new_id             uuid;
  v_now                timestamptz := now();
  v_expires_at         timestamptz := now() + interval '24 hours';
  v_constraint_name    text;
  v_table_name         text;
  v_schema_name        text;
BEGIN
  -- 1. Validate sender exists
  SELECT EXISTS(SELECT 1 FROM public.nex_account WHERE id = p_sender_account_id)
    INTO v_sender_exists;
  IF NOT v_sender_exists THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_sender');
  END IF;

  -- 2. Validate handle format (matches sealed CHECK on nex_friend_request)
  IF p_recipient_handle IS NULL OR p_recipient_handle !~ '^nex-\d+$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_handle');
  END IF;

  -- 3. Compute canonical idempotency fingerprint (if key provided)
  --    Canonical encoding per migration 264 doctrine:
  --      sha256(
  --        'v1|' || sha256_hex(lower(coalesce(handle,''))) || '|' || null_marker(handle)
  --              || '|' || sha256_hex(coalesce(note,''))   || '|' || null_marker(note)
  --      )
  --    Each input is pre-hashed to fixed 64-hex length before concat;
  --    delimiter cannot be forged by caller content.
  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    -- pgcrypto's digest() lives in the `extensions` schema on Supabase
    -- projects (confirmed via sealed migrations 104/105/106 which use
    -- extensions.uuid_generate_v5 explicitly). SET search_path above
    -- deliberately omits `extensions` for safety · we schema-qualify
    -- every pgcrypto call instead.
    v_fingerprint := extensions.digest(
      'v1|'
      || encode(extensions.digest(lower(coalesce(p_recipient_handle, '')), 'sha256'), 'hex')
      || '|' || CASE WHEN p_recipient_handle IS NULL THEN 'NULL' ELSE 'VAL' END
      || '|' || encode(extensions.digest(coalesce(p_intro_note, ''), 'sha256'), 'hex')
      || '|' || CASE WHEN p_intro_note IS NULL THEN 'NULL' ELSE 'VAL' END,
      'sha256'
    );

    -- Idempotency fast-path · FOR UPDATE row-lock serialises against
    -- concurrent retries on the same (sender, key) pair.
    SELECT id, status, idempotency_fingerprint
      INTO v_existing_id, v_existing_status, v_existing_fp
      FROM public.nex_friend_request
      WHERE sender_account_id = p_sender_account_id
        AND idempotency_key = p_idempotency_key
      FOR UPDATE;

    IF FOUND THEN
      IF v_existing_fp IS NOT DISTINCT FROM v_fingerprint THEN
        -- True retry · payloads match · idempotent success.
        RETURN jsonb_build_object(
          'ok', true,
          'already_created', true,
          'request_id', v_existing_id,
          'status', v_existing_status
        );
      ELSE
        -- Same key, different payload · explicit conflict.
        -- NEVER return the colliding row's recipient / intro_note
        -- (prevents a probing attack).
        RETURN jsonb_build_object(
          'ok', false,
          'reason', 'idempotency_key_conflict',
          'request_id', v_existing_id
        );
      END IF;
    END IF;
  ELSE
    v_fingerprint := NULL;
  END IF;

  -- 4. Resolve recipient handle → account_id (case-insensitive · matches sealed behaviour)
  SELECT id INTO v_recipient_id
    FROM public.nex_account
    WHERE lower(nex_handle) = lower(p_recipient_handle);

  IF v_recipient_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_handle');
  END IF;

  -- 5. Self-invite rejection
  IF v_recipient_id = p_sender_account_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_invite');
  END IF;

  -- 6. Cooldown check (72h after any terminal state for same sender+handle)
  SELECT max(cooldown_ends_at) INTO v_cooldown_ends_at
    FROM public.nex_friend_request
    WHERE sender_account_id = p_sender_account_id
      AND lower(recipient_nex_handle) = lower(p_recipient_handle)
      AND cooldown_ends_at IS NOT NULL
      AND cooldown_ends_at > v_now;

  IF v_cooldown_ends_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'cooldown',
      'cooldown_ends_at', v_cooldown_ends_at
    );
  END IF;

  -- 7. INSERT the invite · catch unique violations structurally.
  BEGIN
    INSERT INTO public.nex_friend_request (
      sender_account_id,
      recipient_nex_handle,
      recipient_account_id,
      status,
      created_at,
      expires_at,
      intro_note,
      idempotency_key,
      idempotency_fingerprint
    )
    VALUES (
      p_sender_account_id,
      p_recipient_handle,
      v_recipient_id,
      'pending',
      v_now,
      v_expires_at,
      p_intro_note,
      p_idempotency_key,
      v_fingerprint
    )
    RETURNING id INTO v_new_id;
  EXCEPTION
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS
        v_constraint_name = CONSTRAINT_NAME,
        v_table_name      = TABLE_NAME,
        v_schema_name     = SCHEMA_NAME;

      IF v_table_name IS NOT NULL AND v_table_name <> 'nex_friend_request' THEN
        -- Violation on unexpected table · propagate.
        RAISE;
      END IF;

      IF v_constraint_name = 'nex_friend_request_unique_pending' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_pending');

      ELSIF v_constraint_name = 'nex_friend_request_idempotency_unique' THEN
        -- Concurrent race on same idempotency_key · re-read and compare.
        SELECT id, status, idempotency_fingerprint
          INTO v_existing_id, v_existing_status, v_existing_fp
          FROM public.nex_friend_request
          WHERE sender_account_id = p_sender_account_id
            AND idempotency_key = p_idempotency_key;

        IF NOT FOUND THEN
          -- Expected concurrent row is gone (retention · manual deletion).
          -- Never silently claim success · surface a dedicated terminal.
          RETURN jsonb_build_object(
            'ok', false,
            'reason', 'idempotency_lookup_lost',
            'constraint', v_constraint_name
          );
        END IF;

        IF v_existing_fp IS DISTINCT FROM v_fingerprint THEN
          RETURN jsonb_build_object(
            'ok', false,
            'reason', 'idempotency_key_conflict',
            'request_id', v_existing_id
          );
        END IF;

        RETURN jsonb_build_object(
          'ok', true,
          'already_created', true,
          'request_id', v_existing_id,
          'status', v_existing_status
        );

      ELSE
        -- Unknown unique constraint on nex_friend_request · propagate so
        -- operators see the exact constraint name.
        RAISE EXCEPTION 'nex_friend_request_create_tx: unexpected unique_violation on constraint %',
          coalesce(v_constraint_name, '<null>')
          USING ERRCODE = '23505';
      END IF;
  END;

  -- 8. Emit invite.created event · atomic with the insert above.
  --    Compound FK to nex_invite_event_type guarantees classification.
  --    An unregistered event name would fail here with foreign_key_violation.
  BEGIN
    INSERT INTO public.nex_invite_event (
      correlation_id, event_name, event_class,
      request_id, sender_account_id, recipient_account_id,
      occurred_at
    )
    VALUES (
      p_correlation_id, 'invite.created', 'lifecycle',
      v_new_id, p_sender_account_id, v_recipient_id,
      v_now
    );
  EXCEPTION
    WHEN foreign_key_violation THEN
      GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
      -- Transaction will roll back · neither invite nor event persists.
      RAISE EXCEPTION 'nex_friend_request_create_tx: event_type_unregistered on constraint %',
        coalesce(v_constraint_name, '<null>')
        USING ERRCODE = '23503';
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'already_created', false,
    'request_id', v_new_id,
    'status', 'pending',
    'expires_at', v_expires_at
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.nex_friend_request_create_tx(uuid, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nex_friend_request_create_tx(uuid, text, text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.nex_friend_request_create_tx(uuid, text, text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.nex_friend_request_create_tx(uuid, text, text, text, uuid) TO service_role;

COMMENT ON FUNCTION public.nex_friend_request_create_tx(uuid, text, text, text, uuid) IS
  'Scope-A · atomic friend-request create. SECURITY DEFINER, fixed search_path, service-role-only. Caller (server) binds p_sender_account_id from authenticated session. Payload-aware idempotency via fingerprint comparison. Structured exception diagnostics via GET STACKED DIAGNOSTICS. Emits invite.created event atomically.';

-- ===========================================================================
-- FUNCTION 2 · nex_friend_request_accept_tx
-- ===========================================================================
-- Atomic accept · state-based idempotency · optional friend_edge insert
-- for category='friends' · emits invite.accepted event atomically.
--
-- Business-category peer_conversation creation is deliberately NOT
-- performed inside this function. The peer_conversation surface has
-- schema evolution across multiple migrations (origin_cover_business_id,
-- etc.); the service layer (PR-2) will call getOrCreatePeerConversation
-- after this function commits. If the follow-up conversation open fails,
-- the invite is already accepted · reconciliation is on the next load.
--
-- Returns:
--   { ok: true,  already_accepted: true,  request_id, accepted_at, category }
--   { ok: true,  already_accepted: false, request_id, category, accepted_at }
--   { ok: false, reason: 'not_recipient_or_not_found' }
--   { ok: false, reason: 'already_accepted_other_category', actual_category }
--   { ok: false, reason: 'expired' }
--   { ok: false, reason: 'cancelled' | 'passed' }
--   { ok: false, reason: 'event_type_unregistered', constraint }
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.nex_friend_request_accept_tx(
  p_request_id            uuid,
  p_acceptor_account_id   uuid,
  p_category              text,
  p_correlation_id        uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  v_row             record;
  v_a_id            uuid;
  v_b_id            uuid;
  v_requested_by    uuid;
  v_now             timestamptz := now();
  v_constraint_name text;
  v_elapsed_ms      integer;
BEGIN
  -- Validate category
  IF p_category NOT IN ('friends','business') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_category');
  END IF;

  -- Lock the row to serialise against concurrent accept attempts.
  SELECT id, sender_account_id, recipient_account_id,
         recipient_nex_handle, status, expires_at,
         accepted_category, accepted_at, created_at
    INTO v_row
    FROM public.nex_friend_request
    WHERE id = p_request_id
      AND recipient_account_id = p_acceptor_account_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_recipient_or_not_found');
  END IF;

  -- Idempotent: already accepted with the same category · return existing state.
  IF v_row.status = 'accepted' AND v_row.accepted_category = p_category THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_accepted', true,
      'request_id', v_row.id,
      'accepted_at', v_row.accepted_at,
      'category', v_row.accepted_category
    );
  END IF;

  -- Already accepted but with a DIFFERENT category · caller must know.
  IF v_row.status = 'accepted' AND v_row.accepted_category <> p_category THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'already_accepted_other_category',
      'actual_category', v_row.accepted_category
    );
  END IF;

  -- Any other terminal state · return specific reason.
  IF v_row.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_row.status);
  END IF;

  -- Pending but expired · deliberate guard even though the sweep usually
  -- flips expired rows before anyone can call accept on them.
  IF v_row.expires_at <= v_now THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  -- UPDATE the invite · set accepted state + cooldown window.
  UPDATE public.nex_friend_request
     SET status = 'accepted',
         accepted_category = p_category,
         accepted_at = v_now,
         cooldown_ends_at = v_now + interval '72 hours'
     WHERE id = p_request_id;

  -- Friends path · insert canonical pair into nex_friend_edge.
  -- Canonical ordering a_id < b_id enforced by table CHECK; order here
  -- so the INSERT matches. requested_by = sender (initiator of the invite).
  IF p_category = 'friends' THEN
    IF v_row.sender_account_id < p_acceptor_account_id THEN
      v_a_id := v_row.sender_account_id;
      v_b_id := p_acceptor_account_id;
    ELSE
      v_a_id := p_acceptor_account_id;
      v_b_id := v_row.sender_account_id;
    END IF;
    v_requested_by := v_row.sender_account_id;

    -- ON CONFLICT DO UPDATE keeps the edge idempotent: a retry after a
    -- committed friend_edge insert returns success without duplicate.
    -- If a prior row exists (e.g., declined → re-pending flow), flip
    -- status to accepted and refresh timestamps.
    INSERT INTO public.nex_friend_edge (
      a_account_id, b_account_id, requested_by, status, created_at, updated_at
    )
    VALUES (
      v_a_id, v_b_id, v_requested_by, 'accepted', v_now, v_now
    )
    ON CONFLICT (a_account_id, b_account_id) DO UPDATE
      SET status = 'accepted',
          updated_at = v_now;
  END IF;

  -- Business category: peer_conversation creation deferred to service
  -- layer (PR-2) because the peer_conversation schema has evolved
  -- across multiple migrations and the service already handles the
  -- reconciliation path. This function remains atomic for invite
  -- state + friend_edge + event.

  -- Emit invite.accepted event atomically.
  v_elapsed_ms := greatest(0, (extract(epoch from (v_now - v_row.created_at)) * 1000)::integer);

  BEGIN
    INSERT INTO public.nex_invite_event (
      correlation_id, event_name, event_class,
      request_id, sender_account_id, recipient_account_id,
      acceptor_account_id, category, elapsed_ms_from_created,
      occurred_at
    )
    VALUES (
      p_correlation_id, 'invite.accepted', 'lifecycle',
      v_row.id, v_row.sender_account_id, v_row.recipient_account_id,
      p_acceptor_account_id, p_category, v_elapsed_ms,
      v_now
    );
  EXCEPTION
    WHEN foreign_key_violation THEN
      GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
      RAISE EXCEPTION 'nex_friend_request_accept_tx: event_type_unregistered on constraint %',
        coalesce(v_constraint_name, '<null>')
        USING ERRCODE = '23503';
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'already_accepted', false,
    'request_id', v_row.id,
    'category', p_category,
    'accepted_at', v_now
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.nex_friend_request_accept_tx(uuid, uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nex_friend_request_accept_tx(uuid, uuid, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.nex_friend_request_accept_tx(uuid, uuid, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.nex_friend_request_accept_tx(uuid, uuid, text, uuid) TO service_role;

COMMENT ON FUNCTION public.nex_friend_request_accept_tx(uuid, uuid, text, uuid) IS
  'Scope-A · atomic friend-request accept. SECURITY DEFINER, fixed search_path, service-role-only. FOR UPDATE row-lock serialises concurrent accepts. Friends category writes nex_friend_edge canonical pair atomically. Business peer_conversation creation deferred to service layer (PR-2) because schema evolution makes atomic in-function insert fragile. Emits invite.accepted event atomically with the state change.';

-- ===========================================================================
-- FUNCTION 3 · nex_friend_request_cancel_tx
-- ===========================================================================
-- Atomic cancel · state-based idempotency · emits invite.cancelled event.
--
-- Returns:
--   { ok: true,  already_cancelled: true,  request_id, cancelled_at }
--   { ok: true,  already_cancelled: false, request_id, cancelled_at }
--   { ok: false, reason: 'not_found' }
--   { ok: false, reason: 'not_sender' }
--   { ok: false, reason: 'accepted' | 'expired' | 'passed' }
--   { ok: false, reason: 'event_type_unregistered', constraint }
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.nex_friend_request_cancel_tx(
  p_request_id              uuid,
  p_canceller_account_id    uuid,
  p_correlation_id          uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  v_row              record;
  v_now              timestamptz := now();
  v_constraint_name  text;
  v_elapsed_ms       integer;
BEGIN
  SELECT id, sender_account_id, recipient_account_id,
         status, cancelled_at, created_at
    INTO v_row
    FROM public.nex_friend_request
    WHERE id = p_request_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_row.sender_account_id <> p_canceller_account_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_sender');
  END IF;

  -- Idempotent: already cancelled · same cancelled_at returned.
  IF v_row.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_cancelled', true,
      'request_id', v_row.id,
      'cancelled_at', v_row.cancelled_at
    );
  END IF;

  -- Non-pending non-cancelled state · cancel is a no-op at terminal state.
  IF v_row.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_row.status);
  END IF;

  UPDATE public.nex_friend_request
     SET status = 'cancelled',
         cancelled_at = v_now,
         cooldown_ends_at = v_now + interval '72 hours'
     WHERE id = p_request_id;

  v_elapsed_ms := greatest(0, (extract(epoch from (v_now - v_row.created_at)) * 1000)::integer);

  BEGIN
    INSERT INTO public.nex_invite_event (
      correlation_id, event_name, event_class,
      request_id, sender_account_id, recipient_account_id,
      canceller_account_id, elapsed_ms_from_created,
      occurred_at
    )
    VALUES (
      p_correlation_id, 'invite.cancelled', 'lifecycle',
      v_row.id, v_row.sender_account_id, v_row.recipient_account_id,
      p_canceller_account_id, v_elapsed_ms,
      v_now
    );
  EXCEPTION
    WHEN foreign_key_violation THEN
      GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
      RAISE EXCEPTION 'nex_friend_request_cancel_tx: event_type_unregistered on constraint %',
        coalesce(v_constraint_name, '<null>')
        USING ERRCODE = '23503';
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'already_cancelled', false,
    'request_id', v_row.id,
    'cancelled_at', v_now
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.nex_friend_request_cancel_tx(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nex_friend_request_cancel_tx(uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.nex_friend_request_cancel_tx(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.nex_friend_request_cancel_tx(uuid, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.nex_friend_request_cancel_tx(uuid, uuid, uuid) IS
  'Scope-A · atomic friend-request cancel. SECURITY DEFINER, fixed search_path, service-role-only. State-based idempotency (already-cancelled returns the committed cancelled_at). Emits invite.cancelled event atomically.';

-- ===========================================================================
-- FUNCTION 4 · nex_friend_request_sweep_run
-- ===========================================================================
-- Atomic expiry sweep · advisory lock + bulk flip + per-row events +
-- sweep.run.ok heartbeat emission · all in one transaction.
--
-- The advisory lock is transaction-scoped (pg_try_advisory_xact_lock)
-- so it is auto-released on COMMIT or ROLLBACK. A second concurrent
-- call returns `{ok: true, skipped: 'concurrent'}` immediately.
--
-- Returns:
--   { ok: true, skipped: 'concurrent' }
--   { ok: true, flipped: N, duration_ms: M }
--   (RAISE on unexpected failure · PG rolls back · route emits sweep.run.failed)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.nex_friend_request_sweep_run(
  p_correlation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  v_locked          boolean;
  v_now             timestamptz := now();
  v_started         timestamptz := clock_timestamp();
  v_flipped         integer;
  v_duration_ms     integer;
  v_constraint_name text;
BEGIN
  -- Keyed advisory lock · hash of a well-known string.
  -- hashtextextended returns bigint · stable across sessions.
  v_locked := pg_try_advisory_xact_lock(
    hashtextextended('nex_friend_request_sweep_run', 0)
  );

  IF NOT v_locked THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'concurrent');
  END IF;

  -- Flip all pending-and-overdue rows to expired in one UPDATE.
  WITH flipped AS (
    UPDATE public.nex_friend_request
       SET status = 'expired',
           cooldown_ends_at = v_now + interval '72 hours'
     WHERE status = 'pending'
       AND expires_at <= v_now
    RETURNING id, sender_account_id, recipient_account_id, created_at
  ),
  per_row_events AS (
    INSERT INTO public.nex_invite_event (
      correlation_id, event_name, event_class,
      request_id, sender_account_id, recipient_account_id,
      elapsed_ms_from_created,
      occurred_at
    )
    SELECT
      p_correlation_id, 'invite.expired.swept', 'lifecycle',
      f.id, f.sender_account_id, f.recipient_account_id,
      greatest(0, (extract(epoch from (v_now - f.created_at)) * 1000)::integer),
      v_now
    FROM flipped f
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_flipped FROM flipped;

  v_duration_ms := greatest(0, (extract(epoch from (clock_timestamp() - v_started)) * 1000)::integer);

  -- Emit the sweep.run.ok heartbeat.
  -- A per-row event stream does NOT prove the job ran · a zero-row
  -- sweep still emits this heartbeat so the watcher can confirm execution.
  BEGIN
    INSERT INTO public.nex_invite_event (
      correlation_id, event_name, event_class,
      dims,
      occurred_at
    )
    VALUES (
      p_correlation_id, 'sweep.run.ok', 'operational',
      jsonb_build_object('flipped', v_flipped, 'duration_ms', v_duration_ms),
      v_now
    );
  EXCEPTION
    WHEN foreign_key_violation THEN
      GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
      RAISE EXCEPTION 'nex_friend_request_sweep_run: event_type_unregistered on constraint %',
        coalesce(v_constraint_name, '<null>')
        USING ERRCODE = '23503';
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'flipped', v_flipped,
    'duration_ms', v_duration_ms
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.nex_friend_request_sweep_run(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nex_friend_request_sweep_run(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.nex_friend_request_sweep_run(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.nex_friend_request_sweep_run(uuid) TO service_role;

COMMENT ON FUNCTION public.nex_friend_request_sweep_run(uuid) IS
  'Scope-A · atomic expiry sweep. SECURITY DEFINER, fixed search_path, service-role-only. Transaction-scoped advisory lock prevents overlapping runs. Zero-row sweep still emits sweep.run.ok heartbeat (watcher queries by is_sweep_heartbeat flag). Called from PR-3 Vercel cron with reconciliation handling for lost responses.';

-- ===========================================================================
-- FUNCTION 5 · nex_invite_event_retention_run
-- ===========================================================================
-- Atomic two-pass retention: lifecycle events (90d) + operational events
-- (365d) · both bounded to 1000 rows per class per run · emits
-- retention.run.ok heartbeat with per-class counts.
--
-- Preserves events that are still needed for investigation:
--   · Lifecycle events referenced by pending or still-in-cooldown invites
--   · Any event with an active hold (nex_invite_event_hold)
--   · Operational events are retained longer than lifecycle (365 vs 90)
--     because historical sweep/retention health is useful for pattern
--     analysis across months
--
-- Returns:
--   { ok: true, lifecycle_deleted: N, operational_deleted: M, duration_ms: D }
--   (RAISE on unexpected failure)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.nex_invite_event_retention_run(
  p_correlation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  v_now                   timestamptz := now();
  v_started               timestamptz := clock_timestamp();
  v_lifecycle_deleted     integer := 0;
  v_operational_deleted   integer := 0;
  v_duration_ms           integer;
  v_constraint_name       text;
BEGIN
  -- Pass A · lifecycle events older than 90 days.
  -- Preserves rows referenced by pending or cooldown-active invites,
  -- and rows under active hold.
  WITH candidates AS (
    SELECT id
      FROM public.nex_invite_event e
     WHERE e.event_class = 'lifecycle'
       AND e.occurred_at < v_now - interval '90 days'
       AND NOT EXISTS (
         SELECT 1 FROM public.nex_friend_request r
          WHERE r.id = e.request_id
            AND (r.status = 'pending'
                 OR (r.cooldown_ends_at IS NOT NULL AND r.cooldown_ends_at > v_now))
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.nex_invite_event_hold h
          WHERE h.invite_event_id = e.id
            AND h.cleared_at IS NULL
       )
     ORDER BY e.occurred_at ASC
     LIMIT 1000
     FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.nex_invite_event
   WHERE id IN (SELECT id FROM candidates);
  GET DIAGNOSTICS v_lifecycle_deleted = ROW_COUNT;

  -- Pass B · operational events older than 365 days.
  -- Preserves rows under active hold. Operational rows have no
  -- request_id dependency.
  WITH candidates AS (
    SELECT id
      FROM public.nex_invite_event e
     WHERE e.event_class = 'operational'
       AND e.occurred_at < v_now - interval '365 days'
       AND NOT EXISTS (
         SELECT 1 FROM public.nex_invite_event_hold h
          WHERE h.invite_event_id = e.id
            AND h.cleared_at IS NULL
       )
     ORDER BY e.occurred_at ASC
     LIMIT 1000
     FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.nex_invite_event
   WHERE id IN (SELECT id FROM candidates);
  GET DIAGNOSTICS v_operational_deleted = ROW_COUNT;

  v_duration_ms := greatest(0, (extract(epoch from (clock_timestamp() - v_started)) * 1000)::integer);

  -- Emit retention.run.ok heartbeat atomically.
  BEGIN
    INSERT INTO public.nex_invite_event (
      correlation_id, event_name, event_class,
      dims,
      occurred_at
    )
    VALUES (
      p_correlation_id, 'retention.run.ok', 'operational',
      jsonb_build_object(
        'lifecycle_deleted', v_lifecycle_deleted,
        'operational_deleted', v_operational_deleted,
        'duration_ms', v_duration_ms
      ),
      v_now
    );
  EXCEPTION
    WHEN foreign_key_violation THEN
      GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
      RAISE EXCEPTION 'nex_invite_event_retention_run: event_type_unregistered on constraint %',
        coalesce(v_constraint_name, '<null>')
        USING ERRCODE = '23503';
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'lifecycle_deleted', v_lifecycle_deleted,
    'operational_deleted', v_operational_deleted,
    'duration_ms', v_duration_ms
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.nex_invite_event_retention_run(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nex_invite_event_retention_run(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.nex_invite_event_retention_run(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.nex_invite_event_retention_run(uuid) TO service_role;

COMMENT ON FUNCTION public.nex_invite_event_retention_run(uuid) IS
  'Scope-A · atomic retention. SECURITY DEFINER, fixed search_path, service-role-only. Two bounded passes (lifecycle 90d, operational 365d, 1000 rows each). Preserves active-invite and held events. Emits retention.run.ok heartbeat with per-class deleted counts. Called from PR-3 Vercel cron or pg_cron.';

-- ---------------------------------------------------------------------------
-- Migration history
-- ---------------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, notes)
  VALUES (
    '265',
    'Scope-A transactional functions · 5 plpgsql RPCs for atomic invitation lifecycle + sweep + retention',
    'Owner-authorised 2026-11-03. SECURITY DEFINER with fixed search_path. Service-role-only EXECUTE. Structured GET STACKED DIAGNOSTICS exception handling. Payload-aware idempotency fingerprint. Compound-FK-enforced event classification. Scope-A PR-1.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
