-- ============================================================================
-- Migration 365 · nex_create_cart_order_tx · add WHERE predicate to ON CONFLICT
-- Target: sandbox kdstoyyeygcopkogqsyv ONLY · prod ijvqdvsvwtwxzcqmoqit sealed.
-- ============================================================================
-- Surfaced 2026-11-20 by rerun of mig-363 security contract tests AFTER
-- mig 364 unblocked the TEXT→UUID cast bug (SQLSTATE 42804).
-- Owner-authorised 2026-11-20 by word-trigger "apply mig 365 to sandbox".
--
-- FINDING
--   The unique index backing the message-send dedup is PARTIAL:
--     CREATE UNIQUE INDEX uq_nex_peer_message_send_intent
--       ON public.nex_peer_message (sender_account_id, send_intent_id)
--       WHERE (send_intent_id IS NOT NULL)
--
--   nex_create_cart_order_tx attempts to use:
--     ON CONFLICT (sender_account_id, send_intent_id) DO NOTHING
--
--   PostgreSQL requires the inference clause to carry the partial-index
--   predicate (WHERE send_intent_id IS NOT NULL); without it the planner
--   cannot select uq_nex_peer_message_send_intent and raises SQLSTATE
--   42P10 "there is no unique or exclusion constraint matching the ON
--   CONFLICT specification".
--
--   This was latent across mig 354 + 363 + 364; hidden by the cast bug
--   (42804) and by NEX_CART_ORDER_TX=0 keeping the RPC off the hot path.
--
-- MINIMAL PATCH
--   Add `WHERE send_intent_id IS NOT NULL` to the ON CONFLICT clause on
--   the nex_peer_message insert. Byte-identical to mig 364 otherwise.
--   CREATE OR REPLACE preserves the ACL established by mig 363
--   (REVOKE anon · GRANT authenticated + service_role).
--
-- IDENTITY / OWNERSHIP / REPLAY PROTECTIONS
--   Preserved unchanged from mig 364:
--     · caller_identity_mismatch (auth.uid vs p_self_supabase_user_id)
--     · caller_identity_denied (NULL auth.uid requires service_role GUC)
--     · caller_account_not_found (sender must belong to caller)
--     · conversation_not_found / conversation_not_participant
--     · product_not_found
--     · send_intent dedup fallback SELECT
--     · nex_order ON CONFLICT (idempotency_key) DO NOTHING dedup
--     · nex_order_event write under the same atomic BEGIN/COMMIT
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
  v_send_intent_uuid UUID := NULLIF(p_send_intent_id, '')::uuid;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF auth.uid() <> p_self_supabase_user_id THEN
      RAISE EXCEPTION 'caller_identity_mismatch · auth.uid != p_self_supabase_user_id';
    END IF;
  ELSE
    IF v_effective_role IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'caller_identity_denied · null auth.uid requires service_role (got %)', COALESCE(v_effective_role, '<unknown>');
    END IF;
  END IF;

  PERFORM 1 FROM nex_account
   WHERE id = p_sender_account_id AND supabase_user_id = p_self_supabase_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'caller_account_not_found'; END IF;

  SELECT participant_a_id, participant_b_id INTO v_participant_a, v_participant_b
    FROM nex_peer_conversation WHERE id = p_conversation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'conversation_not_found'; END IF;
  IF p_sender_account_id <> v_participant_a AND p_sender_account_id <> v_participant_b THEN
    RAISE EXCEPTION 'conversation_not_participant';
  END IF;

  INSERT INTO nex_peer_message (
    conversation_id, sender_account_id, body, attachment_url, attachment_type,
    attachment_meta, send_intent_id
  ) VALUES (
    p_conversation_id, p_sender_account_id, p_message_body, NULL, NULL,
    p_attachment_meta, v_send_intent_uuid
  )
  ON CONFLICT (sender_account_id, send_intent_id) WHERE send_intent_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_message_id;

  IF v_message_id IS NULL THEN
    SELECT id INTO v_message_id FROM nex_peer_message
     WHERE sender_account_id = p_sender_account_id
       AND send_intent_id = v_send_intent_uuid;
    IF v_message_id IS NULL THEN RAISE EXCEPTION 'message_dedup_not_resolved'; END IF;
  END IF;

  IF p_primary_product_id IS NULL THEN
    RETURN QUERY SELECT v_message_id, NULL::UUID, 'no_product_item'::TEXT; RETURN;
  END IF;

  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT * INTO v_dedup_order_row FROM nex_order WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN QUERY SELECT v_message_id, v_dedup_order_row.id, 'order_dedup_hit'::TEXT; RETURN;
    END IF;
  END IF;

  SELECT business_id, price_pence, currency INTO v_product_business_id, v_product_price_pence, v_product_currency
    FROM nex_product WHERE id = p_primary_product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'product_not_found'; END IF;

  INSERT INTO nex_order (
    id, customer_account_id, business_id, product_id, source_conversation_id,
    state, price_pence, currency, idempotency_key, customer_note
  ) VALUES (
    p_order_id, p_sender_account_id, v_product_business_id, p_primary_product_id, NULL,
    'created', v_product_price_pence, v_product_currency,
    NULLIF(p_idempotency_key, ''), NULLIF(p_customer_note, '')
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_order_id;

  IF v_order_id IS NULL THEN
    SELECT id INTO v_order_id FROM nex_order WHERE idempotency_key = p_idempotency_key;
    IF v_order_id IS NULL THEN RAISE EXCEPTION 'order_dedup_not_resolved'; END IF;
    RETURN QUERY SELECT v_message_id, v_order_id, 'order_dedup_race'::TEXT; RETURN;
  END IF;

  INSERT INTO nex_order_event (order_id, event, actor_account_id, metadata)
  VALUES (
    v_order_id, 'created', p_sender_account_id,
    jsonb_build_object('product_id', p_primary_product_id, 'business_id', v_product_business_id,
                       'price_pence', v_product_price_pence, 'currency', v_product_currency)
  );

  RETURN QUERY SELECT v_message_id, v_order_id, NULL::TEXT;
END;
$$;

INSERT INTO nex_migration_history (version, description, notes)
VALUES ('365',
  'nex_create_cart_order_tx · add WHERE send_intent_id IS NOT NULL to ON CONFLICT inference · fixes SQLSTATE 42P10 surfaced after mig 364',
  'Byte-identical to mig 364 except the ON CONFLICT WHERE predicate on the message-insert. Grants preserved via CREATE OR REPLACE semantics. Applied to sandbox kdstoyyeygcopkogqsyv 2026-11-20.')
ON CONFLICT (version) DO NOTHING;

COMMIT;
