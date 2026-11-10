-- Migration 326 · nex_peer_message_expire_undelivered() · D3 · 2026-11-10
-- =========================================================================
-- STATUS: PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY · SANDBOX ONLY
-- =========================================================================
--
-- Owner-sealed 2026-11-10 (chat-decisions-locked-2026-11-10.md D3):
--   · 30-day undelivered ciphertext cap. Flip delivery_status='expired'
--     on encrypted rows that have been pending for more than 30 days.
--     DOES NOT delete rows · just flips status. Caller (the orphan sweep
--     in mig 327 + a future admin tool) decides whether to hard-delete
--     the storage object later.
--
-- Semantics:
--   · Only affects nex_peer_message rows where:
--       encrypted = true
--       delivery_status = 'pending'
--       sent_at < now() - interval '30 days'
--   · Flips delivery_status to 'expired'. Keeps all other columns intact.
--   · Idempotent · safe to run every hour · safe to run twice back-to-
--     back. Already-expired rows are skipped by the WHERE clause.
--   · Returns rowcount (bigint).
--
-- Legacy row treatment (I-4):
--   · encrypted=false rows are NEVER touched (the WHERE clause excludes
--     them). Legacy plaintext retention policy stays entirely outside
--     this function.
--
-- Non-plaintext (I-1):
--   · Function reads delivery_status, encrypted, sent_at only. Never
--     touches body / ciphertext / nonce.
--
-- SECURITY DEFINER with pinned search_path · same pattern as mig 094 ·
-- callers do not need write access to nex_peer_message.
--
-- Depends on: mig 093 (encrypted + sent_at columns) · mig 324
-- (delivery_status column).
--
-- Apply target: SANDBOX ONLY (kdstoyyeygcopkogqsyv) · production
-- (ijvqdvsvwtwxzcqmoqit) stays sealed.

BEGIN;

CREATE OR REPLACE FUNCTION nex_peer_message_expire_undelivered(
  retain_days int DEFAULT 30
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_days int;
  flipped        bigint;
BEGIN
  -- Floor at 1 day · identical safeguard to mig 094 · prevents a
  -- misconfigured cron from expiring fresh rows.
  effective_days := GREATEST(retain_days, 1);

  WITH victims AS (
    UPDATE nex_peer_message
       SET delivery_status = 'expired'
     WHERE encrypted = true
       AND delivery_status = 'pending'
       AND sent_at < (now() - (effective_days || ' days')::interval)
     RETURNING id
  )
  SELECT count(*) INTO flipped FROM victims;

  RETURN flipped;
END;
$$;

COMMENT ON FUNCTION nex_peer_message_expire_undelivered(int) IS
  'D3 · sealed 2026-11-10. Flips delivery_status to expired for encrypted rows that stayed pending past retain_days (default 30, floor 1). Does NOT delete rows · idempotent · safe to run on any interval. Never touches encrypted=false rows or body/ciphertext columns.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '326',
    'D3 · nex_peer_message_expire_undelivered(int) SECURITY DEFINER sweep function',
    'Sealed 2026-11-10. Status-flip only · no deletion · idempotent. Caller decides whether to hard-delete storage objects later via mig 327 sweep.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '326';
--     DROP FUNCTION IF EXISTS nex_peer_message_expire_undelivered(int);
--   COMMIT;
--
--   Rollback consequence: sweep function disappears · pending rows older
--   than 30 days stay pending indefinitely until the function is
--   re-applied. No plaintext restored · no row deleted · I-5 satisfied.
