-- 344_nex_business_shop_intro_message_rollback.sql
-- Rollback for migration 344. Drops the CHECK constraint, the column,
-- and the migration history row.

BEGIN;

ALTER TABLE public.nex_business
  DROP CONSTRAINT IF EXISTS nex_business_shop_intro_message_length;

ALTER TABLE public.nex_business
  DROP COLUMN IF EXISTS shop_intro_message;

DELETE FROM nex_migration_history WHERE version = '344';

COMMIT;
