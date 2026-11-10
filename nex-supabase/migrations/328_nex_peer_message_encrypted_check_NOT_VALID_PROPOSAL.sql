-- Migration 328 · nex_peer_message_encrypted_true (NOT VALID) · D6 · 2026-11-10
-- =========================================================================
-- STATUS: PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY · SANDBOX ONLY
-- =========================================================================
--
-- Owner-sealed 2026-11-10 (chat-decisions-locked-2026-11-10.md D6):
--   · Phase 1 of the "ciphertext only" CHECK burn-in.
--   · Adds CHECK constraint `nex_peer_message_encrypted_true` on
--     nex_peer_message with `NOT VALID` so it ONLY applies to NEW inserts
--     + UPDATEs that touch the column. Legacy rows where encrypted=false
--     are UNTOUCHED (I-4). No scan, no re-write, no deletion.
--   · Runs for 14 days in sandbox. Then owner authorises mig 329
--     (VALIDATE CONSTRAINT) after plaintext writes are observed at
--     zero rate for the burn-in window.
--
-- Interaction with mig 093's shape check:
--   · mig 093 added `nex_peer_message_encrypted_shape` enforcing per-row
--     column population consistency (encrypted=false ↔ ciphertext NULL ·
--     encrypted=true ↔ ciphertext NOT NULL). That constraint STAYS.
--   · This migration adds a SEPARATE constraint requiring encrypted=true
--     on new rows. Together they require: new rows must be encrypted
--     AND have all ciphertext columns populated.
--
-- NOT VALID semantics:
--   · PostgreSQL skips the initial table scan · constraint is marked
--     invalid-but-enforced-for-new-rows.
--   · New INSERTs with encrypted=false WILL fail immediately.
--   · Legacy rows with encrypted=false remain in place · NOT touched.
--   · information_schema.table_constraints.is_valid='NO' until mig 329.
--
-- D4 interaction · mig 328 is the DB belt to D4's code-boundary braces
-- (NEX_CHAT_PLAINTEXT_FREEZE=1 env flag). Belt stays loose (NOT VALID)
-- during the 14+7 burn-in so a stuck legacy code path gets logged (DB
-- raises exception · caller logs) rather than silently blocked.
--
-- Apply target: SANDBOX ONLY (kdstoyyeygcopkogqsyv) · production
-- (ijvqdvsvwtwxzcqmoqit) stays sealed.
-- Depends on: mig 093 · code-level freeze (D4) adopted first.

BEGIN;

-- Idempotent · drop-if-exists then re-add. Safe to re-run.
ALTER TABLE nex_peer_message
  DROP CONSTRAINT IF EXISTS nex_peer_message_encrypted_true;

ALTER TABLE nex_peer_message
  ADD CONSTRAINT nex_peer_message_encrypted_true
    CHECK (encrypted = true) NOT VALID;

COMMENT ON CONSTRAINT nex_peer_message_encrypted_true ON nex_peer_message IS
  'D6 Phase 1 · sealed 2026-11-10. Enforces encrypted=true on NEW inserts only (NOT VALID · legacy rows grandfathered under I-4). Promoted to VALID in mig 329 after 14d sandbox + 7d prod burn-in with zero plaintext writes observed.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '328',
    'D6 Phase 1 · CHECK nex_peer_message_encrypted_true NOT VALID (new-insert enforcement only)',
    'Sealed 2026-11-10. NOT VALID: legacy encrypted=false rows preserved under I-4 · new inserts with encrypted=false fail immediately. Validate via mig 329 after burn-in.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT conname, convalidated
--     FROM pg_constraint
--    WHERE conname = 'nex_peer_message_encrypted_true'
--      AND conrelid = 'nex_peer_message'::regclass;
--
--   Expected: convalidated = false (NOT VALID).
--
--   Try-inserting a plaintext row (sandbox-only test) should fail with:
--   ERROR:  new row for relation "nex_peer_message" violates check
--           constraint "nex_peer_message_encrypted_true"
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '328';
--     ALTER TABLE nex_peer_message DROP CONSTRAINT IF EXISTS nex_peer_message_encrypted_true;
--   COMMIT;
--
--   Rollback consequence: plaintext inserts become possible again at DB
--   level (code-level freeze D4 is the remaining gate). No private
--   content restored · no row touched. I-5 satisfied.
