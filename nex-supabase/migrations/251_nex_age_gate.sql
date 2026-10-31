-- ============================================================================
-- NEX Migration 251 · content_age_rating + age_rating column + account DOB
-- ============================================================================
--
-- STATUS: DRAFT · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised preparation only (NEX OWNER RESPONSE — W-1 THROUGH W-9,
-- 2026-10-31 · 7-migration path · W-8 "keep every prerequisite explicit").
--
-- Purpose:
--   Add the per-content `age_rating` column + viewer-side DOB + verification
--   timestamp columns to `nex_account`. Together these implement the DB
--   coarse half of RLS gate G5 (Age · see §4 of the round-2 report).
--
--   Note: owner's safeguard in W-4 — a gate is DB-enforced only if PG can
--   evaluate the predicate. The DB evaluates the coarse "DOB ≥ 18 before
--   showing age_rating='adult'" check. Jurisdictional overrides (18 vs 21
--   depending on country, verification-trust requirement) are SERVER-side
--   and this migration does not pretend otherwise.
--
-- Dependencies:
--   · Prerequisite: Migration 246 (adds `nex_account.primary_country` ·
--     this migration extends the same account enrichment).
--   · Prerequisite: Migration 247 (the 8 visibility-bearing tables now
--     exist with their visibility column · age_rating sits alongside).
--   · Must apply before 245 (RLS predicate references age_rating + DOB).
--
-- Scope of this migration (strictly):
--   · CREATE TYPE content_age_rating (3-value enum)
--   · 8 tables ADD COLUMN age_rating content_age_rating NOT NULL DEFAULT 'general'
--   · nex_account ADD COLUMN date_of_birth date NULL
--                 ADD COLUMN age_verified_at timestamptz NULL
--
-- NOT in scope:
--   · UI collection of DOB (separate feature programme · age_verified_at
--     stays NULL until the user explicitly completes verification)
--   · Jurisdictional override tables (server-side jurisdiction map lives
--     in application code, not in this migration)
--   · Automatic rating of existing content (defaults to 'general')
--
-- Backfill: defaults applied by ADD COLUMN · age_rating defaults to 'general'
--   for all existing content · DOB and age_verified_at stay NULL for all
--   existing accounts (owner collects explicitly).
--
-- Rollback: follows 244/247 pattern.
--
-- Risk level: LOW (new enum + 8 content column adds + 2 account column adds ·
--   all defaults make the change behaviour-neutral until downstream features
--   start setting non-default values).
--
-- ============================================================================

BEGIN;

-- Apply guard
DO $$
BEGIN
  RAISE EXCEPTION 'Migration 251 is DRAFT · requires explicit owner authorisation naming this file to apply.';
END $$;

-- ---------------------------------------------------------------------------
-- Pre-flight
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- 246 must have applied (primary_country column must exist on nex_account)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='nex_account' AND column_name='primary_country'
  ) THEN
    RAISE EXCEPTION 'Migration 251 refused: nex_account.primary_country missing. Apply 246 first.';
  END IF;

  -- 247 must have applied
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='nex_business' AND column_name='visibility'
  ) THEN
    RAISE EXCEPTION 'Migration 251 refused: nex_business.visibility missing. Apply 247 first.';
  END IF;

  -- 251 itself not yet applied
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_age_rating') THEN
    RAISE EXCEPTION 'Migration 251 refused: content_age_rating type already exists.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Enum type
-- ---------------------------------------------------------------------------
CREATE TYPE public.content_age_rating AS ENUM (
  'general',  -- no age restriction (default)
  'teen',     -- viewer must be ≥ 13 (DB coarse check)
  'adult'     -- viewer must be ≥ 18 (DB coarse check); server applies
              --  jurisdictional overrides (e.g. 21 in some countries) +
              --  may require age_verified_at IS NOT NULL for 'adult' content
);

COMMENT ON TYPE public.content_age_rating IS
  'Per-content minimum age · DB evaluates coarse DOB-based gate for RLS G5 · server evaluates fine jurisdictional + verification-trust overrides.';

-- ---------------------------------------------------------------------------
-- 8 tables · age_rating column
-- ---------------------------------------------------------------------------
ALTER TABLE public.nex_business
  ADD COLUMN age_rating public.content_age_rating NOT NULL DEFAULT 'general';
ALTER TABLE public.nex_product
  ADD COLUMN age_rating public.content_age_rating NOT NULL DEFAULT 'general';
ALTER TABLE public.nex_music_track
  ADD COLUMN age_rating public.content_age_rating NOT NULL DEFAULT 'general';
ALTER TABLE public.nex_uploaded_video
  ADD COLUMN age_rating public.content_age_rating NOT NULL DEFAULT 'general';
ALTER TABLE public.nex_live_session
  ADD COLUMN age_rating public.content_age_rating NOT NULL DEFAULT 'general';
ALTER TABLE public.nex_live_post
  ADD COLUMN age_rating public.content_age_rating NOT NULL DEFAULT 'general';
ALTER TABLE public.nex_community_notice
  ADD COLUMN age_rating public.content_age_rating NOT NULL DEFAULT 'general';
ALTER TABLE public.nex_community_card
  ADD COLUMN age_rating public.content_age_rating NOT NULL DEFAULT 'general';

-- ---------------------------------------------------------------------------
-- Account · DOB + verification timestamp
-- ---------------------------------------------------------------------------
ALTER TABLE public.nex_account
  ADD COLUMN IF NOT EXISTS date_of_birth   date        NULL,
  ADD COLUMN IF NOT EXISTS age_verified_at timestamptz NULL;

COMMENT ON COLUMN public.nex_account.date_of_birth IS
  'Account owner date of birth · nullable · collected explicitly by the account owner · drives DB coarse age gate in RLS G5. Server may require age_verified_at IS NOT NULL as additional trust signal for adult content.';
COMMENT ON COLUMN public.nex_account.age_verified_at IS
  'Timestamp when the account owner last completed age verification (e.g. ID check, biometric, parent-managed child profile). NULL means not verified. Server-side check decides whether this is required for a given content''s age_rating.';

-- Simple sanity constraint: DOB must be plausibly in the past
ALTER TABLE public.nex_account
  ADD CONSTRAINT nex_account_dob_sane CHECK (
    date_of_birth IS NULL
    OR (date_of_birth > DATE '1900-01-01' AND date_of_birth <= CURRENT_DATE)
  );

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, applied_at)
VALUES (
  '251',
  'content_age_rating enum + age_rating column on 8 content tables + nex_account.date_of_birth + nex_account.age_verified_at + plausibility CHECK.',
  now()
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- Rollback (copy-paste if needed · follows 244 pattern)
-- ---------------------------------------------------------------------------
-- BEGIN;
-- DO $$ BEGIN
--   IF session_user NOT IN ('postgres','supabase_admin') THEN
--     RAISE EXCEPTION 'Migration 251 rollback REFUSED · session_user=%', session_user;
--   END IF;
-- END $$;
-- ALTER TABLE public.nex_account DROP CONSTRAINT IF EXISTS nex_account_dob_sane;
-- ALTER TABLE public.nex_account DROP COLUMN IF EXISTS age_verified_at;
-- ALTER TABLE public.nex_account DROP COLUMN IF EXISTS date_of_birth;
-- ALTER TABLE public.nex_business       DROP COLUMN IF EXISTS age_rating;
-- ALTER TABLE public.nex_product        DROP COLUMN IF EXISTS age_rating;
-- ALTER TABLE public.nex_music_track    DROP COLUMN IF EXISTS age_rating;
-- ALTER TABLE public.nex_uploaded_video DROP COLUMN IF EXISTS age_rating;
-- ALTER TABLE public.nex_live_session   DROP COLUMN IF EXISTS age_rating;
-- ALTER TABLE public.nex_live_post      DROP COLUMN IF EXISTS age_rating;
-- ALTER TABLE public.nex_community_notice DROP COLUMN IF EXISTS age_rating;
-- ALTER TABLE public.nex_community_card DROP COLUMN IF EXISTS age_rating;
-- DROP TYPE IF EXISTS public.content_age_rating;
-- DELETE FROM public.nex_migration_history WHERE version = '251';
-- COMMIT;
--
-- Note: dropping date_of_birth is LOSSY if any user has collected DOB
-- between 251 apply and rollback. In that case, snapshot
-- (account_id, date_of_birth, age_verified_at) first (same pattern as 244).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Positive / negative tests
-- ---------------------------------------------------------------------------
-- POS-T251-1 · Post-apply: type content_age_rating exists · 3 labels.
-- POS-T251-2 · Post-apply: all 8 content tables have age_rating='general'.
-- POS-T251-3 · Post-apply: nex_account has date_of_birth NULL + age_verified_at NULL for all existing rows.
-- POS-T251-4 · INSERT nex_account with date_of_birth='1990-01-01' → succeeds (CHECK passes).
-- NEG-T251-5 · INSERT nex_account with date_of_birth='1850-01-01' → CHECK violation.
-- NEG-T251-6 · INSERT nex_account with date_of_birth='2099-01-01' → CHECK violation.
-- NEG-T251-7 · Apply with 246 missing → pre-flight raises.
-- NEG-T251-8 · Apply with 247 missing → pre-flight raises.
-- NEG-T251-9 · Re-apply after successful apply → pre-flight sees type exists → raises.
-- ---------------------------------------------------------------------------
