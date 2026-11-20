-- ============================================================================
-- Migration 354 · Lane E · E-ATOM · nex_create_cart_order_tx
-- STATUS: AUTHORISED FOR SANDBOX APPLY · founder handoff (host IPv6-only)
-- Target: sandbox kdstoyyeygcopkogqsyv ONLY · prod ijvqdvsvwtwxzcqmoqit sealed
-- Promoted (strip _PREVIEW) 2026-11-20 per owner authorisation
--   "apply mig-354 cart-tx sandbox + flip flag".
-- Apply-script: scripts/apply-migration-354-sandbox.mjs
-- ============================================================================
--
-- APPLY-VERSION sibling of
-- `C002_nex_cart_order_create_transactional.sql` (the rollback-wrapped
-- quarantined candidate · retained for review diff).
--
-- Status: promoted. Reviewable in migrations/.
--   · This file lives in `nex-supabase/migrations/`.
--   · The TypeScript wrapper (`send-cart-order.transactional-candidate.ts`)
--     remains gated behind `NEX_CART_ORDER_TX=1`. Caller rewire lands
--     in the same commit as this promotion. Legacy direct-write path
--     stays as the fallback until flag flip + BROWSER-tier verification.
--
-- Differences from `C002_...sql`:
--   · This file is wrapped in BEGIN; … COMMIT; (not ROLLBACK).
--   · This file writes one row into `nex_migration_history` (sandbox
--     only · the apply-version PREVIEW records a sandbox ref).
--   · The function body is byte-for-byte the same body as `C002_...sql`
--     · the ONLY intended differences between the two files are the
--     transaction verb and the migration-history INSERT. Reviewers
--     should diff the two files and confirm this.
--
-- Full preamble, invariants, rollback semantics, and review-path
-- rationale are documented in `C002_...sql` · not duplicated here.
-- Reviewers should read `C002_...sql`'s preamble FIRST, then diff the
-- two SQL bodies.
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

REVOKE ALL ON FUNCTION nex_create_cart_order_tx(
  UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID, UUID, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION nex_create_cart_order_tx(
  UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID, UUID, TEXT, TEXT
) TO authenticated, service_role;

-- Migration history row · sandbox target only · the apply-script
-- PREVIEW guards hard against production ref. Column list matches
-- the live `nex_migration_history` schema (version text, description
-- text, notes text · see mig 343 for the latest-applied example).
INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '354',
  'nex_cart_order_create_transactional · SECURITY DEFINER wrapper for sendCartOrderAction',
  'Closes §16.13/§16.27/§16.35 non-atomicity gap · pre-minted order UUID preserved · send_intent_id dedup preserved · server-authoritative price snapshot from nex_product · representative-product rule preserved (pure menu_item carts skip order branch) · sandbox only'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
