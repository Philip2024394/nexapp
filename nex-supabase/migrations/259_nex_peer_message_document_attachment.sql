-- ============================================================================
-- NEX-native Migration 259 · nex_peer_message · document attachment type
-- ============================================================================
--
-- *** DRAFT · NOT YET APPLIED · AWAITING FOUNDER AUTHORISATION ***
--
-- Owner-authorised 2026-11-03 (Option 1 · Stage A). Extends the
-- `nex_peer_message_attachment_type_check` constraint to allow the
-- additional value 'document' so Peer Chat can deliver PDFs, Office
-- documents, zip archives and any other non-media file to the
-- recipient as a first-class message type.
--
-- Scope · additive only · no schema rewrites, no data mutation.
-- Mirrors the sealed Migration 125 pattern (which added 'link_preview')
-- and Migration 119 before it (added 'sticker'): drop the existing
-- CHECK, re-add it with the extra enum value. All existing rows
-- remain valid under the (now larger) allowed set.
--
-- Semantics for 'document':
--   · attachment_url  · public URL in the sealed `nex-peer-chat-
--     attachments` bucket (Migration 055 + 144 · bucket accepts
--     application/octet-stream which carries documents today).
--   · attachment_meta JSONB · already supports {mime, size_bytes,
--     filename} fields per peer-message-service.ts:141-146 ·
--     no column change needed · the renderer reads filename + mime +
--     size_bytes from attachment_meta to paint the document chip.
--   · body may be empty when a document is attached (same as other
--     attachment types · existing (url NULL)=(type NULL) invariant
--     from Migration 054 remains intact).
--
-- Why no new columns:
--   The three fields the recipient needs (filename, mime, size) are
--   already supported in attachment_meta per the sealed service type
--   (NexPeerAttachmentMeta in peer-message-service.ts). Adding
--   dedicated top-level columns would duplicate state and complicate
--   the (url NULL)=(type NULL) invariant for no gain.
--
-- Why no bucket migration:
--   The sealed `nex-peer-chat-attachments` bucket already allows
--   application/octet-stream MIME uploads (Migration 144, 2026-10-07
--   · "add application/octet-stream"). Documents upload today · they
--   are only rejected at the message-insert step by the CHECK this
--   migration extends. Removing the CHECK restriction completes the
--   path end-to-end.
--
-- Bridge 88 posture · UNCHANGED. Document bytes route through the
-- same plaintext storage path as image/video/audio in v1 (the sealed
-- deferral at _e2e-composer-intercept.tsx:24-27). Stage A2 will
-- encrypt all four attachment types together as a single security
-- model change. Documents MUST NOT be special-cased · the Bridge 88
-- posture applies uniformly.
--
-- RLS implications · NONE. nex_peer_message RLS policies (Migration
-- 047) gate reads + writes on conversation participation, not on
-- attachment_type. The new value flows through unchanged.
--
-- (url NULL)=(type NULL) invariant · UNCHANGED. The pairing CHECK
-- from Migration 054 (nex_peer_message_attachment_url_type_pairing)
-- is unaffected · the pairing invariant is enum-agnostic.
--
-- Rollback (reversible · no data mutation that cannot be undone):
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '259';
--     ALTER TABLE nex_peer_message
--       DROP CONSTRAINT IF EXISTS nex_peer_message_attachment_type_check;
--     ALTER TABLE nex_peer_message
--       ADD CONSTRAINT nex_peer_message_attachment_type_check
--       CHECK (
--         attachment_type IS NULL
--         OR attachment_type IN (
--           'image', 'video', 'audio',
--           'product', 'menu_item', 'cart_order', 'product_share',
--           'sticker', 'link_preview'
--         )
--       );
--   COMMIT;
--
--   Safety condition: rollback is safe IF AND ONLY IF no rows with
--   attachment_type='document' have been written since the forward
--   migration. If any document rows exist, the narrower CHECK will
--   fail with a constraint-violation error BEFORE the ALTER
--   succeeds · desired behaviour · prevents silent data loss. If
--   intentional, delete or re-type the document rows first:
--     UPDATE nex_peer_message SET attachment_type = NULL,
--       attachment_url = NULL WHERE attachment_type = 'document';
-- ============================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1 · Extend the attachment_type CHECK to allow 'document'
-- -------------------------------------------------------------------------
-- Mirrors the pattern used by Migration 125 (link_preview) and 119
-- (sticker): drop the old constraint, re-add it with the extra value.
-- Existing rows are unaffected because their attachment_type values
-- remain in the (now larger) allowed set.

ALTER TABLE nex_peer_message
  DROP CONSTRAINT IF EXISTS nex_peer_message_attachment_type_check;

ALTER TABLE nex_peer_message
  ADD CONSTRAINT nex_peer_message_attachment_type_check
  CHECK (
    attachment_type IS NULL
    OR attachment_type IN (
      'image',
      'video',
      'audio',
      'product',
      'menu_item',
      'cart_order',
      'product_share',
      'sticker',
      'link_preview',
      'document'
    )
  );

-- -------------------------------------------------------------------------
-- 2 · Migration history entry
-- -------------------------------------------------------------------------

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '259',
    'Stage A · nex_peer_message.attachment_type extended to include ''document'' so Peer Chat can deliver PDFs / Office docs / zip archives / etc. end-to-end. Additive · no new columns · no new indexes · no RLS change · no bucket change · Bridge 88 posture unchanged.',
    'Owner-authorised 2026-11-03 (Option 1 · Stage A). Pattern mirrors Migration 119 (sticker) + 125 (link_preview). Document bytes route through the same plaintext storage path as image/video/audio in v1 · Bridge 88 deferral intact · Stage A2 will encrypt all four attachment types together.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification queries (run manually after any eventual apply)
-- ============================================================================
--
--   -- Attachment type now includes 'document'?
--   SELECT pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conname = 'nex_peer_message_attachment_type_check';
--   -- Expected: CHECK ((attachment_type IS NULL) OR (attachment_type = ANY
--   --   (ARRAY['image'::text, 'video'::text, 'audio'::text, 'product'::text,
--   --     'menu_item'::text, 'cart_order'::text, 'product_share'::text,
--   --     'sticker'::text, 'link_preview'::text, 'document'::text])))
--
--   -- (url NULL)=(type NULL) pairing intact?
--   SELECT pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conname = 'nex_peer_message_attachment_url_type_pairing';
--
--   -- No rows affected by the migration?
--   SELECT count(*) FROM nex_peer_message WHERE attachment_type = 'document';
--   -- (should be 0 immediately post-migration · the extended enum is a
--   -- superset so no existing row needed to change)
--
--   -- Migration history records the apply?
--   SELECT * FROM nex_migration_history WHERE version = '259';
