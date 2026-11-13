-- 344_nex_business_shop_intro_message.sql
-- -----------------------------------------------------------------------------
-- NEX Shop · editable introduction message shown as the shop owner's
-- first chat bubble when a visitor opens the public shop chat.
-- Owner-sealed 2026-11-13 · shop-to-customer contact experience.
-- DRAFTED · NOT AUTHORISED TO APPLY (sealed "do not apply migrations
-- without separate approval" directive · owner must name sandbox
-- kdstoyyeygcopkogqsyv in a separate word-trigger before apply).
-- -----------------------------------------------------------------------------
-- Scope:
--   · Adds ONE nullable text column to nex_business.
--   · CHECK clamps length to <=500 characters so the intro renders as
--     a single readable bubble · callers can still wrap at render.
--   · No backfill · NULL means "fall back to the default template"
--     (resolveShopIntroMessage() returns the auto-populated default).
--   · No RLS policy change · nex_business is publicly readable for
--     unauthenticated viewers already (public shop page needs this).
--
-- Default template rendered client-side when the column is NULL or
-- empty (never persisted · owners can customise and tap save):
--   "Hi! Welcome to <shop>. Thanks for visiting our shop. If you have
--    any questions about our products, prices or services, just send
--    us a message. We're happy to help!"
--
-- Chat architecture note (2026-11-09 device-only E2E seal):
--   The intro bubble is PSEUDO-MESSAGE · displayed client-side when
--   the conversation has zero real nex_peer_message rows AND the peer
--   owns a business. It is NEVER stored as a message · the server
--   just reads this text column and the client paints it as the
--   first bubble. Visitor-sent replies still flow through the sealed
--   E2E peer-message encryption path · no message content touches
--   the server.
--
-- Rollback (if ever needed):
--   BEGIN;
--     ALTER TABLE nex_business DROP CONSTRAINT IF EXISTS
--       nex_business_shop_intro_message_length;
--     ALTER TABLE nex_business DROP COLUMN IF EXISTS shop_intro_message;
--   COMMIT;

BEGIN;

ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS shop_intro_message text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nex_business_shop_intro_message_length'
  ) THEN
    ALTER TABLE public.nex_business
      ADD CONSTRAINT nex_business_shop_intro_message_length
        CHECK (
          shop_intro_message IS NULL
          OR length(shop_intro_message) <= 500
        );
  END IF;
END $$;

COMMENT ON COLUMN public.nex_business.shop_intro_message IS
  'Shop owner''s editable first-bubble introduction for the public shop chat. NULL = fall back to the default template (client-side). Max 500 chars.';

INSERT INTO nex_migration_history (version, applied_at)
VALUES ('344', now())
ON CONFLICT (version) DO NOTHING;

COMMIT;
