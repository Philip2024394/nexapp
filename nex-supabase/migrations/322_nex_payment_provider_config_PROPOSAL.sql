-- Migration 322 · Phase B · nex_payment_provider_config · 2026-11-10
-- =========================================================================
-- STATUS: PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
--
-- Owner-sealed Phase B landing table. Backs the interactive
-- PaymentSettingsClient on /settings/payments:
--   · preferred_method · which gateway buyers see first at checkout
--   · stripe_enabled / paypal_enabled / qr_enabled / qris_enabled
--
-- NEX stays out of the money flow. This table only stores the seller's
-- PREFERENCE about which configured gateways to expose · it does NOT
-- store any provider credentials or payment-method tokens. Those live
-- with Stripe / PayPal / QRIS merchants of record.
--
-- Non-breaking · additive · one row per business · fail-soft on
-- read (falls back to method-resolver autodetection when the row
-- is absent · UI shows the defaults until seller saves).
--
-- Apply target: SANDBOX ONLY (kdstoyyeygcopkogqsyv) · production
-- (ijvqdvsvwtwxzcqmoqit) stays sealed.

BEGIN;

CREATE TABLE IF NOT EXISTS nex_payment_provider_config (
  business_id         uuid PRIMARY KEY REFERENCES nex_business(id) ON DELETE CASCADE,
  preferred_method    text NOT NULL DEFAULT 'auto'
                       CHECK (preferred_method IN ('auto','stripe','paypal','qr_manual','qris_dynamic')),
  stripe_enabled      boolean NOT NULL DEFAULT true,
  paypal_enabled      boolean NOT NULL DEFAULT false,
  qr_enabled          boolean NOT NULL DEFAULT true,
  qris_enabled        boolean NOT NULL DEFAULT false,
  updated_at          timestamptz NOT NULL DEFAULT NOW(),
  updated_by          uuid REFERENCES nex_account(id)
);

COMMENT ON TABLE nex_payment_provider_config IS
  'Phase B · Seller preference about which configured payment gateways to expose to buyers at checkout. One row per business · fail-soft on absence · falls back to method-resolver autodetection. Does NOT store provider credentials or payment-method tokens. Sealed 2026-11-10.';

COMMENT ON COLUMN nex_payment_provider_config.preferred_method IS
  'Which gateway buyer sees FIRST on /pay when the seller has multiple active. "auto" = buyer picker (current default behaviour). Non-auto values must also be enabled.';

-- RLS · owner can read and write their own row. Service role bypasses
-- as usual.
ALTER TABLE nex_payment_provider_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_payment_provider_config_owner_rw
  ON nex_payment_provider_config;
CREATE POLICY nex_payment_provider_config_owner_rw
  ON nex_payment_provider_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM nex_business b
      JOIN nex_account a ON a.id = b.owner_account_id
      WHERE b.id = nex_payment_provider_config.business_id
        AND a.supabase_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM nex_business b
      JOIN nex_account a ON a.id = b.owner_account_id
      WHERE b.id = nex_payment_provider_config.business_id
        AND a.supabase_user_id = auth.uid()
    )
  );

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '322',
    'Phase B · nex_payment_provider_config · seller payment gateway preferences + owner-rw RLS',
    'Sealed 2026-11-10. One row per business · one config per shop. Stores ONLY the seller preference about which gateway to expose · NOT provider credentials.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--    WHERE table_name = 'nex_payment_provider_config'
--    ORDER BY ordinal_position;
--
--   SELECT policyname FROM pg_policies WHERE tablename = 'nex_payment_provider_config';
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '322';
--     DROP POLICY IF EXISTS nex_payment_provider_config_owner_rw ON nex_payment_provider_config;
--     DROP TABLE IF EXISTS nex_payment_provider_config;
--   COMMIT;
