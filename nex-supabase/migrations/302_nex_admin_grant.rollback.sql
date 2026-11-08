-- 302_nex_admin_grant.rollback.sql
-- Rollback for migration 302 · drops the HQ admin-grant surface.
begin;
  delete from nex_migration_history where version = '302';
  drop index if exists idx_nex_admin_grant_account_granted_at;
  drop index if exists idx_nex_admin_grant_active;
  drop table if exists nex_admin_grant;
commit;
