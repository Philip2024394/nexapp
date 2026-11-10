-- Migration 321 · P5 · nex-merchant-qr private bucket · 2026-11-10
-- =========================================================================
-- STATUS: PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
--
-- Private Supabase Storage bucket for merchant payment QR images.
-- Owner-sealed 2026-11-10: NOT the public nex-business-assets bucket.
-- Retired QR images must not remain accessible via an uncontrolled
-- public URL.
--
-- Access model:
--   · WRITES   service-role only · explicit deny-by-default for anon +
--              authenticated roles.
--   · READS    service-role only · the buyer /pay page + seller
--              settings page mint SHORT-LIVED signed URLs through the
--              server-side signed-url-service · no direct public read.
--   · OBJECT PATHS   qr/<business_id>/<sha256>.<ext> (deterministic ·
--                    overwrite on same sha = idempotent).
--
-- File constraints enforced at the bucket layer:
--   · public:              false
--   · file_size_limit:     2 097 152 bytes (2 MB)
--   · allowed_mime_types:  image/png, image/jpeg, image/webp
--
-- Server-side validation adds dimensions (200-2000 px), MIME match
-- vs decoded content, QR-decodability (jsqr), sha256 dedup.
--
-- Apply target: SANDBOX ONLY (kdstoyyeygcopkogqsyv) · production
-- (ijvqdvsvwtwxzcqmoqit) stays sealed.

BEGIN;

-- Create the bucket (idempotent · safe re-run).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'nex-merchant-qr',
    'nex-merchant-qr',
    false,
    2097152,
    ARRAY['image/png','image/jpeg','image/webp']
  )
  ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Explicit deny-by-default policies for anon + authenticated.
-- This makes the deny discoverable via pg_policies rather than relying
-- on the implicit "no policy = no access" semantics.

-- SELECT deny · service_role bypasses RLS and is unaffected.
DROP POLICY IF EXISTS nex_merchant_qr_select_denied ON storage.objects;
CREATE POLICY nex_merchant_qr_select_denied
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id <> 'nex-merchant-qr');
  -- anon/authenticated can see every bucket EXCEPT nex-merchant-qr.
  -- Buyer + seller pages NEVER read via this policy · they read via
  -- service-role-minted signed URLs.

-- INSERT deny
DROP POLICY IF EXISTS nex_merchant_qr_insert_denied ON storage.objects;
CREATE POLICY nex_merchant_qr_insert_denied
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id <> 'nex-merchant-qr');

-- UPDATE deny
DROP POLICY IF EXISTS nex_merchant_qr_update_denied ON storage.objects;
CREATE POLICY nex_merchant_qr_update_denied
  ON storage.objects
  FOR UPDATE
  TO anon, authenticated
  USING (bucket_id <> 'nex-merchant-qr')
  WITH CHECK (bucket_id <> 'nex-merchant-qr');

-- DELETE deny
DROP POLICY IF EXISTS nex_merchant_qr_delete_denied ON storage.objects;
CREATE POLICY nex_merchant_qr_delete_denied
  ON storage.objects
  FOR DELETE
  TO anon, authenticated
  USING (bucket_id <> 'nex-merchant-qr');

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '321',
    'P5 · nex-merchant-qr private bucket + anon/authenticated deny policies for all four operations',
    'Sealed 2026-11-10. Private bucket · service-role writes only · reads via short-lived signed URLs minted server-side. 2MB limit · png/jpeg/webp only.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT id, public, file_size_limit, allowed_mime_types
--     FROM storage.buckets WHERE id = 'nex-merchant-qr';
--
--   SELECT policyname, cmd FROM pg_policies
--    WHERE tablename = 'objects'
--      AND policyname LIKE 'nex_merchant_qr_%';
--
-- Rollback (non-destructive to other buckets):
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '321';
--     DROP POLICY IF EXISTS nex_merchant_qr_delete_denied ON storage.objects;
--     DROP POLICY IF EXISTS nex_merchant_qr_update_denied ON storage.objects;
--     DROP POLICY IF EXISTS nex_merchant_qr_insert_denied ON storage.objects;
--     DROP POLICY IF EXISTS nex_merchant_qr_select_denied ON storage.objects;
--     -- Optional: DELETE FROM storage.objects WHERE bucket_id = 'nex-merchant-qr';
--     -- Optional: DELETE FROM storage.buckets WHERE id = 'nex-merchant-qr';
--   COMMIT;
