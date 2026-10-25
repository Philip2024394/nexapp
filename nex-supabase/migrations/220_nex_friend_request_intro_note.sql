-- ============================================================================
-- NEX-native Migration 220 · friend_request · intro_note column
-- ============================================================================
--
-- STATUS: APPLIED to sealed project `ijvqdvsvwtwxzcqmoqit` on
-- 2026-10-25 via `scripts/apply-migration-220.mjs` after explicit
-- owner authorisation. Verification result captured by the applier:
--   PRE   intro_note column exists? NO (will add)
--   APPLIED migration 220
--   POST  column: {column_name: intro_note, data_type: text, is_nullable: YES}
--   POST  CHECK: nex_friend_request_intro_note_check:
--                CHECK (((intro_note IS NULL) OR (char_length(intro_note) <= 280)))
--   POST  migration_history: {version: '220', description: '...'}
--
-- Owner directive 2026-10-24 · Live Shop-Contacts introduction text
-- end-to-end verification pass. The Live interaction feature contract
-- (docs/doctrine/nex-live-interaction-feature-contract-2026-10-24.md)
-- specifies that the broadcaster can enclose an optional introduction
-- note with a Shop-Contacts invite. The existing `nex_friend_request`
-- table (Migration 215) has NO column that carries sender-authored
-- text · this is the smallest possible compatible extension.
--
-- Scope
-- ----------------------------------------------------------------------------
--   · Add one nullable `intro_note text` column with a length CHECK.
--   · No new table. No new index. No RLS policy change (existing
--     RLS already scopes the row to the two parties).
--   · No backfill (every pre-existing row stays `intro_note = NULL`).
--
-- Service-side normalisation
-- ----------------------------------------------------------------------------
-- `src/lib/nex-native/friend-request-service.ts` (updated in the same
-- 2026-10-24 pass) performs client-side-tolerant normalisation BEFORE
-- the insert:
--   · trim whitespace
--   · empty → null (never a persisted empty string)
--   · > 280 chars → slice to 280 (never throws · the misbehaving
--     client case is clamped silently, same as a UI textarea with a
--     maxLength attribute)
--
-- The DB CHECK below is the belt-and-braces guard · if a direct SQL
-- insert bypasses the service, the DB rejects a > 280-char value.
-- Both layers agree on 280 as the ceiling. If the ceiling is ever
-- raised, update BOTH the service constant `INTRO_NOTE_MAX_LENGTH`
-- AND the DB CHECK in a coordinated migration.
--
-- Compatibility with the unapplied-column window
-- ----------------------------------------------------------------------------
-- Between the time the service is deployed (expecting the column)
-- and the time this migration is applied, two things happen:
--
--   · The service `insert({ ..., intro_note })` includes the field.
--     Supabase PostgREST silently drops unknown columns from inserts
--     (the row is created without `intro_note`). This is honest ·
--     the invite is still created, just without the note.
--   · The service `.select("*")` reads back whatever the DB returns
--     (no `intro_note` key in the response). The `FriendRequestRow`
--     TypeScript shape marks `intro_note` as `string | null`, so a
--     missing field reads as `undefined` → the service MUST tolerate
--     undefined-or-null · see the `?? null` normalisation when the
--     recipient inbox renders the note.
--
-- This matches the Phase 1 Slice 1C precedent (Migration 216 enum
-- extension with the TS `isDiscoverySignalType` validator tolerant
-- of absent values).
--
-- Dependencies
-- ----------------------------------------------------------------------------
--   APPLIED (production assumption · must be verified in sandbox):
--     215_nex_friend_request.sql
--
-- Rollback
-- ----------------------------------------------------------------------------
--   BEGIN;
--     ALTER TABLE public.nex_friend_request DROP COLUMN IF EXISTS intro_note;
--     DELETE FROM nex_migration_history WHERE version = '220';
--   COMMIT;
--
-- Dropping the column loses any introduction text already stored ·
-- the sender's intent + 24h expiry both still hold, so the loss is
-- cosmetic. Zero FK impact.
--
-- Verification (manual · not executed)
-- ----------------------------------------------------------------------------
-- After applying, verify in sandbox:
--
--   SELECT column_name, data_type, is_nullable, character_maximum_length
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'nex_friend_request'
--      AND column_name = 'intro_note';
--
-- Expected row:
--   intro_note | text | YES | NULL
--
-- And probe the CHECK:
--
--   INSERT INTO nex_friend_request
--     (sender_account_id, recipient_nex_handle, status, expires_at, intro_note)
--   VALUES
--     ('<uuid>', 'nex-0000', 'pending', now() + interval '24 hours',
--      repeat('x', 281));
-- Expected: FAIL with CHECK violation (intro_note too long).
-- ============================================================================

BEGIN;

ALTER TABLE public.nex_friend_request
  ADD COLUMN IF NOT EXISTS intro_note text
    CHECK (intro_note IS NULL OR char_length(intro_note) <= 280);

COMMENT ON COLUMN public.nex_friend_request.intro_note IS
  'Optional sender-authored introduction note displayed on the recipient''s inbound invite card. Max 280 characters. Service-side normalisation (friend-request-service.ts): trim, empty→null, slice at 280. Sealed 2026-10-24 · Migration 220.';

INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '220',
  'nex_friend_request · intro_note column · Live Shop-Contacts introduction text support',
  'Owner directive 2026-10-24. Adds nullable intro_note text column with CHECK (len <= 280). Service-side normalisation already enforces 280-char cap. No backfill. No RLS change. Rollback: DROP COLUMN. The service-layer code (friend-request-service.ts createInvite) tolerates the pre-migration unapplied-column window: PostgREST silently drops the field on insert, the invite is still created without the note. NOT YET APPLIED to any database.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
