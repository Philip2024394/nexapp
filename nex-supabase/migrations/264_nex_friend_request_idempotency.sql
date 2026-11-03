-- ============================================================================
-- NEX Migration 264 · nex_friend_request · idempotency key + fingerprint cols
-- ============================================================================
--
-- STATUS: DRAFT · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised preparation only (Scope-A · PR-1 · 2026-11-03). DO NOT
-- APPLY to the sealed Supabase project `ijvqdvsvwtwxzcqmoqit` without a
-- SEPARATE explicit owner authorisation naming this file.
--
-- Purpose:
--   Add caller-supplied idempotency key support to nex_friend_request so
--   client retries after a lost response do not create duplicate invites.
--
-- Design (owner-corrected Scope-A spec, final revision):
--
--   `idempotency_key`:
--     Caller-generated opaque string (recommended UUIDv4). Nullable so
--     that pre-existing invites and non-idempotent calls remain valid.
--     Scope-limited to the SENDER: unique partial index on
--     `(sender_account_id, idempotency_key) WHERE idempotency_key IS NOT NULL`
--     prevents cross-sender collisions and prevents one sender from
--     reusing a key for two concurrent attempts.
--
--   `idempotency_fingerprint`:
--     32-byte SHA-256 digest of the IMMUTABLE request inputs. Computed
--     SERVER-SIDE by the plpgsql function in migration 265. The client
--     never sends a fingerprint · it supplies only the idempotency key
--     plus the actual request inputs.
--
--     Fingerprint canonical encoding (migration 265):
--       sha256(
--         'v1|'
--         || sha256_hex(lower(coalesce(recipient_handle, '')))
--         || '|' || CASE WHEN recipient_handle IS NULL THEN 'NULL' ELSE 'VAL' END
--         || '|' || sha256_hex(coalesce(intro_note, ''))
--         || '|' || CASE WHEN intro_note IS NULL THEN 'NULL' ELSE 'VAL' END
--       )
--
--     Each input is pre-hashed to a fixed-length hex string before
--     concatenation. Delimiter ambiguity (owner's correction) is
--     eliminated · a user-supplied intro_note cannot contain content
--     that collides with another field because SHA-256 preimage
--     resistance protects each slot. NULL versus empty string is
--     distinguished by the explicit 'NULL' / 'VAL' marker. The 'v1'
--     salt lets a future schema addition be deployed with a new
--     fingerprint version without silently colliding against old rows.
--
--     On a retry with the same key, the function in migration 265:
--       1. Looks up the existing row by (sender_account_id, idempotency_key)
--       2. If fingerprint matches → returns the existing row's state
--          with `already_created: true` (safe retry · idempotent success)
--       3. If fingerprint differs → returns
--          `{ok: false, reason: 'idempotency_key_conflict'}` · never
--          silently returns an unrelated invite's state
--
-- Dependencies:
--   · Pre-existing nex_friend_request (migration 215)
--   · pgcrypto extension (for `digest()` in migration 265 · pre-flight check below)
--
-- Scope (strictly):
--   · ADD COLUMN idempotency_key text NULL
--   · ADD COLUMN idempotency_fingerprint bytea NULL
--   · CREATE partial UNIQUE INDEX on (sender_account_id, idempotency_key)
--     WHERE idempotency_key IS NOT NULL
--   · CHECK constraint on idempotency_key length and shape
--
-- NOT in scope:
--   · The plpgsql function that computes the fingerprint · see migration 265
--   · Service-layer wiring · future PR-2
--
-- Backfill: NONE. New columns are NULL for every existing row.
--   Existing rows remain fully compatible with pre-idempotency clients
--   (null key skips the fast-path check in migration 265).
--
-- Rollback:
--   BEGIN;
--     DROP INDEX IF EXISTS nex_friend_request_idempotency_unique;
--     ALTER TABLE public.nex_friend_request
--       DROP COLUMN IF EXISTS idempotency_fingerprint,
--       DROP COLUMN IF EXISTS idempotency_key;
--     DELETE FROM public.nex_migration_history WHERE version = '264';
--   COMMIT;
--
--   NOTE: destructive · see the forward-compatible rollback section in
--   docs/doctrine/nex-ireland-world-class-chat-blueprint-2026-11-03.md
--   § 4. Preferred rollback leaves these columns in place and reverts
--   the service layer only.
--
-- Risk level: LOW (additive columns on an existing table · no data
--   migration · no index on existing data because partial WHERE
--   idempotency_key IS NOT NULL skips every pre-existing row).
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Apply guard
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  RAISE EXCEPTION 'Migration 264 is DRAFT · requires explicit owner authorisation naming this file to apply. Comment out this guard block only when authorised.';
END $$;

-- ---------------------------------------------------------------------------
-- Pre-flight
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'nex_friend_request'
  ) THEN
    RAISE EXCEPTION 'Migration 264 refused: nex_friend_request missing. This is a sealed table from migration 215.';
  END IF;

  -- pgcrypto is required for `digest()` in migration 265 · verifying now
  -- so an operator cannot land 264 but have 265 fail at CREATE FUNCTION time.
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
  ) THEN
    RAISE EXCEPTION 'Migration 264 refused: pgcrypto extension not installed. Migration 265 depends on digest() from pgcrypto. Install with: CREATE EXTENSION IF NOT EXISTS pgcrypto;';
  END IF;

  -- Guard against re-applying partially · if the column already exists
  -- the ADD COLUMN IF NOT EXISTS below is a no-op, but we want to detect
  -- a divergent column type (e.g., someone created it manually as uuid).
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'nex_friend_request'
      AND column_name = 'idempotency_key'
      AND data_type <> 'text'
  ) THEN
    RAISE EXCEPTION 'Migration 264 refused: nex_friend_request.idempotency_key exists with wrong data type (expected text).';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'nex_friend_request'
      AND column_name = 'idempotency_fingerprint'
      AND data_type <> 'bytea'
  ) THEN
    RAISE EXCEPTION 'Migration 264 refused: nex_friend_request.idempotency_fingerprint exists with wrong data type (expected bytea).';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Column additions
-- ---------------------------------------------------------------------------
ALTER TABLE public.nex_friend_request
  ADD COLUMN IF NOT EXISTS idempotency_key         text  NULL,
  ADD COLUMN IF NOT EXISTS idempotency_fingerprint bytea NULL;

-- Length + shape CHECK on idempotency_key. UUIDv4 strings fit within
-- 128 chars; we cap at 128 to accept common formats while blocking
-- pathological-length inputs. Must contain non-whitespace content when
-- set (empty-string key is treated as absence of key).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nex_friend_request_idempotency_key_shape'
      AND conrelid = 'public.nex_friend_request'::regclass
  ) THEN
    ALTER TABLE public.nex_friend_request
      ADD CONSTRAINT nex_friend_request_idempotency_key_shape
      CHECK (
        idempotency_key IS NULL
        OR (length(idempotency_key) BETWEEN 1 AND 128
            AND length(trim(idempotency_key)) >= 1)
      );
  END IF;
END $$;

-- Length CHECK on fingerprint · SHA-256 is 32 bytes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nex_friend_request_idempotency_fingerprint_shape'
      AND conrelid = 'public.nex_friend_request'::regclass
  ) THEN
    ALTER TABLE public.nex_friend_request
      ADD CONSTRAINT nex_friend_request_idempotency_fingerprint_shape
      CHECK (
        idempotency_fingerprint IS NULL
        OR octet_length(idempotency_fingerprint) = 32
      );
  END IF;
END $$;

-- Coherence CHECK · fingerprint is set when key is set, and vice versa.
-- Prevents a client/server bug where a key is persisted without the
-- fingerprint (which would allow the fast-path to return a row without
-- verifying payload match).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nex_friend_request_idempotency_coherent'
      AND conrelid = 'public.nex_friend_request'::regclass
  ) THEN
    ALTER TABLE public.nex_friend_request
      ADD CONSTRAINT nex_friend_request_idempotency_coherent
      CHECK (
        (idempotency_key IS NULL AND idempotency_fingerprint IS NULL)
        OR (idempotency_key IS NOT NULL AND idempotency_fingerprint IS NOT NULL)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Partial unique index
-- ---------------------------------------------------------------------------
-- Scope: per sender. Null idempotency_key is excluded, so pre-existing
-- rows (all NULL) are unaffected. A single sender cannot have two rows
-- with the same key.
CREATE UNIQUE INDEX IF NOT EXISTS nex_friend_request_idempotency_unique
  ON public.nex_friend_request (sender_account_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Column comments
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.nex_friend_request.idempotency_key IS
  'Caller-supplied idempotency key for safe retry after lost response (sealed Scope-A · 2026-11-03). Scope-limited to the sender via partial unique index. NULL for pre-existing rows and non-idempotent callers.';
COMMENT ON COLUMN public.nex_friend_request.idempotency_fingerprint IS
  'Server-computed SHA-256 digest of the immutable request inputs (recipient_handle + intro_note + schema-version salt). Set only when idempotency_key is set (coherence CHECK). Compared on retry; mismatch returns idempotency_key_conflict (migration 265).';

-- ---------------------------------------------------------------------------
-- Migration history
-- ---------------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, notes)
  VALUES (
    '264',
    'nex_friend_request · idempotency_key + idempotency_fingerprint columns + partial unique index',
    'Owner-authorised 2026-11-03. Server-computed fingerprint · never trusted from client. Coherence CHECK prevents key-without-fingerprint. Scope-A PR-1.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
