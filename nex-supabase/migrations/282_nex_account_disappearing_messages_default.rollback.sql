-- 282_nex_account_disappearing_messages_default.rollback.sql
-- -----------------------------------------------------------------------------
-- Rollback for migration 282.
--
-- Drops the constraint + column. Does NOT affect any existing
-- nex_peer_message rows (the per-message disappearing_at column lives
-- in a separate migration 283).
--
-- STATUS · PREPARED LOCALLY · NOT APPLIED.

begin;

alter table nex_account
  drop constraint if exists nex_account_disappearing_seconds_valid;

alter table nex_account
  drop column if exists default_disappearing_messages_seconds;

commit;
