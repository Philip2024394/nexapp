-- 282_nex_account_disappearing_messages_default.sql
-- -----------------------------------------------------------------------------
-- NEX Chat · disappearing messages account default · owner-sealed 2026-11-07.
--
-- STATUS: AUTHORED · NOT YET APPLIED. Owner authorisation covers
-- preparation + content review only. A separate explicit application
-- authorisation is required before this migration touches any database.
--
-- Architecture (device-centred · E2E-safe · no server-side plaintext
-- storage · server never retains message content beyond the existing
-- ciphertext window):
--
--   · Account-level DEFAULT stored here. Per-chat overrides deferred
--     to a future migration (nex_peer_conversation.disappearing_mode).
--   · Each message gets `nex_peer_message.disappearing_at` populated
--     at send-time based on the sender's default (or the per-chat
--     override once that lands). That column is added separately in
--     migration 283 (also NOT YET APPLIED).
--   · A scheduled purge job DELETEs rows where
--     disappearing_at <= now(). The ciphertext blob in the
--     attachment bucket is purged by the existing Bridge 78 purge
--     job that already sweeps message attachments on row delete.
--   · Sentinel values · see CHECK constraint:
--        0             · disappearing OFF (keep forever)
--       -1             · "immediately after view" · the server
--                        stamps disappearing_at = read_at + grace
--                        seconds when the first read_at arrives
--                        (grace defaults to 30s to let clients that
--                        just acknowledged still render the message
--                        once before purge)
--        300           · 5 minutes
--        1800          · 30 minutes
--        3600          · 1 hour
--        86400         · 24 hours
--        604800        · 7 days
--     Other positive integer values are permitted for future-proofing.

alter table nex_account
  add column if not exists default_disappearing_messages_seconds integer not null default 0;

alter table nex_account
  add constraint if not exists nex_account_disappearing_seconds_valid
    check (
      default_disappearing_messages_seconds >= -1
    );

comment on column nex_account.default_disappearing_messages_seconds is
  'Owner-sealed 2026-11-07 · default disappearing-message timer in seconds.
   0 = OFF (keep forever). -1 = immediately after view (stamped once read_at
   arrives + 30s grace). Positive integers = seconds after send. Sentinels
   used by UI: 0, -1, 300, 1800, 3600, 86400, 604800.';
