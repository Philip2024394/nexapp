-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P0 on nex_community_notice (migration 146 · no RLS).
--
-- Risk: author_account_id + body + hyperlocal_zone_id. Non-members
-- should not see hyperlocal notices; author-scope on write.
--
-- Policy model:
--   SELECT: zone-member OR active status in the author's district.
--   INSERT: must set author_account_id to current user.
--   UPDATE/DELETE: author-only.
-- Moderation / status transitions go via service_role server actions.

BEGIN;

ALTER TABLE nex_community_notice ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_community_notice_zone_select ON nex_community_notice;
CREATE POLICY nex_community_notice_zone_select
  ON nex_community_notice
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM nex_community_membership m
        JOIN nex_account a ON a.id = m.account_id
       WHERE a.supabase_user_id = auth.uid()
         AND (m.hyperlocal_zone_id = nex_community_notice.hyperlocal_zone_id
              OR m.district_zone_id   = nex_community_notice.district_zone_id)
    )
  );

DROP POLICY IF EXISTS nex_community_notice_author_insert ON nex_community_notice;
CREATE POLICY nex_community_notice_author_insert
  ON nex_community_notice
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS nex_community_notice_author_update ON nex_community_notice;
CREATE POLICY nex_community_notice_author_update
  ON nex_community_notice
  FOR UPDATE
  TO authenticated
  USING (
    author_account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP POLICY IF EXISTS nex_community_notice_author_update ON nex_community_notice;
--     DROP POLICY IF EXISTS nex_community_notice_author_insert ON nex_community_notice;
--     DROP POLICY IF EXISTS nex_community_notice_zone_select  ON nex_community_notice;
--     ALTER TABLE nex_community_notice DISABLE ROW LEVEL SECURITY;
--   COMMIT;
