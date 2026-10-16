-- Migration 199 · Per-account chat privacy preferences · R9 Stage 4
-- · 2026-10-15
-- --------------------------------------------------------------------------
-- STATUS: AUTHORED · NOT YET APPLIED. Owner authorisation covers
-- preparation and content review only. A separate explicit application
-- authorisation is required before this migration touches any database.
--
-- Adds four preference columns + one presence timestamp to nex_account.
-- Companion to:
--   · migration 198 (nex_account_notification_prefs · applied) which
--     handles push category preferences
--   · the sealed chat/typing/presence services which will consult the
--     new columns to enforce behavior
--
-- Approved values (owner directive 2026-10-15):
--   read_receipts_enabled       : boolean · default TRUE
--     Reciprocal WhatsApp-style. When FALSE, the recipient's read_at
--     is never persisted · the sender's view never surfaces receipt
--     information for messages this user received. This is a privacy
--     setting enforced server-side at the mark-read + read-expose
--     paths · not a UI-only toggle.
--
--   typing_indicator_enabled    : boolean · default TRUE
--     1:1 conversations only in this release. When FALSE, this user's
--     typing broadcast is suppressed at the realtime channel layer.
--     Group typing is deferred to a future stage.
--
--   last_seen_visibility        : text · default 'nobody' · CHECK IN
--     ('everyone', 'contacts', 'nobody')
--     Who may see this user's last_seen_at. Default nobody matches
--     NEX privacy-by-default doctrine. Enforced at the presence
--     publish + any future profile-reader endpoint.
--
--   online_status_visibility    : text · default 'nobody' · CHECK IN
--     ('everyone', 'contacts', 'nobody')
--     Who may see "online now" for this user. Same enforcement model
--     as last_seen_visibility. Default nobody matches privacy-by-
--     default doctrine.
--
-- Note on last_seen_at: this migration does NOT add a last_seen_at
-- column to nex_account. The existing nex_session.last_seen_at
-- (migration 139) and nex_account_device_key.last_seen_at (migration
-- 092) already capture presence. The viewer-side resolver reads the
-- latest of those to answer "when was this account last online" ·
-- adding a duplicate column would create a reconciliation burden.
--
-- Enforcement surfaces (sealed services the dispatch service will
-- consult; see src/lib/nex-native/chat-preferences-service.ts):
--   · peer-message-service.markPeerMessagesRead · gate on recipient's
--     read_receipts_enabled
--   · peer-message-service.markPeerMessageDelivered · gate on
--     recipient's read_receipts_enabled
--   · peer-message/since route · strip read_at if recipient has
--     read_receipts_enabled=false (sender never sees receipt)
--   · realtime/typing.broadcast · gate on sender's typing_indicator_enabled
--   · realtime/presence.publish · gate on sender's last_seen_visibility
--     + online_status_visibility
--
-- Doctrine (owner-approved 2026-10-15):
--   · Reciprocity · receipts OFF on either side blocks the signal.
--     Implemented by gating on BOTH sender and recipient at the write
--     and expose paths.
--   · Fail-closed · a service-layer error reading preferences falls
--     through to the privacy-maximum (treat the user as having opted
--     into maximum privacy · never broadcast · never persist · never
--     reveal). Same discipline as R8 Notifications dispatch.
--   · Default new-account state · receipts + typing ON, last_seen
--     and online status NOBODY. The ON defaults match reciprocal
--     WhatsApp expectation; the NOBODY presence defaults match NEX
--     privacy-by-default doctrine.
--
-- Owner directive 2026-10-15: "Do not apply this to the live database
-- without separate explicit application authorisation."

alter table nex_account
  add column if not exists read_receipts_enabled boolean not null default true,
  add column if not exists typing_indicator_enabled boolean not null default true,
  add column if not exists last_seen_visibility text not null default 'nobody',
  add column if not exists online_status_visibility text not null default 'nobody';

-- CHECK constraints added separately so repeated application is
-- idempotent (the ADD COLUMN IF NOT EXISTS above handles column
-- idempotency; the CHECK constraints need their own guard).

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nex_account_last_seen_visibility_check'
  ) then
    alter table nex_account
      add constraint nex_account_last_seen_visibility_check
      check (last_seen_visibility in ('everyone','contacts','nobody'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'nex_account_online_status_visibility_check'
  ) then
    alter table nex_account
      add constraint nex_account_online_status_visibility_check
      check (online_status_visibility in ('everyone','contacts','nobody'));
  end if;
end $$;

comment on column nex_account.read_receipts_enabled is
  'R9 Stage 4 · reciprocal read-receipt preference. When FALSE, the sealed peer-message-service will skip persisting read_at + delivered_at for messages this account receives, and the peer-message/since route will strip read_at from outbound payloads this account has sent (so neither side sees receipt information when either disables it). Default TRUE matches reciprocal WhatsApp expectation. Enforced server-side · not a UI-only toggle.';

comment on column nex_account.typing_indicator_enabled is
  'R9 Stage 4 · typing-indicator preference. When FALSE, the sealed realtime/typing broadcast layer suppresses typing pings originating from this account. 1:1 conversations only in this release · group typing is deferred. Default TRUE.';

comment on column nex_account.last_seen_visibility is
  'R9 Stage 4 · last-seen privacy level. One of ''everyone'' / ''contacts'' / ''nobody''. Enforced at the sealed realtime/presence publish layer + any future profile reader. Default ''nobody'' matches NEX privacy-by-default doctrine · users opt INTO visibility rather than opting out.';

comment on column nex_account.online_status_visibility is
  'R9 Stage 4 · online-status privacy level. One of ''everyone'' / ''contacts'' / ''nobody''. Same enforcement model as last_seen_visibility. Default ''nobody''.';
