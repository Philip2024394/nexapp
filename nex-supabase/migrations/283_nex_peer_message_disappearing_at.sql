-- 283_nex_peer_message_disappearing_at.sql
-- -----------------------------------------------------------------------------
-- NEX Chat · per-message disappearing timestamp · owner-sealed 2026-11-07.
--
-- STATUS: AUTHORED · NOT YET APPLIED. Owner authorisation covers
-- preparation + content review only. A separate explicit application
-- authorisation is required before this migration touches any database.
--
-- Pairs with migration 282 (nex_account.default_disappearing_messages_seconds)
-- and migration 284 (purge function + schedule).
--
-- Phase 2 (sendPeerMessage stamping):
--   · At send time, the application reads the sender's account default
--     via disappearing-messages-service.getDisappearingDefaultSafe.
--   · For positive-integer defaults: stamps disappearing_at =
--     send_time + default_seconds immediately.
--   · For sentinel -1 (immediately after view): leaves disappearing_at
--     NULL at send · Phase 3 stamps it when the first read_at arrives.
--   · For OFF (0) or unknown: leaves disappearing_at NULL · row is
--     permanent.
--
-- Phase 3 (markPeerMessagesRead stamping):
--   · When read_at is written for a message AND the row's current
--     disappearing_at is NULL AND the SENDER's account default is -1,
--     application stamps disappearing_at = now() + 30s grace.
--   · The 30s grace lets the client that just ACKed still render the
--     message once before the purge job removes it.
--
-- Phase 4 (purge) is a separate SQL function in migration 284 that
-- deletes rows where disappearing_at <= now(). Attachment cleanup
-- piggybacks on the existing Bridge 78 cascade.

begin;

alter table nex_peer_message
  add column if not exists disappearing_at timestamptz;

-- Partial index · the column is NULL for the vast majority of rows
-- (users with OFF default) so a partial index keeps the purge sweep
-- cheap. The purge DELETE scans this index to find rows to remove.
create index if not exists nex_peer_message_disappearing_at_idx
  on nex_peer_message (disappearing_at)
  where disappearing_at is not null;

comment on column nex_peer_message.disappearing_at is
  'Owner-sealed 2026-11-07 · timestamp after which this row is eligible
   for deletion by the purge job. NULL = permanent (default-OFF timer
   OR post-view timer not yet stamped). Set at send time for positive
   integer defaults · set at read time for sentinel -1 "immediately
   after view". See disappearing-messages-service.ts for the sealed
   semantics + grace window.';

commit;
