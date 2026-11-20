-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 362 · add accepted_at to nex_group_call_participant so
--                 acceptance has its own column representation separate
--                 from joined_at.
-- ─────────────────────────────────────────────────────────────────────────────
-- NEX Gate A Connected Matrix · §16.48.25 · Lane 2
-- Dated: 2026-11-20
-- Status: authorised 2026-11-20 for sandbox kdstoyyeygcopkogqsyv only.
--         Production ijvqdvsvwtwxzcqmoqit SEALED · do not apply to prod.
--
-- Target refs: sandbox kdstoyyeygcopkogqsyv (sealed); production
-- ijvqdvsvwtwxzcqmoqit (SEALED · DO NOT APPLY TO PRODUCTION).
--
-- Problem
-- -------
-- Today, nex_group_call_participant has only three lifecycle timestamps:
--
--   invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()   -- row created
--   joined_at  TIMESTAMPTZ NULL                     -- actually in the room
--   left_at    TIMESTAMPTZ NULL                     -- left / declined
--
-- Two production code paths currently abuse `joined_at` to record
-- "acceptance" (invitee tapped Accept but has not yet connected to the
-- WebRTC room):
--
--   (a) src/app/nex-native/call/preview/page.tsx::acceptInviteOnLoad
--       Writes `joined_at = now()` when the viewer loads the page with
--       ?accept=1. This happens BEFORE any WebRTC connection exists.
--
--   (b) src/lib/nex-native/calls/group-call-service.ts::createGroupCallSession
--       Writes `joined_at = now()` for the host row at session creation
--       time. The host is not yet in the room at that moment — they
--       still need to mount GroupCallEngine and establish peer
--       connections.
--
-- Both writes fake the "actually in the room" semantic that
-- `joined_at` documents. Downstream readers that use
-- `joined_at IS NOT NULL` as a "live participant" signal are wrong
-- in these two cases.
--
-- Fix
-- ---
-- Add an explicit `accepted_at` column so acceptance has its own
-- representation. Lane 2 of §16.48.25 removes the two faked writes
-- above and introduces a server action (`confirmRoomJoin`) that writes
-- `joined_at` only in response to a trusted room-connected signal.
--
-- Column semantics after this migration:
--
--   invited_at   · row created (RPC or INSERT · unchanged)
--   accepted_at  · NEW · invitee pressed Accept · set by the preview-page
--                  server action · NEVER implies room presence
--   joined_at    · peer connection confirmed live by the server action
--                  (`confirmRoomJoin`) · the only trusted "in the room" signal
--   left_at      · explicit leave or decline (unchanged)
--
-- Backfill
-- --------
-- No backfill. Historical rows have `joined_at` set by the two legacy
-- writes above and their `accepted_at` is NULL. That is semantically
-- correct for the historical data: we do not have a trustworthy
-- accepted_at for rows written before this migration and inventing one
-- would repeat the original mistake. Readers that need a boolean
-- "was accepted?" fallback for historical rows can treat
-- `accepted_at IS NOT NULL OR joined_at IS NOT NULL` as acceptance
-- during the transition window.
--
-- Precedent
-- ---------
-- nex-supabase/migrations/215_nex_friend_request.sql:67 adds an
-- `accepted_at timestamptz` to nex_friend_request. The column shape
-- and null-by-default semantics are identical.
--
-- RLS impact
-- ----------
-- NONE. Existing policies on nex_group_call_participant key off
-- `account_id` + `session_id` + the SECURITY DEFINER helper
-- `nex_is_participant_in_session` (mig 360). None of them read
-- `joined_at` or `accepted_at`. Adding a nullable column changes
-- neither policy evaluation nor the row visibility a caller sees.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE nex_group_call_participant
  ADD COLUMN accepted_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN nex_group_call_participant.accepted_at IS
  'Set when the invitee presses Accept on the preview page. Separate from joined_at, which is only set by the server after a trusted room-connected signal (§16.48.25 Lane 2, 2026-11-20).';

INSERT INTO nex_migration_history(version, description, notes)
VALUES (
  '362',
  'Add accepted_at to nex_group_call_participant · separates acceptance from joined_at',
  'Gate A §16.48.25 Lane 2. Authorised 2026-11-20 for sandbox kdstoyyeygcopkogqsyv. Pairs with removing the two joined_at=NOW() fakes in preview/page.tsx::acceptInviteOnLoad and group-call-service.ts::createGroupCallSession and adding the confirmRoomJoin server action as the sole trusted writer of joined_at.'
);

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback (commented · for reference only)
-- ─────────────────────────────────────────────────────────────────────────────
-- BEGIN;
--   ALTER TABLE nex_group_call_participant DROP COLUMN accepted_at;
--   DELETE FROM nex_migration_history WHERE version = '362';
-- COMMIT;
-- ─────────────────────────────────────────────────────────────────────────────
