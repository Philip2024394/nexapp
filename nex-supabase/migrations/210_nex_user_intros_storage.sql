-- 210_nex_user_intros_storage.sql
--
-- Supabase Storage buckets for user-uploaded intro videos + chat
-- wallpapers · owner-authorised 2026-10-20.
-- =============================================================================
-- Pairs with 209_nex_account_intro_video.sql which carries the
-- pointer columns. Two private buckets, one object per account,
-- overwrites on new upload.
--
-- RLS policy pattern mirrors the sealed nex-avatars bucket (migration
-- 069) and the sealed nex-theme-emoji bucket (migration 116):
--   · Service role has full access (server actions)
--   · Authenticated users read their own object only (keyed on auth.uid())
--   · Public SELECT so the chat renderer / avatar renderer can resolve
--     the URL without a signed-request round-trip (object paths include
--     the account UUID so paths are unguessable, matching the avatar
--     bucket's security model).
--
-- Mobile-first file-type set:
--   · Intros: video/mp4 (H.264 is the only universal mobile codec)
--   · Wallpapers: image/png + image/jpeg + image/webp (same mime set
--     the nex-avatar bucket allows)

BEGIN;

-- ─── 1 · nex-user-intros bucket ─────────────────────────────────────
--
-- 10 MB cap matches the client-side MAX_BYTES guard in
-- src/app/nex-native/settings/intro-video/_intro-video-client.tsx.
-- H.264 mp4 only · browser recording APIs produce this on every
-- platform (iOS Safari, Android Chrome, desktop Chrome/Firefox).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'nex-user-intros',
  'nex-user-intros',
  true,
  10485760,  -- 10 MB
  ARRAY['video/mp4']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read · the chat intro player resolves the URL from
-- nex_account.intro_video_url directly. Paths include the account
-- UUID so object paths are unguessable (mirrors nex-avatars).
DROP POLICY IF EXISTS "nex-user-intros public read" ON storage.objects;
CREATE POLICY "nex-user-intros public read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'nex-user-intros');

-- Owner-only write/update/delete, keyed on auth.uid() ·  the server
-- action `uploadUserIntroVideoAction` writes an object at path
-- `<auth.uid()>/<timestamp>.mp4` and this policy ensures only that
-- user can touch it. Service role bypasses RLS (used by server-side
-- validation + ffprobe pipeline).
DROP POLICY IF EXISTS "nex-user-intros owner write" ON storage.objects;
CREATE POLICY "nex-user-intros owner write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'nex-user-intros'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "nex-user-intros owner update" ON storage.objects;
CREATE POLICY "nex-user-intros owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'nex-user-intros'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'nex-user-intros'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "nex-user-intros owner delete" ON storage.objects;
CREATE POLICY "nex-user-intros owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'nex-user-intros'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ─── 2 · nex-user-wallpapers bucket ─────────────────────────────────
--
-- 5 MB cap matches the client-side WALLPAPER_MAX_BYTES guard.
-- PNG + JPG + WebP (same set the sealed nex-avatars bucket accepts).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'nex-user-wallpapers',
  'nex-user-wallpapers',
  true,
  5242880,  -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "nex-user-wallpapers public read" ON storage.objects;
CREATE POLICY "nex-user-wallpapers public read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'nex-user-wallpapers');

DROP POLICY IF EXISTS "nex-user-wallpapers owner write" ON storage.objects;
CREATE POLICY "nex-user-wallpapers owner write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'nex-user-wallpapers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "nex-user-wallpapers owner update" ON storage.objects;
CREATE POLICY "nex-user-wallpapers owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'nex-user-wallpapers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'nex-user-wallpapers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "nex-user-wallpapers owner delete" ON storage.objects;
CREATE POLICY "nex-user-wallpapers owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'nex-user-wallpapers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
