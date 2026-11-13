-- 345_nex_message_e2e_encryption.sql
-- -----------------------------------------------------------------------------
-- Owner-sealed 2026-11-13 · bring nex_message onto the sealed device-
-- only E2E architecture so shop-scoped business conversations can run
-- with the same encryption guarantees as nex_peer_message. Supersedes
-- the plaintext-only shape sealed in mig 004.
-- DRAFTED · NOT AUTHORISED TO APPLY (owner must say "apply mig 345
-- sandbox" naming kdstoyyeygcopkogqsyv before this runs anywhere).
-- -----------------------------------------------------------------------------
-- Context
--   NEX has two parallel conversation systems:
--     · nex_peer_conversation + nex_peer_message · person-to-person E2E
--     · nex_conversation      + nex_message      · business-scoped,
--                                                    PLAINTEXT today
--   The owner's "every shop has its own dedicated customer conversation"
--   architecture requires shop chat to live on the business-scoped
--   system (nex_conversation keys on business_id · multiple shops per
--   owner get independent conversations). The existing plaintext shape
--   would break the device-only E2E seal (2026-11-09) · this migration
--   closes the gap by mirroring nex_peer_message's crypto columns.
--
-- Columns added (nullable · legacy plaintext rows preserved):
--   encrypted              boolean · NOT NULL DEFAULT false
--   ciphertext             bytea   · NULL
--   nonce                  bytea   · NULL
--   sender_public_key      text    · NULL
--   sender_device_id       text    · NULL
--   recipient_device_id    text    · NULL
--   attachment_type        text    · NULL  (image|video|audio|document|product)
--   attachment_meta        jsonb   · NULL
--   message_group_id       uuid    · NULL  (groups per-device encrypted copies)
--   delivered_at           timestamptz · NULL
--   send_intent_id         uuid    · NULL  (client idempotency token)
--   reply_to_id            uuid    · NULL  FK nex_message(id) ON DELETE SET NULL
--   delivery_status        text    · NOT NULL DEFAULT 'pending'
--
-- Also makes `body` NULLABLE for the first time. Plaintext legacy rows
-- keep their body; encrypted new rows store ciphertext/nonce and leave
-- body NULL. The CHECK below enforces the contract:
--   - plaintext row  · encrypted=false AND body IS NOT NULL
--   - encrypted row  · encrypted=true  AND ciphertext IS NOT NULL
--                                       AND nonce      IS NOT NULL
--                                       AND sender_public_key   IS NOT NULL
--                                       AND sender_device_id    IS NOT NULL
--                                       AND recipient_device_id IS NOT NULL
--
-- CHECK is added NOT VALID so pre-existing plaintext rows (if any) are
-- preserved. All future INSERTs must satisfy one of the two shapes.
--
-- Indexes:
--   idx_nex_message_group · partial on message_group_id so clients can
--     fetch all encrypted copies for one logical send in a single query
--   idx_nex_message_pending_delivery · partial for delivery-status
--     bookkeeping (optional · used by push-notification dispatcher)
--
-- Scope-restricted:
--   · No RLS policy change (participant-scope policies on nex_message
--     from mig 004 already work with the new columns · data_type
--     changes only affect INSERT/SELECT shape)
--   · No table rename, no FK direction change
--   · body remains column-order-preserving · existing SELECT * callers
--     keep working
--
-- Rollback (co-authored in _rollback.sql):
--   drops the CHECK, drops the added columns, restores body NOT NULL,
--   deletes the migration_history row.

BEGIN;

-- 1 · Relax body NOT NULL so encrypted rows can store ciphertext only.
ALTER TABLE public.nex_message
  ALTER COLUMN body DROP NOT NULL;

-- 2 · Crypto + attachment columns.
ALTER TABLE public.nex_message
  ADD COLUMN IF NOT EXISTS encrypted           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ciphertext          bytea,
  ADD COLUMN IF NOT EXISTS nonce               bytea,
  ADD COLUMN IF NOT EXISTS sender_public_key   text,
  ADD COLUMN IF NOT EXISTS sender_device_id    text,
  ADD COLUMN IF NOT EXISTS recipient_device_id text,
  ADD COLUMN IF NOT EXISTS attachment_type     text,
  ADD COLUMN IF NOT EXISTS attachment_meta     jsonb,
  ADD COLUMN IF NOT EXISTS message_group_id    uuid,
  ADD COLUMN IF NOT EXISTS delivered_at        timestamptz,
  ADD COLUMN IF NOT EXISTS send_intent_id      uuid,
  ADD COLUMN IF NOT EXISTS reply_to_id         uuid REFERENCES public.nex_message(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_status     text NOT NULL DEFAULT 'pending';

-- 3 · Shape CHECK · plaintext XOR encrypted (NOT VALID so legacy rows
--     without the new columns stay valid).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nex_message_shape_plaintext_or_encrypted'
  ) THEN
    ALTER TABLE public.nex_message
      ADD CONSTRAINT nex_message_shape_plaintext_or_encrypted
        CHECK (
          (encrypted = false AND body IS NOT NULL)
          OR
          (encrypted = true
             AND ciphertext          IS NOT NULL
             AND nonce               IS NOT NULL
             AND sender_public_key   IS NOT NULL
             AND sender_device_id    IS NOT NULL
             AND recipient_device_id IS NOT NULL)
        ) NOT VALID;
  END IF;
END $$;

-- 4 · Attachment-type CHECK (mirrors nex_peer_message doctrine).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nex_message_attachment_type_known'
  ) THEN
    ALTER TABLE public.nex_message
      ADD CONSTRAINT nex_message_attachment_type_known
        CHECK (
          attachment_type IS NULL
          OR attachment_type IN ('image','video','audio','document','product')
        );
  END IF;
END $$;

-- 5 · Group index · lets clients fetch every encrypted copy belonging
--     to one logical send in a single round trip.
CREATE INDEX IF NOT EXISTS idx_nex_message_group
  ON public.nex_message (message_group_id)
  WHERE message_group_id IS NOT NULL;

-- 6 · Delivery bookkeeping · partial index on pending rows so the
--     push-notification dispatcher can scan cheaply.
CREATE INDEX IF NOT EXISTS idx_nex_message_pending_delivery
  ON public.nex_message (conversation_id, created_at)
  WHERE delivery_status = 'pending';

COMMENT ON COLUMN public.nex_message.encrypted IS
  'Device-only E2E flag (2026-11-13 · owner-sealed). When true, body is NULL and ciphertext/nonce/sender_public_key/sender_device_id/recipient_device_id carry the encrypted payload for one target device. Mirrors nex_peer_message.encrypted.';
COMMENT ON COLUMN public.nex_message.attachment_type IS
  'Shop chat supports product cards via attachment_type=''product'' + attachment_meta.product_id. Mirrors nex_peer_message attachment taxonomy.';

INSERT INTO nex_migration_history (version, applied_at, description)
VALUES (
  '345',
  now(),
  'nex_message · E2E crypto columns + product attachment · brings business-scoped chat onto the sealed device-only E2E architecture'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
