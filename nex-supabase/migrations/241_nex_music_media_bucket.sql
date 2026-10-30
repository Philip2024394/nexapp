-- ============================================================================
-- NEX-native Migration 241 · nex-music-media storage bucket + RLS
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised draft only · DO NOT APPLY to the sealed Supabase project
-- `ijvqdvsvwtwxzcqmoqit` or any staging target without a SEPARATE explicit
-- owner authorisation.
--
-- Partner artifact to the production storage adapter at
-- `src/lib/nex-native/music/storage-adapter/supabase-storage-adapter.ts`
-- (Phase B · #81). The adapter uploads to this bucket; this migration
-- defines its shape + security posture. The two must be applied + reviewed
-- together.
--
-- Core decisions
-- ----------------------------------------------------------------------------
--   · PRIVATE bucket (public = false) — unlike nex-peer-chat-attachments
--     which is public-read. Music bytes are only accessible via Supabase
--     signed URLs minted by the server-side adapter, so a leaked file path
--     can't be streamed by anonymous callers. Mirrors the dev-fs adapter's
--     HMAC-signed `/api/nex-native/music/stream` route pattern.
--   · 20 MB cap (matches `MUSIC_UPLOAD_LIMITS.MAX_AUDIO_BYTES` in
--     `music-upload-validation.ts`). Covers audio ≤ 20MB + cover ≤ 2MB +
--     background ≤ 5MB (route-level enforces the smaller image caps).
--   · MIME whitelist: audio/mpeg, audio/mp4 (schema types) +
--     image/jpeg, image/png, image/webp (cover + background allowed).
--   · Path convention `{nex_account.id}/{objectKey}` — the storage adapter
--     writes under the owner UUID as the first folder. RLS reads use this
--     prefix to gate owner-only SELECT.
--
-- RLS posture · storage.objects
-- ----------------------------------------------------------------------------
--   SELECT · owner-only: a user with session.auth.uid() can SELECT rows
--     whose first path segment matches their nex_account.id. Prevents
--     cross-account enumeration if the client is ever handed a direct
--     storage.objects reference. Service-role bypasses RLS (admin client).
--   INSERT · service-role only. Users never PUT directly. The upload route
--     is the single write path.
--   UPDATE/DELETE · service-role only. Deletions happen through the
--     adapter's deleteObject() + the (future) orphan reconciler.
--   anon · no access.
--
-- Rollback
--   BEGIN;
--     DROP POLICY IF EXISTS nex_music_media_select_own ON storage.objects;
--     DELETE FROM storage.buckets WHERE id = 'nex-music-media';
--     DELETE FROM nex_migration_history WHERE version = '241';
--   COMMIT;
--
--   NOTE: Rollback is destructive once uploads land. Reversing this
--   migration in production requires a verified data-export rehearsal
--   per V8 (sealed memory 2026-10-30). Do NOT roll back without that.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------
-- Bucket · private · 20 MB per file · scoped MIMEs
-- --------------------------------------------------------------------
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'nex-music-media',
  'nex-music-media',
  false,
  20971520, -- 20 * 1024 * 1024 · 20 MB
  ARRAY[
    'audio/mpeg',
    'audio/mp4',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- --------------------------------------------------------------------
-- RLS · owner-only SELECT. INSERT/UPDATE/DELETE have no policies,
-- which under RLS means `authenticated` has no access — exactly what
-- we want. service_role bypasses RLS.
-- --------------------------------------------------------------------
-- Supabase storage.objects already has RLS enabled by default; no
-- ALTER TABLE needed. We only need the SELECT policy.
--
-- Path shape: `{nex_account.id}/{objectKey}`. storage.foldername(name)
-- returns an array of path components; [1] is the first segment.
-- Compare to the signed-in user's nex_account.id (resolved via
-- supabase_user_id = auth.uid()).

CREATE POLICY nex_music_media_select_own
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'nex-music-media'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text
        FROM public.nex_account
        WHERE supabase_user_id = auth.uid()
    )
  );

COMMENT ON POLICY nex_music_media_select_own ON storage.objects IS
  'Signed-in user can SELECT metadata for storage.objects rows whose first path segment matches one of their nex_account.id values. Bytes are read via signed URLs minted by the service-role adapter.';

-- --------------------------------------------------------------------
-- Migration ledger
-- --------------------------------------------------------------------
INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '241',
    'nex-music-media storage bucket · private · 20 MB cap · audio+image MIMEs · owner-only SELECT RLS',
    'AUTHORED only · not applied. Depends on H2 (production storage adapter · sealed memory 2026-10-30) being sealed as Supabase Storage. Partner artifact to supabase-storage-adapter.ts. Apply as the final step of the music-storage activation sequence · after 235, 236, 240. Rollback is destructive once uploads exist · requires V8 rehearsal.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- --------------------------------------------------------------------
-- Post-apply verification
--   SELECT id, public, file_size_limit, allowed_mime_types
--     FROM storage.buckets WHERE id = 'nex-music-media';
--   SELECT polname, polcmd, polroles::regrole[]
--     FROM pg_policy
--    WHERE polrelid = 'storage.objects'::regclass
--      AND polname = 'nex_music_media_select_own';
-- --------------------------------------------------------------------
