-- Migration 159 · nex_business_promo
-- -----------------------------------
-- Up to 3 active promos per nex_business · displayed on NEX Discover
-- cards as round circles overlaid on the right side of the cover
-- image. Tap a circle to open a bottom sheet with the promo banner,
-- description, and expiry countdown.
--
-- Rules enforced at the schema level:
--   · position in (1,2,3)                  — slot cap
--   · unique (business_id, position)       — one promo per slot
--   · expires_at > created_at              — never already-dead
--   · expires_at <= created_at + 14 days   — 14-day cap (urgency)
--
-- A business can "roll" a promo by updating the row (new title /
-- image / expiry) up to 14 days from now; expired rows filter out
-- naturally via `expires_at > now()` in the Discover read path.
--
-- Status: DRAFT · founder authorisation required before applying to
-- `ijvqdvsvwtwxzcqmoqit`. Safe: new table, no backfill, no downtime.
--
-- Author: NEX Discover build, 2026-10-13
--
BEGIN;

CREATE TABLE IF NOT EXISTS public.nex_business_promo (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES public.nex_business(id) ON DELETE CASCADE,
  position      smallint NOT NULL,
  title         text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 80),
  description   text CHECK (description IS NULL OR length(description) <= 400),
  image_url     text,
  background_hex text CHECK (background_hex IS NULL OR background_hex ~ '^#[0-9A-Fa-f]{6}$'),
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  CONSTRAINT nex_business_promo_position_range CHECK (position IN (1,2,3)),
  CONSTRAINT nex_business_promo_expiry_future CHECK (expires_at > created_at),
  CONSTRAINT nex_business_promo_expiry_cap CHECK (expires_at <= created_at + interval '14 days'),
  CONSTRAINT nex_business_promo_slot_unique UNIQUE (business_id, position)
);

-- 2026-10-31 · dropped `WHERE expires_at > now()` partial-index predicate.
-- Postgres requires index predicates to use IMMUTABLE functions only;
-- now() is STABLE. The app's actual query pattern never filtered on
-- expires_at at the DB layer anyway (see business-promo-service.ts
-- lines 78-84 · fetches all promos for business, filters client-side),
-- so a plain composite index on (business_id, expires_at) serves the
-- real workload identically. The partial-index optimisation was
-- aspirational and never engaged.
CREATE INDEX IF NOT EXISTS nex_business_promo_business_active_idx
  ON public.nex_business_promo (business_id, expires_at);

COMMENT ON TABLE public.nex_business_promo IS
  'Up to 3 time-boxed promos per business · displayed as round circles on NEX Discover cards. '
  'Capped at 14 days from created_at. Added 2026-10-13 by migration 159.';

COMMIT;
