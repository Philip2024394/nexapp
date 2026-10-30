-- ============================================================================
-- NEX-native Migration 239 · nex_product category reference
-- ============================================================================
-- Owner-authorised 2026-10-30 · Phase 1 of the owner-accepted Product System
-- Implementation Contract (sealed 2026-10-30, §K owner-resolved 15/15).
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE
-- Application requires separate CLAUDE.md §5 authorisation window.
--
-- Scope
-- -----
-- Adds department_id + category_id columns to nex_product so every product
-- has a known taxonomic home for:
--   · Shared Create flow (one route · one action · dispatches by category)
--   · Shop rendering (per-department badges, per-category spec presenters)
--   · Live Product Library filters
--   · NEX search directory cards
--
-- Taxonomy source of truth: src/lib/nex-native/catalogue/departments.ts
-- (sealed · 30 departments · 150+ nested categories).
--
-- Safety posture (per sealed contract §L)
-- ---------------------------------------
--   · Non-destructive · adds columns + indexes + constraint
--   · 143 live products + 44 drafts preserved · backfilled with safe
--     fallback (department_id='everything_else', category_id='other')
--     pending owner reclassification
--   · DEFAULT applied first, then NOT NULL enforced after backfill
--   · CHECK constraint validates against sealed 30-dept taxonomy
--
-- Rollback (not expected to be used · recorded for completeness)
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '239';
--     DROP INDEX IF EXISTS idx_nex_product_business_dept_live;
--     DROP INDEX IF EXISTS idx_nex_product_department_live;
--     ALTER TABLE nex_product DROP CONSTRAINT IF EXISTS nex_product_department_valid;
--     ALTER TABLE nex_product DROP COLUMN IF EXISTS category_id;
--     ALTER TABLE nex_product DROP COLUMN IF EXISTS department_id;
--   COMMIT;
-- ============================================================================

BEGIN;

-- 1 · Add columns with safe defaults so existing rows don't break
ALTER TABLE public.nex_product
  ADD COLUMN IF NOT EXISTS department_id text,
  ADD COLUMN IF NOT EXISTS category_id text;

-- 2 · Backfill existing rows (143 live + 44 drafts verified Phase 0 2026-10-30)
UPDATE public.nex_product
   SET department_id = COALESCE(department_id, 'everything_else'),
       category_id   = COALESCE(category_id, 'other')
 WHERE department_id IS NULL OR category_id IS NULL;

-- 3 · Enforce NOT NULL now that backfill is complete
ALTER TABLE public.nex_product
  ALTER COLUMN department_id SET NOT NULL,
  ALTER COLUMN category_id   SET NOT NULL;

-- 4 · CHECK constraint · department_id must match sealed 30-dept taxonomy
--     from src/lib/nex-native/catalogue/departments.ts + 'everything_else'
--     fallback for pre-Phase-1 rows and legitimate "other" uses.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_product_department_valid'
  ) THEN
    ALTER TABLE public.nex_product
      ADD CONSTRAINT nex_product_department_valid
        CHECK (department_id IN (
          'electronics_technology',
          'home_furniture_living',
          'kitchen_dining',
          'fashion_clothing',
          'jewellery_watches',
          'beauty_personal_care',
          'health_wellness_medical',
          'baby_nursery_parenting',
          'toys_games_hobbies',
          'sports_fitness_outdoors',
          'garden_outdoor_agriculture',
          'tools_diy_construction',
          'automotive_motorcycles_transport',
          'food_grocery_beverages',
          'pet_supplies_animals',
          'books_education_stationery',
          'office_business_industrial',
          'arts_crafts_handmade',
          'music_film_entertainment',
          'travel_luggage_outdoor',
          'digital_products_software',
          'accommodation_property',
          'food_delivery_restaurants',
          'services_marketplace',
          'experiences_activities_tickets',
          'second_hand_refurbished',
          'luxury_premium_collectibles',
          'gifts_celebrations_seasonal',
          'renewable_energy_utilities',
          'everything_else'
        ));
  END IF;
END $$;

-- 5 · Index for Shop + Live + Directory queries that filter by department
--     among live products. Partial index keeps it small; most queries read
--     only live rows.
CREATE INDEX IF NOT EXISTS idx_nex_product_department_live
  ON public.nex_product (department_id, status)
  WHERE status = 'live';

-- 6 · Index for business-scoped department queries (Shop grid + Live Library)
CREATE INDEX IF NOT EXISTS idx_nex_product_business_dept_live
  ON public.nex_product (business_id, department_id, status)
  WHERE status = 'live';

INSERT INTO public.nex_migration_history (version, description, notes)
  VALUES (
    '239',
    'nex_product category reference · department_id + category_id',
    'Phase 1 Product System · owner-accepted 2026-10-30 · 143 live + 44 draft rows backfilled to everything_else/other pending owner reclassification · CHECK enforces sealed 30-dept taxonomy · partial indexes support Shop/Live/Directory queries.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
