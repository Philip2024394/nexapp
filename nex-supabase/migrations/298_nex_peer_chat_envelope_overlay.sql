-- 298_nex_peer_chat_envelope_overlay.sql
-- -----------------------------------------------------------------------------
-- NEX Chat Attachments · Phase A·history · envelope overlay for
-- legacy records migrated from public to private bucket.
-- Owner-authorised 2026-11-08.
-- STATUS · AUTHORED · NOT YET APPLIED.
--
-- Doctrine
--   · `nex_peer_message.attachment_meta` is sealed-immutable by the
--     migration-054 trigger `nex_peer_message_enforce_immutability`.
--     We MUST preserve that invariant · the trigger is load-bearing
--     security doctrine for the sealed "message bytes are the history"
--     guarantee.
--   · For migrated historical records we need a server-only mapping
--     from a private-bucket `storage_path` back to the owning message
--     (so the signed-URL endpoint can resolve participant membership).
--     We CANNOT write that path into the immutable envelope.
--   · Solution · a dedicated overlay table scoped to service_role.
--     Insert-only · no UPDATE / DELETE grants · entries represent an
--     authoritative "this message's ciphertext now lives at this
--     private-bucket path" assertion, written by the migration tool
--     after SHA-256 verification.
--
-- Shape
--   · PK (message_id) · one row per migrated message · prevents
--     duplicate / conflicting mappings
--   · storage_path regex matches the sealed upload-route shape
--   · verified_sha256 kept so a later audit can re-verify integrity
--   · migrated_at timestamp for operator progress tracking
--
-- Append-only · service_role has INSERT + SELECT only. UPDATE +
-- DELETE + TRUNCATE are revoked. If a row needs correction, the
-- fix is a new migration pass with higher privilege, NOT an UPDATE
-- through the app.

begin;

create table if not exists nex_peer_chat_envelope_overlay (
  message_id        uuid        primary key
                      references nex_peer_message(id) on delete cascade,
  storage_path      text        not null,
  verified_sha256   text        not null,
  migrated_at       timestamptz not null default now(),
  constraint ck_env_overlay_path check (
    storage_path ~ '^enc/[0-9a-f-]+/\d+-[a-z0-9]+\.[a-z0-9]+$'
  ),
  constraint ck_env_overlay_sha check (
    verified_sha256 ~ '^[a-f0-9]{64}$'
  )
);

create index if not exists idx_nex_peer_chat_envelope_overlay_path
  on nex_peer_chat_envelope_overlay (storage_path);

-- Role scoping · same discipline as 290-294 (explicit revoke from
-- anon + authenticated so Supabase default grants don't leak) PLUS
-- an explicit revoke-then-grant on service_role so append-only is
-- real · the Supabase default grants service_role ALL privileges on
-- new tables so a simple GRANT INSERT, SELECT would leave UPDATE +
-- DELETE + TRUNCATE in place.
alter table nex_peer_chat_envelope_overlay enable row level security;
revoke all on nex_peer_chat_envelope_overlay from public;
revoke all on nex_peer_chat_envelope_overlay from authenticated;
revoke all on nex_peer_chat_envelope_overlay from anon;
revoke all on nex_peer_chat_envelope_overlay from service_role;
grant insert, select on nex_peer_chat_envelope_overlay to service_role;
-- UPDATE + DELETE + TRUNCATE explicitly NOT granted · append-only.

comment on table nex_peer_chat_envelope_overlay is
  'Owner-sealed 2026-11-08 · overlay mapping legacy peer-chat
  messages to their migrated private-bucket paths. Preserves the
  migration-054 immutability guarantee on nex_peer_message.
  attachment_meta while enabling the historical migration tool to
  record new paths. service_role INSERT+SELECT only.';

insert into nex_migration_history (version, description, notes)
  values (
    '298',
    'Phase A·history · nex_peer_chat_envelope_overlay for migrated legacy attachments',
    'Owner-sealed 2026-11-08. Preserves the sealed migration-054 immutability on nex_peer_message.attachment_meta. Signed-URL endpoint falls back to overlay lookup when the envelope lacks storage_path.'
  )
  on conflict (version) do nothing;

commit;
