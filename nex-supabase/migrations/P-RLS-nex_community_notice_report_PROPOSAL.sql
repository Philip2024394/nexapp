-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P0 on nex_community_notice_report (migration 146 · no RLS).
-- Risk: reporter_account_id visible without RLS = retaliation risk.
--
-- Policy: reporter-only SELECT on own rows; INSERT must bind
-- reporter_account_id to the current user; moderation reads via
-- service_role / HQ.

BEGIN;

ALTER TABLE nex_community_notice_report ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_community_notice_report_reporter_select ON nex_community_notice_report;
CREATE POLICY nex_community_notice_report_reporter_select
  ON nex_community_notice_report
  FOR SELECT
  TO authenticated
  USING (
    reporter_account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS nex_community_notice_report_reporter_insert ON nex_community_notice_report;
CREATE POLICY nex_community_notice_report_reporter_insert
  ON nex_community_notice_report
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
--     DROP POLICY IF EXISTS nex_community_notice_report_reporter_insert ON nex_community_notice_report;
--     DROP POLICY IF EXISTS nex_community_notice_report_reporter_select ON nex_community_notice_report;
--     ALTER TABLE nex_community_notice_report DISABLE ROW LEVEL SECURITY;
--   COMMIT;
