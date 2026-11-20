-- ============================================================================
-- UNAPPLIED candidate migration · Lane E · E-ATOM · round 17 · 2026-11-19
-- ROLLBACK-WRAPPED ANCHOR VARIANT · DO NOT APPLY TO ANY DATABASE
-- ============================================================================
--
-- Status: QUARANTINED. Lives under `nex-supabase/candidate-migrations/`,
-- NOT under `nex-supabase/migrations/`. Not scanned by any
-- `apply-migration-*.mjs` helper. Wrapped in `BEGIN; … ROLLBACK;` so a
-- hand-run against ANY DB produces no net effect.
--
-- Addresses §16.13 / §16.27 / §16.35 documented non-atomicity gap in
-- `sendCartOrderAction` (src/app/nex-native/_actions.ts). Today the
-- flow is:
--
--   1. peerMessageService.sendPeerMessage(cart snapshot)   ← persisted
--   2. orderService.createOrder(id = futureOrderId, …)     ← fail-soft
--
-- If step 2 fails, the message is retained and the seller sees the
-- cart in chat but no order row. This candidate wraps BOTH writes in
-- a single SECURITY DEFINER function so either both rows land or
-- neither does. The TypeScript wrapper candidate
-- (`src/lib/nex-native/calls/send-cart-order.transactional-candidate.ts`)
-- stays disabled behind a feature flag until BROWSER-tier verification
-- passes on the sandbox · the flag flip is a SEPARATE authorisation.
--
-- Invariants preserved:
--   · Pre-minted order UUID flows from caller → attachment_meta.cart.order_id
--     → nex_order.id · Tier-0 resolution on manage/orders detail stays
--     a direct equality match.
--   · send_intent_id dedup on nex_peer_message (sender_account_id,
--     send_intent_id) is honoured via ON CONFLICT DO NOTHING + re-SELECT.
--   · nex_order.idempotency_key dedup is honoured via the same pattern.
--   · Representative-product rule: when p_primary_product_id IS NULL
--     (pure menu_item cart · food flow) the function writes the message
--     and skips the order insert · preserves current pure-menu behaviour.
--   · Prices + currency + business_id are snapshotted FROM nex_product
--     inside the function · caller cannot inject a different price.
--   · Ownership check: sender must be a participant of the conversation
--     (participant_a_id OR participant_b_id) · raises on mismatch.
--   · auth.uid() check matches the caller's claimed sender_account_id's
--     supabase_user_id via nex_account · raises on mismatch.
--
-- Rollback semantics (candidate-review only):
--   · This file is BEGIN; … ROLLBACK; → no state change to the DB.
--   · The APPLY-VERSION sibling (354_...PREVIEW.sql · also quarantined)
--     is BEGIN; … COMMIT; and adds the nex_migration_history INSERT the
--     real apply would need.
--   · A matching _rollback_PREVIEW.sql + apply-script preview live in
--     this same directory.
--
-- Review path (two-variant convention, sealed 2026-11-19 · README):
--   1. Review THIS file as the baseline anchor.
--   2. Diff against `354_nex_cart_order_create_transactional_PREVIEW.sql`
--      · only the transaction verb and migration-history INSERT should
--      differ in the apply sibling.
--   3. Review the TypeScript wrapper candidate (unactivated).
--   4. Review the mocked spec tests under
--      `src/lib/nex-native/calls/__tests__/`.
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
BEGIN
  -- ── Caller identity ───────────────────────────────────────────
  -- auth.uid() is the Supabase JWT subject. When present it must
  -- resolve to the SAME nex_account whose id the caller claims as
  -- p_sender_account_id. A null auth.uid() is treated as "callable
  -- from service-role contexts" (e.g. batched replays) and is NOT
  -- blocked here · the caller must still prove the account link.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_self_supabase_user_id THEN
    RAISE EXCEPTION 'caller_identity_mismatch · auth.uid != p_self_supabase_user_id';
  END IF;

  PERFORM 1
  FROM nex_account
  WHERE id = p_sender_account_id
    AND supabase_user_id = p_self_supabase_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'caller_account_not_found';
  END IF;

  -- ── Conversation ownership (participant-only) ─────────────────
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

  -- ── Message INSERT · send_intent_id dedup ─────────────────────
  -- Migration 102 Part C seals UNIQUE (sender_account_id,
  -- send_intent_id) on nex_peer_message. ON CONFLICT DO NOTHING +
  -- RETURNING-id-or-SELECT produces the same shape sendPeerMessage
  -- exposes to callers: a retry converges on the first message row.
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
    -- Message was deduped. If a prior order row already exists for
    -- the same idempotency_key we return THAT · otherwise we still
    -- fall through to the order branch so a crashed-mid-attempt
    -- retry can still land the order row.
  END IF;

  -- ── Order branch (representative-product rule) ────────────────
  -- Pure menu_item carts call the function with p_primary_product_id
  -- IS NULL · we write the message only · identical to the current
  -- JS behaviour (see src/app/nex-native/_actions.ts around the
  -- `primaryProductItem?.id` guard).
  IF p_primary_product_id IS NULL THEN
    RETURN QUERY SELECT
      v_message_id,
      NULL::UUID,
      'no_product_item'::TEXT;
    RETURN;
  END IF;

  -- Idempotency dedup on nex_order BEFORE the price snapshot + INSERT.
  -- Matches src/lib/nex-native/order-service.ts:75-83.
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

  -- Server-authoritative price snapshot from nex_product.
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
    -- Lost a race on idempotency_key · re-SELECT (mirrors the
    -- pattern in order-service.ts:126-132).
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

  -- Fresh order · write the immutable "created" event. Matches
  -- order-service.ts:141-151.
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

REVOKE ALL ON FUNCTION nex_create_cart_order_tx(
  UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID, UUID, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION nex_create_cart_order_tx(
  UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID, UUID, TEXT, TEXT
) TO authenticated, service_role;

ROLLBACK;
