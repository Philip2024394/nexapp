-- 279_peer_message_edit.sql
-- Owner-authored 2026-11-05 later-same-day iter 10 · adds edit-sent-
-- message support to nex_peer_message. STATUS: DRAFT · NOT YET APPLIED.
-- Needs separate owner authorisation per CLAUDE.md §5 before running
-- against Supabase project ijvqdvsvwtwxzcqmoqit.
--
-- Columns:
--   edited_at      timestamptz · null until the first edit · set to the
--                  moment the sender saved an edit. UI shows "edited"
--                  below bubble when non-null.
--   edit_history   jsonb · default '[]'::jsonb · array of prior-body
--                  snapshots so the audit trail is preserved. Each
--                  entry: { body: text, edited_at: timestamptz } with
--                  the body being what the message said BEFORE the
--                  edit that produced this entry.
--
-- Design decisions:
--   · Edit is a SENDER-ONLY action · RLS keeps it that way (sender_
--     account_id must match auth.uid()).
--   · Edit window = 15 minutes from sent_at. Enforced in the service
--     layer (editPeerMessage) because we want a friendly server
--     response, not a raw constraint-violation error.
--   · Encrypted messages (bridge 76 · encrypted=true) can still be
--     edited · the new body is re-encrypted on the client before
--     editPeerMessage is called with ciphertext/nonce/sender_public_
--     key updates. First version of this migration keeps the schema
--     agnostic · the service enforces body vs ciphertext replacement
--     as appropriate.
--   · Deleted-for-everyone messages cannot be edited · the service
--     rejects.

BEGIN;

ALTER TABLE public.nex_peer_message
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS edit_history jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.nex_peer_message.edited_at IS
  'Owner directive 2026-11-05 · timestamp of last edit · null when the message has never been edited.';
COMMENT ON COLUMN public.nex_peer_message.edit_history IS
  'Owner directive 2026-11-05 · append-only array of { body, edited_at } snapshots BEFORE each edit · used for audit trail + undo surface.';

COMMIT;
