-- nex-supabase/migrations/151_nex_community_photo_bucket.sql
--
-- NEX Community Noticeboard · Phase 2A.5 · photo storage bucket.
-- Founder-authorised 2026-10-11.
--
-- WHAT THIS DOES
--   1. Creates (idempotently) a Supabase Storage bucket named
--      `nex-community-photos`. Public read is enabled so plain
--      <img src=...> tags in the UI work without signed URLs.
--   2. Sets a per-object MIME + size allowlist via a bucket row
--      update (file_size_limit, allowed_mime_types).
--   3. Adds Row Level Security policies so:
--        · Public read (anonymous): allowed · bucket is public.
--        · Authenticated upload: service_role only in Phase 2A.5.
--          The app uploads server-side via the service role key;
--          anon/authenticated users never touch storage directly.
--        · Delete: service_role only (card deletion cascades the
--          storage objects via application cleanup, not DB cascade).
--
-- WHY
--   Phase 2A migrations 148-150 reserved the bucket name in the
--   schema but did not create the bucket itself. This migration
--   is the smallest storage-side migration that lets Lost & Found
--   cards actually render photos uploaded via the app's server
--   action.
--
-- INVARIANTS SEALED WITH THIS MIGRATION
--   · Bucket is PUBLIC READ. Private uploads with signed URLs
--     require a different bucket · opt-in later.
--   · file_size_limit = 2 MB · matches CHECK on
--     nex_community_card_photo.bytes.
--   · allowed_mime_types restricted to webp / jpeg / png · the
--     server-side upload action transcodes to webp regardless.
--   · Upload policy requires service_role · no direct client upload.

BEGIN;

-- 1 · Create / update the bucket row.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'nex-community-photos',
  'nex-community-photos',
  TRUE,
  2097152,  -- 2 MB
  ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2 · Policies on storage.objects for this bucket.
--    Supabase storage policies live on `storage.objects` and are
--    scoped to a bucket via the bucket_id column.

-- Drop any pre-existing policy with the same name (idempotent re-apply).
DROP POLICY IF EXISTS "nex_community_photos_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "nex_community_photos_service_write" ON storage.objects;
DROP POLICY IF EXISTS "nex_community_photos_service_update" ON storage.objects;
DROP POLICY IF EXISTS "nex_community_photos_service_delete" ON storage.objects;

-- Public read on anything in this bucket.
CREATE POLICY "nex_community_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'nex-community-photos');

-- Service-role insert · the service role bypasses RLS by default, but
-- this policy documents the intended path. Anon/authenticated roles
-- cannot upload directly · they must go through the server action.
CREATE POLICY "nex_community_photos_service_write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'nex-community-photos' AND auth.role() = 'service_role');

CREATE POLICY "nex_community_photos_service_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'nex-community-photos' AND auth.role() = 'service_role');

CREATE POLICY "nex_community_photos_service_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'nex-community-photos' AND auth.role() = 'service_role');

COMMIT;
