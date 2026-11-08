-- 301_nex_hq_direct_channel.sql
-- -----------------------------------------------------------------------------
-- NEX HQ Direct Channel · HQ-administered direct-message pipeline to
-- any NEX member from the official "Nex" account. Owner-authorised
-- 2026-11-08.
-- STATUS · AUTHORED · NOT YET APPLIED to production.
--
-- Scope
--   HQ admins must be able to initiate a direct message to any
--   nex_account · the message lands in the user's existing peer-chat
--   inbox as if it came from the sealed sentinel "Nex" account
--   (id='11111111-aaaa-aaaa-aaaa-111111111111'). Delivery runs entirely
--   through the existing nex_peer_conversation + nex_peer_message
--   plumbing · we do NOT branch chat UI for HQ messages.
--
-- Doctrine
--   · One channel row per target account · UNIQUE(target_account_id)
--     keeps the HQ UX simple (one "Nex direct" entry per user).
--   · The channel row is a TRACKER · the actual conversation lives
--     in nex_peer_conversation and is created lazily by the send RPC.
--   · The sentinel account is a real nex_account row · it has no
--     supabase_user_id · it is NOT reachable via a login. The Supabase
--     Auth side cannot bootstrap it (see constraint below).
--   · Messages insert through nex_peer_message with attachment_meta
--     set to jsonb_build_object('nex_hq_origin', true,
--     'authored_by_hq_account_id', <uuid>). This marks the message
--     as HQ-authored WITHOUT storing chat content in HQ metadata ·
--     content is only in nex_peer_message.body (sealed immutable by
--     the migration 218 trigger).
--   · Sealed insert-only on nex_peer_message · the migration 218
--     trigger makes body/attachment_meta/sent_at/sender immutable
--     after the row lands. HQ cannot "edit" a sent direct message ·
--     only send a follow-up.
--
-- Role scoping · identical pattern to migrations 290-299 · service_role
-- INSERT + SELECT · anon + authenticated explicit REVOKE + ENABLE ROW
-- LEVEL SECURITY with zero policies so RLS-enforced clients see zero
-- rows.
--
-- Application pairing
--   · src/lib/nex-native/hq-direct-channel/hq-direct-service.ts
--     wraps the RPCs + emits security audit events.
--   · src/app/api/nex-native/hq/direct-message/route.ts is the POST
--     endpoint gated by requireHqAdmin.
--
-- Rollback
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '301';
--     DROP FUNCTION IF EXISTS nex_hq_direct_send(uuid, uuid, text);
--     DROP FUNCTION IF EXISTS nex_hq_direct_channel_upsert(uuid, uuid);
--     DROP TABLE IF EXISTS nex_hq_direct_channel;
--     -- Sentinel row intentionally left in place · removing it would
--     -- break historical messages. Delete manually if the whole HQ
--     -- direct-channel feature is being retired.
--   COMMIT;

begin;

-- ─── 1. Sentinel "Nex" account ─────────────────────────────────────
-- Owner-sealed fixed UUID · reserved for the HQ system sender. Never
-- reused · never regenerated. Idempotent via ON CONFLICT so repeated
-- migration applies are safe.
insert into nex_account (id, display_name)
values ('11111111-aaaa-aaaa-aaaa-111111111111', 'Nex')
on conflict (id) do nothing;

comment on column nex_account.id is
  'Primary NEX identity UUID. This is what downstream tables FK to. '
  'Sealed reserved UUID 11111111-aaaa-aaaa-aaaa-111111111111 is the '
  'HQ direct-channel sentinel "Nex" account (migration 301) · never '
  'has a supabase_user_id · never logs in · service_role writes only.';

-- ─── 2. Channel tracker ────────────────────────────────────────────
create table if not exists nex_hq_direct_channel (
  id                        uuid primary key default gen_random_uuid(),
  target_account_id         uuid not null references nex_account(id) on delete cascade,
  created_by_hq_account_id  uuid null,
  created_at                timestamptz not null default now(),
  constraint uq_nex_hq_direct_channel_target unique (target_account_id)
);

create index if not exists idx_nex_hq_direct_channel_created_at
  on nex_hq_direct_channel (created_at desc);

comment on table nex_hq_direct_channel is
  'Owner-sealed 2026-11-08 · tracker for HQ→user direct-message '
  'channels. One row per target account. The actual chat lives in '
  'nex_peer_conversation + nex_peer_message. service_role writes only.';

-- RLS + grants (identical discipline to migrations 290-299 · zero
-- anon/authenticated access · service_role gets INSERT + SELECT only).
alter table nex_hq_direct_channel enable row level security;
revoke all on nex_hq_direct_channel from public;
revoke all on nex_hq_direct_channel from authenticated;
revoke all on nex_hq_direct_channel from anon;
revoke all on nex_hq_direct_channel from service_role;
grant select, insert on nex_hq_direct_channel to service_role;

-- ─── 3. Upsert RPC ─────────────────────────────────────────────────
create or replace function nex_hq_direct_channel_upsert(
  _target_account_id uuid,
  _hq_account_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  _channel_id uuid;
begin
  if _target_account_id is null then
    raise exception 'nex_hq_direct_channel_upsert: _target_account_id required';
  end if;
  -- Idempotent · ON CONFLICT (target_account_id) DO NOTHING + returning
  -- the pre-existing row id when the insert was a no-op.
  insert into nex_hq_direct_channel (target_account_id, created_by_hq_account_id)
    values (_target_account_id, _hq_account_id)
    on conflict (target_account_id) do nothing
    returning id into _channel_id;
  if _channel_id is null then
    select id into _channel_id
      from nex_hq_direct_channel
     where target_account_id = _target_account_id;
  end if;
  return _channel_id;
end;
$$;

revoke all on function nex_hq_direct_channel_upsert(uuid, uuid) from public;
revoke all on function nex_hq_direct_channel_upsert(uuid, uuid) from authenticated;
revoke all on function nex_hq_direct_channel_upsert(uuid, uuid) from anon;
grant execute on function nex_hq_direct_channel_upsert(uuid, uuid) to service_role;

comment on function nex_hq_direct_channel_upsert(uuid, uuid) is
  'Owner-sealed 2026-11-08 · HQ-only · idempotent creator for the '
  'HQ→user direct-channel tracker row. Returns existing channel id '
  'when the row already exists. service_role only.';

-- ─── 4. Send RPC ───────────────────────────────────────────────────
-- Inserts a nex_peer_message from the sentinel account to the target.
-- Creates the nex_peer_conversation row lazily · canonical (a,b)
-- ordering enforced by the sealed CHECK on migration 047.
--
-- attachment_meta carries the HQ-authored provenance · attachment_url
-- + attachment_type stay NULL (pair constraint from migration 054
-- permits attachment_meta set alone · no attachment_url/type pair).
create or replace function nex_hq_direct_send(
  _target_account_id uuid,
  _hq_account_id uuid,
  _body text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  _sentinel_id constant uuid := '11111111-aaaa-aaaa-aaaa-111111111111';
  _participant_a uuid;
  _participant_b uuid;
  _conversation_id uuid;
  _message_id uuid;
  _body_len integer;
begin
  if _target_account_id is null then
    raise exception 'nex_hq_direct_send: _target_account_id required';
  end if;
  if _target_account_id = _sentinel_id then
    raise exception 'nex_hq_direct_send: target cannot be the HQ sentinel';
  end if;
  if _body is null then
    raise exception 'nex_hq_direct_send: _body required';
  end if;
  _body_len := length(_body);
  if _body_len < 1 or _body_len > 4000 then
    raise exception 'nex_hq_direct_send: _body length must be 1..4000 (got %)', _body_len;
  end if;

  -- Verify target is a live account (not soft-deleted).
  perform 1 from nex_account
    where id = _target_account_id
      and deleted_at is null;
  if not found then
    raise exception 'nex_hq_direct_send: target account not found or deleted';
  end if;

  -- Canonical (a,b) ordering · migration 047 CHECK participant_a_id
  -- < participant_b_id. Pick lexicographically.
  if _sentinel_id < _target_account_id then
    _participant_a := _sentinel_id;
    _participant_b := _target_account_id;
  else
    _participant_a := _target_account_id;
    _participant_b := _sentinel_id;
  end if;

  -- Find-or-create the peer conversation.
  select id into _conversation_id
    from nex_peer_conversation
   where participant_a_id = _participant_a
     and participant_b_id = _participant_b;
  if _conversation_id is null then
    insert into nex_peer_conversation (participant_a_id, participant_b_id, last_message_at)
      values (_participant_a, _participant_b, now())
      returning id into _conversation_id;
  else
    -- Bump last_message_at · conversation row has no immutability
    -- trigger so this is safe. The message insert itself is the
    -- audit record of send-time.
    update nex_peer_conversation
       set last_message_at = now()
     where id = _conversation_id;
  end if;

  -- Insert the message · body + attachment_meta only.
  insert into nex_peer_message (
    conversation_id,
    sender_account_id,
    body,
    attachment_meta
  )
  values (
    _conversation_id,
    _sentinel_id,
    _body,
    jsonb_build_object(
      'nex_hq_origin', true,
      'authored_by_hq_account_id', _hq_account_id
    )
  )
  returning id into _message_id;

  -- Ensure the channel-tracker row exists · idempotent via unique
  -- constraint. Mirrors the upsert RPC behaviour so a bare send never
  -- leaves the channel table behind.
  insert into nex_hq_direct_channel (target_account_id, created_by_hq_account_id)
    values (_target_account_id, _hq_account_id)
    on conflict (target_account_id) do nothing;

  return _message_id;
end;
$$;

revoke all on function nex_hq_direct_send(uuid, uuid, text) from public;
revoke all on function nex_hq_direct_send(uuid, uuid, text) from authenticated;
revoke all on function nex_hq_direct_send(uuid, uuid, text) from anon;
grant execute on function nex_hq_direct_send(uuid, uuid, text) to service_role;

comment on function nex_hq_direct_send(uuid, uuid, text) is
  'Owner-sealed 2026-11-08 · HQ-only · inserts a peer message from '
  'the sealed sentinel "Nex" account to a target user. Finds-or-'
  'creates the nex_peer_conversation. Honours the sealed migration '
  '218 immutability contract · body + attachment_meta frozen on '
  'INSERT. service_role only.';

-- ─── 5. Migration ledger ───────────────────────────────────────────
insert into nex_migration_history (version, description, notes)
  values (
    '301',
    'HQ direct channel · sentinel + tracker + upsert/send RPCs',
    'Owner-sealed 2026-11-08. HQ-administered direct-message pipeline to any NEX member via the sealed sentinel account 11111111-aaaa-aaaa-aaaa-111111111111 ("Nex"). Pairs with src/lib/nex-native/hq-direct-channel/* and /api/nex-native/hq/direct-message. Reuses the sealed nex_peer_conversation + nex_peer_message plumbing · zero branching in chat UI.'
  )
  on conflict (version) do nothing;

commit;
