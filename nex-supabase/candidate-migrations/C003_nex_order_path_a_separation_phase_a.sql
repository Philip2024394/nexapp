-- ============================================================================
-- UNAPPLIED candidate migration · Lane E · E-PRIVACY · round 17 · 2026-11-19
-- ROLLBACK-WRAPPED ANCHOR VARIANT · DO NOT APPLY TO ANY DATABASE
-- ============================================================================
--
-- Status: QUARANTINED. Lives under `nex-supabase/candidate-migrations/`,
-- NOT under `nex-supabase/migrations/`. Not scanned by any
-- `apply-migration-*.mjs` helper. Wrapped in `BEGIN; … ROLLBACK;` so a
-- hand-run against ANY DB produces no net effect.
--
-- EXACT BLOCKER IDENTIFIED (per owner directive round 17):
--   The sealed 2026-11-09 Phase 2 Path A doctrine
--   (`project_nex_chat_order_separation_sealed_2026_11_09.md`) requires
--   commercial order metadata (delivery address, delivery quote, subtotal,
--   payment method hint, payment-confirmed-at) to live in `nex_order` ·
--   NOT in `nex_peer_message.attachment_meta.cart`. Today
--   `sendCartOrderAction` stamps `delivery_address` plaintext into the
--   peer-message JSONB (recipient_name / phone / street / city / lat /
--   lng · see `_actions.ts` snapshot assembly). The Phase A schema below
--   has NOT been applied to any DB · until it is, there is no destination
--   to write the delivery address TO, so the plaintext-in-snapshot pattern
--   cannot be removed without losing functionality.
--
-- SCOPE OF PHASE A (sealed 2026-11-09 decision #3):
--   · Zero existing-data mutations.
--   · Zero write-path switches (that is Phase B, authorised separately).
--   · ADD `delivery_address JSONB` + `delivery_quote JSONB` +
--     `subtotal_pence BIGINT` + `payment_method_hint TEXT` +
--     `payment_confirmed_at TIMESTAMPTZ` nullable columns on `nex_order`.
--   · MAKE `nex_order.product_id` nullable (for the future multi-item
--     case · existing NOT-NULL rows keep their non-null product_id ·
--     DROP NOT NULL is non-destructive).
--   · CREATE `nex_order_item` child table (empty at apply time ·
--     populated only by the Phase B writer when authorised).
--   · EXTEND `nex_peer_message.attachment_type` CHECK to include
--     `'order_reference'` alongside the existing sealed enum from
--     migration 309.
--
-- THIS MIGRATION DOES NOT (sealed decisions):
--   · Delete, rewrite, or migrate any existing `cart_order` message.
--     The one-off backfill lives in Phase C under a separate approval
--     word-trigger (`migrate legacy cart_order rows`).
--   · Remove `cart_order` from the enum. That is Phase D, authorised
--     by `deprecate cart_order` after monitoring shows zero legacy
--     renderer hits.
--   · Flip any write path to the new columns · that is Phase B,
--     authorised by `switch separation writes`.
--
-- Rollback semantics (candidate-review only):
--   · This file is BEGIN; … ROLLBACK; → no state change to the DB.
--   · The APPLY-VERSION sibling (355_...PREVIEW.sql · also quarantined)
--     is BEGIN; … COMMIT; and adds the nex_migration_history row.
--   · A matching _rollback_PREVIEW.sql + apply-script preview live in
--     this same directory.
--
-- Review path (two-variant convention, sealed 2026-11-19 · README):
--   1. Review THIS file as the baseline anchor.
--   2. Diff against `355_nex_order_path_a_separation_phase_a_PREVIEW.sql`
--      · only the transaction verb and migration-history INSERT should
--      differ in the apply sibling.
--   3. Compare against the sealed doctrine
--      `docs/doctrine/nex-chat-order-data-separation-proposal-2026-11-08.md`
--      Section 4 (schema impact).
-- ============================================================================

BEGIN;

-- ── (a) widen attachment_type enum to include 'order_reference' ───
-- Keeps the full migration-309 restored enum intact · additive only.
-- IF EXISTS / re-ADD is the same pattern migration 309 uses.
ALTER TABLE public.nex_peer_message
  DROP CONSTRAINT IF EXISTS nex_peer_message_attachment_type_check;

ALTER TABLE public.nex_peer_message
  ADD CONSTRAINT nex_peer_message_attachment_type_check
  CHECK (
    attachment_type IS NULL
    OR attachment_type IN (
      'image',
      'video',
      'audio',
      'product',
      'menu_item',
      'cart_order',
      'product_share',
      'sticker',
      'link_preview',
      'document',
      'call_invite',
      -- Phase A · Path A separation · opaque reference to a
      -- `nex_order.id` so chat no longer carries plaintext order
      -- snapshots once Phase B flips writes.
      'order_reference'
    )
  );

COMMENT ON COLUMN public.nex_peer_message.attachment_type IS
  'Sealed enum · image | video | audio | product | menu_item | cart_order | product_share | sticker | link_preview | document | call_invite | order_reference · each type is rendered by a dedicated client-side component. order_reference added by candidate 355 for Phase A chat/order separation.';

-- ── (b) relax nex_order.product_id to nullable (multi-item orders) ─
-- Zero-data impact · DROP NOT NULL does not touch existing values.
-- New multi-item orders (future Phase B) will leave product_id NULL
-- and populate nex_order_item rows instead.
ALTER TABLE public.nex_order
  ALTER COLUMN product_id DROP NOT NULL;

-- ── (c) add commercial-metadata columns to nex_order ──────────────
-- All nullable · existing rows get NULL until Phase B writes populate
-- them for new orders.
ALTER TABLE public.nex_order
  ADD COLUMN IF NOT EXISTS delivery_address JSONB,
  ADD COLUMN IF NOT EXISTS delivery_quote JSONB,
  ADD COLUMN IF NOT EXISTS subtotal_pence BIGINT CHECK (subtotal_pence IS NULL OR subtotal_pence >= 0),
  ADD COLUMN IF NOT EXISTS payment_method_hint TEXT,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.nex_order.delivery_address IS
  'JSONB · Phase A column · populated only by Phase B writes. Shape: {recipient_name, phone, street, street_2, city, region, postal_code, country, notes, lat, lng}. Accessible only to the buyer (customer_account_id) and the seller (via business_id) per existing nex_order RLS.';

COMMENT ON COLUMN public.nex_order.delivery_quote IS
  'JSONB · Phase A column · populated only by Phase B writes. Shape: {kind: "delivery"|"pickup", fee_pence, eta_minutes?, carrier?} matching the legacy snapshot shape.';

COMMENT ON COLUMN public.nex_order.subtotal_pence IS
  'BIGINT · Phase A column · populated only by Phase B writes. Sum of nex_order_item.line_total_pence for multi-item orders · may differ from nex_order.price_pence (which stays single-product-snapshot for Phase A compatibility).';

COMMENT ON COLUMN public.nex_order.payment_method_hint IS
  'TEXT · Phase A column · populated only by Phase B writes. Buyer-selected intent (NOT a card number · NOT a credential). Free-form so this evolves without a DDL change. Phase B writers must map to the existing nex_order.payment_method enum when finalising.';

COMMENT ON COLUMN public.nex_order.payment_confirmed_at IS
  'TIMESTAMPTZ · Phase A column · populated only by Phase B writes. Timestamp the seller marked the order paid (independent of nex_order.state transitions · survives state resets).';

-- ── (d) nex_order_item child table ────────────────────────────────
-- One row per line item at order creation. For Phase A this table is
-- empty · Phase B writers populate it when the owner authorises
-- `switch separation writes`. Phase C populates it via the backfill
-- migration.
CREATE TABLE IF NOT EXISTS public.nex_order_item (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES public.nex_order(id) ON DELETE CASCADE,
  -- Line-item identity · may point at nex_product OR nex_menu_item.
  -- Both are nullable so legacy menu-item carts (that have no product
  -- row) still map cleanly. Exactly one should be set per row.
  product_id           uuid REFERENCES public.nex_product(id) ON DELETE RESTRICT,
  menu_item_id         uuid REFERENCES public.nex_menu_item(id) ON DELETE RESTRICT,
  -- Server-authoritative snapshot at creation time · see nex_order
  -- doctrine · never rewritten by product-record edits.
  display_name         text NOT NULL CHECK (length(trim(display_name)) > 0),
  unit_price_pence     bigint NOT NULL CHECK (unit_price_pence >= 0),
  currency             text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  quantity             integer NOT NULL CHECK (quantity > 0),
  line_total_pence     bigint NOT NULL CHECK (line_total_pence >= 0),
  per_item_note        text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (product_id IS NOT NULL AND menu_item_id IS NULL)
    OR (product_id IS NULL AND menu_item_id IS NOT NULL)
  )
);

COMMENT ON TABLE public.nex_order_item IS
  'Phase A · child table for Path A separation. Empty until Phase B writer authorised · Phase C backfill populates it from legacy cart_order snapshots.';

CREATE INDEX IF NOT EXISTS idx_nex_order_item_order_id
  ON public.nex_order_item (order_id);
CREATE INDEX IF NOT EXISTS idx_nex_order_item_product_id
  ON public.nex_order_item (product_id)
  WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nex_order_item_menu_item_id
  ON public.nex_order_item (menu_item_id)
  WHERE menu_item_id IS NOT NULL;

-- ── (e) RLS on nex_order_item · scoped through parent nex_order ───
-- Same read model as nex_order_event: a row is visible to the buyer
-- of the parent order OR the owner of the parent business.
ALTER TABLE public.nex_order_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_order_item_read
  ON public.nex_order_item
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT o.id FROM public.nex_order o
      WHERE o.customer_account_id IN (
        SELECT id FROM public.nex_account WHERE supabase_user_id = auth.uid()
      )
      OR o.business_id IN (
        SELECT b.id FROM public.nex_business b
        JOIN public.nex_account a ON a.id = b.owner_account_id
        WHERE a.supabase_user_id = auth.uid()
      )
    )
  );

-- Phase A does not grant INSERT/UPDATE/DELETE to `authenticated` on
-- nex_order_item · the Phase B writer runs as service-role (same
-- discipline nex_order_event uses). Phase B authorisation is a
-- SEPARATE word-trigger (`switch separation writes`).

ROLLBACK;
