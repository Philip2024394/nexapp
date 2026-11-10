-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P1 on nex_menu_section (migration 066 · no RLS).
-- Policy mirrors nex_service / nex_accommodation_unit: public SELECT,
-- service-role-only write (owner server-actions).

BEGIN;

ALTER TABLE nex_menu_section ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_menu_section_public_read ON nex_menu_section;
CREATE POLICY nex_menu_section_public_read
  ON nex_menu_section
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS nex_menu_section_deny_client_write ON nex_menu_section;
CREATE POLICY nex_menu_section_deny_client_write
  ON nex_menu_section
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP POLICY IF EXISTS nex_menu_section_deny_client_write ON nex_menu_section;
--     DROP POLICY IF EXISTS nex_menu_section_public_read       ON nex_menu_section;
--     ALTER TABLE nex_menu_section DISABLE ROW LEVEL SECURITY;
--   COMMIT;
