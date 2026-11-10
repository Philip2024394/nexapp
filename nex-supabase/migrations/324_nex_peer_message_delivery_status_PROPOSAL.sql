-- Migration 324 · nex_peer_message.delivery_status · D3 · 2026-11-10
-- =========================================================================
-- STATUS: PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY · SANDBOX ONLY
-- =========================================================================
--
-- Owner-sealed 2026-11-10 (chat-decisions-locked-2026-11-10.md D3):
--   · 30-day undelivered ciphertext cap. Rows that stay pending > 30 days
--     flip to delivery_status='expired' via a scheduled sweep (mig 326).
--   · Delivery status is a STRUCTURAL state · not a NEX message to the
--     user. Sender UI renders "pending / delivered / expired" from this
--     column alone.
--
-- Schema note (verified against mig 093):
--   · nex_peer_message.encrypted boolean NOT NULL DEFAULT false · EXISTS.
--   · nex_peer_message.delivered_at timestamptz NULL · EXISTS (mig 093
--     line 41). The ALTER below is written defensively with IF NOT EXISTS
--     so it is a no-op on the already-applied column.
--
-- Semantics:
--   · 'pending'   · default at insert · ciphertext row is awaiting
--     recipient-device decrypt-ack.
--   · 'delivered' · receiver device marked delivered_at after a
--     successful Poly1305 tag verification + local decrypt. Set by
--     /api/nex-native/peer-message/delivered/route.ts in the same
--     transaction that flips delivered_at.
--   · 'expired'   · sweep (mig 326) flipped this after 30d pending.
--     Row is NOT deleted · ciphertext blob can still be decrypted if
--     the device comes online within the storage retention window.
--
-- Legacy row treatment (I-4):
--   · encrypted=false rows get delivery_status='pending' by default but
--     are NEVER touched by the expiry sweep (sweep filters encrypted=true).
--   · No existing row semantics changed by this migration.
--
-- Apply target: SANDBOX ONLY (kdstoyyeygcopkogqsyv) · production
-- (ijvqdvsvwtwxzcqmoqit) stays sealed.

BEGIN;

ALTER TABLE nex_peer_message
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending';

-- delivered_at already exists in mig 093; ADD IF NOT EXISTS is a defensive
-- no-op kept per the D3 owner-paper (explicit intent to confirm both
-- columns coexist before the sweep function in mig 326 lands).
ALTER TABLE nex_peer_message
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz NULL;

ALTER TABLE nex_peer_message
  DROP CONSTRAINT IF EXISTS nex_peer_message_delivery_status_check;

ALTER TABLE nex_peer_message
  ADD CONSTRAINT nex_peer_message_delivery_status_check
    CHECK (delivery_status IN ('pending','delivered','expired'));

COMMENT ON COLUMN nex_peer_message.delivery_status IS
  'D3 · structural delivery state · pending (default · awaiting recipient decrypt) / delivered (recipient Poly1305-verified + decrypted locally + ack POSTed) / expired (sweep flipped after 30d pending · mig 326). Not a user-facing NEX message · sender UI renders from this column directly. Sealed 2026-11-10.';

CREATE INDEX IF NOT EXISTS nex_peer_message_pending_encrypted_idx
  ON nex_peer_message (sent_at)
  WHERE encrypted = true AND delivery_status = 'pending';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '324',
    'D3 · nex_peer_message.delivery_status + check constraint + pending index',
    'Sealed 2026-11-10. Additive text column (default pending) + CHECK in (pending,delivered,expired) + partial index on encrypted pending rows for mig-326 sweep cost. delivered_at ADD IF NOT EXISTS is a no-op (column pre-exists from mig 093).'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '324';
--     DROP INDEX IF EXISTS nex_peer_message_pending_encrypted_idx;
--     ALTER TABLE nex_peer_message DROP CONSTRAINT IF EXISTS nex_peer_message_delivery_status_check;
--     ALTER TABLE nex_peer_message DROP COLUMN IF EXISTS delivery_status;
--     -- delivered_at is NOT dropped · it was pre-existing from mig 093.
--   COMMIT;
--
--   Rollback consequence: delivery-status metadata disappears · sender UI
--   falls back to delivered_at IS NULL heuristic. No ciphertext row is
--   deleted · no plaintext is exposed. I-5 satisfied.
