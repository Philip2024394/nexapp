-- 292_nex_security_audit_log.rollback.sql
-- -----------------------------------------------------------------------------
-- Rollback for migration 292. Drops the audit tables + sequences.
-- IRREVERSIBLE · destroys all audit rows. Use only during authorised
-- rollback windows when the data retention requirements are known.
-- STATUS · PREPARED LOCALLY · NOT APPLIED.

begin;

drop table if exists nex_security_audit_reconciliation;
drop table if exists nex_security_audit_retention;
drop table if exists nex_security_audit_log;

delete from nex_migration_history where version = '292';

commit;
