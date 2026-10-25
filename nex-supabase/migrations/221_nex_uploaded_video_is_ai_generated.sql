-- ============================================================================
-- NEX-native Migration 221 · nex_uploaded_video · is_ai_generated column
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Must not be applied to the sealed production project
-- `ijvqdvsvwtwxzcqmoqit` without explicit owner approval. Apply via
-- `scripts/apply-migration-221.mjs` which hard-aborts on project-id
-- mismatch (same safety pattern used for Migration 220).
--
-- Owner directive 2026-10-25 · NEX Video · AI-Generated Disclosure.
-- The uploaded-video viewer header now shows a visible red "(AI)"
-- label immediately after the "Broadcasted {date}" text when the
-- video is marked as AI-generated. The flag must be stored on the
-- authoritative record · we do not infer AI status from the title,
-- description, or topic_tags (per the owner directive).
--
-- Scope
-- ----------------------------------------------------------------------------
--   · Add a single NOT NULL `is_ai_generated boolean` column with
--     a DEFAULT of false. The default preserves every existing row
--     as "not AI-generated" · publishing paths that want to mark a
--     video as AI-generated must set the flag explicitly on insert
--     (or via a later UPDATE).
--   · No new table. No new index. No RLS change. The flag is public
--     metadata about the video, same visibility as `title` or
--     `country_of_origin`.
--   · No backfill · the DEFAULT handles pre-existing rows.
--
-- Service-side normalisation
-- ----------------------------------------------------------------------------
-- `src/lib/nex-native/live-broadcast/uploaded-video-service.ts`:
--   · The `UploadedVideoRow` type now carries `is_ai_generated:
--     boolean`.
--   · `PublishUploadedVideoInput` accepts an optional
--     `isAiGenerated?: boolean` · defaults to false when omitted.
--   · The insert body includes `is_ai_generated: input.isAiGenerated
--     === true` so a misbehaving client cannot persist truthy-but-
--     not-boolean values.
--
-- Compatibility with the unapplied-column window
-- ----------------------------------------------------------------------------
-- Between the time the service is deployed (expecting the column)
-- and the time this migration is applied:
--   · The service `insert({ ..., is_ai_generated })` includes the
--     field. Supabase PostgREST silently drops unknown columns from
--     inserts, so the row is still created · just with no flag ·
--     and `.select("*")` reads back a row without the key, which
--     the TypeScript shape tolerates by narrowing the field to
--     `boolean` with a `?? false` normalisation at every read site
--     that cares (viewer header).
--   · This matches the Phase 1 Slice 1C + Migration 220 precedent.
--
-- Dependencies
-- ----------------------------------------------------------------------------
--   APPLIED (production assumption · must be verified in sandbox):
--     219_nex_live_session_and_featured_product.sql (which creates
--     the preceding uploaded-video schema in this cluster).
--
-- Rollback
-- ----------------------------------------------------------------------------
--   BEGIN;
--     ALTER TABLE public.nex_uploaded_video DROP COLUMN IF EXISTS is_ai_generated;
--     DELETE FROM nex_migration_history WHERE version = '221';
--   COMMIT;
--
-- Dropping the column loses the AI flag on any rows that were marked
-- post-apply. Zero FK impact. Any viewer header that referenced the
-- field falls back to the "no label" path via the `?? false`
-- normalisation.
--
-- Verification (manual · not executed)
-- ----------------------------------------------------------------------------
-- After applying, verify in sandbox:
--
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'nex_uploaded_video'
--      AND column_name = 'is_ai_generated';
--
-- Expected row:
--   is_ai_generated | boolean | NO | false
--
-- Insert probe:
--
--   INSERT INTO nex_uploaded_video (owner_account_id, title,
--     storage_bucket, storage_object_path, mime_type,
--     rights_declaration, country_of_origin, is_ai_generated)
--   VALUES ('<uuid>', 'probe', 'nex-live-uploaded',
--     'owner/first-live/x.mp4', 'video/mp4', 'owner_content',
--     'ID', true)
--   RETURNING is_ai_generated;
--
-- Expected: returns `true`.
--
-- IMPORTANT: this field records whether the video is IDENTIFIED as
-- AI-generated. It must not be presented as a guarantee that every
-- UNLABELLED video was made by a human. The viewer-side copy says
-- "(AI)" when true · it says NOTHING when false. There is no "100%
-- human" badge.
-- ============================================================================

BEGIN;

ALTER TABLE public.nex_uploaded_video
  ADD COLUMN IF NOT EXISTS is_ai_generated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.nex_uploaded_video.is_ai_generated IS
  'When true the viewer header shows a visible red "(AI)" label immediately after "Broadcasted {date}". NEX makes NO claim about unlabelled videos being human-authored · absence of the label does not imply human origin. Service-side the field is set via PublishUploadedVideoInput.isAiGenerated or a subsequent UPDATE. Sealed 2026-10-25 · Migration 221.';

INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '221',
  'nex_uploaded_video · is_ai_generated column · AI-generated disclosure label',
  'Owner directive 2026-10-25. Adds NOT NULL is_ai_generated boolean DEFAULT false. Preserves all existing rows as "not AI-generated" via the default. No backfill. No RLS change. Rollback: DROP COLUMN. The service-layer code (uploaded-video-service.ts publishUploadedVideo) tolerates the pre-migration unapplied-column window: PostgREST silently drops the field on insert, the row is still created without the flag, and the viewer header reads a missing key as false via `?? false`. NOT YET APPLIED to any database.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
