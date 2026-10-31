-- ============================================================================
-- NEX Migration 249 · content_moderation_status enum + column on 8 tables
-- ============================================================================
--
-- STATUS: DRAFT · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised preparation only (NEX OWNER RESPONSE — W-1 THROUGH W-9,
-- 2026-10-31, 7-migration path selected · W-8 "keep every prerequisite
-- explicit · do not silently fold"). DO NOT APPLY to the sealed Supabase
-- project `ijvqdvsvwtwxzcqmoqit` without SEPARATE explicit owner
-- authorisation naming this file.
--
-- Purpose:
--   Add a per-content moderation state column so RLS gate G2 (Moderation,
--   see `nex-country-isolation-review-round-2-2026-10-31.md` §4) can
--   deny visibility of `taken_down` content and show `pending`/`holdback`
--   only to the author and HQ. Prerequisite of Migration 245.
--
-- Dependencies:
--   · Prerequisite: Migration 247 (same 8 tables already have `visibility`
--     column · adds schema-consistent alignment).
--   · Must apply before 245 (RLS predicate references `moderation_status`).
--
-- Scope of this migration (strictly):
--   · CREATE TYPE public.content_moderation_status (4-value enum)
--   · ADD COLUMN moderation_status content_moderation_status NOT NULL DEFAULT 'ok'
--     on 8 tables (business, music_track, uploaded_video, live_session,
--     live_post, community_notice, community_card, product).
--
-- NOT in scope:
--   · HQ moderation workflow UI
--   · Automatic classification pipeline
--   · Reporting-to-takedown integration (that's a separate programme)
--   · RLS (that is 245)
--
-- Backfill: default 'ok' applied by ADD COLUMN · all existing rows start
--   as cleared · zero exposure change vs today.
--
-- Rollback: same pattern as 247 · snapshot of non-default values before
--   drop if any exist (initial state is 100% 'ok' so Phase 2A would
--   succeed if run shortly after apply).
--
-- Risk level: LOW (new enum + 8 column adds · defaults mean no behavioural
--   change until HQ workflow starts flipping statuses).
--
-- ============================================================================

BEGIN;

-- Apply guard
DO $$
BEGIN
  RAISE EXCEPTION 'Migration 249 is DRAFT · requires explicit owner authorisation naming this file to apply.';
END $$;

-- ---------------------------------------------------------------------------
-- Pre-flight
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- 247 must have applied (same 8 tables)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='nex_business' AND column_name='visibility'
  ) THEN
    RAISE EXCEPTION 'Migration 249 refused: nex_business.visibility missing. Apply 247 first.';
  END IF;

  -- 249 itself not yet applied
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_moderation_status') THEN
    RAISE EXCEPTION 'Migration 249 refused: content_moderation_status type already exists.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Enum type
-- ---------------------------------------------------------------------------
CREATE TYPE public.content_moderation_status AS ENUM (
  'ok',          -- cleared or default
  'pending',     -- first-pass review required (visible to author + HQ, not public)
  'holdback',    -- temporarily hidden pending review (same visibility as pending)
  'taken_down'   -- removed by HQ moderation (visible to HQ only)
);

COMMENT ON TYPE public.content_moderation_status IS
  'Per-content moderation state · drives RLS gate G2. Only HQ (service_role via requireHqAdmin) may transition rows.';

-- ---------------------------------------------------------------------------
-- 8 tables · moderation_status column
-- ---------------------------------------------------------------------------
ALTER TABLE public.nex_business
  ADD COLUMN moderation_status public.content_moderation_status NOT NULL DEFAULT 'ok';
ALTER TABLE public.nex_product
  ADD COLUMN moderation_status public.content_moderation_status NOT NULL DEFAULT 'ok';
ALTER TABLE public.nex_music_track
  ADD COLUMN moderation_status public.content_moderation_status NOT NULL DEFAULT 'ok';
ALTER TABLE public.nex_uploaded_video
  ADD COLUMN moderation_status public.content_moderation_status NOT NULL DEFAULT 'ok';
ALTER TABLE public.nex_live_session
  ADD COLUMN moderation_status public.content_moderation_status NOT NULL DEFAULT 'ok';
ALTER TABLE public.nex_live_post
  ADD COLUMN moderation_status public.content_moderation_status NOT NULL DEFAULT 'ok';
ALTER TABLE public.nex_community_notice
  ADD COLUMN moderation_status public.content_moderation_status NOT NULL DEFAULT 'ok';
ALTER TABLE public.nex_community_card
  ADD COLUMN moderation_status public.content_moderation_status NOT NULL DEFAULT 'ok';

-- Comment on one representative column to document intent
COMMENT ON COLUMN public.nex_business.moderation_status IS
  'Per-row moderation state driving RLS gate G2. Only service_role (HQ) may UPDATE (enforced by Migration 245 policies). Author of the row sees own content regardless of status.';

-- ---------------------------------------------------------------------------
-- Index · partial, HQ-queue aid
-- ---------------------------------------------------------------------------
-- HQ moderators often query "all pending/holdback content" · partial index
-- keeps the common case fast.
CREATE INDEX IF NOT EXISTS idx_nex_business_moderation_review
  ON public.nex_business (moderation_status) WHERE moderation_status IN ('pending','holdback');
CREATE INDEX IF NOT EXISTS idx_nex_product_moderation_review
  ON public.nex_product (moderation_status) WHERE moderation_status IN ('pending','holdback');
CREATE INDEX IF NOT EXISTS idx_nex_music_track_moderation_review
  ON public.nex_music_track (moderation_status) WHERE moderation_status IN ('pending','holdback');
CREATE INDEX IF NOT EXISTS idx_nex_uploaded_video_moderation_review
  ON public.nex_uploaded_video (moderation_status) WHERE moderation_status IN ('pending','holdback');
CREATE INDEX IF NOT EXISTS idx_nex_live_session_moderation_review
  ON public.nex_live_session (moderation_status) WHERE moderation_status IN ('pending','holdback');
CREATE INDEX IF NOT EXISTS idx_nex_live_post_moderation_review
  ON public.nex_live_post (moderation_status) WHERE moderation_status IN ('pending','holdback');
CREATE INDEX IF NOT EXISTS idx_nex_community_notice_moderation_review
  ON public.nex_community_notice (moderation_status) WHERE moderation_status IN ('pending','holdback');
CREATE INDEX IF NOT EXISTS idx_nex_community_card_moderation_review
  ON public.nex_community_card (moderation_status) WHERE moderation_status IN ('pending','holdback');

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, applied_at)
VALUES (
  '249',
  'content_moderation_status enum + moderation_status column on 8 content tables + partial indexes for HQ review queue.',
  now()
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- Rollback (not part of this migration; copy-paste if needed)
-- ---------------------------------------------------------------------------
-- Follows the 244/247 guarded pattern. Column drop is only safe if all
-- rows still have moderation_status='ok'. If HQ has flipped any rows to
-- non-'ok', snapshot (table, row_id, moderation_status) to
-- `nex_moderation_rollback_249` before dropping.
--
-- BEGIN;
-- DO $$ BEGIN
--   IF session_user NOT IN ('postgres','supabase_admin') THEN
--     RAISE EXCEPTION 'Migration 249 rollback REFUSED · session_user=%', session_user;
--   END IF;
-- END $$;
-- -- Drop partial indexes
-- DROP INDEX IF EXISTS idx_nex_business_moderation_review;
-- DROP INDEX IF EXISTS idx_nex_product_moderation_review;
-- DROP INDEX IF EXISTS idx_nex_music_track_moderation_review;
-- DROP INDEX IF EXISTS idx_nex_uploaded_video_moderation_review;
-- DROP INDEX IF EXISTS idx_nex_live_session_moderation_review;
-- DROP INDEX IF EXISTS idx_nex_live_post_moderation_review;
-- DROP INDEX IF EXISTS idx_nex_community_notice_moderation_review;
-- DROP INDEX IF EXISTS idx_nex_community_card_moderation_review;
-- -- Drop columns
-- ALTER TABLE public.nex_business       DROP COLUMN IF EXISTS moderation_status;
-- ALTER TABLE public.nex_product        DROP COLUMN IF EXISTS moderation_status;
-- ALTER TABLE public.nex_music_track    DROP COLUMN IF EXISTS moderation_status;
-- ALTER TABLE public.nex_uploaded_video DROP COLUMN IF EXISTS moderation_status;
-- ALTER TABLE public.nex_live_session   DROP COLUMN IF EXISTS moderation_status;
-- ALTER TABLE public.nex_live_post      DROP COLUMN IF EXISTS moderation_status;
-- ALTER TABLE public.nex_community_notice DROP COLUMN IF EXISTS moderation_status;
-- ALTER TABLE public.nex_community_card DROP COLUMN IF EXISTS moderation_status;
-- DROP TYPE IF EXISTS public.content_moderation_status;
-- DELETE FROM public.nex_migration_history WHERE version = '249';
-- COMMIT;
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Positive / negative tests
-- ---------------------------------------------------------------------------
-- POS-T249-1 · Post-apply: type exists with 4 labels.
-- POS-T249-2 · Post-apply: all 8 tables have moderation_status column defaulted to 'ok'.
-- POS-T249-3 · Post-apply: HQ-queue partial indexes exist on all 8 tables.
-- POS-T249-4 · HQ UPDATE SET moderation_status='taken_down' succeeds (service_role).
-- NEG-T249-5 · Apply with 247 missing → pre-flight raises.
-- NEG-T249-6 · Re-apply after successful apply → pre-flight sees type exists → raises.
-- NEG-T249-7 · (After 245 applied) · authenticated user UPDATE moderation_status → denied by 245's write policy.
-- ---------------------------------------------------------------------------
