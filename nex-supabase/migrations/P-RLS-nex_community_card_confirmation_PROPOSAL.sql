-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P0 on nex_community_card_confirmation (migration 148 · no RLS).
-- Mirror policy from nex_community_notice_confirmation: owner-only
-- SELECT/INSERT/DELETE on own account_id.

BEGIN;

ALTER TABLE nex_community_card_confirmation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_community_card_confirmation_owner_select ON nex_community_card_confirmation;
CREATE POLICY nex_community_card_confirmation_owner_select
  ON nex_community_card_confirmation
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS nex_community_card_confirmation_owner_insert ON nex_community_card_confirmation;
CREATE POLICY nex_community_card_confirmation_owner_insert
  ON nex_community_card_confirmation
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS nex_community_card_confirmation_owner_delete ON nex_community_card_confirmation;
CREATE POLICY nex_community_card_confirmation_owner_delete
  ON nex_community_card_confirmation
  FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP POLICY IF EXISTS nex_community_card_confirmation_owner_delete ON nex_community_card_confirmation;
--     DROP POLICY IF EXISTS nex_community_card_confirmation_owner_insert ON nex_community_card_confirmation;
--     DROP POLICY IF EXISTS nex_community_card_confirmation_owner_select ON nex_community_card_confirmation;
--     ALTER TABLE nex_community_card_confirmation DISABLE ROW LEVEL SECURITY;
--   COMMIT;
