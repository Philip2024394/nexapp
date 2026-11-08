-- 291_nex_security_rate_limit_claim.rollback.sql
-- -----------------------------------------------------------------------------
-- Rollback for migration 291. Drops the two SECURITY DEFINER functions.
-- The underlying nex_security_rate_limit table (mig 290) stays intact.
-- STATUS · PREPARED LOCALLY · NOT APPLIED.

begin;

drop function if exists nex_security_rate_limit_claim(text, text, integer, integer);
drop function if exists nex_security_rate_limit_prune();

delete from nex_migration_history where version = '291';

commit;
