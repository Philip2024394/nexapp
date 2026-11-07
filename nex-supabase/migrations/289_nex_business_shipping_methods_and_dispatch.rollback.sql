-- 289_nex_business_shipping_methods_and_dispatch.rollback.sql
-- -----------------------------------------------------------------------------
-- Rollback for migration 289. Drops both new columns + their CHECKs.
--
-- Seller records keep their `shipping_scope` legacy enum intact (not
-- touched by this migration), so Directory + cover readers continue
-- to show the correct bucket even after rollback. The new multi-select
-- UX in Shop Setup Step 6 degrades to the single-scope picker via
-- the column-probe cache in business-service.
--
-- STATUS · PREPARED LOCALLY · NOT APPLIED.

begin;

alter table nex_business
  drop constraint if exists nex_business_shipping_methods_valid,
  drop constraint if exists nex_business_dispatch_time_days_bounds;

alter table nex_business
  drop column if exists dispatch_time_days,
  drop column if exists shipping_methods;

delete from nex_migration_history where version = '289';

commit;
