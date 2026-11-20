-- ============================================================================
-- Migration 355 · Lane E · E-PRIVACY Phase A · schema-only
-- STATUS: AUTHORISED FOR SANDBOX APPLY · founder handoff (host IPv6-only)
-- Target: sandbox kdstoyyeygcopkogqsyv ONLY · prod ijvqdvsvwtwxzcqmoqit sealed
-- Promoted (strip _PREVIEW) 2026-11-20 per owner authorisation
--   "apply mig-355 delivery-pii phase A sandbox".
-- Apply-script: scripts/apply-migration-355-sandbox.mjs
-- Phase B write-path switch is a SEPARATE increment (Item #7 of the
-- sealed 9-item pass) · this file does not switch any writer.
-- ============================================================================
--
-- APPLY-VERSION sibling of
-- `C003_nex_order_path_a_separation_phase_a.sql` (the rollback-wrapped
-- quarantined candidate · retained for review diff).
--
-- Differences from `C003_...sql`:
--   · This file is wrapped in BEGIN; … COMMIT; (not ROLLBACK).
--   · This file writes one row into `nex_migration_history` using the
--     live (version, description, notes) column shape.
--   · The schema DDL is byte-for-byte the same as `C003_...sql` · the
--     ONLY intended differences between the two files are the
--     transaction verb and the migration-history INSERT. Reviewers
--     should diff the two files and confirm this.
--
-- Full preamble, blocker identification, invariants, and Phase A
-- scope are documented in `C003_...sql` · not duplicated here.
-- Reviewers should read `C003_...sql`'s preamble FIRST, then diff the
-- two SQL bodies.
-- ============================================================================

BEGIN;

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
      'order_reference'
    )
  );

COMMENT ON COLUMN public.nex_peer_message.attachment_type IS
  'Sealed enum · image | video | audio | product | menu_item | cart_order | product_share | sticker | link_preview | document | call_invite | order_reference · each type is rendered by a dedicated client-side component. order_reference added by migration 355 for Phase A chat/order separation.';

ALTER TABLE public.nex_order
  ALTER COLUMN product_id DROP NOT NULL;

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

CREATE TABLE IF NOT EXISTS public.nex_order_item (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES public.nex_order(id) ON DELETE CASCADE,
  product_id           uuid REFERENCES public.nex_product(id) ON DELETE RESTRICT,
  menu_item_id         uuid REFERENCES public.nex_menu_item(id) ON DELETE RESTRICT,
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

INSERT INTO public.nex_migration_history (version, description, notes)
VALUES (
  '355',
  'nex_order Path A Phase A · adds 5 commercial-metadata columns + makes product_id nullable + creates nex_order_item + extends attachment_type enum with order_reference',
  'Zero existing-data mutations · no write-path switch (Phase B is separately authorised) · no backfill (Phase C is separately authorised) · no cart_order removal (Phase D is separately authorised)'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
