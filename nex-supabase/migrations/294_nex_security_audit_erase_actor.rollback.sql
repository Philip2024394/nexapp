-- 294_nex_security_audit_erase_actor.rollback.sql
-- Drops the pseudonymisation function. Pseudonymised rows remain
-- pseudonymised · rollback does NOT reverse past deletions.

begin;

drop function if exists nex_security_audit_erase_actor(uuid, text);

delete from nex_migration_history where version = '294';

commit;
