-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P0 on nex_community_card_update (migration 148 · no RLS).
-- Mirror policy from parent card (zone-member SELECT, author INSERT).

BEGIN;

ALTER TABLE nex_community_card_update ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_community_card_update_zone_select ON nex_community_card_update;
CREATE POLICY nex_community_card_update_zone_select
  ON nex_community_card_update
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM nex_community_card c
        JOIN nex_community_membership m ON m.hyperlocal_zone_id = c.hyperlocal_zone_id
                                        OR m.district_zone_id   = c.district_zone_id
        JOIN nex_account a             ON a.id = m.account_id
       WHERE c.id = nex_community_card_update.card_id
         AND a.supabase_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS nex_community_card_update_author_insert ON nex_community_card_update;
CREATE POLICY nex_community_card_update_author_insert
  ON nex_community_card_update
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM nex_community_card c
        JOIN nex_account a ON a.id = c.author_account_id
       WHERE c.id = nex_community_card_update.card_id
         AND a.supabase_user_id = auth.uid()
    )
  );

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP POLICY IF EXISTS nex_community_card_update_author_insert ON nex_community_card_update;
--     DROP POLICY IF EXISTS nex_community_card_update_zone_select   ON nex_community_card_update;
--     ALTER TABLE nex_community_card_update DISABLE ROW LEVEL SECURITY;
--   COMMIT;
