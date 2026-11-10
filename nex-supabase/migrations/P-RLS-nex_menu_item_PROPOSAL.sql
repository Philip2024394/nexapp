-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P1 on nex_menu_item (migration 066 · no RLS).
-- Policy mirrors nex_service / nex_accommodation_unit: public SELECT
-- limited to live + available rows, service-role-only write.

BEGIN;

ALTER TABLE nex_menu_item ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_menu_item_public_read ON nex_menu_item;
CREATE POLICY nex_menu_item_public_read
  ON nex_menu_item
  FOR SELECT
  TO anon, authenticated
  USING (status = 'live' AND is_available = true);

DROP POLICY IF EXISTS nex_menu_item_owner_read_all ON nex_menu_item;
CREATE POLICY nex_menu_item_owner_read_all
  ON nex_menu_item
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM nex_business b
        JOIN nex_account a ON a.id = b.owner_account_id
       WHERE b.id = nex_menu_item.business_id
         AND a.supabase_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS nex_menu_item_deny_client_write ON nex_menu_item;
CREATE POLICY nex_menu_item_deny_client_write
  ON nex_menu_item
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP POLICY IF EXISTS nex_menu_item_deny_client_write ON nex_menu_item;
--     DROP POLICY IF EXISTS nex_menu_item_owner_read_all    ON nex_menu_item;
--     DROP POLICY IF EXISTS nex_menu_item_public_read       ON nex_menu_item;
--     ALTER TABLE nex_menu_item DISABLE ROW LEVEL SECURITY;
--   COMMIT;
