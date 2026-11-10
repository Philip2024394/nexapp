-- Migration 320 · P5 · nex_order.payment_method · 2026-11-10
-- =========================================================================
-- STATUS: PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
--
-- Adds a NULLABLE payment_method text column to nex_order so the
-- buyer checkout surface can tag the flow used (initially only
-- 'qr_manual'; future 'stripe_checkout' / 'paypal' / 'qris_dynamic').
--
-- NULLABLE because older orders predate this field · the sealed JSONB
-- cart snapshot in nex_peer_message.attachment_meta still carries the
-- cart lines. No destructive change to the order state machine.
--
-- Apply target: SANDBOX ONLY (kdstoyyeygcopkogqsyv) · production
-- (ijvqdvsvwtwxzcqmoqit) stays sealed.

BEGIN;

ALTER TABLE nex_order
  ADD COLUMN IF NOT EXISTS payment_method text
    CHECK (payment_method IS NULL OR payment_method IN (
      'qr_manual',
      'stripe_checkout',    -- future P2
      'paypal',             -- future P6
      'qris_dynamic'        -- future P7
    ));

COMMENT ON COLUMN nex_order.payment_method IS
  'P5 · tag for which payment surface produced this order. NULL for pre-P5 orders. Populated by the buyer checkout action. Sealed 2026-11-10. Does NOT imply payment verification.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '320',
    'P5 · nex_order.payment_method NULLABLE text with CHECK enum',
    'Sealed 2026-11-10. Additive only. qr_manual is the only value populated today. stripe_checkout / paypal / qris_dynamic reserved for P2/P6/P7.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'nex_order' AND column_name = 'payment_method';
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '320';
--     ALTER TABLE nex_order DROP COLUMN IF EXISTS payment_method;
--   COMMIT;
