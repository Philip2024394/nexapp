-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P0 on nex_community_notice_update (migration 146 · no RLS).
-- Policy mirrors the parent nex_community_notice policy (zone-scoped
-- SELECT for members; author-only INSERT).

BEGIN;

ALTER TABLE nex_community_notice_update ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_community_notice_update_zone_select ON nex_community_notice_update;
CREATE POLICY nex_community_notice_update_zone_select
  ON nex_community_notice_update
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM nex_community_notice n
        JOIN nex_community_membership m ON m.hyperlocal_zone_id = n.hyperlocal_zone_id
                                        OR m.district_zone_id   = n.district_zone_id
        JOIN nex_account a             ON a.id = m.account_id
       WHERE n.id = nex_community_notice_update.notice_id
         AND a.supabase_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS nex_community_notice_update_author_insert ON nex_community_notice_update;
CREATE POLICY nex_community_notice_update_author_insert
  ON nex_community_notice_update
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM nex_community_notice n
        JOIN nex_account a ON a.id = n.author_account_id
       WHERE n.id = nex_community_notice_update.notice_id
         AND a.supabase_user_id = auth.uid()
    )
  );

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP POLICY IF EXISTS nex_community_notice_update_author_insert ON nex_community_notice_update;
--     DROP POLICY IF EXISTS nex_community_notice_update_zone_select   ON nex_community_notice_update;
--     ALTER TABLE nex_community_notice_update DISABLE ROW LEVEL SECURITY;
--   COMMIT;
