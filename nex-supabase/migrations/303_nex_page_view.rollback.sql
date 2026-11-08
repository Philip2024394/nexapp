-- 303_nex_page_view.rollback.sql · reverses migration 303.
begin;
  delete from nex_migration_history where version = '303';
  drop index if exists idx_nex_page_view_viewed_at;
  drop index if exists idx_nex_page_view_product_time;
  drop index if exists idx_nex_page_view_business_time;
  drop table if exists nex_page_view;
commit;
