-- ============================================================================
-- NEX-native Migration 281 · Starter Pack quota columns
-- ============================================================================
-- Owner-authorised 2026-11-05 iter 29 · Ship B3b · DRAFT · NOT YET APPLIED.
-- Requires separate owner authorisation per CLAUDE.md §5 before running
-- against Supabase project ijvqdvsvwtwxzcqmoqit.
--
-- Adds a lightweight "quota top-up" counter to nex_account for the one-time
-- Starter Pack (€5 · +10 product listings · 60-day window). Intentionally
-- NOT modelled as a subscription (257/258's shop_tier/shop_status
-- machinery doesn't fit a one-time pack · a separate parallel model is
-- cheaper + clearer).
--
-- Columns:
--   starter_pack_quota_remaining  · int · default 0 · how many product
--                                   slots remain from the most recent
--                                   purchased pack. Decremented on each
--                                   nex_product insert that uses the
--                                   top-up (after the sealed Gratis
--                                   10-cap is exhausted).
--   starter_pack_expires_at       · timestamptz · default null · when
--                                   the current quota goes stale (60
--                                   days after purchase). tier-gate.ts
--                                   treats quota=0 OR expired as equivalent.
--   starter_pack_purchased_at     · timestamptz · default null · set to
--                                   now() on successful one-time Stripe
--                                   checkout.session.completed · used by
--                                   admin surfaces + the receipt page.
--
-- Rules (enforced in app code, not SQL):
--   · A second Starter Pack purchase REPLACES the first (quota resets to 10,
--     expires_at resets to now+60d). Simple · avoids stacking math.
--   · On tier upgrade to Shop (standard/unlimited) the quota becomes
--     irrelevant · Shop is unlimited.
--
-- RLS: inherits sealed nex_account RLS. The new columns are readable by
-- the owner · writeable only by the service-role backend (webhook handler
-- + tier-gate consumption).
--
-- Prerequisites: 046, 207, 224, 257, 258.

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(281000001);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '281') THEN
    RAISE EXCEPTION 'Migration 281 already recorded. Aborting.';
  END IF;
  FOR v IN SELECT unnest(ARRAY['046','207','224','257','258']) LOOP
    IF NOT EXISTS (SELECT 1 FROM nex_migration_history WHERE version = v) THEN
      RAISE EXCEPTION 'Prerequisite migration % missing.', v;
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.nex_account
  ADD COLUMN IF NOT EXISTS starter_pack_quota_remaining integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS starter_pack_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS starter_pack_purchased_at timestamptz;

-- Partial index · optimises the tier-gate check that asks "does this
-- account have a usable pack right now?" at product-creation time.
CREATE INDEX IF NOT EXISTS idx_nex_account_starter_pack_active
  ON public.nex_account (starter_pack_expires_at)
  WHERE starter_pack_quota_remaining > 0 AND starter_pack_expires_at IS NOT NULL;

COMMENT ON COLUMN public.nex_account.starter_pack_quota_remaining IS
  'Owner directive 2026-11-05 · Starter Pack · remaining product-listing slots from most recent purchase · decremented after sealed Gratis cap exhausted · reset to 10 on each new pack purchase.';
COMMENT ON COLUMN public.nex_account.starter_pack_expires_at IS
  'Owner directive 2026-11-05 · Starter Pack · when current pack goes stale (60 days after purchase) · quota treated as 0 past this timestamp.';
COMMENT ON COLUMN public.nex_account.starter_pack_purchased_at IS
  'Owner directive 2026-11-05 · Starter Pack · timestamp of most recent successful one-time purchase · used by admin + receipt surfaces.';

INSERT INTO nex_migration_history (version, applied_at, description, notes)
VALUES (
  '281',
  NOW(),
  'nex_account · Starter Pack quota columns · 3 nullable cols + 1 partial index',
  'Owner-authorised 2026-11-05 · Ship B3b · DRAFT until explicit application auth · supports the €5 one-time +10-product Starter Pack parallel to sealed shop_tier subscription model'
);

COMMIT;
