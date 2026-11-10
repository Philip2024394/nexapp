-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P0 on nex_community_card (migration 148 · no RLS).
-- Policy mirrors nex_community_notice (zone-scoped SELECT for members;
-- author-only write).

BEGIN;

ALTER TABLE nex_community_card ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_community_card_zone_select ON nex_community_card;
CREATE POLICY nex_community_card_zone_select
  ON nex_community_card
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM nex_community_membership m
        JOIN nex_account a ON a.id = m.account_id
       WHERE a.supabase_user_id = auth.uid()
         AND (m.hyperlocal_zone_id = nex_community_card.hyperlocal_zone_id
              OR m.district_zone_id   = nex_community_card.district_zone_id)
    )
  );

DROP POLICY IF EXISTS nex_community_card_author_insert ON nex_community_card;
CREATE POLICY nex_community_card_author_insert
  ON nex_community_card
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS nex_community_card_author_update ON nex_community_card;
CREATE POLICY nex_community_card_author_update
  ON nex_community_card
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
--     DROP POLICY IF EXISTS nex_community_card_author_update ON nex_community_card;
--     DROP POLICY IF EXISTS nex_community_card_author_insert ON nex_community_card;
--     DROP POLICY IF EXISTS nex_community_card_zone_select   ON nex_community_card;
--     ALTER TABLE nex_community_card DISABLE ROW LEVEL SECURITY;
--   COMMIT;
