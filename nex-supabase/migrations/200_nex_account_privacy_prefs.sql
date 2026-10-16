-- Migration 200 · Per-account privacy preferences · R10 Stage 5
-- · 2026-10-15
-- --------------------------------------------------------------------------
-- STATUS: AUTHORED · NOT YET APPLIED. Owner authorisation covers
-- preparation and content review only. A separate explicit application
-- authorisation is required before this migration touches any database.
--
-- Adds two preference columns to nex_account:
--
--   profile_visibility   : text · default 'public' · CHECK IN
--     ('public', 'contacts', 'private')
--     Who may read this account's profile. Default 'public' matches
--     existing product behaviour · do NOT silently restrict existing
--     users (owner directive 2026-10-15).
--     Enforcement at the sealed account-reader paths · for 'private',
--     the reader returns 404 (not 403) to prevent enumeration attacks.
--
--   who_can_message      : text · default 'everyone' · CHECK IN
--     ('everyone', 'contacts')
--     Who may initiate a peer conversation with this account.
--     Default 'everyone' matches existing product behaviour.
--     Enforcement at sealed peer-conversation-service.
--     getOrCreatePeerConversation · a non-contact sender attempting
--     to open a thread with a 'contacts'-restricted recipient is
--     rejected with a clear error.
--
-- Deliberately EXCLUDED from this stage (owner directive 2026-10-15):
--   · who_can_call · deferred to a future stage with call-signalling
--     review
--   · contacts_or_request mode · deferred pending legal review of
--     unencrypted first-message storage for Indonesia market
--   · nex_message_request table · not created in this stage
--
-- is_discoverable remains SEPARATE (owner directive):
--   · nex_account_profile.is_discoverable (migration 134) controls
--     Socials/directory listing. It is NOT merged into
--     profile_visibility. The two axes answer different questions:
--     - is_discoverable: "may I appear in discovery surfaces?"
--     - profile_visibility: "who may read my profile when they
--       already have my id?"
--
-- Doctrine (owner-approved 2026-10-15):
--   · Fail-closed · a service-layer error reading preferences falls
--     through to the privacy-maximum shape (profile_visibility=
--     'private' · who_can_message='contacts'). Same discipline as
--     chat preferences + notification dispatch.
--   · 404 for private · an attacker probing for the existence of a
--     private profile sees a 404 response identical to a non-existent
--     account. This prevents enumeration.
--   · No silent change for existing users · the defaults match
--     current product behaviour so applying this migration does not
--     retroactively restrict anyone.
--
-- Owner directive 2026-10-15: "Do not apply this to the live database
-- without separate explicit application authorisation."

alter table nex_account
  add column if not exists profile_visibility text not null default 'public',
  add column if not exists who_can_message text not null default 'everyone';

-- CHECK constraints added separately so repeated application is
-- idempotent.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nex_account_profile_visibility_check'
  ) then
    alter table nex_account
      add constraint nex_account_profile_visibility_check
      check (profile_visibility in ('public', 'contacts', 'private'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'nex_account_who_can_message_check'
  ) then
    alter table nex_account
      add constraint nex_account_who_can_message_check
      check (who_can_message in ('everyone', 'contacts'));
  end if;
end $$;

comment on column nex_account.profile_visibility is
  'R10 Stage 5 · profile-visibility privacy level. One of ''public'' / ''contacts'' / ''private''. Enforced by the sealed account-reader paths · a ''private'' profile responds with 404 (not 403) to non-correspondents to prevent enumeration. Separate from nex_account_profile.is_discoverable (migration 134) which gates Socials/directory surfacing. Default ''public'' matches existing product behaviour · do NOT silently change existing users.';

comment on column nex_account.who_can_message is
  'R10 Stage 5 · conversation-initiation privacy. One of ''everyone'' / ''contacts''. Enforced at sealed peer-conversation-service.getOrCreatePeerConversation · a non-contact sender attempting to open a thread with a ''contacts''-restricted recipient is rejected. Default ''everyone'' matches existing product behaviour. who_can_call and contacts_or_request mode are deferred to future stages.';
