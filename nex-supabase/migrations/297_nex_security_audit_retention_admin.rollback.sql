-- 297_nex_security_audit_retention_admin.rollback.sql
begin;
drop function if exists nex_security_audit_retention_upsert(text, integer, text);
drop function if exists nex_security_audit_retention_delete(text);
drop function if exists nex_security_audit_reconcile_manually_resolve(bigint, text);
delete from nex_migration_history where version = '297';
commit;
