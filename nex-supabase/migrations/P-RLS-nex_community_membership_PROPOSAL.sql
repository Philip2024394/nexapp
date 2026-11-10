-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P0 on nex_community_membership (migration 146 · no RLS).
--
-- Risk: table stores account_id + hyperlocal_zone_id + confirmed_at.
-- A leak reveals every user's declared hyperlocal area (RT/neighbourhood)
-- · privacy-sensitive location signal.
--
-- Policy model: owner-scoped SELECT on account_id = auth.uid();
-- writes via service_role server action layer.

BEGIN;

ALTER TABLE nex_community_membership ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_community_membership_owner_select ON nex_community_membership;
CREATE POLICY nex_community_membership_owner_select
  ON nex_community_membership
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies for authenticated · writes go via
-- service_role server actions that have already authorised the flow.

COMMENT ON TABLE nex_community_membership IS
  'Per-account zone claim. Owner-only SELECT · service_role for writes. Added via P-RLS proposal 2026-11-10.';

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP POLICY IF EXISTS nex_community_membership_owner_select ON nex_community_membership;
--     ALTER TABLE nex_community_membership DISABLE ROW LEVEL SECURITY;
--   COMMIT;
