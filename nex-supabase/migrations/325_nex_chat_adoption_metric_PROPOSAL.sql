-- Migration 325 · nex_chat_encryption_adoption_v · D4 helper · 2026-11-10
-- =========================================================================
-- STATUS: PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY · SANDBOX ONLY
-- =========================================================================
--
-- Owner-sealed 2026-11-10 (chat-decisions-locked-2026-11-10.md D4):
--   · Adoption gate · ≥95% of conversations between accounts that both
--     have active device keys have moved to encrypted sends (measured
--     over preceding 14 days). The owner word-trigger `freeze plaintext
--     sends` is the SECOND half of D4 · this view is the READ-ONLY
--     telemetry half.
--
-- Additive, non-destructive. No state change · no user data touched.
-- Service-role refreshes before owner inspects adoption.
--
-- Window: last 14 days. Denominator = pairs where BOTH participants have
-- at least one non-retired device key (mig 323). Numerator = pairs whose
-- in-window messages are ALL encrypted=true.
--
-- I-1 compliance · reads only metadata columns (participants, encrypted
-- flag, sent_at). Does NOT touch body / ciphertext / nonce.
--
-- Apply target: SANDBOX ONLY (kdstoyyeygcopkogqsyv) · production
-- (ijvqdvsvwtwxzcqmoqit) stays sealed.
-- Depends on: mig 092, 093, 323.

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS nex_chat_encryption_adoption_v;

CREATE MATERIALIZED VIEW nex_chat_encryption_adoption_v AS
WITH eligible AS (
  SELECT c.id AS conversation_id
  FROM nex_peer_conversation c
  WHERE EXISTS (SELECT 1 FROM nex_account_device_key k
                 WHERE k.account_id = c.participant_a_id AND k.retired_at IS NULL)
    AND EXISTS (SELECT 1 FROM nex_account_device_key k
                 WHERE k.account_id = c.participant_b_id AND k.retired_at IS NULL)
),
windowed AS (
  SELECT m.conversation_id,
         bool_and(m.encrypted) AS all_encrypted
  FROM nex_peer_message m
  WHERE m.sent_at >= now() - INTERVAL '14 days'
  GROUP BY m.conversation_id
),
joined AS (
  SELECT e.conversation_id, w.all_encrypted
  FROM eligible e
  JOIN windowed w ON w.conversation_id = e.conversation_id
)
SELECT
  (SELECT count(*) FROM eligible)                                              AS eligible_conversations,
  (SELECT count(*) FROM joined)                                                AS active_conversations,
  (SELECT count(*) FROM joined WHERE all_encrypted = true)                     AS fully_encrypted_conversations,
  COALESCE(
    (SELECT count(*) FROM joined WHERE all_encrypted = true)::numeric
    / NULLIF((SELECT count(*) FROM joined), 0)::numeric,
    0
  )                                                                            AS adoption_ratio,
  (now() - INTERVAL '14 days')                                                 AS window_start,
  now()                                                                        AS computed_at;

COMMENT ON MATERIALIZED VIEW nex_chat_encryption_adoption_v IS
  'D4 · read-only adoption telemetry · preceding 14 days · only metadata read · plaintext/ciphertext NOT referenced. REFRESH MATERIALIZED VIEW to recompute. Sealed 2026-11-10.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '325',
    'D4 · nex_chat_encryption_adoption_v materialized view (read-only telemetry)',
    'Sealed 2026-11-10. Helper only · no state change · no user data touched. Depends on mig 092, 093, 323.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '325';
--     DROP MATERIALIZED VIEW IF EXISTS nex_chat_encryption_adoption_v;
--   COMMIT;
--
--   Rollback consequence: view disappears · no data lost · no behaviour
--   change (view was telemetry only). I-5 satisfied.
