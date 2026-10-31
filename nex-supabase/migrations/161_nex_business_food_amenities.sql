-- Migration 161 · nex_business food amenities
-- --------------------------------------------
-- Adds owner-declared food amenities so NEX Discover's food cards
-- can surface three signals that materially shift a buyer's decision
-- before tapping View menu / Chat with owner:
--
--   · cuisine_type       · one-word cuisine ("italian", "indonesian",
--                            "vegan", "warung"); drives a tag chip
--   · dietary_flags       · owner-declared accommodations: "halal",
--                            "vegetarian_options", "vegan_options",
--                            "kosher", "gluten_free_options"
--   · delivery_platforms  · third-party delivery coverage: "gofood",
--                            "grab", "shopee", "own" (self-delivery)
--
-- Rationale: the frozen chip row today only exposes delivery /
-- exports / COD / pickup / eat-in; buyers choosing a restaurant want
-- to know "italian?", "halal?", "gofood?" at a glance.
--
-- Rules enforced at schema level:
--   · cuisine_type        · nullable text · max 40 chars
--   · dietary_flags       · text[] default [] · max 10 entries ·
--                            each entry matches `^[a-z_]{2,40}$`
--   · delivery_platforms  · text[] default [] · max 6 entries ·
--                            each entry matches `^[a-z_]{2,30}$`
--
-- Status: DRAFT · founder authorisation required before applying to
-- `ijvqdvsvwtwxzcqmoqit`. Safe: additive, no backfill, no downtime.
--
-- Author: NEX Discover build, 2026-10-13
--
BEGIN;

ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS cuisine_type text
    CHECK (cuisine_type IS NULL OR (length(trim(cuisine_type)) BETWEEN 1 AND 40 AND cuisine_type ~ '^[a-z_]+$'));

ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS dietary_flags text[]
    NOT NULL DEFAULT ARRAY[]::text[]
    CHECK (array_length(dietary_flags, 1) IS NULL OR array_length(dietary_flags, 1) <= 10);

-- 2026-10-31 · dropped the per-element shape-validation CHECK for
-- dietary_flags (NOT EXISTS over unnest() is a subquery; Postgres
-- disallows subqueries in CHECK constraints). Element shape
-- (`^[a-z_]{2,40}$`) is enforced in the nex-business write path. The
-- array_length <= 10 cap above still applies via the scalar column
-- CHECK.

ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS delivery_platforms text[]
    NOT NULL DEFAULT ARRAY[]::text[]
    CHECK (array_length(delivery_platforms, 1) IS NULL OR array_length(delivery_platforms, 1) <= 6);

-- 2026-10-31 · dropped the per-element shape-validation CHECK for
-- delivery_platforms (same reason as dietary_flags above). The
-- array_length <= 6 cap still applies.

COMMENT ON COLUMN public.nex_business.cuisine_type IS
  'Owner-declared cuisine ("italian", "indonesian", "warung"). Shown as a tag chip on NEX Discover food cards. Added 2026-10-13 by migration 161.';
COMMENT ON COLUMN public.nex_business.dietary_flags IS
  'Owner-declared dietary accommodations ("halal", "vegetarian_options", etc.). Max 10 entries. Added 2026-10-13 by migration 161.';
COMMENT ON COLUMN public.nex_business.delivery_platforms IS
  'Third-party delivery coverage ("gofood", "grab", "own", etc.). Max 6 entries. Added 2026-10-13 by migration 161.';

COMMIT;
