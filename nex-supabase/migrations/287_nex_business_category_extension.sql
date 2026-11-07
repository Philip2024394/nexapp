-- 287_nex_business_category_extension.sql
-- -----------------------------------------------------------------------------
-- NEX Shop · migration 065 CHECK extension · owner-sealed 2026-11-07.
--
-- STATUS: AUTHORED · NOT YET APPLIED. Owner directive 2026-11-07
-- authorises preparation + review only; a separate explicit
-- application authorisation is required before this migration
-- touches any database.
--
-- Rationale:
--   Migration 065 locked nex_business.business_category to 19 slugs.
--   Code-side `NEX_BUSINESS_CATEGORIES` (src/lib/nex-native/site-
--   templates.ts) has 23. The 4 drift slugs (ice-cream, dessert-shop,
--   drinks-shop, juice-bar) exist in code and in Directory tile
--   mappings (landing-category-mapping.ts FOOD array) but any write
--   to the column with those values fails Postgres' CHECK constraint.
--
--   Phase B (Rev 6 restoration) 2026-11-07 added ice_cream,
--   dessert_shop, juice_bar as canonical Rev 6 subtypes with 1:1
--   legacy mirrors to those 4 drift slugs. The mirror writer
--   degrades gracefully pre-migration (dropping the legacy column
--   write while keeping the profile JSONB write), but Directory
--   tiling for the new food subtypes stays silent until this
--   migration lands.
--
-- Shape of change:
--   · DROP + re-ADD nex_business_category_check with the 4 drift
--     slugs appended to the IN list (now 23 total).
--   · No data change · no backfill · existing rows keep their slug.
--   · Fully additive · existing writers are unaffected.
--
-- After apply:
--   · Writers can persist business_category = 'ice-cream', 'dessert-
--     shop', 'drinks-shop', 'juice-bar' without triggering the CHECK.
--   · Directory FOOD tile surfaces shops carrying those slugs.
--   · setBusinessPrimaryProfile mirror no longer has to retry-
--     without-mirror for the 4 new food subtypes.

begin;

alter table nex_business
  drop constraint if exists nex_business_category_check;

alter table nex_business
  add constraint nex_business_category_check
  check (
    business_category is null
    or business_category in (
      'bakery',
      'restaurant',
      'cafe',
      'tradesperson',
      'construction',
      'staircase-company',
      'salon',
      'beauty',
      'fitness',
      'consultant',
      'agency',
      'ecommerce',
      'product-brand',
      'local-service',
      'portfolio',
      'community',
      'event',
      'creator',
      'professional-service',
      -- Phase B drift fix · owner-sealed 2026-11-07
      'ice-cream',
      'dessert-shop',
      'drinks-shop',
      'juice-bar'
    )
  );

comment on column nex_business.business_category is
  'Vertical of the shop · one of the 23 NEX_BUSINESS_CATEGORIES values
   (Phase B · 2026-11-07 extends from 19 → 23 to clear code/DB drift).
   NULL = uncategorised · Directory shows in a general bucket. Keep
   in sync with src/lib/nex-native/site-templates.ts
   NEX_BUSINESS_CATEGORIES.';

insert into nex_migration_history (version, description, notes)
  values (
    '287',
    'Phase B drift fix · nex_business_category_check extended to 23 slugs',
    'Owner-sealed 2026-11-07. Fixes the latent 19 vs 23 drift between migration 065 CHECK and NEX_BUSINESS_CATEGORIES. Unblocks mirror writes for ice_cream, dessert_shop, drinks, juice_bar Rev 6 subtypes → Directory FOOD tile.'
  )
  on conflict (version) do nothing;

commit;
