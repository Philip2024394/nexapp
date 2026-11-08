-- 296_nex_account_deletion.rollback.sql
-- Drops the soft-delete function and columns.
-- IRREVERSIBLE on any row where deleted_at was set · the scrubbed
-- display_name + null nex_handle are not restored by this rollback.

begin;

drop function if exists nex_account_mark_deleted(uuid, text);
drop index if exists idx_nex_account_deleted_at;
alter table nex_account
  drop column if exists deletion_reason,
  drop column if exists deleted_at;

delete from nex_migration_history where version = '296';

commit;
