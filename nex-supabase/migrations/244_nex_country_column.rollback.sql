-- ============================================================================
-- NEX Migration 244 · GUARDED ROLLBACK (companion file · not an apply)
-- ============================================================================
--
-- STATUS: DRAFT · NOT AN APPLY · NOT TO BE RUN WITHOUT A SEPARATE EXPLICIT
-- OWNER AUTHORISATION THAT NAMES THIS FILE.
--
-- Purpose:
--   The rollback for Migration 244 is NOT trivially `DROP COLUMN` once
--   Migration 246 has backfilled the `country` columns on the four anchor
--   tables. Dropping those columns at that point DESTROYS the country
--   assignments and makes every row re-assignable only by inference. This
--   file provides a two-phase rollback with a safety guard between phases.
--
-- Phases:
--   Phase 1 · READ-ONLY SAFETY CHECK (always permitted)
--       Counts non-NULL country values across the four anchor tables.
--       If ANY row has `country IS NOT NULL`, Phase 2 is REFUSED.
--
--   Phase 2A · DESTRUCTIVE ROLLBACK (requires owner authorisation naming
--       this file AND explicit `set app.allow_244_destructive_rollback`)
--       Only permitted when every row still has `country IS NULL`
--       (i.e. 246 has not yet applied).
--
--   Phase 2B · DATA-PRESERVING ROLLBACK PATH
--       If data exists, the rollback instead EXPORTS the current (id,
--       country) pairs into a snapshot table `nex_country_rollback_244`
--       (owned by service_role · RLS-locked to HQ) and then performs
--       the column drop. The snapshot can be used to restore column
--       values if 244 is re-applied.
--
-- Owner authorisation model (explicit · do not infer):
--   · "Prepare rollback" ≠ "Run rollback". Draft presence here is NOT
--     authorisation.
--   · "Run Phase 1" is read-only, safe to run any time.
--   · "Run Phase 2A" requires owner to name this file AND run
--     `SET LOCAL app.allow_244_destructive_rollback = 'yes-i-have-no-data'`
--     before the DROP COLUMN block.
--   · "Run Phase 2B" requires owner to name this file AND run
--     `SET LOCAL app.allow_244_preserving_rollback = 'yes-snapshot-first'`
--     before the DROP COLUMN block.
--
-- Why two phases:
--   A single-phase DROP COLUMN with no guard is destructive by default.
--   Postgres happily accepts `DROP COLUMN country` even when 100% of rows
--   have populated country values. The two-phase design makes it impossible
--   to accidentally delete country assignments.
--
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Phase 1 · READ-ONLY SAFETY CHECK (always permitted)
-- ---------------------------------------------------------------------------
-- Run this standalone to see what rolling back would destroy.

BEGIN;

SELECT 'nex_business'       AS t,
       count(*)                                       AS total_rows,
       count(*) FILTER (WHERE country IS NULL)        AS null_country,
       count(*) FILTER (WHERE country IS NOT NULL)    AS populated_country,
       array_agg(DISTINCT country) FILTER (WHERE country IS NOT NULL) AS country_values
  FROM public.nex_business
UNION ALL
SELECT 'nex_community_zone', count(*),
       count(*) FILTER (WHERE country IS NULL),
       count(*) FILTER (WHERE country IS NOT NULL),
       array_agg(DISTINCT country) FILTER (WHERE country IS NOT NULL)
  FROM public.nex_community_zone
UNION ALL
SELECT 'nex_live_session', count(*),
       count(*) FILTER (WHERE country IS NULL),
       count(*) FILTER (WHERE country IS NOT NULL),
       array_agg(DISTINCT country) FILTER (WHERE country IS NOT NULL)
  FROM public.nex_live_session
UNION ALL
SELECT 'nex_report', count(*),
       count(*) FILTER (WHERE country IS NULL),
       count(*) FILTER (WHERE country IS NOT NULL),
       array_agg(DISTINCT country) FILTER (WHERE country IS NOT NULL)
  FROM public.nex_report;

-- Interpretation:
--   · all `populated_country = 0`     → Migration 246 has not applied yet
--                                       (or 244 has not applied yet) → Phase 2A
--                                       destructive rollback is safe.
--   · any `populated_country > 0`     → Migration 246 (or ad-hoc inserts)
--                                       populated country values → Phase 2A
--                                       is REFUSED → must use Phase 2B
--                                       (snapshot + drop).

ROLLBACK;  -- Phase 1 is read-only · never COMMIT.


-- ---------------------------------------------------------------------------
-- Phase 2A · DESTRUCTIVE ROLLBACK (only when no data exists)
-- ---------------------------------------------------------------------------
-- This block REFUSES to run unless:
--   (1) The custom setting `app.allow_244_destructive_rollback` equals
--       the exact string `'yes-i-have-no-data'`.
--   (2) The four anchor tables all have 0 non-NULL country values.
--
-- Both conditions must hold. The owner authorisation signal is BOTH:
--   · Owner names this file in writing, AND
--   · Owner (or the operator) sets the custom setting via SQL before run.
--
-- To run (only after owner authorisation):
--
--   BEGIN;
--   SET LOCAL app.allow_244_destructive_rollback = 'yes-i-have-no-data';
--   -- then paste the DO $$ block below
--   -- (COMMIT only if the DO block succeeded)
--
-- Do NOT un-comment the block to run from a shell by default.

/*
BEGIN;
SET LOCAL app.allow_244_destructive_rollback = 'yes-i-have-no-data';

DO $$
DECLARE
  guard_setting text;
  populated_count bigint;
BEGIN
  -- Guard 1 · explicit permission string
  guard_setting := current_setting('app.allow_244_destructive_rollback', true);
  IF guard_setting IS DISTINCT FROM 'yes-i-have-no-data' THEN
    RAISE EXCEPTION
      'Migration 244 destructive rollback REFUSED · setting app.allow_244_destructive_rollback is % · must equal literal ''yes-i-have-no-data''',
      coalesce(guard_setting, '<unset>');
  END IF;

  -- Guard 2 · no populated country values across the four anchors
  SELECT (
    (SELECT count(*) FROM public.nex_business       WHERE country IS NOT NULL) +
    (SELECT count(*) FROM public.nex_community_zone WHERE country IS NOT NULL) +
    (SELECT count(*) FROM public.nex_live_session   WHERE country IS NOT NULL) +
    (SELECT count(*) FROM public.nex_report         WHERE country IS NOT NULL)
  ) INTO populated_count;

  IF populated_count > 0 THEN
    RAISE EXCEPTION
      'Migration 244 destructive rollback REFUSED · % populated country rows exist across the four anchor tables · use Phase 2B (preserving) or delete the data first with explicit authorisation',
      populated_count;
  END IF;

  -- Both guards passed.
  ALTER TABLE public.nex_business       DROP COLUMN IF EXISTS country;
  ALTER TABLE public.nex_community_zone DROP COLUMN IF EXISTS country;
  ALTER TABLE public.nex_live_session   DROP COLUMN IF EXISTS country;
  ALTER TABLE public.nex_report         DROP COLUMN IF EXISTS country;

  DELETE FROM public.nex_migration_history WHERE version = '244';
  RAISE NOTICE 'Migration 244 destructive rollback applied · 0 populated rows at the time of drop.';
END $$;

COMMIT;
*/


-- ---------------------------------------------------------------------------
-- Phase 2B · DATA-PRESERVING ROLLBACK (populated rows snapshotted first)
-- ---------------------------------------------------------------------------
-- When Phase 2A is refused because data exists, this path:
--   1. Creates `public.nex_country_rollback_244` snapshot table
--   2. Copies (anchor_table, row_id, country) tuples into it
--   3. Then drops the country columns
--
-- The snapshot can be used to restore column values on a future re-apply
-- of 244.
--
-- Owner authorisation signal is BOTH:
--   · Owner names this file in writing, AND
--   · The operator sets `app.allow_244_preserving_rollback = 'yes-snapshot-first'`
--     before running the DO block.

/*
BEGIN;
SET LOCAL app.allow_244_preserving_rollback = 'yes-snapshot-first';

DO $$
DECLARE
  guard_setting text;
BEGIN
  guard_setting := current_setting('app.allow_244_preserving_rollback', true);
  IF guard_setting IS DISTINCT FROM 'yes-snapshot-first' THEN
    RAISE EXCEPTION
      'Migration 244 preserving rollback REFUSED · setting app.allow_244_preserving_rollback is % · must equal literal ''yes-snapshot-first''',
      coalesce(guard_setting, '<unset>');
  END IF;

  -- Snapshot table (service_role-only · RLS-locked)
  CREATE TABLE IF NOT EXISTS public.nex_country_rollback_244 (
    anchor_table text        NOT NULL,
    row_id       uuid        NOT NULL,
    country      text        NOT NULL,
    snapshot_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (anchor_table, row_id)
  );
  ALTER TABLE public.nex_country_rollback_244 ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.nex_country_rollback_244 FORCE ROW LEVEL SECURITY;
  -- No policies · service_role bypasses · no authenticated access.

  INSERT INTO public.nex_country_rollback_244 (anchor_table, row_id, country)
  SELECT 'nex_business', id, country FROM public.nex_business WHERE country IS NOT NULL
  UNION ALL
  SELECT 'nex_community_zone', id, country FROM public.nex_community_zone WHERE country IS NOT NULL
  UNION ALL
  SELECT 'nex_live_session', id, country FROM public.nex_live_session WHERE country IS NOT NULL
  UNION ALL
  SELECT 'nex_report', id, country FROM public.nex_report WHERE country IS NOT NULL
  ON CONFLICT (anchor_table, row_id) DO NOTHING;

  -- Drop the columns
  ALTER TABLE public.nex_business       DROP COLUMN IF EXISTS country;
  ALTER TABLE public.nex_community_zone DROP COLUMN IF EXISTS country;
  ALTER TABLE public.nex_live_session   DROP COLUMN IF EXISTS country;
  ALTER TABLE public.nex_report         DROP COLUMN IF EXISTS country;

  DELETE FROM public.nex_migration_history WHERE version = '244';
  RAISE NOTICE 'Migration 244 preserving rollback applied · snapshot in nex_country_rollback_244 for forward recovery.';
END $$;

COMMIT;
*/

-- ---------------------------------------------------------------------------
-- Forward recovery (after a preserving rollback)
-- ---------------------------------------------------------------------------
-- To restore country values after re-applying Migration 244:
--
--   UPDATE public.nex_business b
--      SET country = r.country
--     FROM public.nex_country_rollback_244 r
--    WHERE r.anchor_table = 'nex_business' AND r.row_id = b.id;
--   -- repeat for each anchor table.
--
-- The snapshot table itself remains · drop it only after owner confirms
-- the restore and after a visible retention window has passed.
