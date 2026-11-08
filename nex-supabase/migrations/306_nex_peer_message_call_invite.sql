-- 306_nex_peer_message_call_invite.sql
-- -----------------------------------------------------------------------------
-- NEX Call Center · peer-message call_invite attachment type.
-- Owner-authorised 2026-11-08 (round 22).
-- STATUS · AUTHORED · APPLIED TO SANDBOX ONLY · NOT APPLIED to production
-- (ijvqdvsvwtwxzcqmoqit) per CLAUDE.md §5 Safety Constitution.
--
-- Scope
--   Expands nex_peer_message.attachment_type CHECK (sealed in migration
--   054) to accept 'call_invite' so the Call Center invite-dispatch
--   service can insert "ring" messages into the peer conversation
--   between the caller and each invitee. The receiver's chat surface
--   then renders an Accept button inline on the bubble.
--
-- Doctrine
--   · Additive · no column rename · no data migration.
--   · The sealed attachment_url + attachment_type pairing CHECK
--     (migration 054:64) is unchanged · call_invite messages carry
--     an attachment_url (deep-link to accept the call) and an
--     attachment_meta JSONB payload with the session + media info.
--   · attachment_meta shape (service-layer convention · not
--     enforced in DB):
--       { "session_id": "<uuid>",
--         "media_type": "audio" | "video",
--         "host_account_id": "<uuid>" }
--     The receiver's renderer trusts the DB row + redacts anything
--     else out of scope.
--
-- Rollback
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '306';
--     ALTER TABLE nex_peer_message
--       DROP CONSTRAINT IF EXISTS nex_peer_message_attachment_type_check,
--       ADD CONSTRAINT nex_peer_message_attachment_type_check CHECK (
--         attachment_type IS NULL
--         OR attachment_type IN ('image', 'video', 'audio')
--       );
--   COMMIT;
--
--   WARNING · if any rows already have attachment_type='call_invite'
--   when the rollback runs, the narrowed CHECK will REJECT them.
--   Operator must reclassify or delete those rows first.

begin;

alter table nex_peer_message
  drop constraint if exists nex_peer_message_attachment_type_check;

-- Full enum restated · 'image', 'video', 'audio' from migration 054
-- plus new 'call_invite'. Other product/menu/cart/sticker/etc
-- attachment types are NOT in this CHECK · they ride different
-- tables + columns per their sealed migrations. Only the raw
-- attachment_url + attachment_type pairing is governed by this
-- constraint.
alter table nex_peer_message
  add constraint nex_peer_message_attachment_type_check check (
    attachment_type is null
    or attachment_type in ('image', 'video', 'audio', 'call_invite')
  );

insert into nex_migration_history (version, description, notes)
  values (
    '306',
    'nex_peer_message · attachment_type accepts call_invite',
    'Owner-authorised 2026-11-08 (round 22) · sandbox only · production sealed. attachment_url + attachment_meta shape service-layer convention.'
  )
  on conflict do nothing;

commit;
