-- nex-supabase/migrations/310_nex_account_shop_tier_add_shop.sql
--
-- NEX Shop tier vocabulary extension · owner-authorised 2026-11-08
-- Round 30.
-- -----------------------------------------------------------------------------
-- WHY
--
-- The sealed 2026-11-06 Scope Reduction collapsed the 3-tier Shop model
-- into a single Shop package. Migration 257 (sealed 2026-11-02) added
-- the shop_tier column with CHECK (shop_tier IS NULL OR shop_tier IN
-- ('standard','unlimited')) for the 3-tier design. The commercial
-- entitlement + round 29h/29i checkout wiring operate on the single
-- 'shop' tier.
--
-- Three paths were available (per Round 30 audit):
--   A. Rewrite migration 257's CHECK to only allow 'shop' (destructive ·
--      breaks any pre-existing rows written under 'standard'/'unlimited')
--   B. Add 'shop' to the existing enum (preserves backwards compat with
--      historical rows · new subscriptions write 'shop')
--   C. Drop the CHECK entirely (unsafe · fail-closed discipline broken)
--
-- 310 implements PATH B · the least-destructive reconciliation.
--
-- WHAT 310 DOES
--   Drops the current shop_tier CHECK and recreates it to allow
--   ('shop','standard','unlimited').  No data is altered. Safe to
--   re-apply.
--
-- NOT CHANGED BY 310
--   · Migration 257's shop_tier column definition (still TEXT, still
--     indexed, still nullable).
--   · The vault_tier CHECK (still 'gratis','5gb','25gb','50gb','100gb').
--   · Any RLS policies.
--
-- Apply discipline (same pattern as 306/307/308/309):
--   · SANDBOX apply only via `scripts/apply-migration-310-sandbox.mjs`
--     (hard ref-check refusing production `ijvqdvsvwtwxzcqmoqit`).
--   · PRODUCTION apply requires separate owner authorisation.

BEGIN;

-- Amended 2026-11-09 Round 33 · owner-authorised self-sufficient apply.
-- Originally this migration refused when migration 257 hadn't been
-- applied to the target (sandbox was missing mig 257 per CLAUDE.md §5).
-- To unblock the NEX subscription webhook work · the migration now
-- adds the shop_tier column if it doesn't exist (mirroring mig 257's
-- column shape) · then sets the sealed 2026-11-08 single-tier CHECK.
-- Safe to re-apply on environments where 257 already added the column ·
-- the ADD COLUMN IF NOT EXISTS is idempotent.
ALTER TABLE public.nex_account
  ADD COLUMN IF NOT EXISTS shop_tier text;

-- Add an index on shop_tier if it doesn't exist (mirrors mig 257's
-- indexing intent for tier filter queries).
CREATE INDEX IF NOT EXISTS idx_nex_account_shop_tier
  ON public.nex_account (shop_tier)
  WHERE shop_tier IS NOT NULL;

ALTER TABLE public.nex_account
  DROP CONSTRAINT IF EXISTS nex_account_shop_tier_check;

ALTER TABLE public.nex_account
  ADD CONSTRAINT nex_account_shop_tier_check
  CHECK (
    shop_tier IS NULL
    OR shop_tier IN (
      -- Owner-sealed 2026-11-08 single Shop package (round 29 commercial
      -- model) · all new subscriptions write 'shop'.
      'shop',
      -- Historical 3-tier values grandfathered so rows written under
      -- migration 257's original CHECK remain valid.
      'standard',
      'unlimited'
    )
  );

COMMENT ON COLUMN public.nex_account.shop_tier IS
  'NEX Shop subscription tier · canonical new value is ''shop'' (owner-sealed 2026-11-08 single package) · ''standard'' and ''unlimited'' grandfathered for pre-reduction rows. Set/cleared by Stripe webhook events.';

-- Migration history · consistent with migrations 304-309.
INSERT INTO public.nex_migration_history (version, description)
  VALUES ('310', 'nex_account.shop_tier CHECK extended to include ''shop'' (sealed single-package tier) + ''standard''/''unlimited'' grandfathered')
  ON CONFLICT (version) DO NOTHING;

COMMIT;
