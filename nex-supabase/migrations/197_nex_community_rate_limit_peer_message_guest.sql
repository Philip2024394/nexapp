-- ============================================================================
-- NEX-native Migration 197 · nex_community_rate_limit · add peer_message_guest action
-- ============================================================================
--
-- Purpose:
--   Extend the sealed CHECK constraint on `nex_community_rate_limit.action`
--   to include a new action key, `peer_message_guest`, so the existing
--   rolling-window primitive at `src/lib/nex-native/community/rate-limit.ts`
--   can be reused to limit guest-chat follow-up message sends.
--
--   This migration closes design-contract gap G1 across the wider guest-
--   chat surface (not just the NEX-Official flow). It is the SMALLER of
--   two independent gaps identified in the Stage-2 security audit; the
--   second gap (fingerprint re-check · G2) requires extending the
--   `sendGuestMessageAction` client contract and is deferred to a
--   separate design + implementation pass (see roadmap §D.2 and the
--   security audit §5.5 V2).
--
-- Doctrine:
--   · The rate-limit primitive key is `(nex_account.id, action,
--     window_started_at)`. Provisional accounts are real `nex_account`
--     rows per Bridge 99 §7B, so this keying works unchanged for
--     guest-chat follow-ups.
--   · The CHECK extension pattern mirrors migrations 150 and 152:
--     DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT with the full current
--     list.
--   · The TypeScript union + per-action config lives at
--     `src/lib/nex-native/community/types.ts` and is extended in the
--     same bounded PR as this migration (co-ordered: TS change becomes
--     effective only after this migration is applied).
--
-- Safety stance:
--   · Code is written to FAIL OPEN when this migration has not yet been
--     applied (a CHECK violation on INSERT is caught + logged + the
--     message is allowed through). This preserves current behaviour
--     exactly (no rate limit today). The limit becomes HARD only once
--     this migration is applied.
--   · Nothing in Vault, theme-commerce (191–196), Bridge 99 orchestrator,
--     fingerprint pipeline, risk service, launch flags, account identity,
--     or Phase C claim is touched.
--
-- Rollback:
--   Statement ordering matters · the narrower post-rollback CHECK does
--   NOT list `peer_message_guest`, so any surviving `peer_message_guest`
--   row would make `ADD CONSTRAINT` validate-against-existing-data and
--   abort the whole rollback transaction with:
--     ERROR: check constraint "ck_rl_action" of relation
--            "nex_community_rate_limit" is violated by some row
--   Therefore: DELETE the `peer_message_guest` rows FIRST, then swap
--   the constraint. The restored CHECK below matches the exact list
--   that was in force after migration 152 and before 197 (verified
--   against 152 lines 100-108).
--
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '197';
--     -- Must run BEFORE the narrower ADD CONSTRAINT otherwise ADD aborts.
--     DELETE FROM nex_community_rate_limit WHERE action = 'peer_message_guest';
--     ALTER TABLE nex_community_rate_limit
--       DROP CONSTRAINT IF EXISTS ck_rl_action;
--     ALTER TABLE nex_community_rate_limit
--       ADD CONSTRAINT ck_rl_action CHECK (action IN (
--         'notice_create','notice_update','notice_confirm','notice_resolve','notice_report',
--         'card_create','card_update','card_confirm','card_resolve','card_report',
--         'card_photo_upload',
--         'business_welcome_publish','business_welcome_retract'
--       ));
--   COMMIT;
-- ============================================================================

BEGIN;

-- Prerequisite · the primitive table and the latest sealed CHECK must
-- already be in place.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'nex_community_rate_limit' AND relkind = 'r') THEN
    RAISE EXCEPTION 'migration 197 requires nex_community_rate_limit (migration 146)';
  END IF;
END $$;

-- Extend the CHECK · mirrors migration 152's pattern. Full current
-- list is reproduced inline so a future contributor can see the whole
-- allowed set at a glance.
ALTER TABLE nex_community_rate_limit
  DROP CONSTRAINT IF EXISTS ck_rl_action;

ALTER TABLE nex_community_rate_limit
  ADD CONSTRAINT ck_rl_action CHECK (action IN (
    'notice_create','notice_update','notice_confirm','notice_resolve','notice_report',
    'card_create','card_update','card_confirm','card_resolve','card_report',
    'card_photo_upload',
    'business_welcome_publish','business_welcome_retract',
    'peer_message_guest'
  ));

COMMENT ON CONSTRAINT ck_rl_action ON nex_community_rate_limit IS
  'Allowed action keys for the rate-limit primitive. Extended by migration 197 to include peer_message_guest · the guest-chat follow-up send limit (closes Stage-2 security audit gap G1 across all guest conversations). Future extensions MUST re-list every previously allowed action key in a new DROP+ADD migration.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '197',
    'nex_community_rate_limit · add peer_message_guest action key',
    'Extends ck_rl_action CHECK to include peer_message_guest · reuses the sealed rolling-window primitive at src/lib/nex-native/community/rate-limit.ts to apply a per-provisional-account frequency limit on sendGuestMessageAction. Closes the design contract G1 gap across every guest-chat caller, not just NEX1. Does NOT address G2 (fingerprint re-check on follow-up) · G2 requires extending the client contract and is deferred to a separate design pass. Application code is written to fail-open until this migration applies · once applied, the limit becomes a hard enforcement at the DB level.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'nex_community_rate_limit'::regclass
--      AND conname = 'ck_rl_action';
--     → expect the CHECK list to include 'peer_message_guest'
--   SELECT * FROM nex_migration_history WHERE version = '197';
--
--   -- Exercise insert path:
--   INSERT INTO nex_community_rate_limit (account_id, action, window_started_at, count)
--   VALUES ('<any valid nex_account.id>', 'peer_message_guest', date_trunc('hour', now()), 1)
--   ON CONFLICT (account_id, action, window_started_at) DO UPDATE SET count = EXCLUDED.count;
--     → expect: 1 row upserted
--   DELETE FROM nex_community_rate_limit
--    WHERE account_id = '<same>' AND action = 'peer_message_guest';
