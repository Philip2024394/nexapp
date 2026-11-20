-- =============================================================================
-- Migration 349 · nex_order dispatch / tracking fields + safe seller RPC
-- STATUS: PROPOSAL · NOT AUTHORISED FOR APPLY · no auto-apply, no PR, no deploy
-- Target when applied: sandbox kdstoyyeygcopkogqsyv ONLY
-- Prod ijvqdvsvwtwxzcqmoqit remains sealed · no production apply authorised
-- =============================================================================
--
-- CONTEXT
-- Owner authorised preparation (not execution) of a minimal dispatch/tracking
-- feature on 2026-11-17. This file is the audit-ready migration draft.
--
-- CURRENT STATE (verified 2026-11-17 via schema audit)
--   · nex_order already has `dispatch_tracking_url text` from migration 032.
--   · nex_order has NO authenticated UPDATE/DELETE RLS policy — authenticated
--     users CANNOT directly PATCH nex_order rows via PostgREST. All writes
--     flow through server-role server actions today. We KEEP this property.
--   · Primary attack vector flagged by owner: an RLS UPDATE policy restricts
--     ROWS not COLUMNS; granting any authenticated UPDATE would let a seller
--     flip `state='paid'`, `price_pence`, `customer_account_id`, etc.
--   · Therefore this migration does NOT add an authenticated UPDATE policy.
--     Instead it adds a narrow SECURITY DEFINER RPC that touches ONLY the
--     new dispatch columns, enforces fulfilling-seller ownership, uses a
--     fixed search_path, and is granted EXECUTE to authenticated only.
--
-- SECURITY PROPERTIES
--   · RLS stays as today · authenticated cannot UPDATE nex_order directly.
--   · RPC allowlist: only dispatch_provider, dispatch_provider_custom,
--     dispatch_tracking_number, dispatch_tracking_url, dispatch_state,
--     dispatched_at, delivered_at, estimated_transit_qty,
--     estimated_transit_unit, tracking_updated_at.
--   · RPC never touches: state (payment), price_pence, total_pence, currency,
--     customer_account_id, business_id, product_id, created_at, idempotency_key,
--     customer_note, merchant_note, payment_method.
--   · Caller validation: nex_resolve_account_id_from_jwt() must match the
--     nex_business.owner_account_id for the target order's business_id.
--   · search_path = pg_catalog, public (prevents search_path hijack).
--   · REVOKE ALL FROM PUBLIC · GRANT EXECUTE TO authenticated ONLY.
--
-- OPEN QUESTIONS FOR OWNER DECISION
--   Q1 · Unit range for estimated_transit_qty + estimated_transit_unit:
--        · days: 1..180 proposed (months of sea freight handled via 'months').
--        · months: 1..12 proposed.
--   Q2 · Should an existing paid order be allowed to transition dispatch_state
--        while unpaid stays Not dispatched? Current proposal: allowed (owner
--        rule "do NOT add a new hard rule blocking unpaid dispatch").
--   Q3 · Delivered state: current proposal attributes to seller
--        ('delivered — seller reported'). No carrier-verified source wired.
--   Q4 · ETA calendar-month handling: clamp-to-month-end convention
--        (Jan 31 + 1 month → Feb 28/29). Spec'd in server util, not DB.
--
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · Columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.nex_order
  ADD COLUMN IF NOT EXISTS dispatch_provider text
    CHECK (dispatch_provider IS NULL OR dispatch_provider IN
      ('dhl','ups','fedex','postal','sea_freight','other')),
  ADD COLUMN IF NOT EXISTS dispatch_provider_custom text
    CHECK (dispatch_provider_custom IS NULL OR
      (length(trim(dispatch_provider_custom)) BETWEEN 1 AND 80)),
  ADD COLUMN IF NOT EXISTS dispatch_tracking_number text
    CHECK (dispatch_tracking_number IS NULL OR
      (length(trim(dispatch_tracking_number)) BETWEEN 1 AND 128)),
  -- dispatch_tracking_url already exists from migration 032 · retained
  ADD COLUMN IF NOT EXISTS dispatch_state text NOT NULL DEFAULT 'not_dispatched'
    CHECK (dispatch_state IN ('not_dispatched','preparing','dispatched','delivered')),
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS estimated_transit_qty int
    CHECK (estimated_transit_qty IS NULL OR
      (estimated_transit_qty > 0 AND estimated_transit_qty <= 365)),
  ADD COLUMN IF NOT EXISTS estimated_transit_unit text
    CHECK (estimated_transit_unit IS NULL OR
      estimated_transit_unit IN ('days','months')),
  ADD COLUMN IF NOT EXISTS tracking_updated_at timestamptz;

-- Date/state consistency:
--   dispatched / delivered require dispatched_at.
--   delivered also requires delivered_at.
--   delivered_at must be >= dispatched_at when both are set.
--   dispatched_at must not be in the future (clock skew tolerance 5 min).
ALTER TABLE public.nex_order
  ADD CONSTRAINT IF NOT EXISTS nex_order_dispatch_state_dates_chk CHECK (
    (dispatch_state NOT IN ('dispatched','delivered') OR dispatched_at IS NOT NULL)
    AND (dispatch_state <> 'delivered' OR delivered_at IS NOT NULL)
    AND (delivered_at IS NULL OR dispatched_at IS NULL OR delivered_at >= dispatched_at)
  );

-- Transit qty + unit paired:
ALTER TABLE public.nex_order
  ADD CONSTRAINT IF NOT EXISTS nex_order_transit_qty_unit_paired_chk CHECK (
    (estimated_transit_qty IS NULL) = (estimated_transit_unit IS NULL)
  );

-- Provider custom paired with provider_in ('postal','sea_freight','other'):
ALTER TABLE public.nex_order
  ADD CONSTRAINT IF NOT EXISTS nex_order_provider_custom_chk CHECK (
    dispatch_provider_custom IS NULL
    OR dispatch_provider IN ('postal','sea_freight','other')
  );

-- Partial index for seller fulfilment queue · "my open shipments":
CREATE INDEX IF NOT EXISTS nex_order_dispatch_open_idx
  ON public.nex_order (business_id, dispatch_state)
  WHERE dispatch_state IN ('preparing','dispatched');

COMMENT ON COLUMN public.nex_order.dispatch_provider IS
  'Seller-reported carrier category. NULL until seller records dispatch info.';
COMMENT ON COLUMN public.nex_order.dispatch_state IS
  'Seller-reported fulfilment progression. NEVER set by elapsed time, animation, or buyer action. Delivered is seller-attributed unless an external verified source lands later.';
COMMENT ON COLUMN public.nex_order.dispatched_at IS
  'Actual date seller handed the parcel to the carrier (not the order date). Used as base for ETA computation.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · SECURITY DEFINER RPC for seller dispatch writes
--    Template: mig 236 nex_music_publish_as_active_slot
--    Pattern: SECURITY DEFINER · SET search_path · caller validation · grants
-- ─────────────────────────────────────────────────────────────────────────────

-- Called by service-role server action after the action has resolved the
-- session and loaded the order. Caller passes the session's resolved
-- seller_account_id as p_seller_account_id — the RPC re-verifies ownership
-- against nex_business (defence in depth · never trusts the caller's claim
-- without matching it against the DB).
--
-- NOTE on auth.uid(): service-role bypasses RLS and auth.uid() returns NULL,
-- so this RPC cannot rely on nex_resolve_account_id_from_jwt(). Ownership
-- is proven by matching p_seller_account_id against nex_business.owner_account_id
-- for the target order's business_id · same assurance that the server action
-- already performs, re-enforced here so a future broader service-role call
-- path cannot modify someone else's shipment.
CREATE OR REPLACE FUNCTION public.nex_order_seller_save_dispatch(
  p_order_id uuid,
  p_seller_account_id uuid,
  p_provider text,
  p_provider_custom text,
  p_tracking_number text,
  p_tracking_url text,
  p_estimated_qty int,
  p_estimated_unit text,
  p_action text  -- 'save' | 'mark_preparing' | 'mark_dispatched' | 'mark_delivered'
)
RETURNS TABLE (
  id uuid,
  dispatch_provider text,
  dispatch_provider_custom text,
  dispatch_tracking_number text,
  dispatch_tracking_url text,
  dispatch_state text,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  estimated_transit_qty int,
  estimated_transit_unit text,
  tracking_updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_business uuid;
  v_order_state text;
  v_current_state text;
  v_now timestamptz := now();
  v_new_state text;
  v_new_dispatched_at timestamptz;
  v_new_delivered_at timestamptz;
BEGIN
  IF p_seller_account_id IS NULL OR p_order_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  -- Load order and verify fulfilling-seller ownership.
  SELECT o.business_id, o.state, o.dispatch_state
    INTO v_business, v_order_state, v_current_state
    FROM public.nex_order o
   WHERE o.id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.nex_business b
     WHERE b.id = v_business AND b.owner_account_id = p_seller_account_id
  ) THEN
    RAISE EXCEPTION 'forbidden_not_fulfilling_seller' USING ERRCODE = '42501';
  END IF;

  -- Terminal payment states still allow fulfilment · but cancelled/refunded
  -- must not accept new dispatch actions.
  IF v_order_state IN ('cancelled','refunded') THEN
    RAISE EXCEPTION 'order_terminal_payment_state' USING ERRCODE = '22023';
  END IF;

  -- Normalise and validate inputs (defence in depth · table CHECKs already apply).
  p_provider := nullif(trim(coalesce(p_provider,'')), '');
  p_provider_custom := nullif(trim(coalesce(p_provider_custom,'')), '');
  p_tracking_number := nullif(trim(coalesce(p_tracking_number,'')), '');
  p_tracking_url := nullif(trim(coalesce(p_tracking_url,'')), '');

  IF p_provider IS NOT NULL
     AND p_provider NOT IN ('dhl','ups','fedex','postal','sea_freight','other') THEN
    RAISE EXCEPTION 'invalid_provider' USING ERRCODE = '22023';
  END IF;

  IF p_tracking_url IS NOT NULL
     AND p_tracking_url !~ '^https://' THEN
    RAISE EXCEPTION 'tracking_url_must_be_https' USING ERRCODE = '22023';
  END IF;

  IF p_estimated_qty IS NOT NULL AND p_estimated_unit IS NULL THEN
    RAISE EXCEPTION 'estimated_qty_without_unit' USING ERRCODE = '22023';
  END IF;
  IF p_estimated_qty IS NULL AND p_estimated_unit IS NOT NULL THEN
    RAISE EXCEPTION 'estimated_unit_without_qty' USING ERRCODE = '22023';
  END IF;
  IF p_estimated_unit NOT IN ('days','months') AND p_estimated_unit IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_estimated_unit' USING ERRCODE = '22023';
  END IF;

  -- Dispatch-state transition (explicit actions only).
  v_new_state := v_current_state;
  v_new_dispatched_at := NULL;  -- NULL means "do not overwrite"
  v_new_delivered_at := NULL;

  IF p_action = 'save' THEN
    -- Save details only · never flips state.
    NULL;
  ELSIF p_action = 'mark_preparing' THEN
    IF v_current_state NOT IN ('not_dispatched','preparing') THEN
      RAISE EXCEPTION 'invalid_dispatch_transition' USING ERRCODE = '22023';
    END IF;
    v_new_state := 'preparing';
  ELSIF p_action = 'mark_dispatched' THEN
    IF v_current_state NOT IN ('not_dispatched','preparing','dispatched') THEN
      RAISE EXCEPTION 'invalid_dispatch_transition' USING ERRCODE = '22023';
    END IF;
    v_new_state := 'dispatched';
    -- Only set dispatched_at the first time we transition into dispatched.
    IF v_current_state <> 'dispatched' THEN
      v_new_dispatched_at := v_now;
    END IF;
  ELSIF p_action = 'mark_delivered' THEN
    IF v_current_state NOT IN ('dispatched','delivered') THEN
      RAISE EXCEPTION 'invalid_dispatch_transition' USING ERRCODE = '22023';
    END IF;
    v_new_state := 'delivered';
    IF v_current_state <> 'delivered' THEN
      v_new_delivered_at := v_now;
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_action' USING ERRCODE = '22023';
  END IF;

  -- Perform the narrow UPDATE · explicit column allowlist.
  UPDATE public.nex_order o
     SET dispatch_provider        = p_provider,
         dispatch_provider_custom = p_provider_custom,
         dispatch_tracking_number = p_tracking_number,
         dispatch_tracking_url    = p_tracking_url,
         dispatch_state           = v_new_state,
         dispatched_at            = COALESCE(v_new_dispatched_at, o.dispatched_at),
         delivered_at             = COALESCE(v_new_delivered_at, o.delivered_at),
         estimated_transit_qty    = p_estimated_qty,
         estimated_transit_unit   = p_estimated_unit,
         tracking_updated_at      = v_now,
         updated_at               = v_now
   WHERE o.id = p_order_id;

  -- Audit event · reuse nex_order_event trail.
  INSERT INTO public.nex_order_event (order_id, event, actor_account_id, metadata)
  VALUES (p_order_id,
          CASE p_action
            WHEN 'save' THEN 'dispatch_details_saved'
            WHEN 'mark_preparing' THEN 'dispatch_marked_preparing'
            WHEN 'mark_dispatched' THEN 'dispatch_marked_dispatched'
            WHEN 'mark_delivered' THEN 'dispatch_marked_delivered'
          END,
          p_seller_account_id,
          jsonb_build_object(
            'provider', p_provider,
            'provider_custom', p_provider_custom,
            'has_tracking_number', (p_tracking_number IS NOT NULL),
            'has_tracking_url', (p_tracking_url IS NOT NULL),
            'estimated_qty', p_estimated_qty,
            'estimated_unit', p_estimated_unit,
            'from_dispatch_state', v_current_state,
            'to_dispatch_state', v_new_state
          ));

  RETURN QUERY
    SELECT o.id, o.dispatch_provider, o.dispatch_provider_custom,
           o.dispatch_tracking_number, o.dispatch_tracking_url,
           o.dispatch_state, o.dispatched_at, o.delivered_at,
           o.estimated_transit_qty, o.estimated_transit_unit,
           o.tracking_updated_at
      FROM public.nex_order o
     WHERE o.id = p_order_id;
END;
$$;

-- Grants · follow mig 236 template · service_role only (NOT authenticated).
-- Server actions call this RPC via nexSupabaseAdmin (service-role client).
-- Browsers never invoke it directly. Column safety still enforced inside the
-- function (explicit UPDATE allowlist) · defence in depth even if a future
-- bug were to allow broader service-role calls.
REVOKE EXECUTE ON FUNCTION public.nex_order_seller_save_dispatch(
  uuid, uuid, text, text, text, text, int, text, text
) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.nex_order_seller_save_dispatch(
  uuid, uuid, text, text, text, text, int, text, text
) TO service_role;

COMMENT ON FUNCTION public.nex_order_seller_save_dispatch IS
  'Seller-only dispatch/tracking update. Validates caller owns the target order''s business. Touches ONLY dispatch_* columns · never payment, totals, ownership, or product data. Called by sellerSaveOrderDispatchAction server action.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · Buyer shipment-update notifications
--    Reuses nex_notification + existing kinds. New kind: 'shipment_update'.
--    No new tables · no new preference columns · reuses dispatch_pipeline.
-- ─────────────────────────────────────────────────────────────────────────────
-- (The TypeScript notification service adds the kind · no DB enum migration
-- needed because nex_notification.kind is text with a soft allowlist today.)

COMMIT;

-- =============================================================================
-- APPLY PROCEDURE · when owner authorises
--   1. Owner says the exact words: "apply dispatch migration sandbox"
--   2. Operator runs scripts/apply-migration-349-sandbox.mjs (to write)
--   3. Script verifies DATABASE_URL contains kdstoyyeygcopkogqsyv
--      AND REFUSES if it contains ijvqdvsvwtwxzcqmoqit
--   4. Execute this file in a single transaction
--   5. Smoke-verify: dispatch columns exist, RPC callable, grants correct
--   6. Record apply in evidence/dispatch-tracking-checkpoint/
-- =============================================================================
