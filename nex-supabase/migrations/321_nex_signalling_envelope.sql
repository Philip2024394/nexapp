-- ============================================================================
-- NEX-native Migration 321 · Signalling envelope (Phase 2 Sprint 2 draft)
-- ============================================================================
-- Phase D Sprint 2 · DRAFT CODE · NOT AUTHORISED FOR SANDBOX APPLY until the
-- owner issues an explicit "Authorise Sprint 2" message AND D-5 TURN provider
-- is sealed (TURN credential issuance uses a sealed vendor's API that lives
-- in a sibling library file · intentionally absent from this commit).
--
-- Author: Claude. Produced under the quality-gates parallel build
-- 2026-11-09.
--
-- Purpose · WebRTC peer-to-peer connection establishment requires a brief
-- exchange of SDP offers/answers + ICE candidates between two online devices.
-- This exchange happens via NEX's signalling service. Per sealed invariant
-- I-2, NEX must not act as a message queue · the envelope lifetime is a
-- hard ≤120 seconds enforced at the DB level.
--
-- I-1 compliance:
--   · `payload` column stores OPAQUE SIGNALLING BYTES only · SDP + ICE
--     candidates + public-key handshake material. These are NEVER message
--     bodies · NEVER ciphertext of message content · NEVER attachments.
--   · The column name is deliberately `payload` and NOT `body`/`content`/
--     `ciphertext` so the Sentry PII scrubber's deny-list does not need
--     to consult content.
--   · Payload size capped at 32 KB (an SDP+ICE bundle is typically 2-8 KB
--     · anything larger is suspicious).
--
-- I-2 compliance:
--   · `expires_at` is NOT NULL and CHECK-constrained to be at most 120
--     seconds after `created_at`. The DB will refuse envelopes with longer
--     TTLs.
--   · A partial index exists on (expires_at) for the auto-prune worker to
--     efficiently sweep.
--   · No "stash" or "queue" semantics · every envelope is either consumed
--     within its TTL or lost.
--
-- RLS posture · service_role only · mirrors mig 320 pattern.
-- Rollback · see 321_nex_signalling_envelope.rollback.sql.
--
-- Prerequisites · requires nex_device (mig 320).
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(321000001);

DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '321') THEN
    RAISE EXCEPTION 'Migration 321 already recorded in nex_migration_history.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '320') THEN
    RAISE EXCEPTION 'Migration 320 (nex_device) is prerequisite · apply 320 first.';
  END IF;
END
$mig$;

CREATE TABLE IF NOT EXISTS nex_signalling_envelope (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_device_id  uuid        NOT NULL REFERENCES nex_device(id) ON DELETE CASCADE,
  to_device_id    uuid        NOT NULL REFERENCES nex_device(id) ON DELETE CASCADE,
  envelope_type   text        NOT NULL,
  payload         bytea       NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,

  CONSTRAINT nex_signalling_envelope_type_whitelist
    CHECK (envelope_type IN ('sdp_offer', 'sdp_answer', 'ice_candidate', 'handshake')),
  CONSTRAINT nex_signalling_envelope_ttl_cap
    CHECK (expires_at > created_at AND expires_at <= created_at + INTERVAL '120 seconds'),
  CONSTRAINT nex_signalling_envelope_payload_size
    CHECK (octet_length(payload) BETWEEN 1 AND 32768),
  CONSTRAINT nex_signalling_envelope_not_self
    CHECK (from_device_id <> to_device_id)
);

CREATE INDEX IF NOT EXISTS nex_signalling_envelope_to_device_pending_idx
  ON nex_signalling_envelope (to_device_id, created_at)
  WHERE expires_at > now();

CREATE INDEX IF NOT EXISTS nex_signalling_envelope_expires_at_idx
  ON nex_signalling_envelope (expires_at);

COMMENT ON TABLE nex_signalling_envelope IS
  'Phase 2 Sprint 2 (draft) · ephemeral signalling envelopes for WebRTC. TTL ≤120s · I-1 compliant (no message content) · I-2 compliant (no queue).';
COMMENT ON COLUMN nex_signalling_envelope.payload IS
  'Opaque bytes · SDP/ICE/handshake material. Never message content.';
COMMENT ON COLUMN nex_signalling_envelope.expires_at IS
  'Hard-capped at created_at + 120s. DB refuses longer TTLs.';

ALTER TABLE nex_signalling_envelope ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON nex_signalling_envelope FROM public;
REVOKE ALL ON nex_signalling_envelope FROM authenticated;
REVOKE ALL ON nex_signalling_envelope FROM anon;
GRANT SELECT, INSERT, DELETE ON nex_signalling_envelope TO service_role;
-- Note · no UPDATE grant · envelopes are append-only until consumed or
-- expired · modifying in-flight would break the I-2 semantics.

INSERT INTO nex_migration_history (version, applied_at, description, notes)
VALUES (
  '321',
  NOW(),
  'nex_signalling_envelope · Phase 2 Sprint 2 ephemeral signalling · TTL ≤120s',
  'Phase D Sprint 2 (draft) · DRAFT · owner-authorised build but NOT sandbox apply. I-1 compliant: payload is signalling bytes only, never message content. I-2 compliant: TTL ≤120s enforced at DB level, no queue semantics. Append-only (no UPDATE grant). References nex_device(id).'
);

COMMIT;
