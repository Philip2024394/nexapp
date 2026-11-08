-- nex-supabase/migrations/310_nex_account_shop_tier_add_shop.rollback.sql
--
-- Rollback for migration 310 · narrows the shop_tier CHECK back to the
-- original migration-257 state ('standard' | 'unlimited').
--
-- WARNING · if any rows with shop_tier='shop' exist when this rollback
-- runs, the ALTER will FAIL because the new CHECK rejects existing rows.
-- Use the preflight guard below to detect them and refuse the rollback
-- with a clear error.

BEGIN;

-- Preflight · any row with shop_tier='shop' would violate the narrower
-- post-rollback CHECK · fail-closed rather than silently truncate state.
DO $$
DECLARE
  shop_rows integer;
BEGIN
  SELECT COUNT(*) INTO shop_rows FROM public.nex_account WHERE shop_tier = 'shop';
  IF shop_rows > 0 THEN
    RAISE EXCEPTION '310 rollback refused · % rows carry shop_tier = ''shop'' which the narrower CHECK would reject · migrate or null those rows first', shop_rows;
  END IF;
END $$;

ALTER TABLE public.nex_account
  DROP CONSTRAINT IF EXISTS nex_account_shop_tier_check;

ALTER TABLE public.nex_account
  ADD CONSTRAINT nex_account_shop_tier_check
  CHECK (
    shop_tier IS NULL
    OR shop_tier IN ('standard', 'unlimited')
  );

COMMENT ON COLUMN public.nex_account.shop_tier IS
  'NEX Shop subscription tier · ''standard'' or ''unlimited'' · narrowed by migration 310 rollback.';

DELETE FROM public.nex_migration_history WHERE version = '310';

COMMIT;
