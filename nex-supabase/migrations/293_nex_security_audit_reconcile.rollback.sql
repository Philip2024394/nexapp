-- 293_nex_security_audit_reconcile.rollback.sql
-- Drops the reconciliation functions. Reconciliation rows written
-- during the function's lifetime are preserved.

begin;

drop function if exists nex_security_audit_reconcile_unmatched(integer);
drop function if exists nex_security_audit_reconcile_match_late(bigint, bigint, text);

delete from nex_migration_history where version = '293';

commit;
