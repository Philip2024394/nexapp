-- ============================================================================
-- Migration 363 · defence-in-depth hardening of nex_create_cart_order_tx
-- STATUS: PREPARED FOR SANDBOX APPLY · host IPv6-only outage blocks direct
-- apply this session · awaiting pooler/handoff.
-- Target: sandbox kdstoyyeygcopkogqsyv ONLY · prod ijvqdvsvwtwxzcqmoqit sealed.
-- ============================================================================
--
-- Owner-authorised 2026-11-20 after security review of migration 354 ·
-- "Treat nex_create_cart_order_tx as a security review, not just a
--  schema check. It is SECURITY DEFINER and anon can execute it.
--  Check whether anon should have EXECUTE at all; that the buyer
--  comes from auth.uid() and can't be faked through inputs; ...
--  If any check fails, fix it with a reviewed sandbox migration that
--  tightens security and never loosens it."
--
-- FINDINGS (probe evidence captured 2026-11-20):
--
--   1. anon HAD EXECUTE on nex_create_cart_order_tx. Verified via
--      sandbox POST https://kdstoyyeygcopkogqsyv.supabase.co/rest/v1/
--      rpc/nex_create_cart_order_tx using the sandbox anon key.
--      Response: HTTP 400 {"code":"P0001","message":
--      "caller_account_not_found"}. A 400 at that point means anon
--      PASSED the EXECUTE check AND the auth.uid()-NULL
--      short-circuit, and the function's own internal lookup fired
--      the exception. A properly-revoked function would return 403
--      at the PostgREST layer BEFORE the body executed. This is a
--      real privilege-escalation exposure, not a theoretical one.
--
--   2. In nex_create_cart_order_tx the check
--        IF auth.uid() IS NOT NULL AND auth.uid() <> p_self_supabase_user_id
--      is a NO-OP when auth.uid() IS NULL. Service-role callers
--      (server actions via admin client) correctly have NULL auth
--      and are trusted by design · anon callers ALSO have NULL auth
--      and were NOT trusted but passed the same check.
--
--   3. The downstream check
--        SELECT 1 FROM nex_account
--          WHERE id = p_sender_account_id
--            AND supabase_user_id = p_self_supabase_user_id
--      only blocks attackers who do NOT know a victim's
--      (id, supabase_user_id) pair. supabase_user_id is a UUID and
--      not visible via the current anon RLS on nex_account for
--      arbitrary accounts, so this is DEFENCE-IN-DEPTH rather than
--      the last line of defence · but defence-in-depth at the ACL
--      layer is still required by sealed security policy.
--
-- WHAT THIS MIGRATION DOES:
--
--   · REVOKE EXECUTE ON nex_create_cart_order_tx FROM anon, PUBLIC.
--     This closes the REST-exploit path immediately.
--   · Replaces the function body so that callers with NULL
--     auth.uid() must ALSO pass a GUC assertion the server action
--     sets. The server action runs with service_role which bypasses
--     RLS, but service_role auth.uid() is also NULL inside functions
--     (session_user is `authenticator`, role is `service_role`).
--     The hardened check uses `current_setting('role', true)` to
--     verify the caller is `service_role` when auth.uid() IS NULL.
--     Service-role callers pass · anon callers (if an ACL regression
--     ever re-grants EXECUTE) fail closed.
--   · Function body otherwise byte-for-byte identical to mig 354.
--     No behavioural change for authenticated server-action callers.
--
-- EXPLICITLY DOES NOT:
--
--   · Change grants to authenticated or service_role (unchanged
--     EXECUTE).
--   · Alter any row data.
--   · Touch nex_order, nex_peer_message, nex_order_event, nex_product.
--   · Loosen any existing check.
--
-- ROLLBACK (see 363_..._rollback.sql): simply re-installs the mig
-- 354 function body verbatim and does not re-grant anon. Reverts
-- the defence-in-depth check WITHOUT re-exposing the EXECUTE grant.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION nex_create_cart_order_tx(
  p_self_supabase_user_id UUID,
  p_sender_account_id UUID,
  p_conversation_id UUID,
  p_message_body TEXT,
  p_attachment_meta JSONB,
  p_send_intent_id TEXT,
  p_order_id UUID,
  p_primary_product_id UUID,
  p_idempotency_key TEXT,
  p_customer_note TEXT
) RETURNS TABLE (
  out_message_id UUID,
  out_order_id UUID,
  out_skipped TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_participant_a UUID;
  v_participant_b UUID;
  v_message_id UUID;
  v_order_id UUID;
  v_product_business_id UUID;
  v_product_price_pence BIGINT;
  v_product_currency TEXT;
  v_dedup_order_row nex_order%ROWTYPE;
  v_effective_role TEXT := current_setting('role', true);
BEGIN
  -- Defence-in-depth 2026-11-20 · tighten the identity check.
  -- Authenticated callers: auth.uid() must equal p_self_supabase_user_id.
  -- Service-role callers (server actions): auth.uid() IS NULL and
  -- current_setting('role') is 'service_role'.
  -- Anything else (anon, or an unexpected role): fail closed.
  IF auth.uid() IS NOT NULL THEN
    IF auth.uid() <> p_self_supabase_user_id THEN
      RAISE EXCEPTION 'caller_identity_mismatch · auth.uid != p_self_supabase_user_id';
    END IF;
  ELSE
    IF v_effective_role IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'caller_identity_denied · null auth.uid requires service_role (got %)', COALESCE(v_effective_role, '<unknown>');
    END IF;
  END IF;

  PERFORM 1
  FROM nex_account
  WHERE id = p_sender_account_id
    AND supabase_user_id = p_self_supabase_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'caller_account_not_found';
  END IF;

  SELECT participant_a_id, participant_b_id
    INTO v_participant_a, v_participant_b
  FROM nex_peer_conversation
  WHERE id = p_conversation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'conversation_not_found';
  END IF;
  IF p_sender_account_id <> v_participant_a
     AND p_sender_account_id <> v_participant_b THEN
    RAISE EXCEPTION 'conversation_not_participant';
  END IF;

  INSERT INTO nex_peer_message (
    conversation_id,
    sender_account_id,
    body,
    attachment_url,
    attachment_type,
    attachment_meta,
    send_intent_id
  ) VALUES (
    p_conversation_id,
    p_sender_account_id,
    p_message_body,
    NULL,
    NULL,
    p_attachment_meta,
    NULLIF(p_send_intent_id, '')
  )
  ON CONFLICT (sender_account_id, send_intent_id) DO NOTHING
  RETURNING id INTO v_message_id;

  IF v_message_id IS NULL THEN
    SELECT id INTO v_message_id
    FROM nex_peer_message
    WHERE sender_account_id = p_sender_account_id
      AND send_intent_id = NULLIF(p_send_intent_id, '');
    IF v_message_id IS NULL THEN
      RAISE EXCEPTION 'message_dedup_not_resolved';
    END IF;
  END IF;

  IF p_primary_product_id IS NULL THEN
    RETURN QUERY SELECT
      v_message_id,
      NULL::UUID,
      'no_product_item'::TEXT;
    RETURN;
  END IF;

  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT * INTO v_dedup_order_row
    FROM nex_order
    WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN QUERY SELECT
        v_message_id,
        v_dedup_order_row.id,
        'order_dedup_hit'::TEXT;
      RETURN;
    END IF;
  END IF;

  SELECT business_id, price_pence, currency
    INTO v_product_business_id, v_product_price_pence, v_product_currency
  FROM nex_product
  WHERE id = p_primary_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product_not_found';
  END IF;

  INSERT INTO nex_order (
    id,
    customer_account_id,
    business_id,
    product_id,
    source_conversation_id,
    state,
    price_pence,
    currency,
    idempotency_key,
    customer_note
  ) VALUES (
    p_order_id,
    p_sender_account_id,
    v_product_business_id,
    p_primary_product_id,
    NULL,
    'created',
    v_product_price_pence,
    v_product_currency,
    NULLIF(p_idempotency_key, ''),
    NULLIF(p_customer_note, '')
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_order_id;

  IF v_order_id IS NULL THEN
    SELECT id INTO v_order_id
    FROM nex_order
    WHERE idempotency_key = p_idempotency_key;
    IF v_order_id IS NULL THEN
      RAISE EXCEPTION 'order_dedup_not_resolved';
    END IF;
    RETURN QUERY SELECT
      v_message_id,
      v_order_id,
      'order_dedup_race'::TEXT;
    RETURN;
  END IF;

  INSERT INTO nex_order_event (
    order_id,
    event,
    actor_account_id,
    metadata
  ) VALUES (
    v_order_id,
    'created',
    p_sender_account_id,
    jsonb_build_object(
      'product_id', p_primary_product_id,
      'business_id', v_product_business_id,
      'price_pence', v_product_price_pence,
      'currency', v_product_currency
    )
  );

  RETURN QUERY SELECT
    v_message_id,
    v_order_id,
    NULL::TEXT;
END;
$$;

-- Close the REST-exploit path · REVOKE from PUBLIC AND anon explicitly.
-- The CREATE OR REPLACE above preserves the existing ACL · we must
-- actively strip anon before this migration can be considered
-- complete.
REVOKE EXECUTE ON FUNCTION nex_create_cart_order_tx(
  UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID, UUID, TEXT, TEXT
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION nex_create_cart_order_tx(
  UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID, UUID, TEXT, TEXT
) FROM anon;

-- Keep EXECUTE on authenticated + service_role · byte-for-byte parity
-- with mig 354's intended grant set.
GRANT EXECUTE ON FUNCTION nex_create_cart_order_tx(
  UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID, UUID, TEXT, TEXT
) TO authenticated, service_role;

-- Migration history row · sandbox target only.
INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '363',
  'nex_cart_order_create_transactional · defence-in-depth · REVOKE anon + require service_role for null auth.uid',
  'Closes REST-callable anon exploit discovered 2026-11-20 after mig 354 landed · function body otherwise identical · see probe evidence in handoff.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
