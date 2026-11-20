-- ============================================================================
-- ROLLBACK PREVIEW · candidate migration 356
-- UNAPPLIED · REVIEW REQUIRED · DO NOT APPLY WITHOUT SEPARATE AUTHORISATION
-- ============================================================================
--
-- Rollback for `356_nex_group_call_invite_v2_PREVIEW.sql`.  Promoted
-- sibling will live at
-- `nex-supabase/migrations/356_nex_group_call_invite_v2_rollback.sql`.
--
-- What rollback DOES
--   · DROPs the mig-356 signature of `nex_invite_to_call_tx`
--     (p_invitee_account_id, p_media_type, p_host_country,
--      p_attachment_meta, p_invite_body, p_attachment_url,
--      p_existing_session_id).
--   · Deletes the mig-356 row from `nex_migration_history`.
--
-- What rollback does NOT do (deliberately)
--   · Does NOT restore the mig-353 function body.  Restoring it would:
--       1. Reintroduce GB-ATTACH-PAIR: every happy-path call would
--          raise 23514 on the pair-check, because the 353 body writes
--          `attachment_type = 'call_invite'` with no `attachment_url`.
--       2. Reintroduce the §16.39.3 fail-open-NULL body gap.  The
--          353 identity guard is fail-OPEN when `auth.uid()` is NULL.
--          The permission boundary (anon REVOKE from §16.39.3)
--          currently blocks anon callers, but the body itself would
--          still trust a supplied `p_self_supabase_user_id` if any
--          surviving grant leaked NULL `auth.uid()` into the function.
--     Both outcomes are UNSAFE · policy: rollback never restores
--     unsafe prior bodies.  See the Lane G-B restore-ban clause in
--     the ledger (§16.40.4).
--
-- Post-rollback behaviour
--   · The function `nex_invite_to_call_tx` does not exist in any
--     signature after this rollback runs.
--   · Any RPC call to `nex_invite_to_call_tx` fails fast with
--     Postgres error `42883 undefined_function`.
--   · The TypeScript wrapper
--     (`src/lib/nex-native/calls/invite-service.transactional-candidate.ts`)
--     remains disabled behind its feature flag · no code path reaches
--     the missing function in normal operation.
--   · The legacy 4-insert call-site in
--     `src/lib/nex-native/calls/invite-service.ts` is UNTOUCHED and
--     continues to serve call invites without transactional
--     atomicity (same posture as before mig 353 was applied).
--   · §16.39 evidence anchored to mig 353's applied body remains
--     historically valid · the body it described simply no longer
--     exists post-rollback.
--
-- Re-apply
--   To restore mig-356 behaviour after rollback, re-run
--   `node scripts/apply-migration-356-sandbox.mjs` (if authorised).
--   No data-level rollback is needed · this function performs
--   session/participant/conversation/message writes atomically inside
--   its own subtransaction, and dropping the function does not
--   retroactively alter any already-written rows.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS nex_invite_to_call_tx(
  UUID,  -- p_invitee_account_id
  TEXT,  -- p_media_type
  TEXT,  -- p_host_country
  JSONB, -- p_attachment_meta
  TEXT,  -- p_invite_body
  TEXT,  -- p_attachment_url
  UUID   -- p_existing_session_id
);

DELETE FROM nex_migration_history WHERE version = '356';

COMMIT;
