-- ============================================================================
-- NEX Migration 246 · country backfill + account primary_country
-- ============================================================================
--
-- STATUS: DRAFT · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised preparation only (NEX OWNER RESPONSE — W-1 THROUGH W-9,
-- 2026-10-31, 7-migration path selected). DO NOT APPLY to the sealed
-- Supabase project `ijvqdvsvwtwxzcqmoqit`, any staging target, or any
-- local database without a SEPARATE, specific owner authorisation that
-- names this file.
--
-- Purpose:
--   Backfill `country` on the four anchor tables created by Migration 244
--   AND add `primary_country` to `nex_account`.
--   This migration is a prerequisite of Migration 245 (RLS). Without a
--   complete backfill, the RLS predicate `country = current_setting(…)`
--   makes every row invisible (NULL compares to anything is NULL →
--   fail-closed).
--
-- Scope:
--   · UPDATE nex_business       SET country='ID' WHERE country IS NULL
--   · UPDATE nex_community_zone SET country='ID' WHERE country IS NULL
--   · UPDATE nex_live_session   SET country='ID' WHERE country IS NULL
--   · UPDATE nex_report         SET country='ID' WHERE country IS NULL
--   · ADD COLUMN nex_account.primary_country text NULL  (owner CI-6)
--   · UPDATE nex_account.primary_country='ID' WHERE primary_country IS NULL
--
-- Why `'ID'` for every existing row:
--   100% of production-shaped data today was created under dev-impersonation
--   of Indonesian personas (nex-99901, nex-50001..nex-50024). No Irish-origin
--   records exist. Pre-backfill audit query runs first and confirms this
--   invariant OR raises an exception.
--
-- Dependencies:
--   · Requires Migration 244 (column exists). Guard refuses apply if the
--     column is missing.
--   · Must apply before 247 (semantic ordering: visibility only makes sense
--     after country exists).
--   · Must apply before 245 (RLS requires backfill complete).
--
-- Scope that this migration DOES NOT do:
--   · No NOT NULL constraint on country (deferred until 100% populated AND
--     the application has been updated to always set country at insert).
--   · No RLS install (that is Migration 245).
--   · No visibility column, moderation_status, age_rating (247/249/251).
--
-- Rollback: fully preserving. UPDATE country=NULL WHERE country='ID' + DROP
--   COLUMN nex_account.primary_country IF EXISTS. See Rollback section below.
--
-- Risk level: LOW (every change is reversible by a reverse UPDATE).
--
-- ============================================================================

BEGIN;

-- Apply guard · prevents accidental run without owner authorisation
DO $$
BEGIN
  RAISE EXCEPTION 'Migration 246 is DRAFT · requires explicit owner authorisation naming this file to apply. Comment out this guard block only when authorised.';
END $$;

-- ---------------------------------------------------------------------------
-- Pre-flight audit · fail fast if preconditions are not met
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  cnt bigint;
  foreign_rows bigint;
BEGIN
  -- 244 must have applied (column must exist)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'nex_business'
       AND column_name = 'country'
  ) THEN
    RAISE EXCEPTION 'Migration 246 refused: nex_business.country does not exist. Apply Migration 244 first.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'nex_community_zone'
       AND column_name = 'country'
  ) THEN
    RAISE EXCEPTION 'Migration 246 refused: nex_community_zone.country does not exist. Apply Migration 244 first.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'nex_live_session'
       AND column_name = 'country'
  ) THEN
    RAISE EXCEPTION 'Migration 246 refused: nex_live_session.country does not exist. Apply Migration 244 first.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'nex_report'
       AND column_name = 'country'
  ) THEN
    RAISE EXCEPTION 'Migration 246 refused: nex_report.country does not exist. Apply Migration 244 first.';
  END IF;

  -- Owner invariant: no non-ID country should exist pre-backfill. If any
  -- row already has a non-NULL non-'ID' country, STOP and ask the owner
  -- to confirm the backfill rule (there may be Irish-origin rows we did
  -- not account for).
  SELECT (
    (SELECT count(*) FROM public.nex_business       WHERE country IS NOT NULL AND country <> 'ID') +
    (SELECT count(*) FROM public.nex_community_zone WHERE country IS NOT NULL AND country <> 'ID') +
    (SELECT count(*) FROM public.nex_live_session   WHERE country IS NOT NULL AND country <> 'ID') +
    (SELECT count(*) FROM public.nex_report         WHERE country IS NOT NULL AND country <> 'ID')
  ) INTO foreign_rows;
  IF foreign_rows > 0 THEN
    RAISE EXCEPTION 'Migration 246 refused: % rows already have a non-NULL non-ID country value. The blanket ID backfill may misclassify them. Apply only with an explicit, owner-approved per-row mapping.',
      foreign_rows;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Backfill · 4 anchor tables
-- ---------------------------------------------------------------------------
UPDATE public.nex_business       SET country = 'ID' WHERE country IS NULL;
UPDATE public.nex_community_zone SET country = 'ID' WHERE country IS NULL;
UPDATE public.nex_live_session   SET country = 'ID' WHERE country IS NULL;
UPDATE public.nex_report         SET country = 'ID' WHERE country IS NULL;

-- ---------------------------------------------------------------------------
-- Account enrichment · primary_country (owner CI-6)
-- ---------------------------------------------------------------------------
ALTER TABLE public.nex_account
  ADD COLUMN IF NOT EXISTS primary_country text NULL;

COMMENT ON COLUMN public.nex_account.primary_country IS
  'ISO 3166-1 alpha-2 code · the account''s home country for discovery defaults, pricing display, support routing. Informational, NOT a security gate (CI-11: signup geo-detection is a hint only · user confirms). Nullable until confirmed by the account owner. Can be changed by the owner at any time.';

UPDATE public.nex_account
   SET primary_country = 'ID'
 WHERE primary_country IS NULL;

-- ---------------------------------------------------------------------------
-- Post-apply verification · zero-NULL invariant on anchors
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  remaining_null bigint;
BEGIN
  SELECT (
    (SELECT count(*) FROM public.nex_business       WHERE country IS NULL) +
    (SELECT count(*) FROM public.nex_community_zone WHERE country IS NULL) +
    (SELECT count(*) FROM public.nex_live_session   WHERE country IS NULL) +
    (SELECT count(*) FROM public.nex_report         WHERE country IS NULL)
  ) INTO remaining_null;
  IF remaining_null > 0 THEN
    RAISE EXCEPTION 'Migration 246 self-check failed: % anchor rows still have NULL country after backfill. Aborting.',
      remaining_null;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, applied_at)
VALUES (
  '246',
  'Backfill country=''ID'' on 4 anchor tables + add nex_account.primary_country (nullable) + backfill primary_country=''ID''.',
  now()
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- Rollback (not part of this migration; copy-paste if needed · fully preserving)
-- ---------------------------------------------------------------------------
-- BEGIN;
-- -- Reverse the backfill (preserves rows, just clears country values).
-- UPDATE public.nex_business       SET country = NULL WHERE country = 'ID';
-- UPDATE public.nex_community_zone SET country = NULL WHERE country = 'ID';
-- UPDATE public.nex_live_session   SET country = NULL WHERE country = 'ID';
-- UPDATE public.nex_report         SET country = NULL WHERE country = 'ID';
-- -- Drop account enrichment
-- UPDATE public.nex_account SET primary_country = NULL WHERE primary_country = 'ID';
-- ALTER TABLE public.nex_account DROP COLUMN IF EXISTS primary_country;
-- DELETE FROM public.nex_migration_history WHERE version = '246';
-- COMMIT;
--
-- Note: the UPDATE reversal above assumes all backfilled rows still have
-- country='ID'. If application code has set any country to another value
-- post-246, those rows will be preserved by the WHERE country='ID' filter.
--
-- Idempotency: re-running 246 on an already-backfilled DB is a no-op
-- (WHERE country IS NULL matches 0 rows).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Verification queries (run AFTER authorised apply)
-- ---------------------------------------------------------------------------
-- -- 1. All anchor rows have country populated
-- SELECT 'nex_business' AS t, count(*) AS total, count(*) FILTER (WHERE country IS NULL) AS null_rows FROM public.nex_business
-- UNION ALL SELECT 'nex_community_zone', count(*), count(*) FILTER (WHERE country IS NULL) FROM public.nex_community_zone
-- UNION ALL SELECT 'nex_live_session',   count(*), count(*) FILTER (WHERE country IS NULL) FROM public.nex_live_session
-- UNION ALL SELECT 'nex_report',         count(*), count(*) FILTER (WHERE country IS NULL) FROM public.nex_report;
-- -- Expected: 0 null_rows across all 4.
--
-- -- 2. nex_account enrichment
-- SELECT count(*) FILTER (WHERE primary_country IS NULL) AS null_rows,
--        count(*) FILTER (WHERE primary_country = 'ID') AS id_rows,
--        count(*) FILTER (WHERE primary_country <> 'ID') AS other_rows
--   FROM public.nex_account;
-- -- Expected: 0 null_rows, id_rows = total, 0 other_rows.
--
-- -- 3. Ledger
-- SELECT version, description, applied_at FROM public.nex_migration_history WHERE version='246';
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Positive / negative tests (external · to run against a sandbox)
-- ---------------------------------------------------------------------------
-- POS-T246-1 · Pre-apply: random `nex_business` row has country IS NULL.
--             Post-apply: same row has country='ID'. No row data lost.
-- POS-T246-2 · Pre-apply: `nex_account.primary_country` column does NOT exist.
--             Post-apply: column exists AND all rows have primary_country='ID'.
-- NEG-T246-3 · Apply with Migration 244 NOT applied (missing column) →
--             pre-flight DO block raises exception · no change.
-- NEG-T246-4 · Apply when non-ID country values already exist → pre-flight
--             DO block raises exception · no change.
-- NEG-T246-5 · Re-apply after successful apply → UPDATE … WHERE country IS NULL
--             matches 0 rows · idempotent. Ledger INSERT ON CONFLICT DO NOTHING.
-- ---------------------------------------------------------------------------
