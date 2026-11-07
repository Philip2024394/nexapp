-- 288_nex_category_request.rollback.sql
-- -----------------------------------------------------------------------------
-- Rollback for migration 288. Drops the table + policies entirely.
-- Destructive · any pending seller requests are lost.
--
-- STATUS · PREPARED LOCALLY · NOT APPLIED.

begin;

drop policy if exists nex_category_request_insert_self on nex_category_request;
drop policy if exists nex_category_request_select_self on nex_category_request;

drop index if exists idx_nex_category_request_status_created;
drop index if exists idx_nex_category_request_account;

drop table if exists nex_category_request;

delete from nex_migration_history where version = '288';

commit;
