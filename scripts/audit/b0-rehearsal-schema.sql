-- scripts/audit/b0-rehearsal-schema.sql
--
-- Stage B0-C-light · owner-authorised 2026-11-03 (artefact · unexecuted)
-- -----------------------------------------------------------------------------
-- Minimum schema the B0 coverage query needs, replicated against a scratch
-- Postgres instance named `nex_rehearsal_b0`.
--
-- Covers ONLY the four tables the query touches:
--   · nex_account              (from migration 001)
--   · nex_peer_conversation    (from migration 047)
--   · nex_peer_message         (from migration 047 · columns we need)
--   · nex_account_device_key   (from migration 092 + revoked_at from 141)
--
-- Deliberately omits:
--   · RLS policies           (query runs as service-role in scratch)
--   · auth.users FK          (standalone scratch has no Supabase auth schema)
--   · encrypted-path columns (query ignores them)
--   · indexes                (small fixture · query stays fast without)
--
-- Run order:
--   1. CREATE DATABASE nex_rehearsal_b0  (DBA step · outside this file)
--   2. \c nex_rehearsal_b0
--   3. \i b0-rehearsal-schema.sql
--   4. \i b0-rehearsal-fixtures.sql
--   5. \i b0-device-key-coverage.sql
--   6. DROP DATABASE nex_rehearsal_b0  (teardown · outside this file)

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for gen_random_uuid()

-- --- nex_account (minimum from migration 001) --------------------------------
CREATE TABLE IF NOT EXISTS nex_account (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id    uuid,                                   -- no FK · scratch
  display_name        text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- --- nex_peer_conversation (from migration 047) ------------------------------
CREATE TABLE IF NOT EXISTS nex_peer_conversation (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a_id    uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  participant_b_id    uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_message_at     timestamptz,
  CONSTRAINT nex_peer_conversation_ordered_pair
    CHECK (participant_a_id < participant_b_id),
  CONSTRAINT nex_peer_conversation_distinct
    CHECK (participant_a_id <> participant_b_id),
  CONSTRAINT nex_peer_conversation_unique_pair
    UNIQUE (participant_a_id, participant_b_id)
);

-- --- nex_peer_message (minimum from migration 047 · plaintext path only) -----
-- The coverage query only needs sender_account_id + conversation_id + sent_at
-- so we stay minimal.
CREATE TABLE IF NOT EXISTS nex_peer_message (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     uuid NOT NULL REFERENCES nex_peer_conversation(id) ON DELETE CASCADE,
  sender_account_id   uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  body                text NOT NULL,
  sent_at             timestamptz NOT NULL DEFAULT now(),
  read_at             timestamptz
);

-- --- nex_account_device_key (from migrations 092 + 141 revoked_at) -----------
CREATE TABLE IF NOT EXISTS nex_account_device_key (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  device_id     text NOT NULL CHECK (length(device_id) BETWEEN 8 AND 128),
  public_key    text NOT NULL CHECK (length(public_key) BETWEEN 40 AND 64),
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,                                  -- added by 141
  UNIQUE (account_id, device_id)
);
