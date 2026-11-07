-- 290_nex_security_rate_limit.rollback.sql
-- -----------------------------------------------------------------------------
-- Rollback for migration 290. Destructive · drops the counter rows.
-- STATUS · PREPARED LOCALLY · NOT APPLIED.

begin;

drop index if exists idx_nex_security_rate_limit_window;
drop table if exists nex_security_rate_limit;

delete from nex_migration_history where version = '290';

commit;
