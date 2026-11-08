-- nex-supabase/migrations/311_nex_business_stripe_connect.rollback.sql
--
-- Rollback for migration 311 · removes all Stripe Connect columns.
-- WARNING · if any rows have stripe_connect_account_id set, this will
-- permanently lose the NEX → Stripe account mapping. Sellers would
-- need to re-connect after re-apply. Hard-refuses if non-null rows
-- exist · rename or null those first.

BEGIN;

DO $$
DECLARE
  connected integer;
BEGIN
  SELECT COUNT(*) INTO connected
    FROM public.nex_business
   WHERE stripe_connect_account_id IS NOT NULL;
  IF connected > 0 THEN
    RAISE EXCEPTION '311 rollback refused · % businesses have active Stripe Connect accounts · null them before rollback or you lose the mapping', connected;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_nex_business_stripe_connect_account_id;

ALTER TABLE public.nex_business
  DROP CONSTRAINT IF EXISTS ck_nex_business_stripe_connect_country_alpha2;

ALTER TABLE public.nex_business
  DROP COLUMN IF EXISTS stripe_connect_last_webhook_at,
  DROP COLUMN IF EXISTS stripe_connect_onboarded_at,
  DROP COLUMN IF EXISTS stripe_connect_country,
  DROP COLUMN IF EXISTS stripe_connect_requirements_currently_due,
  DROP COLUMN IF EXISTS stripe_connect_payouts_enabled,
  DROP COLUMN IF EXISTS stripe_connect_charges_enabled,
  DROP COLUMN IF EXISTS stripe_connect_account_id;

DELETE FROM public.nex_migration_history WHERE version = '311';

COMMIT;
