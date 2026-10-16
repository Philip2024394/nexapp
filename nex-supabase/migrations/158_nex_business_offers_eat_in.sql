-- Migration 158 · nex_business.offers_eat_in
-- --------------------------------------------
-- Adds a nullable boolean column so food-category businesses
-- (restaurant / cafe / bakery / etc.) can declare whether they
-- offer eat-in service in addition to delivery / pickup.
--
-- Consumed by NEX Discover's shop-card chip row
-- (`src/app/nex-native/search/_business-chips.tsx`) which renders
-- the "🍽 Eat-in" chip ONLY when `offers_eat_in = true` AND the
-- business_category is in the sealed food set. Honest-null: when
-- unset (default false) the chip is not shown.
--
-- Safe to apply · pure additive · zero backfill required · no
-- downtime window needed.
--
-- Status: DRAFT · founder authorisation required before executing
-- against `ijvqdvsvwtwxzcqmoqit`. Does NOT need an offline window.
--
-- Author: NEX Discover build, 2026-10-13
--
BEGIN;

ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS offers_eat_in boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.nex_business.offers_eat_in IS
  'Owner-declared: this business offers eat-in / dine-in service. '
  'Rendered as a "🍽 Eat-in" chip on NEX Discover cards for food '
  'businesses (restaurant / cafe / bakery / ice-cream / dessert-shop '
  '/ drinks-shop / juice-bar). Added 2026-10-13 by migration 158.';

COMMIT;
