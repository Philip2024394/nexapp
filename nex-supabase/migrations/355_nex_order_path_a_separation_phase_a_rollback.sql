-- ============================================================================
-- APPLY-VERSION ROLLBACK PREVIEW · candidate migration 355 · Lane E · E-PRIVACY
-- UNAPPLIED · REVIEW REQUIRED · DO NOT APPLY WITHOUT SEPARATE AUTHORISATION
-- ============================================================================
--
-- Rollback for the apply-version PREVIEW of migration 355
-- (`355_nex_order_path_a_separation_phase_a_PREVIEW.sql`).
--
-- Still quarantined · still under `nex-supabase/candidate-migrations/`.
--
-- Scope (safe only when Phase B has NOT started · Phase A is empty at
-- Phase A-apply time · rollback MUST NOT run after Phase B begins):
--   · DROP the `nex_order_item` table (empty by Phase A contract ·
--     Phase B authorisation would have populated it · do NOT run this
--     rollback after Phase B is live).
--   · DROP the five Phase A columns from `nex_order` (all NULL at
--     Phase A-apply time · would lose data if Phase B populated them).
--   · RESTORE `nex_order.product_id NOT NULL` ONLY IF every existing
--     row has a non-null product_id · otherwise RAISE. Rollback-safe
--     check is included.
--   · RESTORE the migration-309 attachment_type CHECK (drops
--     'order_reference' back off the enum).
--   · DELETE the `nex_migration_history` row the forward migration
--     INSERTed.
--
-- Deliberate non-actions:
--   · Does NOT touch any pre-Phase-A column on `nex_order`.
--   · Does NOT alter any `nex_peer_message` row.
--   · Does NOT touch `nex_product`, `nex_menu_item`, `nex_account`,
--     `nex_business`.
--
-- Operator safety:
--   · A rollback attempted after Phase B begins SHOULD RAISE via the
--     product_id NOT NULL restoration (because Phase B multi-item
--     orders will have NULL product_id). This is intentional · it
--     signals that this rollback is not safe for that state.
-- ============================================================================

BEGIN;

-- Guard: refuse if Phase B has populated nex_order_item rows.
DO $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.nex_order_item;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'nex_order_item has % rows · Phase B is live · this rollback is not safe · ABORTING', v_count;
  END IF;
END $$;

-- Guard: refuse if any nex_order row has NULL product_id (Phase B
-- multi-item marker).
DO $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.nex_order WHERE product_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'nex_order has % rows with NULL product_id · Phase B is live · restoring NOT NULL would corrupt data · ABORTING', v_count;
  END IF;
END $$;

DROP TABLE IF EXISTS public.nex_order_item;

ALTER TABLE public.nex_order
  DROP COLUMN IF EXISTS delivery_address,
  DROP COLUMN IF EXISTS delivery_quote,
  DROP COLUMN IF EXISTS subtotal_pence,
  DROP COLUMN IF EXISTS payment_method_hint,
  DROP COLUMN IF EXISTS payment_confirmed_at;

ALTER TABLE public.nex_order
  ALTER COLUMN product_id SET NOT NULL;

-- Restore migration-309 enum (removes 'order_reference').
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
      'call_invite'
    )
  );

DELETE FROM public.nex_migration_history
 WHERE version = '355';

COMMIT;
