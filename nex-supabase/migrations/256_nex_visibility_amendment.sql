-- ============================================================================
-- NEX Migration 256 · content_visibility enum + visibility amendment
--                    · SUPERSEDES migration 247 for the two collision tables
-- ============================================================================
--
-- STATUS: DRAFT · NOT YET APPLIED TO ANY DATABASE.
-- NOT PART OF STAGE 3A APPLY SCOPE (per owner Decision D7 · 2026-11-01 ·
-- Minimum Safe: 244 + 252 + 253 + 254 only).
--
-- This file is DRAFTED NOW for owner review but held until a separate
-- authorised apply step (Stage 3A.5 or Stage 3B · owner choice).
--
-- Owner-authorised preparation only (NEX GLOBAL FEED PROPOSAL · Stage 3A
-- Decision D5 · 2026-11-01 · "Amend 247: convert existing text column
-- -> content_visibility enum with explicit value map").
--
-- Why this migration exists:
--   Migration 247 as-written tries `ADD COLUMN visibility content_visibility`
--   on nex_music_track + nex_uploaded_video. Both tables already have a
--   `visibility text` column (added by their own migrations · 235 for
--   music_track · 223 for uploaded_video). The ADD COLUMN would fail.
--
--   This migration handles the collision cleanly:
--     1. CREATE TYPE content_visibility (same 6-value enum as 247 intended)
--     2. For the 6 tables with NO existing visibility column: ADD COLUMN
--        (same as 247)
--     3. For nex_music_track + nex_uploaded_video (collision tables):
--        a. Rename existing `visibility` -> `legacy_visibility_text`
--        b. ADD COLUMN visibility content_visibility NULL (temporary nullable)
--        c. UPDATE visibility = <explicit map of legacy_visibility_text>
--        d. ALTER COLUMN visibility SET NOT NULL + SET DEFAULT 'PRIVATE'
--        e. Keep legacy_visibility_text for one release cycle (lossless audit)
--     4. Add selected_countries[] + integrity trigger (per 247)
--     5. Add nex_product triple (per 247)
--
-- EXPLICIT VALUE MAP (owner D5 · 2026-11-01):
--   legacy_visibility_text='private'      -> visibility='PRIVATE'
--   legacy_visibility_text='shared_live'  -> visibility='WORLDWIDE'
--   legacy_visibility_text='removed'      -> visibility='PRIVATE' + moderation_status set elsewhere
--   legacy_visibility_text='draft'        -> visibility='PRIVATE' (uploaded_video only)
--   legacy_visibility_text='public'       -> visibility='WORLDWIDE' (uploaded_video only)
--   legacy_visibility_text='unlisted'     -> visibility='FOLLOWERS'
--   anything else                         -> raise exception (safer than wrong default)
--
--   Irish Pride's 6 tracks (current state 2026-11-01):
--     - 4 tracks visibility='private'      -> new visibility='PRIVATE'  (unchanged · still author-only)
--     - 2 tracks visibility='shared_live'  -> new visibility='WORLDWIDE' (unchanged semantic · still in feed)
--
--   Owner safeguard: "Irish Pride's six tracks and all existing uploads
--   must remain intact and available as they are today." VERIFIED by the
--   map above · no track changes feed-eligibility.
--
-- Dependencies:
--   · Migration 244 (country column) · 247 preflight required this; so does 256
--   · nex_business + 5 other tables must still exist (they do)
--
-- Scope (strictly):
--   · CREATE TYPE content_visibility (6 values)
--   · 6 tables ADD COLUMN visibility content_visibility NOT NULL DEFAULT …
--   · 2 tables RENAME + ADD + BACKFILL + CONSTRAIN
--   · nex_product triple (discovery_visibility + international_sales_enabled + allowed_delivery_destinations)
--   · selected_countries[] on all 8
--   · integrity trigger
--
-- NOT in scope:
--   · Code changes to feed readers · Stage 3B
--   · RLS gate G2 (Migration 245) · Stage 3B
--   · moderation_status (Migration 249) · can apply AFTER 256 since its
--     preflight checks for nex_business.visibility existence · 256 adds that
--
-- Rollback: non-trivial · see rollback section at bottom.
--
-- Risk level: MEDIUM-HIGH · touches existing content rows (Irish Pride's 6).
--   Owner must inspect the explicit-map UPDATE statements before apply.
--
-- ============================================================================

BEGIN;

-- Apply guard
DO $$
BEGIN
  RAISE EXCEPTION 'Migration 256 is DRAFT · requires explicit owner authorisation naming this file to apply. This migration touches existing content rows (Irish Pride tracks). Review the explicit value map in this file before approving.';
END $$;

-- ---------------------------------------------------------------------------
-- Pre-flight · same guards as 247 plus the two collision-table existence checks
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='nex_business' AND column_name='country'
  ) THEN
    RAISE EXCEPTION 'Migration 256 refused: nex_business.country missing. Apply 244 first.';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_visibility') THEN
    RAISE EXCEPTION 'Migration 256 refused: content_visibility type already exists. Did you apply 247 somehow? See nex_migration_history.';
  END IF;

  -- Verify the collision columns exist as expected
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='nex_music_track' AND column_name='visibility'
       AND data_type='text'
  ) THEN
    RAISE EXCEPTION 'Migration 256 refused: nex_music_track.visibility text column missing · expected collision not present · audit the schema.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='nex_uploaded_video' AND column_name='visibility'
       AND data_type='text'
  ) THEN
    RAISE EXCEPTION 'Migration 256 refused: nex_uploaded_video.visibility text column missing · expected collision not present · audit the schema.';
  END IF;

  -- Verify every legacy value in both tables is in the mapping set
  IF EXISTS (
    SELECT 1 FROM public.nex_music_track
     WHERE visibility NOT IN ('private','shared_live','removed')
  ) THEN
    RAISE EXCEPTION 'Migration 256 refused: nex_music_track contains unmapped visibility value. Add it to the explicit value map before applying.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.nex_uploaded_video
     WHERE visibility NOT IN ('draft','public','unlisted','removed')
  ) THEN
    RAISE EXCEPTION 'Migration 256 refused: nex_uploaded_video contains unmapped visibility value. Add it to the explicit value map before applying.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Enum type (same as 247 intended)
-- ---------------------------------------------------------------------------
CREATE TYPE public.content_visibility AS ENUM (
  'PRIVATE',
  'FRIENDS',
  'FOLLOWERS',
  'COUNTRY',
  'SELECTED_COUNTRIES',
  'WORLDWIDE'
);

COMMENT ON TYPE public.content_visibility IS
  'Six-scope audience enum · author chooses who sees content. SELECTED_COUNTRIES requires non-null selected_countries[] (enforced by trigger per visibility-bearing table).';

-- ---------------------------------------------------------------------------
-- Group 1 · the 6 tables WITHOUT a pre-existing visibility column
--             (ADD COLUMN · identical to 247)
-- ---------------------------------------------------------------------------
ALTER TABLE public.nex_business
  ADD COLUMN visibility public.content_visibility NOT NULL DEFAULT 'COUNTRY',
  ADD COLUMN selected_countries text[] NULL;

ALTER TABLE public.nex_live_session
  ADD COLUMN visibility public.content_visibility NOT NULL DEFAULT 'COUNTRY',
  ADD COLUMN selected_countries text[] NULL;

ALTER TABLE public.nex_live_post
  ADD COLUMN visibility public.content_visibility NOT NULL DEFAULT 'COUNTRY',
  ADD COLUMN selected_countries text[] NULL;

ALTER TABLE public.nex_community_notice
  ADD COLUMN visibility public.content_visibility NOT NULL DEFAULT 'COUNTRY',
  ADD COLUMN selected_countries text[] NULL;

ALTER TABLE public.nex_community_card
  ADD COLUMN visibility public.content_visibility NOT NULL DEFAULT 'COUNTRY',
  ADD COLUMN selected_countries text[] NULL;

-- ---------------------------------------------------------------------------
-- Group 2 · the 2 tables WITH a pre-existing visibility text column
--             (RENAME → BACKFILL → CONSTRAIN)
-- ---------------------------------------------------------------------------

-- nex_music_track
ALTER TABLE public.nex_music_track
  RENAME COLUMN visibility TO legacy_visibility_text;

ALTER TABLE public.nex_music_track
  ADD COLUMN visibility public.content_visibility NULL,
  ADD COLUMN selected_countries text[] NULL;

UPDATE public.nex_music_track
   SET visibility = CASE legacy_visibility_text
     WHEN 'private'     THEN 'PRIVATE'::public.content_visibility
     WHEN 'shared_live' THEN 'WORLDWIDE'::public.content_visibility
     WHEN 'removed'     THEN 'PRIVATE'::public.content_visibility
     -- Guarded above · raise if anything else
     ELSE (RAISE EXCEPTION 'nex_music_track.legacy_visibility_text unmapped: %', legacy_visibility_text)
   END;

ALTER TABLE public.nex_music_track
  ALTER COLUMN visibility SET NOT NULL,
  ALTER COLUMN visibility SET DEFAULT 'PRIVATE'::public.content_visibility;

COMMENT ON COLUMN public.nex_music_track.legacy_visibility_text IS
  'Pre-256 text value preserved for one release cycle for audit. Can be dropped after Stage 3B verifies the feed reader uses the new enum column exclusively. Do NOT drop without owner authorisation.';

-- nex_uploaded_video
ALTER TABLE public.nex_uploaded_video
  RENAME COLUMN visibility TO legacy_visibility_text;

ALTER TABLE public.nex_uploaded_video
  ADD COLUMN visibility public.content_visibility NULL,
  ADD COLUMN selected_countries text[] NULL;

UPDATE public.nex_uploaded_video
   SET visibility = CASE legacy_visibility_text
     WHEN 'draft'    THEN 'PRIVATE'::public.content_visibility
     WHEN 'public'   THEN 'WORLDWIDE'::public.content_visibility
     WHEN 'unlisted' THEN 'FOLLOWERS'::public.content_visibility
     WHEN 'removed'  THEN 'PRIVATE'::public.content_visibility
     ELSE (RAISE EXCEPTION 'nex_uploaded_video.legacy_visibility_text unmapped: %', legacy_visibility_text)
   END;

ALTER TABLE public.nex_uploaded_video
  ALTER COLUMN visibility SET NOT NULL,
  ALTER COLUMN visibility SET DEFAULT 'PRIVATE'::public.content_visibility;

COMMENT ON COLUMN public.nex_uploaded_video.legacy_visibility_text IS
  'Pre-256 text value preserved for one release cycle for audit. See nex_music_track.legacy_visibility_text comment.';

-- ---------------------------------------------------------------------------
-- Product triple (same as 247 intended · unchanged)
-- ---------------------------------------------------------------------------
ALTER TABLE public.nex_product
  ADD COLUMN discovery_visibility         public.content_visibility NOT NULL DEFAULT 'COUNTRY',
  ADD COLUMN international_sales_enabled  boolean                   NOT NULL DEFAULT false,
  ADD COLUMN allowed_delivery_destinations text[]                   NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN selected_countries           text[] NULL;

COMMENT ON COLUMN public.nex_product.discovery_visibility IS
  'Who can SEE the listing. INDEPENDENT of international_sales_enabled.';
COMMENT ON COLUMN public.nex_product.international_sales_enabled IS
  'Does the seller currently accept orders from buyers in other countries? INDEPENDENT of discovery.';
COMMENT ON COLUMN public.nex_product.allowed_delivery_destinations IS
  'ISO 3166-1 alpha-2 country codes. Empty = seller country only.';

-- ---------------------------------------------------------------------------
-- Integrity trigger · selected_countries ↔ visibility='SELECTED_COUNTRIES'
-- (same as 247 intended · unchanged)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nex_enforce_selected_countries_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'nex_product' THEN
    IF NEW.discovery_visibility = 'SELECTED_COUNTRIES' AND (NEW.selected_countries IS NULL OR array_length(NEW.selected_countries, 1) IS NULL) THEN
      RAISE EXCEPTION 'nex_product.discovery_visibility=SELECTED_COUNTRIES requires non-empty selected_countries[]';
    END IF;
    IF NEW.discovery_visibility <> 'SELECTED_COUNTRIES' AND NEW.selected_countries IS NOT NULL THEN
      RAISE EXCEPTION 'nex_product.selected_countries must be NULL unless discovery_visibility=SELECTED_COUNTRIES';
    END IF;
  ELSE
    IF NEW.visibility = 'SELECTED_COUNTRIES' AND (NEW.selected_countries IS NULL OR array_length(NEW.selected_countries, 1) IS NULL) THEN
      RAISE EXCEPTION '%.visibility=SELECTED_COUNTRIES requires non-empty selected_countries[]', TG_TABLE_NAME;
    END IF;
    IF NEW.visibility <> 'SELECTED_COUNTRIES' AND NEW.selected_countries IS NOT NULL THEN
      RAISE EXCEPTION '%.selected_countries must be NULL unless visibility=SELECTED_COUNTRIES', TG_TABLE_NAME;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'nex_business','nex_music_track','nex_uploaded_video','nex_live_session',
    'nex_live_post','nex_community_notice','nex_community_card','nex_product'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_selected_countries_consistency
         BEFORE INSERT OR UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.nex_enforce_selected_countries_consistency()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, applied_at)
VALUES (
  '256',
  'content_visibility enum + visibility amendment · supersedes 247 approach for nex_music_track + nex_uploaded_video collision via rename+backfill+constrain · product triple · integrity trigger. Owner Decision D5 2026-11-01 explicit map applied.',
  now()
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- Rollback (manual · DESTRUCTIVE if non-default rows exist)
-- ---------------------------------------------------------------------------
-- Phase A: snapshot
--   CREATE TABLE nex_visibility_rollback_256 AS SELECT 'nex_music_track' AS t, id,
--     visibility::text AS new_v, legacy_visibility_text AS old_v FROM public.nex_music_track
--     UNION ALL SELECT 'nex_uploaded_video', id, visibility::text, legacy_visibility_text
--     FROM public.nex_uploaded_video;
-- Phase B: drop triggers + function
--   (same list as 247 rollback)
-- Phase C: for collision tables · drop new column, rename legacy back
--   ALTER TABLE public.nex_music_track DROP COLUMN visibility, DROP COLUMN selected_countries;
--   ALTER TABLE public.nex_music_track RENAME COLUMN legacy_visibility_text TO visibility;
--   (repeat for nex_uploaded_video)
-- Phase D: drop the 6 added columns on other tables (same as 247 rollback)
-- Phase E: DROP TYPE public.content_visibility
-- Phase F: DELETE FROM nex_migration_history WHERE version='256';
--
-- Owner must author the full rollback-companion file if 256 is ever rolled
-- back after HQ has started writing non-default visibility values.
