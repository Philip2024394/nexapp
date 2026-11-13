-- 345_nex_message_e2e_encryption_rollback.sql
-- Rollback for mig 345 · drops the E2E crypto columns + CHECKs +
-- indexes and restores body NOT NULL.

BEGIN;

DROP INDEX IF EXISTS idx_nex_message_pending_delivery;
DROP INDEX IF EXISTS idx_nex_message_group;

ALTER TABLE public.nex_message
  DROP CONSTRAINT IF EXISTS nex_message_attachment_type_known;
ALTER TABLE public.nex_message
  DROP CONSTRAINT IF EXISTS nex_message_shape_plaintext_or_encrypted;

ALTER TABLE public.nex_message
  DROP COLUMN IF EXISTS delivery_status,
  DROP COLUMN IF EXISTS reply_to_id,
  DROP COLUMN IF EXISTS send_intent_id,
  DROP COLUMN IF EXISTS delivered_at,
  DROP COLUMN IF EXISTS message_group_id,
  DROP COLUMN IF EXISTS attachment_meta,
  DROP COLUMN IF EXISTS attachment_type,
  DROP COLUMN IF EXISTS recipient_device_id,
  DROP COLUMN IF EXISTS sender_device_id,
  DROP COLUMN IF EXISTS sender_public_key,
  DROP COLUMN IF EXISTS nonce,
  DROP COLUMN IF EXISTS ciphertext,
  DROP COLUMN IF EXISTS encrypted;

-- Restore body NOT NULL (only safe if all rows have body populated).
ALTER TABLE public.nex_message
  ALTER COLUMN body SET NOT NULL;

DELETE FROM nex_migration_history WHERE version = '345';

COMMIT;
