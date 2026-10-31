-- ============================================================================
-- NEX-native Migration 245 · country-aware RLS policies
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised DRAFT only · DO NOT APPLY · requires separate authorisation.
-- Step 4 of 5 in `docs/doctrine/nex-country-isolation-plan-2026-10-31.md`.
--
-- Prerequisite order:
--   244 country text NULL column          · APPLY FIRST
--   (interim · backfill existing rows)    · owner-chosen SQL · OUT OF SCOPE here
--   (interim · ALTER COLUMN NOT NULL)     · owner-authorised separate migration
--   245 country-aware RLS policies        · THIS FILE
--
-- Why order matters: these RLS policies compare the row's `country` to
-- `current_setting('nex.app_country')`. If any row still has `country IS
-- NULL` when 245 applies, that row is effectively hidden from every
-- deployment · which is the correct fail-closed behaviour but means the
-- backfill MUST complete before 245 lands or data appears to vanish.
--
-- Deployment contract (per plan §2):
--   · Ireland  deployment: NEX_APP_COUNTRY=IE · sets nex.app_country='IE' per request
--   · Indonesia deployment: NEX_APP_COUNTRY=ID · sets nex.app_country='ID' per request
--   · HQ deployment: NEX_APP_IDENTITY=hq · uses service_role · bypasses RLS
--
-- Fail-closed semantics (hard requirement from plan §2):
--   · If `current_setting('nex.app_country', true)` returns NULL or empty,
--     every policy's USING clause evaluates to false · all rows denied.
--   · This prevents a mis-deployed app that forgot to set the setting
--     from accidentally serving the full dataset.
--
-- Public discovery (cross-country) · adds SEPARATE policy where applicable:
--   · nex_business where is_published AND visibility='public' → readable
--     from any deployment regardless of country
--   · (RLS policies combine with OR · so a row visible to both is granted)
-- ============================================================================

BEGIN;

-- Shared boilerplate · a tiny plpgsql block creates the four standard
-- policies (SELECT/INSERT/UPDATE/DELETE) for each listed table using the
-- same template. Owner-only review item: this template deliberately
-- rejects empty-string setting as well as NULL · the empty default we
-- set at database level in the setup command.

DO $$
DECLARE
  tbls text[] := ARRAY[
    'nex_business',
    'nex_product',
    'nex_product_ladder',
    'nex_product_section',
    'nex_product_variant',
    'nex_product_share_grant',
    'nex_order',
    'nex_order_event',
    'nex_cart',
    'nex_liked_product',
    'nex_buyer_tier_progress',
    'nex_menu_item',
    'nex_menu_section',
    'nex_service',
    'nex_affiliate_account',
    'nex_affiliate_promotion',
    'nex_banner',
    'nex_live_session',
    'nex_live_post',
    'nex_live_participation',
    'nex_live_engagement',
    'nex_live_featured_product',
    'nex_live_jail',
    'nex_community_card',
    'nex_community_card_confirmation',
    'nex_community_card_photo',
    'nex_community_card_report',
    'nex_community_card_update',
    'nex_community_business_welcome_detail',
    'nex_community_lost_found_detail',
    'nex_community_notice',
    'nex_community_notice_confirmation',
    'nex_community_notice_report',
    'nex_community_notice_update',
    'nex_community_membership',
    'nex_community_rate_limit',
    'nex_community_zone',
    'nex_report'
  ];
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    -- Enable RLS (idempotent · no-op when already enabled)
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- Drop existing country policies to make this migration idempotent
    EXECUTE format('DROP POLICY IF EXISTS %I_country_select ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_country_insert ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_country_update ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_country_delete ON public.%I', tbl, tbl);

    -- SELECT · country match · fail-closed on NULL / empty setting
    EXECUTE format($pol$
      CREATE POLICY %I_country_select
        ON public.%I
        FOR SELECT
        TO authenticated
        USING (
          current_setting('nex.app_country', true) IS NOT NULL
          AND current_setting('nex.app_country', true) <> ''
          AND country = current_setting('nex.app_country', true)
        )
    $pol$, tbl, tbl);

    -- INSERT · WITH CHECK · reject payload with country ≠ setting
    EXECUTE format($pol$
      CREATE POLICY %I_country_insert
        ON public.%I
        FOR INSERT
        TO authenticated
        WITH CHECK (
          current_setting('nex.app_country', true) IS NOT NULL
          AND current_setting('nex.app_country', true) <> ''
          AND country = current_setting('nex.app_country', true)
        )
    $pol$, tbl, tbl);

    -- UPDATE · both USING + WITH CHECK · country immutable through this gate
    EXECUTE format($pol$
      CREATE POLICY %I_country_update
        ON public.%I
        FOR UPDATE
        TO authenticated
        USING (
          current_setting('nex.app_country', true) IS NOT NULL
          AND current_setting('nex.app_country', true) <> ''
          AND country = current_setting('nex.app_country', true)
        )
        WITH CHECK (
          country = current_setting('nex.app_country', true)
        )
    $pol$, tbl, tbl);

    -- DELETE
    EXECUTE format($pol$
      CREATE POLICY %I_country_delete
        ON public.%I
        FOR DELETE
        TO authenticated
        USING (
          current_setting('nex.app_country', true) IS NOT NULL
          AND current_setting('nex.app_country', true) <> ''
          AND country = current_setting('nex.app_country', true)
        )
    $pol$, tbl, tbl);
  END LOOP;
END $$;

-- --------------------------------------------------------------------
-- Public-discovery exceptions · published businesses + products readable
-- cross-country. Combines with the country policies via standard PG RLS
-- OR semantics.
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS nex_business_public_discovery ON public.nex_business;
-- Only apply if the referenced columns exist · defensive guard
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nex_business'
      AND column_name IN ('is_published','visibility')
    GROUP BY table_name
    HAVING count(*) >= 2
  ) THEN
    EXECUTE $pol$
      CREATE POLICY nex_business_public_discovery
        ON public.nex_business
        FOR SELECT
        TO authenticated
        USING (is_published = true AND visibility = 'public')
    $pol$;
  END IF;
END $$;

-- --------------------------------------------------------------------
-- Migration ledger
-- --------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, notes)
VALUES (
  '245',
  'country-aware RLS policies on 37 country-owned tables · fail-closed on NULL/empty setting · service_role bypasses for HQ · public-discovery exception for published businesses',
  'DRAFT 2026-10-31 · step 4/5 of country isolation plan. Requires backfill + NOT NULL constraint migration to run FIRST. See docs/doctrine/nex-country-isolation-plan-2026-10-31.md.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ----------------------------------------------------------------
-- Rollback (manual · drops all 37 × 4 country policies + the public
-- discovery policy. Does NOT drop the country column. Does NOT undo
-- the backfill.)
--   BEGIN;
--     DO $$ DECLARE tbls text[] := ARRAY[/* same list as above */]; tbl text;
--     BEGIN
--       FOREACH tbl IN ARRAY tbls LOOP
--         EXECUTE format('DROP POLICY IF EXISTS %I_country_select ON public.%I', tbl, tbl);
--         EXECUTE format('DROP POLICY IF EXISTS %I_country_insert ON public.%I', tbl, tbl);
--         EXECUTE format('DROP POLICY IF EXISTS %I_country_update ON public.%I', tbl, tbl);
--         EXECUTE format('DROP POLICY IF EXISTS %I_country_delete ON public.%I', tbl, tbl);
--       END LOOP;
--     END $$;
--     DROP POLICY IF EXISTS nex_business_public_discovery ON public.nex_business;
--     DELETE FROM public.nex_migration_history WHERE version = '245';
--   COMMIT;
-- ----------------------------------------------------------------
