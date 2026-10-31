-- ============================================================================
-- NEX Migration 244 (REISSUED) · country column on four anchor tables
-- ============================================================================
--
-- STATUS: DRAFT · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised preparation only (NEX OWNER DECISION — COUNTRY
-- CLASSIFICATION REVIEW, 2026-10-31). DO NOT APPLY to the sealed Supabase
-- project `ijvqdvsvwtwxzcqmoqit`, any staging target, or any local database
-- without a SEPARATE, specific owner authorisation that names this file.
--
-- This file SUPERSEDES the prior over-scoped 37-table draft now at
-- `244_nex_country_column.SUPERSEDED-REISSUED.sql`. The audit in
-- `docs/doctrine/nex-99-table-classification-2026-10-31.md` reduced the
-- scope: only 4 tables carry their OWN `country` column; the other ~32
-- country-owned tables inherit country at policy-evaluation time via FK
-- join (see `docs/doctrine/nex-country-isolation-review-package-2026-10-31.md`
-- §3).
--
-- What this migration does:
--   · Adds `country text` NULLABLE column to exactly four tables:
--       nex_business, nex_community_zone, nex_live_session, nex_report
--   · No default · no backfill · no NOT NULL constraint · no RLS change.
--   · Zero behavioural change on apply. All existing queries continue to
--     work exactly as today. The column exists but every row has NULL.
--
-- What this migration does NOT do (deferred to later migrations):
--   · Backfill existing rows               → Migration 246
--   · NOT NULL constraint                   → Migration 246 (post-backfill)
--   · Add RLS policies                      → Migration 245 (requires 246+247 first)
--   · Add visibility column or enum         → Migration 247
--   · Storage prefix policies               → Migration 248
--
-- Four-anchor rationale (full explanation in review package §3):
--   nex_business       — root commerce anchor · fixes the USING(true) gap
--   nex_community_zone — root community anchor · address-anchored zones
--   nex_live_session   — root live anchor · broadcaster-anchored
--   nex_report         — moderation jurisdiction · set to subject's country
--                        by the server action at insert time
--
-- Apply order (not filename order):
--   244 → 246 → 247 → 245 → 248
--   Each stage is a SEPARATE owner authorisation gate.
--
-- Rollback: trivial · DROP COLUMN IF EXISTS on each of the four tables.
--
-- ============================================================================

BEGIN;

-- Guard: prevent accidental apply with no explicit intent.
-- Comment out this line only when owner has authorised THIS specific file.
DO $$
BEGIN
  RAISE EXCEPTION 'Migration 244 is DRAFT · requires explicit owner authorisation naming this file to apply. Comment out this guard block only when authorised.';
END $$;

-- ---------------------------------------------------------------------------
-- Anchor A · nex_business
-- Root commerce anchor. 22 downstream tables inherit via FK.
-- ---------------------------------------------------------------------------
ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS country text NULL;

COMMENT ON COLUMN public.nex_business.country IS
  'ISO 3166-1 alpha-2 country code (e.g. ''IE'', ''ID''). Set by the server action at insert time to current_setting(''nex.app_country'',true). Immutable after insert (enforced in Migration 245 RLS UPDATE WITH CHECK). NULL only until Migration 246 backfills.';

-- ---------------------------------------------------------------------------
-- Anchor B · nex_community_zone
-- Root community anchor. 13 downstream tables inherit via FK.
-- ---------------------------------------------------------------------------
ALTER TABLE public.nex_community_zone
  ADD COLUMN IF NOT EXISTS country text NULL;

COMMENT ON COLUMN public.nex_community_zone.country IS
  'ISO 3166-1 alpha-2 country code derived from the zone''s geographic address. Set at zone-creation time. Immutable (RLS enforces).';

-- ---------------------------------------------------------------------------
-- Anchor C · nex_live_session
-- Root live anchor. 5 downstream live tables inherit via FK.
-- ---------------------------------------------------------------------------
ALTER TABLE public.nex_live_session
  ADD COLUMN IF NOT EXISTS country text NULL;

COMMENT ON COLUMN public.nex_live_session.country IS
  'ISO 3166-1 alpha-2 country code · the broadcaster''s country at session start. Set at session-create time. Immutable.';

-- ---------------------------------------------------------------------------
-- Anchor D · nex_report
-- Moderation jurisdiction = SUBJECT'S country (not reporter's).
-- The server action looks up the subject at insert time and writes `country`.
-- See review package §2.4 for the full access matrix.
-- ---------------------------------------------------------------------------
ALTER TABLE public.nex_report
  ADD COLUMN IF NOT EXISTS country text NULL;

COMMENT ON COLUMN public.nex_report.country IS
  'ISO 3166-1 alpha-2 country code = SUBJECT''S jurisdiction (not reporter''s). Set by the report-filing server action after a subject-country lookup. Drives HQ moderation routing. Reporter country is informational and NOT stored on this row.';

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, applied_at)
VALUES (
  '244',
  'Country column (nullable) on 4 anchor tables (nex_business, nex_community_zone, nex_live_session, nex_report). No backfill. No RLS. No behaviour change. Supersedes the over-scoped 37-table draft.',
  now()
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- Rollback (not part of this migration; copy-paste if needed)
-- ---------------------------------------------------------------------------
-- BEGIN;
--   ALTER TABLE public.nex_business       DROP COLUMN IF EXISTS country;
--   ALTER TABLE public.nex_community_zone DROP COLUMN IF EXISTS country;
--   ALTER TABLE public.nex_live_session   DROP COLUMN IF EXISTS country;
--   ALTER TABLE public.nex_report         DROP COLUMN IF EXISTS country;
--   DELETE FROM public.nex_migration_history WHERE version = '244';
-- COMMIT;

-- ---------------------------------------------------------------------------
-- Verification queries (run AFTER authorised apply)
-- ---------------------------------------------------------------------------
-- -- 1. Column exists on all 4 anchor tables, nullable, no default
-- SELECT table_name, column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_schema='public'
--    AND table_name IN ('nex_business','nex_community_zone','nex_live_session','nex_report')
--    AND column_name='country'
--  ORDER BY table_name;
--
-- -- 2. 100% NULL post-apply (backfill is Migration 246)
-- SELECT 'nex_business'       AS t, count(*) FILTER (WHERE country IS NULL) AS null_rows, count(*) FILTER (WHERE country IS NOT NULL) AS set_rows FROM public.nex_business
-- UNION ALL SELECT 'nex_community_zone', count(*) FILTER (WHERE country IS NULL), count(*) FILTER (WHERE country IS NOT NULL) FROM public.nex_community_zone
-- UNION ALL SELECT 'nex_live_session',   count(*) FILTER (WHERE country IS NULL), count(*) FILTER (WHERE country IS NOT NULL) FROM public.nex_live_session
-- UNION ALL SELECT 'nex_report',         count(*) FILTER (WHERE country IS NULL), count(*) FILTER (WHERE country IS NOT NULL) FROM public.nex_report;
--
-- -- 3. Ledger entry present
-- SELECT version, description, applied_at FROM public.nex_migration_history WHERE version='244';
