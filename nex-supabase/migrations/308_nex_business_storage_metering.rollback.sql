-- nex-supabase/migrations/308_nex_business_storage_metering.rollback.sql
--
-- Rollback for migration 308. Drops the SECURITY DEFINER RPCs,
-- removes the CHECK constraint, and nullifies the columns. Column
-- DROP is performed last so a partial rollback can still be
-- distinguished. Idempotent · safe to re-run.
--
-- Hard restriction: SANDBOX ONLY · never applied to production
-- without separate owner authorisation.

BEGIN;

DROP FUNCTION IF EXISTS public.nex_shop_bandwidth_rollover();
DROP FUNCTION IF EXISTS public.nex_shop_increment_bandwidth_bytes(uuid, bigint);
DROP FUNCTION IF EXISTS public.nex_shop_increment_storage_bytes(uuid, bigint);

ALTER TABLE public.nex_business
  DROP CONSTRAINT IF EXISTS ck_nex_business_storage_nonneg;

ALTER TABLE public.nex_business
  DROP COLUMN IF EXISTS bandwidth_period_start,
  DROP COLUMN IF EXISTS bandwidth_pack_bytes,
  DROP COLUMN IF EXISTS storage_pack_bytes,
  DROP COLUMN IF EXISTS bandwidth_bytes_month,
  DROP COLUMN IF EXISTS storage_bytes_used;

DELETE FROM public.nex_migration_history WHERE version = '308';

COMMIT;
