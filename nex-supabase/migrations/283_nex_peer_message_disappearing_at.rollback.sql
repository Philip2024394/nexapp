-- 283_nex_peer_message_disappearing_at.rollback.sql
-- -----------------------------------------------------------------------------
-- Rollback for migration 283.
--
-- Drops the partial index + column. Rows are NOT deleted · only the
-- timer metadata is removed. The companion account-default column
-- (migration 282) is unaffected.
--
-- After this rollback, the application degrades gracefully: the column
-- probe in peer-message-service detects column absence and omits
-- disappearing_at from future message inserts · existing rows are
-- preserved.
--
-- STATUS · PREPARED LOCALLY · NOT APPLIED.

begin;

drop index if exists nex_peer_message_disappearing_at_idx;

alter table nex_peer_message
  drop column if exists disappearing_at;

commit;
