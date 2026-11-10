-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P0 on nex_community_notice_confirmation (migration 146 · no RLS).
-- Risk: table keys account_id + notice_id · leak = social-graph PII.
--
-- Policy: owner-only SELECT/INSERT on own account_id; service_role
-- handles any admin aggregations.

BEGIN;

ALTER TABLE nex_community_notice_confirmation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_community_notice_confirmation_owner_select ON nex_community_notice_confirmation;
CREATE POLICY nex_community_notice_confirmation_owner_select
  ON nex_community_notice_confirmation
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS nex_community_notice_confirmation_owner_insert ON nex_community_notice_confirmation;
CREATE POLICY nex_community_notice_confirmation_owner_insert
  ON nex_community_notice_confirmation
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS nex_community_notice_confirmation_owner_delete ON nex_community_notice_confirmation;
CREATE POLICY nex_community_notice_confirmation_owner_delete
  ON nex_community_notice_confirmation
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
--     DROP POLICY IF EXISTS nex_community_notice_confirmation_owner_delete ON nex_community_notice_confirmation;
--     DROP POLICY IF EXISTS nex_community_notice_confirmation_owner_insert ON nex_community_notice_confirmation;
--     DROP POLICY IF EXISTS nex_community_notice_confirmation_owner_select ON nex_community_notice_confirmation;
--     ALTER TABLE nex_community_notice_confirmation DISABLE ROW LEVEL SECURITY;
--   COMMIT;
