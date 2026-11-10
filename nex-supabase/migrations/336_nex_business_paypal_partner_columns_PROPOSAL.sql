-- ============================================================================
-- NEX-native Migration 336 · nex_business · PayPal Partner columns
-- ============================================================================
-- STATUS: PROPOSAL · NOT YET APPLIED · DO NOT APPLY without an explicit
-- authorisation phrase of the form:
--   AUTHORISE SANDBOX APPLY 336
--
-- Owner-authorised scope drafting 2026-11-10 (REVISED gateway ownership).
--
-- Purpose · under the sealed 2026-11-10 (revised) rule, shop-owner
-- commerce routes through PayPal, not Stripe. Each shop owner connects
-- their own PayPal Business account via the PayPal Partner Referrals
-- flow. This migration adds the columns NEX needs to mirror the
-- connection status + partner-scoped merchant identifier.
--
-- Non-destructive · additive columns only · all nullable · existing
-- rows get NULL · no data touched.
--
-- Field-level notes:
--   · paypal_merchant_id              · PayPal's unique merchant identifier
--                                       for the connected shop (opaque
--                                       text · set once onboarded)
--   · paypal_partner_merchant_id      · the Partner-scoped identifier
--                                       NEX uses in API calls to act on
--                                       behalf of the seller (NEX = Partner)
--   · paypal_charges_enabled          · mirrored from PayPal · false until
--                                       the seller completes verification
--   · paypal_payouts_enabled          · same, for payout capability
--   · paypal_onboarded_at             · timestamp when the seller first
--                                       completed the Partner Referrals flow
--   · paypal_last_webhook_at          · timestamp of last account webhook
--                                       (MERCHANT.ONBOARDING.COMPLETED /
--                                        CAPABILITY.CHANGED)
--
-- The existing Stripe Connect columns on nex_business (mig 311):
--   · stripe_connect_account_id
--   · stripe_connect_charges_enabled
--   · stripe_connect_payouts_enabled
-- remain in place for reversibility. They are no longer read by the
-- method-resolver as of 2026-11-10 (revised).
--
-- Dependencies: none · fully additive.
-- Rollback · drop the 6 columns · lose any merchant-ID mirrors (owner
-- should snapshot nex_business before rollback).
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(336000001);

DO $pre$
BEGIN
  IF EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '336') THEN
    RAISE EXCEPTION 'Migration 336 already recorded in nex_migration_history.';
  END IF;
END
$pre$;

ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS paypal_merchant_id           text,
  ADD COLUMN IF NOT EXISTS paypal_partner_merchant_id   text,
  ADD COLUMN IF NOT EXISTS paypal_charges_enabled       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paypal_payouts_enabled       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paypal_onboarded_at          timestamptz,
  ADD COLUMN IF NOT EXISTS paypal_last_webhook_at       timestamptz;

-- Index supports the resolver query "does this business have an active
-- PayPal connection" with the same cost profile as the existing Stripe
-- Connect index on this table. Partial · only indexes rows where the
-- merchant id is actually set.
CREATE INDEX IF NOT EXISTS idx_nex_business_paypal_active
  ON public.nex_business (paypal_merchant_id)
  WHERE paypal_merchant_id IS NOT NULL AND paypal_charges_enabled = true;

COMMENT ON COLUMN public.nex_business.paypal_merchant_id IS
  '2026-11-10 · opaque PayPal merchant identifier for a connected shop · set by the Partner Referrals callback · NEX stores no PayPal credential, only this mirror ID.';
COMMENT ON COLUMN public.nex_business.paypal_partner_merchant_id IS
  '2026-11-10 · Partner-scoped merchant identifier used in PayPal API calls when NEX acts as Partner on behalf of the seller.';
COMMENT ON COLUMN public.nex_business.paypal_charges_enabled IS
  '2026-11-10 · mirrored capability flag · false until PayPal reports the seller completed verification.';
COMMENT ON COLUMN public.nex_business.paypal_payouts_enabled IS
  '2026-11-10 · mirrored payout capability · merchant-direct · NEX never moves the money.';

INSERT INTO nex_migration_history (version, applied_at, description, notes)
VALUES (
  '336',
  NOW(),
  'nex_business · PayPal Partner columns (paypal_merchant_id + 5 siblings) + active-connection partial index',
  'Supports the sealed 2026-11-10 (revised) shop checkout path through PayPal. Fully additive. Stripe Connect columns on nex_business stay for reversibility · no longer read by the method-resolver.'
);

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP INDEX IF EXISTS idx_nex_business_paypal_active;
--     ALTER TABLE public.nex_business
--       DROP COLUMN IF EXISTS paypal_last_webhook_at,
--       DROP COLUMN IF EXISTS paypal_onboarded_at,
--       DROP COLUMN IF EXISTS paypal_payouts_enabled,
--       DROP COLUMN IF EXISTS paypal_charges_enabled,
--       DROP COLUMN IF EXISTS paypal_partner_merchant_id,
--       DROP COLUMN IF EXISTS paypal_merchant_id;
--     DELETE FROM nex_migration_history WHERE version = '336';
--   COMMIT;
