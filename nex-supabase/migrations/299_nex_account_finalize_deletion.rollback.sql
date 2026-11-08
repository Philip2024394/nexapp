begin;
drop function if exists nex_account_finalize_deletion(uuid);
delete from nex_migration_history where version = '299';
commit;
