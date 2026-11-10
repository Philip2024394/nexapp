-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit · tightened 2026-11-10.
-- Target: close GAP-P0 on nex.emergency_incident (migration 224 · no RLS).
-- Per sealed Emergency Help doctrine 2026-11-09: NO server-side coord
-- persistence · this table is the incident envelope only. Any leak of
-- incident existence is a safety signal.
--
-- SCHEMA NOTES (verified against mig 224):
--   · PK column is `incident_id`, NOT `id`.
--   · Owner column is `requester_account_id`, NOT `triggered_by_account_id`.
--
-- Policy: requester SELECT on own incidents; service_role bypass for
-- operational dispatch.

BEGIN;

ALTER TABLE nex.emergency_incident ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON nex.emergency_incident FROM anon;
REVOKE ALL ON nex.emergency_incident FROM public;
GRANT  SELECT ON nex.emergency_incident TO authenticated;
GRANT  SELECT, INSERT, UPDATE ON nex.emergency_incident TO service_role;

DROP POLICY IF EXISTS nex_emergency_incident_requester_select ON nex.emergency_incident;
CREATE POLICY nex_emergency_incident_requester_select
  ON nex.emergency_incident
  FOR SELECT
  TO authenticated
  USING (
    requester_account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

COMMENT ON TABLE nex.emergency_incident IS
  'Emergency incident envelope. Owner-only SELECT · service_role dispatch. Added via P-RLS proposal 2026-11-10.';

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP POLICY IF EXISTS nex_emergency_incident_requester_select ON nex.emergency_incident;
--     ALTER TABLE nex.emergency_incident DISABLE ROW LEVEL SECURITY;
--   COMMIT;
