-- nex-supabase/migrations/309_nex_peer_message_attachment_type_restore.rollback.sql
--
-- Rollback for migration 309. Narrows the CHECK back to migration 306's
-- state (image / video / audio / call_invite only). Idempotent.
--
-- WARNING · applying this rollback re-introduces the regression that 309
-- was built to fix. Only use if 309 itself caused an unexpected downstream
-- issue · the sealed enum state before 306 was the migration 259 full
-- enum · which this rollback DOES NOT restore. For a full revert to pre-306,
-- apply the rollback for migration 306 after this one.
--
-- Hard restriction · SANDBOX ONLY · never applied to production without
-- separate owner authorisation.

BEGIN;

ALTER TABLE public.nex_peer_message
  DROP CONSTRAINT IF EXISTS nex_peer_message_attachment_type_check;

ALTER TABLE public.nex_peer_message
  ADD CONSTRAINT nex_peer_message_attachment_type_check
  CHECK (
    attachment_type IS NULL
    OR attachment_type IN (
      'image',
      'video',
      'audio',
      'call_invite'
    )
  );

COMMENT ON COLUMN public.nex_peer_message.attachment_type IS
  'image | video | audio | call_invite · narrowed by migration 309 rollback. WARNING · product/menu_item/cart_order/product_share/sticker/link_preview/document inserts will be rejected in this state.';

DELETE FROM public.nex_migration_history WHERE version = '309';

COMMIT;
