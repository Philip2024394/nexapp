-- Migration 235 · nex_music_track
-- Owner-authorised 2026-10-29 · AUTHORED · DO NOT APPLY until the
-- music contract clears Gate 3 (provider selection + migration SQL
-- review). This file is the schema target that the dev filesystem
-- repository mirrors in shape · when a production repository lands,
-- the row shape is identical.
--
-- References:
--   · docs/doctrine/nex-music-upload-contract-DRAFT-2026-10-29.md §9
--   · The sealed `nex_uploaded_video` row pattern (migration 223).
--
-- Rollback: a corresponding `DOWN` block is included at the bottom.

BEGIN;

CREATE TABLE IF NOT EXISTS public.nex_music_track (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account_id     uuid         NOT NULL REFERENCES public.nex_account(id) ON DELETE CASCADE,
  business_id          uuid         NULL REFERENCES public.nex_business(id) ON DELETE SET NULL,

  source_type          text         NOT NULL
    CHECK (source_type IN ('uploaded_audio', 'spotify_url', 'youtube_url')),

  title                text         NOT NULL
    CHECK (length(trim(title)) BETWEEN 1 AND 200),
  artist               text         NULL
    CHECK (artist IS NULL OR length(trim(artist)) BETWEEN 1 AND 200),
  album                text         NULL
    CHECK (album IS NULL OR length(trim(album)) BETWEEN 1 AND 200),
  duration_ms          integer      NULL
    CHECK (duration_ms IS NULL OR duration_ms BETWEEN 1 AND 36000000),

  -- Opaque adapter reference for uploaded_audio. NULL for the URL sources.
  media_url            text         NULL,
  -- External URL for spotify_url / youtube_url. NULL for uploaded_audio.
  source_url           text         NULL,
  cover_image_url      text         NULL,
  background_image_url text         NULL,

  byte_size            bigint       NULL
    CHECK (byte_size IS NULL OR byte_size BETWEEN 1 AND 52428800),
  mime_type            text         NULL
    CHECK (mime_type IS NULL OR mime_type IN ('audio/mpeg', 'audio/mp4')),
  bitrate_kbps         integer      NULL,

  rights_declaration   text         NOT NULL
    CHECK (rights_declaration IN ('owner_content', 'licensed', 'public_domain')),
  rights_notes         text         NULL,

  visibility           text         NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'shared_live', 'removed')),

  -- Owner-authorised 2026-10-29 (library card metrics) · aggregate
  -- counters bumped by server actions. Default 0.
  view_count           integer      NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  like_count           integer      NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  share_count          integer      NOT NULL DEFAULT 0 CHECK (share_count >= 0),

  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now(),
  removed_at           timestamptz  NULL,

  -- Exactly one of media_url / source_url per DRAFT §9.1.
  CHECK (
    (source_type = 'uploaded_audio'
       AND media_url IS NOT NULL
       AND source_url IS NULL)
    OR (source_type IN ('spotify_url', 'youtube_url')
       AND source_url IS NOT NULL
       AND media_url IS NULL)
  )
);

-- Hot-path index · library listing.
CREATE INDEX IF NOT EXISTS idx_nex_music_track_owner_visibility_created
  ON public.nex_music_track (owner_account_id, visibility, created_at DESC);

-- Partial index · Live-session track picker reads only shared_live rows.
CREATE INDEX IF NOT EXISTS idx_nex_music_track_shared_live
  ON public.nex_music_track (owner_account_id, created_at DESC)
  WHERE visibility = 'shared_live';

-- RLS · owner-only read. Writes flow via server actions under service role.
ALTER TABLE public.nex_music_track ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_music_track_owner_select
  ON public.nex_music_track
  FOR SELECT
  TO authenticated
  USING (owner_account_id = (SELECT auth.uid()));

-- No INSERT/UPDATE/DELETE policy for `authenticated` · service-role writes.

REVOKE ALL ON public.nex_music_track FROM anon;
GRANT SELECT ON public.nex_music_track TO authenticated;

COMMIT;

-- ----------------------------------------------------------------
-- Rollback (manual):
--   BEGIN;
--     DROP INDEX IF EXISTS public.idx_nex_music_track_shared_live;
--     DROP INDEX IF EXISTS public.idx_nex_music_track_owner_visibility_created;
--     DROP TABLE IF EXISTS public.nex_music_track;
--   COMMIT;
-- ----------------------------------------------------------------
