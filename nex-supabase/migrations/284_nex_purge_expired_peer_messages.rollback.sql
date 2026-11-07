-- 284_nex_purge_expired_peer_messages.rollback.sql
-- -----------------------------------------------------------------------------
-- Rollback for migration 284.
--
-- Drops the purge function + grants. Does NOT affect any existing
-- nex_peer_message rows · past purges are permanent (deleted rows
-- are not recoverable).
--
-- If pg_cron was used to schedule the function, remove the schedule
-- entry first:
--     select cron.unschedule('nex-purge-expired-peer-messages');
--
-- STATUS · PREPARED LOCALLY · NOT APPLIED.

begin;

drop function if exists public.nex_purge_expired_peer_messages();

commit;
