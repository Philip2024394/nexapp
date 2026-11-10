-- Migration 329 · VALIDATE nex_peer_message_encrypted_true · D6 Phase 3 · 2026-11-10
-- =========================================================================
-- STATUS: PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY · SANDBOX ONLY
-- =========================================================================
--
-- GATE · HARD PRECONDITION · DO NOT APPLY UNTIL:
--   (a) mig 328 has been applied for ≥14 days in sandbox AND ≥7 days in
--       production (owner-decision · production apply is a SEPARATE
--       owner word-trigger) with zero observed plaintext writes during
--       that window;
--   OR
--   (b) the owner has accepted a documented exception in writing
--       (freeze-exception memo stapled to this migration's apply
--       authorisation).
--
-- Additionally · VALIDATE CONSTRAINT will FAIL if any legacy
-- encrypted=false row remains in nex_peer_message at apply time.
-- Pre-flight count MUST return zero OR the owner-accepted exception
-- block MUST explicitly list the rows that are permitted to exist
-- (and 329 is applied with a conditional WHERE strategy outside of
-- this file).
--
-- Pre-flight check (MUST be run and reported BEFORE scheduling apply):
--   SELECT count(*) AS plaintext_rows_remaining
--     FROM nex_peer_message
--    WHERE encrypted = false;
--
--   Expected: 0.
--
-- Owner-sealed 2026-11-10 (chat-decisions-locked-2026-11-10.md D6):
--   · Phase 3 · flip the NOT VALID constraint from mig 328 to VALID.
--   · After this applies, the full table has been scanned once and any
--     row with encrypted=false would have blocked the VALIDATE. From
--     this point on, the CHECK is a full invariant.
--
-- I-4 preservation · this migration does NOT delete any row. Legacy
-- plaintext deletion is a SEPARATE owner-authorised flow. If legacy
-- plaintext exists at VALIDATE time, this migration REFUSES to apply
-- cleanly · it is NOT a solution to legacy data.
--
-- Apply target: SANDBOX ONLY (kdstoyyeygcopkogqsyv) · production
-- (ijvqdvsvwtwxzcqmoqit) stays sealed.
-- Depends on: mig 093 · mig 328 (constraint exists as NOT VALID).

BEGIN;

ALTER TABLE nex_peer_message
  VALIDATE CONSTRAINT nex_peer_message_encrypted_true;

COMMENT ON CONSTRAINT nex_peer_message_encrypted_true ON nex_peer_message IS
  'D6 Phase 3 · VALIDATED 2026-11-10 (date updated on apply). Full table invariant: every row must have encrypted=true. Legacy encrypted=false rows must have been resolved via a SEPARATE owner-authorised flow before this migration ran.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '329',
    'D6 Phase 3 · VALIDATE CONSTRAINT nex_peer_message_encrypted_true (promotes NOT VALID → VALID)',
    'Sealed 2026-11-10. Preflight: SELECT count(*) FROM nex_peer_message WHERE encrypted=false MUST = 0 before apply (or owner-accepted exception). 14d sandbox + 7d prod burn-in required first.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT conname, convalidated
--     FROM pg_constraint
--    WHERE conname = 'nex_peer_message_encrypted_true'
--      AND conrelid = 'nex_peer_message'::regclass;
--
--   Expected: convalidated = true (VALIDATED).
--
-- Rollback (two options · owner picks):
--
--   Option A · drop entirely:
--     BEGIN;
--       DELETE FROM nex_migration_history WHERE version = '329';
--       ALTER TABLE nex_peer_message
--         DROP CONSTRAINT nex_peer_message_encrypted_true;
--     COMMIT;
--     Consequence: constraint gone · plaintext inserts possible at DB
--     level again (code-level D4 freeze remains).
--
--   Option B · demote back to NOT VALID (keeps new-insert enforcement
--             but removes the full-table invariant · useful if a
--             forensic exercise needs to re-introduce a legacy row):
--     BEGIN;
--       DELETE FROM nex_migration_history WHERE version = '329';
--       ALTER TABLE nex_peer_message
--         DROP CONSTRAINT nex_peer_message_encrypted_true;
--       ALTER TABLE nex_peer_message
--         ADD CONSTRAINT nex_peer_message_encrypted_true
--           CHECK (encrypted = true) NOT VALID;
--     COMMIT;
--
--   Neither rollback restores plaintext · no row deleted · I-5 satisfied.
