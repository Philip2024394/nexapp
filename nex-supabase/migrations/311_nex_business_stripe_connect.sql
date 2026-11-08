-- nex-supabase/migrations/311_nex_business_stripe_connect.sql
--
-- NEX seller Stripe Connect schema · owner-authorised 2026-11-09
-- Round 31a · Deliverable 1 of the Complete Payment System Build Plan.
-- -----------------------------------------------------------------------------
-- Adds columns to nex_business so each seller can connect their OWN
-- Stripe account via Stripe Connect Express. NEX never holds seller
-- funds · buyer payments route directly to the seller's connected
-- account with 0% application fee (sealed commission rule).
--
-- Columns added
--   · stripe_connect_account_id text UNIQUE NULL
--       Stripe's acct_XXX identifier for the seller's Express account.
--       NULL when the seller has not connected · unique when set so
--       two nex_business rows can't accidentally point at the same
--       Stripe account.
--   · stripe_connect_charges_enabled boolean NOT NULL DEFAULT FALSE
--       Mirror of Stripe's account.charges_enabled · updated by
--       webhook on account.updated · TRUE means the seller can
--       accept payments.
--   · stripe_connect_payouts_enabled boolean NOT NULL DEFAULT FALSE
--       Mirror of Stripe's account.payouts_enabled · updated by
--       webhook on account.updated · TRUE means Stripe will pay
--       funds out to the seller's bank.
--   · stripe_connect_requirements_currently_due text[] NOT NULL
--     DEFAULT '{}'
--       List of Stripe-reported items the seller still needs to
--       complete (verification docs · bank account · etc.) · UI reads
--       this array to prompt the seller back into onboarding.
--   · stripe_connect_country text NULL CHECK (country IS NULL OR
--     char_length(country) = 2)
--       ISO-3166 alpha-2 country code of the seller's connected
--       account · set at onboarding time · used by UI to confirm
--       eligibility + currency hints.
--   · stripe_connect_onboarded_at timestamptz NULL
--       First time charges_enabled flipped to TRUE · used for UI
--       state ("Set up on 9 November 2026") and audit.
--   · stripe_connect_last_webhook_at timestamptz NULL
--       Last time any account.updated webhook fired for this account ·
--       lets the UI show "Status refreshed X ago" + helps operators
--       diagnose stale account states.
--
-- RLS
--   · nex_business already has RLS (sealed migrations). These columns
--     inherit · service-role writes only (webhook + API routes use
--     the admin client).
--   · Sellers reading their own nex_business row see these columns
--     via the existing owner-read policy.
--
-- Apply discipline (same pattern as 306/307/308/309/310):
--   · SANDBOX apply only via `scripts/apply-migration-311-sandbox.mjs`
--     (hard ref-check refusing production `ijvqdvsvwtwxzcqmoqit`).
--   · PRODUCTION apply requires separate owner authorisation.

BEGIN;

-- Preflight · nex_business must exist (sealed).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'nex_business'
  ) THEN
    RAISE EXCEPTION '311 preflight failed · nex_business table missing';
  END IF;
END $$;

-- Columns
ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled boolean NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled boolean NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_connect_requirements_currently_due text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stripe_connect_country text,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_connect_last_webhook_at timestamptz;

-- Country sanity CHECK · 2-letter ISO alpha-2 when set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'ck_nex_business_stripe_connect_country_alpha2'
  ) THEN
    ALTER TABLE public.nex_business
      ADD CONSTRAINT ck_nex_business_stripe_connect_country_alpha2
        CHECK (stripe_connect_country IS NULL
            OR char_length(stripe_connect_country) = 2);
  END IF;
END $$;

-- Index · lookup by connected account id (for webhook routing)
CREATE INDEX IF NOT EXISTS idx_nex_business_stripe_connect_account_id
  ON public.nex_business (stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;

-- Column comments · document source-of-truth to future readers
COMMENT ON COLUMN public.nex_business.stripe_connect_account_id IS
  'Seller''s Stripe Connect Express account ID (acct_XXX). NEX never holds seller funds · 0% application fee. NULL when not connected.';
COMMENT ON COLUMN public.nex_business.stripe_connect_charges_enabled IS
  'Mirror of Stripe account.charges_enabled · TRUE means the seller can accept payments. Updated by account.updated webhook.';
COMMENT ON COLUMN public.nex_business.stripe_connect_payouts_enabled IS
  'Mirror of Stripe account.payouts_enabled · TRUE means Stripe will pay funds to seller''s bank.';
COMMENT ON COLUMN public.nex_business.stripe_connect_requirements_currently_due IS
  'Stripe-reported pending items the seller must complete · UI surfaces as outstanding-requirements list.';

-- Migration history · consistent with 304-310
INSERT INTO public.nex_migration_history (version, description)
  VALUES ('311', 'nex_business Stripe Connect columns · seller-side payment provider state · NEX takes 0% application fee')
  ON CONFLICT (version) DO NOTHING;

COMMIT;
