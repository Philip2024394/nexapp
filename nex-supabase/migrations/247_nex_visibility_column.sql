-- ============================================================================
-- NEX Migration 247 · content_visibility enum + visibility column on 8 tables + product triple
-- ============================================================================
--
-- STATUS: DRAFT · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised preparation only (NEX OWNER RESPONSE — W-1 THROUGH W-9,
-- 2026-10-31, 7-migration path selected). DO NOT APPLY to the sealed
-- Supabase project `ijvqdvsvwtwxzcqmoqit` without SEPARATE explicit owner
-- authorisation naming this file.
--
-- Purpose:
--   Add the `content_visibility` enum and attach a `visibility` column to
--   the 8 tables identified in `nex-99-table-classification-2026-10-31.md`
--   as receiving author-chosen audience scope. `nex_product` additionally
--   receives the triple `(discovery_visibility, international_sales_enabled,
--   allowed_delivery_destinations)` per owner CI-10 safeguard — three
--   INDEPENDENT fields, never collapsed into one.
--
-- Dependencies:
--   · Semantic prerequisite: Migration 244 (country column). Visibility
--     branches reference country.
--   · Must apply before 245 (RLS references visibility column + enum).
--
-- Scope of this migration (strictly):
--   · CREATE TYPE public.content_visibility (6-value enum)
--   · 7 tables ADD COLUMN visibility content_visibility NOT NULL DEFAULT …
--   · 1 table (nex_product) ADD COLUMN discovery_visibility content_visibility NOT NULL DEFAULT 'COUNTRY'
--                                 + ADD COLUMN international_sales_enabled boolean NOT NULL DEFAULT false
--                                 + ADD COLUMN allowed_delivery_destinations text[] NOT NULL DEFAULT ARRAY[]::text[]
--   · ADD COLUMN selected_countries text[] NULL on each visibility-bearing table
--   · CHECK triggers: selected_countries ↔ visibility='SELECTED_COUNTRIES'
--
-- NOT in scope (deferred to their own migrations):
--   · moderation_status + enum       → Migration 249
--   · age_rating + DOB + verified_at → Migration 251
--   · RLS                            → Migration 245
--   · storage prefixes               → Migration 248
--
-- Backfill: default values applied by ADD COLUMN · all existing rows take
--   the safest scope ('PRIVATE' for music/video, 'COUNTRY' elsewhere).
--   Zero exposure change vs today.
--
-- Rollback: non-destructive except for explicitly-set non-default values
--   (if any have been set between 247 apply and rollback). Follows the
--   244-rollback pattern (Phase 1 read-only count, Phase 2A refused if
--   non-default values exist, Phase 2B snapshot-then-drop).
--
-- Risk level: MEDIUM (new enum type + 8 column adds · reversible, but
--   downstream SELECT * callers see new columns immediately).
--
-- ============================================================================

BEGIN;

-- Apply guard
DO $$
BEGIN
  RAISE EXCEPTION 'Migration 247 is DRAFT · requires explicit owner authorisation naming this file to apply.';
END $$;

-- ---------------------------------------------------------------------------
-- Pre-flight audit
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- 244 must have applied (semantic prerequisite · the visibility=COUNTRY
  -- branch refers to a country column that must exist on nex_business).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='nex_business' AND column_name='country'
  ) THEN
    RAISE EXCEPTION 'Migration 247 refused: nex_business.country missing. Apply 244 first.';
  END IF;

  -- 247 itself must not have been applied (apply-idempotency)
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_visibility') THEN
    RAISE EXCEPTION 'Migration 247 refused: content_visibility type already exists. Did you apply 247 already? See `nex_migration_history`.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Enum type
-- ---------------------------------------------------------------------------
CREATE TYPE public.content_visibility AS ENUM (
  'PRIVATE',             -- author only
  'FRIENDS',             -- accepted friends (via nex_friend_edge)
  'FOLLOWERS',           -- accepted followers (via nex_follow_graph)
  'COUNTRY',             -- same deployment country
  'SELECTED_COUNTRIES',  -- explicit list in selected_countries[]
  'WORLDWIDE'            -- all deployments
);

COMMENT ON TYPE public.content_visibility IS
  'Six-scope audience enum · author chooses who sees content. SELECTED_COUNTRIES requires non-null selected_countries[] (enforced by trigger per visibility-bearing table).';

-- ---------------------------------------------------------------------------
-- 7 tables · plain visibility column + selected_countries
-- ---------------------------------------------------------------------------
-- Default = 'COUNTRY' for already-shipped surfaces (business, live_session,
-- live_post, community_notice, community_card) · least-exposure for
-- creator-authored uploads (music_track, uploaded_video) = 'PRIVATE'.

ALTER TABLE public.nex_business
  ADD COLUMN visibility public.content_visibility NOT NULL DEFAULT 'COUNTRY',
  ADD COLUMN selected_countries text[] NULL;

ALTER TABLE public.nex_music_track
  ADD COLUMN visibility public.content_visibility NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN selected_countries text[] NULL;

ALTER TABLE public.nex_uploaded_video
  ADD COLUMN visibility public.content_visibility NOT NULL DEFAULT 'PRIVATE',
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
-- Product triple (CI-10 safeguard · three INDEPENDENT fields)
-- ---------------------------------------------------------------------------
ALTER TABLE public.nex_product
  ADD COLUMN discovery_visibility         public.content_visibility NOT NULL DEFAULT 'COUNTRY',
  ADD COLUMN international_sales_enabled  boolean                   NOT NULL DEFAULT false,
  ADD COLUMN allowed_delivery_destinations text[]                   NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN selected_countries           text[] NULL;

COMMENT ON COLUMN public.nex_product.discovery_visibility IS
  'Who can SEE the listing · six-scope enum. INDEPENDENT of international_sales_enabled (owner CI-10). A WORLDWIDE discovery does NOT imply international sales.';
COMMENT ON COLUMN public.nex_product.international_sales_enabled IS
  'Does the seller currently accept orders from buyers in other countries? INDEPENDENT of discovery visibility. Default false · intentional fail-closed.';
COMMENT ON COLUMN public.nex_product.allowed_delivery_destinations IS
  'ISO 3166-1 alpha-2 country codes · explicit shipping destinations. Empty array = seller country only. Checkout gate verifies destination independently of visibility.';

-- ---------------------------------------------------------------------------
-- Integrity triggers · selected_countries ↔ visibility='SELECTED_COUNTRIES'
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nex_enforce_selected_countries_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- The column name differs on nex_product vs the other tables
  IF TG_TABLE_NAME = 'nex_product' THEN
    IF NEW.discovery_visibility = 'SELECTED_COUNTRIES' AND (NEW.selected_countries IS NULL OR array_length(NEW.selected_countries, 1) IS NULL) THEN
      RAISE EXCEPTION 'nex_product.discovery_visibility=SELECTED_COUNTRIES requires a non-empty selected_countries[]';
    END IF;
    IF NEW.discovery_visibility <> 'SELECTED_COUNTRIES' AND NEW.selected_countries IS NOT NULL THEN
      RAISE EXCEPTION 'nex_product.selected_countries must be NULL unless discovery_visibility=SELECTED_COUNTRIES';
    END IF;
  ELSE
    IF NEW.visibility = 'SELECTED_COUNTRIES' AND (NEW.selected_countries IS NULL OR array_length(NEW.selected_countries, 1) IS NULL) THEN
      RAISE EXCEPTION '%.visibility=SELECTED_COUNTRIES requires a non-empty selected_countries[]', TG_TABLE_NAME;
    END IF;
    IF NEW.visibility <> 'SELECTED_COUNTRIES' AND NEW.selected_countries IS NOT NULL THEN
      RAISE EXCEPTION '%.selected_countries must be NULL unless visibility=SELECTED_COUNTRIES', TG_TABLE_NAME;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'nex_business',
    'nex_music_track',
    'nex_uploaded_video',
    'nex_live_session',
    'nex_live_post',
    'nex_community_notice',
    'nex_community_card',
    'nex_product'
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
  '247',
  'content_visibility enum + visibility column on 7 tables + discovery_visibility/international_sales_enabled/allowed_delivery_destinations on nex_product + selected_countries[] + integrity triggers.',
  now()
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- Rollback (not part of this migration; copy-paste if needed)
-- ---------------------------------------------------------------------------
-- Guarded rollback follows the 244 pattern. For brevity the snapshot path
-- is condensed · in a real rollback it would snapshot
-- (table_name, row_id, visibility, selected_countries, …product_fields) to a
-- `nex_visibility_rollback_247` table before dropping. See 244's rollback
-- file for the full template.
--
-- BEGIN;
-- -- Role + GUC checks (see 244 rollback file for pattern)
-- DO $$ BEGIN
--   IF session_user NOT IN ('postgres','supabase_admin') THEN
--     RAISE EXCEPTION 'Migration 247 rollback REFUSED · session_user=%', session_user;
--   END IF;
-- END $$;
-- -- Drop triggers
-- DROP TRIGGER IF EXISTS trg_nex_business_selected_countries_consistency       ON public.nex_business;
-- DROP TRIGGER IF EXISTS trg_nex_music_track_selected_countries_consistency    ON public.nex_music_track;
-- DROP TRIGGER IF EXISTS trg_nex_uploaded_video_selected_countries_consistency ON public.nex_uploaded_video;
-- DROP TRIGGER IF EXISTS trg_nex_live_session_selected_countries_consistency   ON public.nex_live_session;
-- DROP TRIGGER IF EXISTS trg_nex_live_post_selected_countries_consistency      ON public.nex_live_post;
-- DROP TRIGGER IF EXISTS trg_nex_community_notice_selected_countries_consistency ON public.nex_community_notice;
-- DROP TRIGGER IF EXISTS trg_nex_community_card_selected_countries_consistency ON public.nex_community_card;
-- DROP TRIGGER IF EXISTS trg_nex_product_selected_countries_consistency        ON public.nex_product;
-- DROP FUNCTION IF EXISTS public.nex_enforce_selected_countries_consistency();
-- -- Drop columns (CAUTION · destroys any non-default values set between 247 apply and rollback)
-- ALTER TABLE public.nex_business       DROP COLUMN IF EXISTS visibility, DROP COLUMN IF EXISTS selected_countries;
-- ALTER TABLE public.nex_music_track    DROP COLUMN IF EXISTS visibility, DROP COLUMN IF EXISTS selected_countries;
-- ALTER TABLE public.nex_uploaded_video DROP COLUMN IF EXISTS visibility, DROP COLUMN IF EXISTS selected_countries;
-- ALTER TABLE public.nex_live_session   DROP COLUMN IF EXISTS visibility, DROP COLUMN IF EXISTS selected_countries;
-- ALTER TABLE public.nex_live_post      DROP COLUMN IF EXISTS visibility, DROP COLUMN IF EXISTS selected_countries;
-- ALTER TABLE public.nex_community_notice DROP COLUMN IF EXISTS visibility, DROP COLUMN IF EXISTS selected_countries;
-- ALTER TABLE public.nex_community_card DROP COLUMN IF EXISTS visibility, DROP COLUMN IF EXISTS selected_countries;
-- ALTER TABLE public.nex_product
--   DROP COLUMN IF EXISTS discovery_visibility,
--   DROP COLUMN IF EXISTS international_sales_enabled,
--   DROP COLUMN IF EXISTS allowed_delivery_destinations,
--   DROP COLUMN IF EXISTS selected_countries;
-- DROP TYPE IF EXISTS public.content_visibility;
-- DELETE FROM public.nex_migration_history WHERE version = '247';
-- COMMIT;
--
-- Data-preservation note: because the drop is lossy for non-default values,
-- a production rollback should snapshot into `nex_visibility_rollback_247`
-- first (same pattern as 244's Phase 2B). Not inlined here · owner-authored
-- rollback-companion file to be issued if we ever need to roll 247 back
-- post-production.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Positive / negative tests
-- ---------------------------------------------------------------------------
-- POS-T247-1 · Pre-apply: type content_visibility does NOT exist.
--              Post-apply: type exists with 6 labels.
-- POS-T247-2 · Pre-apply: nex_music_track has no `visibility` column.
--              Post-apply: column exists AND all existing rows default to 'PRIVATE'.
-- POS-T247-3 · Pre-apply: nex_product has no triple columns.
--              Post-apply: all three columns exist · discovery_visibility='COUNTRY',
--              international_sales_enabled=false, allowed_delivery_destinations='{}'.
-- POS-T247-4 · INSERT into nex_music_track with visibility='SELECTED_COUNTRIES' + selected_countries=NULL → trigger raises.
-- POS-T247-5 · UPDATE nex_product SET discovery_visibility='SELECTED_COUNTRIES', selected_countries=ARRAY['IE','ID']
--              → succeeds. Then UPDATE to discovery_visibility='COUNTRY' without clearing selected_countries → trigger raises.
-- NEG-T247-6 · Apply with 244 missing → pre-flight raises.
-- NEG-T247-7 · Re-apply after successful apply → pre-flight sees type exists → raises.
-- ---------------------------------------------------------------------------
