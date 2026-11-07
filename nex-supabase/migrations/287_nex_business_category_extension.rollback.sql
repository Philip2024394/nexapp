-- 287_nex_business_category_extension.rollback.sql
-- -----------------------------------------------------------------------------
-- Rollback for migration 287. Restores the 19-slug CHECK from migration 065.
--
-- Safety: if any nex_business rows carry one of the 4 Phase B slugs
-- (ice-cream, dessert-shop, drinks-shop, juice-bar) when this rollback
-- runs, the re-added CHECK will REJECT the operation and Postgres
-- aborts the transaction. The seller rows are preserved intact.
--
-- To rollback cleanly after Phase B has been in production, FIRST
-- update affected rows to NULL (or re-classify via the Shop Setup)
-- before running this rollback.
--
-- STATUS · PREPARED LOCALLY · NOT APPLIED.

begin;

alter table nex_business
  drop constraint if exists nex_business_category_check;

alter table nex_business
  add constraint nex_business_category_check
  check (
    business_category is null
    or business_category in (
      'bakery',
      'restaurant',
      'cafe',
      'tradesperson',
      'construction',
      'staircase-company',
      'salon',
      'beauty',
      'fitness',
      'consultant',
      'agency',
      'ecommerce',
      'product-brand',
      'local-service',
      'portfolio',
      'community',
      'event',
      'creator',
      'professional-service'
    )
  );

delete from nex_migration_history where version = '287';

commit;
