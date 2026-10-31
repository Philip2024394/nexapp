-- ============================================================================
-- NEX-native Migration 244 · country column on country-owned tables
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised DRAFT only · DO NOT APPLY to the sealed Supabase project
-- `ijvqdvsvwtwxzcqmoqit` or any staging target without a SEPARATE explicit
-- owner authorisation. This migration is step 1 of 5 in the country
-- isolation plan at `docs/doctrine/nex-country-isolation-plan-2026-10-31.md`.
--
-- What this migration does:
--   · Adds `country text` NULLABLE column to each table classified as
--     COUNTRY-OWNED in the plan's §1 classification.
--   · No default value · no backfill · no NOT NULL constraint yet. Those
--     come in migrations 245 (backfill) and 246 (constraint).
--   · No RLS policies yet. Those come in migration 247.
--
-- Why nullable + no backfill in this step:
--   · Zero behavioural change on apply. All existing queries continue to
--     work exactly as today. The column exists but every row has NULL.
--   · Owner reviews data distribution and decides the backfill rule for
--     migration 245 (e.g. "assign all existing nex_business rows to
--     country='ID' because they were created under dev-impersonation of
--     Indonesian personas") BEFORE the constraint lands.
--   · Rollback is trivial: DROP COLUMN. Idempotent via IF NOT EXISTS.
--
-- Tables covered (per plan §1):
--   nex_business, nex_product, nex_product_ladder, nex_product_section,
--   nex_product_variant, nex_product_share_grant, nex_order, nex_order_event,
--   nex_cart, nex_liked_product, nex_buyer_tier_progress, nex_menu_item,
--   nex_menu_section, nex_service, nex_affiliate_account,
--   nex_affiliate_promotion, nex_banner, nex_live_session, nex_live_post,
--   nex_live_participation, nex_live_engagement, nex_live_featured_product,
--   nex_live_jail, nex_community_card, nex_community_card_confirmation,
--   nex_community_card_photo, nex_community_card_report,
--   nex_community_card_update, nex_community_business_welcome_detail,
--   nex_community_lost_found_detail, nex_community_notice,
--   nex_community_notice_confirmation, nex_community_notice_report,
--   nex_community_notice_update, nex_community_membership,
--   nex_community_rate_limit, nex_community_zone, nex_report
--
-- NOT COVERED (GLOBAL per plan §1): nex_account*, nex_music*, nex_chat*,
--   nex_peer*, nex_conversation*, nex_message, nex_call*, nex_group_call*,
--   nex_vault_*, nex_friend_*, nex_email_*, nex_vertical, nex_profession,
--   nex_color_palette, nex_handle_counter, nex_migration_history,
--   nex_session*, nex_sign_in_event, nex_welcome_outbox,
--   nex_bridge99_first_send_intent, nex_surface_health_event,
--   nex_collection_*, nex_generated_site, nex_generation_job,
--   nex_ledger_*, nex_uploaded_video, nex_gallery_image (REVISIT),
--   nex_theme_*, nex_webauthn_credential, nex_account_push_subscription,
--   nex_account_device_key, nex_account_risk_signal, nex_banner (REVISIT),
--   nex_creator_support_settings.
-- ============================================================================

BEGIN;

-- Helper · a tiny plpgsql block adds the column iff missing. Prefer this
-- over `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` so we can also attach
-- the comment in one block, and so a reader sees the full list in one
-- place.
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
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS country text NULL',
      tbl
    );
    EXECUTE format(
      $cmt$COMMENT ON COLUMN public.%I.country IS
        'NEX country isolation (migration 244 · 2026-10-31). NULL during Phase 244 · migration 246 adds NOT NULL + CHECK (country IN (''IE'',''ID'')). RLS gating added in migration 247. Deployments resolve country from NEX_APP_COUNTRY env.'
      $cmt$,
      tbl
    );
  END LOOP;
END $$;

-- --------------------------------------------------------------------
-- Migration ledger
-- --------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, notes)
VALUES (
  '244',
  'country text NULL column on 37 country-owned tables · no backfill · no constraint yet · zero behavioural change',
  'DRAFT 2026-10-31 · step 1/5 of country isolation plan. Requires separate owner authorisation to apply. See docs/doctrine/nex-country-isolation-plan-2026-10-31.md.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ----------------------------------------------------------------
-- Rollback (manual · trivial · zero data loss)
--   BEGIN;
--     DO $$
--     DECLARE tbls text[] := ARRAY[/* same list as above */]; tbl text;
--     BEGIN
--       FOREACH tbl IN ARRAY tbls LOOP
--         EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS country', tbl);
--       END LOOP;
--     END $$;
--     DELETE FROM public.nex_migration_history WHERE version = '244';
--   COMMIT;
-- ----------------------------------------------------------------
