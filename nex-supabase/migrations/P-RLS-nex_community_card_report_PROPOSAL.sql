-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P0 on nex_community_card_report (migration 148 · no RLS).
-- Mirror policy from nex_community_notice_report: reporter-only SELECT;
-- reporter-only INSERT with reporter_account_id bound to auth.uid().

BEGIN;

ALTER TABLE nex_community_card_report ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_community_card_report_reporter_select ON nex_community_card_report;
CREATE POLICY nex_community_card_report_reporter_select
  ON nex_community_card_report
  FOR SELECT
  TO authenticated
  USING (
    reporter_account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS nex_community_card_report_reporter_insert ON nex_community_card_report;
CREATE POLICY nex_community_card_report_reporter_insert
  ON nex_community_card_report
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP POLICY IF EXISTS nex_community_card_report_reporter_insert ON nex_community_card_report;
--     DROP POLICY IF EXISTS nex_community_card_report_reporter_select ON nex_community_card_report;
--     ALTER TABLE nex_community_card_report DISABLE ROW LEVEL SECURITY;
--   COMMIT;
