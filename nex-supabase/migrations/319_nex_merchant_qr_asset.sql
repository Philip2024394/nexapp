-- Migration 319 · P5 · nex_merchant_qr_asset · 2026-11-10
-- =========================================================================
-- STATUS: PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
--
-- Per-upload audit history for seller payment QR codes. One row per
-- lifetime upload. Immutable insert · soft-retire via retired_at.
-- Backs nex_business.qr_code_image_url (mig 110) with a full history +
-- validation + dedup + preview-and-confirm gate.
--
-- Non-breaking · additive. Does NOT alter nex_business. Owner directive
-- 2026-11-10: storage lives in a NEW PRIVATE bucket (mig 321), NOT the
-- public nex-business-assets bucket. Retired QR images must not remain
-- addressable through an uncontrolled public URL.
--
-- Apply target: SANDBOX ONLY (kdstoyyeygcopkogqsyv) · production
-- (ijvqdvsvwtwxzcqmoqit) stays sealed.

BEGIN;

CREATE TABLE IF NOT EXISTS nex_merchant_qr_asset (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES nex_business(id) ON DELETE CASCADE,
  uploaded_by      uuid NOT NULL REFERENCES nex_account(id) ON DELETE RESTRICT,
  storage_bucket   text NOT NULL DEFAULT 'nex-merchant-qr',
  storage_path     text NOT NULL,
  mime_type        text NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp')),
  byte_size        int  NOT NULL CHECK (byte_size > 0 AND byte_size <= 2097152),
  sha256_hex       text NOT NULL CHECK (char_length(sha256_hex) = 64),
  width_px         int  NOT NULL CHECK (width_px  BETWEEN 200 AND 2000),
  height_px        int  NOT NULL CHECK (height_px BETWEEN 200 AND 2000),
  qr_decoded       bool NOT NULL,
  qr_payload_hint  text,
  status           text NOT NULL CHECK (status IN ('pending_preview','active','retired','rejected')),
  created_at       timestamptz NOT NULL DEFAULT NOW(),
  activated_at     timestamptz,
  retired_at       timestamptz,
  retired_by       uuid REFERENCES nex_account(id),
  rejection_reason text,
  CONSTRAINT nex_merchant_qr_asset_activated_when_active
    CHECK (status != 'active' OR activated_at IS NOT NULL),
  CONSTRAINT nex_merchant_qr_asset_retired_fields_together
    CHECK ((retired_at IS NULL) = (retired_by IS NULL))
);

-- Only ONE active QR per business (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS nex_merchant_qr_asset_one_active_per_biz
  ON nex_merchant_qr_asset (business_id)
  WHERE status = 'active';

-- Rate-limit lookup · COUNT uploads per business in last 24h
CREATE INDEX IF NOT EXISTS nex_merchant_qr_asset_biz_created
  ON nex_merchant_qr_asset (business_id, created_at DESC);

-- Dedup lookup · idempotent re-upload
CREATE UNIQUE INDEX IF NOT EXISTS nex_merchant_qr_asset_biz_sha256
  ON nex_merchant_qr_asset (business_id, sha256_hex);

-- Row-level security · business owner can read their own · service role
-- bypasses as usual. No INSERT/UPDATE/DELETE policy for authenticated
-- users · writes go through service-role server actions only.
ALTER TABLE nex_merchant_qr_asset ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_merchant_qr_asset_owner_read ON nex_merchant_qr_asset;
CREATE POLICY nex_merchant_qr_asset_owner_read
  ON nex_merchant_qr_asset
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM nex_business b
      JOIN nex_account a ON a.id = b.owner_account_id
      WHERE b.id = nex_merchant_qr_asset.business_id
        AND a.supabase_user_id = auth.uid()
    )
  );

COMMENT ON TABLE nex_merchant_qr_asset IS
  'P5 merchant-owned payments · audit history of seller-uploaded payment QR codes. Owner-sealed 2026-11-10. One row per lifetime upload · immutable insert · soft-retire via retired_at. Reads via RLS to the owning seller only; writes via service-role server actions. Storage lives in the PRIVATE nex-merchant-qr bucket (mig 321) — never a public URL.';

COMMENT ON COLUMN nex_merchant_qr_asset.status IS
  'pending_preview: just uploaded, seller has not pressed Activate. active: currently displayed to buyers (max 1 per business). retired: replaced by a later upload. rejected: validation failed at upload time.';

COMMENT ON COLUMN nex_merchant_qr_asset.qr_decoded IS
  'TRUE if jsqr successfully decoded a QR code from the uploaded bytes at upload time. FALSE is only possible for rejected rows; active/retired rows must be TRUE.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '319',
    'P5 · nex_merchant_qr_asset audit history + rate-limit + dedup + one-active partial unique',
    'Sealed 2026-11-10. Additive only. Backs nex_business.qr_code_image_url with full per-upload audit trail + preview-and-confirm gate. Storage in the private nex-merchant-qr bucket (mig 321).'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'nex_merchant_qr_asset'
--    ORDER BY ordinal_position;
--
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'nex_merchant_qr_asset'
--    ORDER BY indexname;
--
--   SELECT policyname FROM pg_policies
--    WHERE tablename = 'nex_merchant_qr_asset';
--
-- Rollback (non-destructive to nex_business):
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '319';
--     DROP INDEX  IF EXISTS nex_merchant_qr_asset_biz_sha256;
--     DROP INDEX  IF EXISTS nex_merchant_qr_asset_biz_created;
--     DROP INDEX  IF EXISTS nex_merchant_qr_asset_one_active_per_biz;
--     DROP POLICY IF EXISTS nex_merchant_qr_asset_owner_read ON nex_merchant_qr_asset;
--     DROP TABLE  IF EXISTS nex_merchant_qr_asset;
--   COMMIT;
