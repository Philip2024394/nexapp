-- nex-supabase/migrations/309_nex_peer_message_attachment_type_restore.sql
--
-- NEX peer-message attachment_type · regression repair ·
-- owner-authorised 2026-11-08 round 29j.
-- -----------------------------------------------------------------------------
-- WHY THIS EXISTS
--
-- Migration 306_nex_peer_message_call_invite.sql added 'call_invite' to the
-- attachment_type CHECK — correctly. But it ALSO narrowed the CHECK back to
-- only ('image', 'video', 'audio', 'call_invite'), inadvertently dropping
-- the types that were authorised in earlier sealed migrations:
--
--   · 059 · product
--   · 067 · menu_item
--   · 077 · cart_order
--   · 088 · product_share
--   · 119 · sticker
--   · 125 · link_preview
--   · 259 · document
--
-- Migration 259 explicitly restated the full sealed enum (lines 85-118) ·
-- Migration 306's narrowed restatement at lines 46-59 effectively overwrote
-- that state. Mig 306's own inline comment (lines 49-54) rationalised the
-- removal as "other types ride different tables + columns per their sealed
-- migrations" — but that is INCORRECT. All seven types above write directly
-- to nex_peer_message.attachment_type · the audit at 2026-11-08 confirmed
-- the regression via grep across the codebase.
--
-- IMPACT
--   · On any DB where 306 was applied (per CLAUDE.md §5: sandbox
--     kdstoyyeygcopkogqsyv only · NEVER production ijvqdvsvwtwxzcqmoqit),
--     new inserts with attachment_type IN ('product','menu_item','cart_order',
--     'product_share','sticker','link_preview','document') are rejected by
--     the CHECK.
--   · PRODUCTION enum is still at migration 259's state and remains valid.
--   · EXISTING rows with the pre-306 types survive on sandbox because
--     ALTER CONSTRAINT doesn't re-validate rows retroactively · only future
--     inserts fail.
--
-- WHAT 309 DOES
--   Re-widens the CHECK to the UNION of (sealed pre-306 enum) ∪ {call_invite}.
--   No data is altered. Idempotent · safe to re-apply.
--
-- Apply discipline (same pattern as 306/307/308):
--   · SANDBOX apply only via `scripts/apply-migration-309-sandbox.mjs`
--     (hard ref-check refusing production).
--   · PRODUCTION apply requires separate owner authorisation.

BEGIN;

ALTER TABLE public.nex_peer_message
  DROP CONSTRAINT IF EXISTS nex_peer_message_attachment_type_check;

ALTER TABLE public.nex_peer_message
  ADD CONSTRAINT nex_peer_message_attachment_type_check
  CHECK (
    attachment_type IS NULL
    OR attachment_type IN (
      -- Original sealed enum (restored from migration 259 state)
      'image',
      'video',
      'audio',
      'product',
      'menu_item',
      'cart_order',
      'product_share',
      'sticker',
      'link_preview',
      'document',
      -- Preserved from migration 306 (Call Center invites)
      'call_invite'
    )
  );

-- Update the column comment so future readers see the full canonical list.
COMMENT ON COLUMN public.nex_peer_message.attachment_type IS
  'Sealed enum · image | video | audio | product | menu_item | cart_order | product_share | sticker | link_preview | document | call_invite · each type is rendered by a dedicated client-side component. Canonical list restored by migration 309 after migration 306 inadvertently narrowed the CHECK.';

-- Migration history · consistent with migrations 304-308.
INSERT INTO public.nex_migration_history (version, description)
  VALUES ('309', 'nex_peer_message.attachment_type CHECK restored · repairs migration 306 regression that dropped product/menu_item/cart_order/product_share/sticker/link_preview/document')
  ON CONFLICT (version) DO NOTHING;

COMMIT;
