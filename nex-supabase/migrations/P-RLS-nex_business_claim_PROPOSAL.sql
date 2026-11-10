-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit · tightened 2026-11-10.
-- Target: close GAP-P0 on nex.business_claim (migration 176 · no RLS).
-- Sandbox-only envelope once authorised: kdstoyyeygcopkogqsyv.
--
-- Risk: leak would reveal which account is trying to claim which
-- business (reputation/competitive risk). Reader scope must be the
-- claimant themselves + HQ review (via service_role).
--
-- SCHEMA NOTES (verified against mig 176):
--   · The column is `claimed_by_account_id` (TEXT, nullable), NOT
--     `claimant_account_id`. It stores a cross-DB string of the
--     Supabase nex_account.id (not a uuid FK). Policy casts the uuid
--     from auth.uid()-joined nex_account.id to text for comparison.
--   · Rows where claimed_by_account_id IS NULL (unverified claims)
--     are visible only to service_role.

BEGIN;

ALTER TABLE nex.business_claim ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON nex.business_claim FROM anon;
REVOKE ALL ON nex.business_claim FROM authenticated;
REVOKE ALL ON nex.business_claim FROM public;

GRANT SELECT ON nex.business_claim TO authenticated;
GRANT SELECT, INSERT, UPDATE ON nex.business_claim TO service_role;

DROP POLICY IF EXISTS nex_business_claim_claimant_select ON nex.business_claim;
CREATE POLICY nex_business_claim_claimant_select
  ON nex.business_claim
  FOR SELECT
  TO authenticated
  USING (
    claimed_by_account_id IS NOT NULL
    AND claimed_by_account_id = (
      SELECT id::text FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

COMMENT ON TABLE nex.business_claim IS
  'Business-claim queue. Claimant-only SELECT via RLS · service_role for HQ review. Added via P-RLS proposal 2026-11-10.';

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP POLICY IF EXISTS nex_business_claim_claimant_select ON nex.business_claim;
--     ALTER TABLE nex.business_claim DISABLE ROW LEVEL SECURITY;
--   COMMIT;
