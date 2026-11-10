-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P0 on nex.trusted_contact (migration 224 · no RLS).
--
-- This table is among the most privacy-sensitive data in NEX:
-- a per-user list of trusted emergency contacts (name + phone/email).
-- Policy: owner-only SELECT/INSERT/UPDATE/DELETE on
-- owner_account_id = auth.uid().

BEGIN;

ALTER TABLE nex.trusted_contact ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON nex.trusted_contact FROM anon;
REVOKE ALL ON nex.trusted_contact FROM public;
GRANT  SELECT, INSERT, UPDATE, DELETE ON nex.trusted_contact TO authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON nex.trusted_contact TO service_role;

DROP POLICY IF EXISTS nex_trusted_contact_owner_all ON nex.trusted_contact;
CREATE POLICY nex_trusted_contact_owner_all
  ON nex.trusted_contact
  FOR ALL
  TO authenticated
  USING (
    owner_account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  )
  WITH CHECK (
    owner_account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

COMMENT ON TABLE nex.trusted_contact IS
  'Per-account trusted emergency contacts. Owner-only CRUD via RLS. Added via P-RLS proposal 2026-11-10.';

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP POLICY IF EXISTS nex_trusted_contact_owner_all ON nex.trusted_contact;
--     ALTER TABLE nex.trusted_contact DISABLE ROW LEVEL SECURITY;
--   COMMIT;
