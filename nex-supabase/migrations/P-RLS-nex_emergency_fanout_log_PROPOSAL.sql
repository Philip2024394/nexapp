-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit · tightened 2026-11-10.
-- Target: close GAP-P0 on nex.emergency_fanout_log (migration 224 · no RLS).
-- Audit log of emergency notifications dispatched · reveals trusted-
-- contact graph + safety-signal history.
--
-- SCHEMA NOTES (verified against mig 224):
--   · Join key is `i.incident_id = nex.emergency_fanout_log.incident_id`.
--   · Incident owner column is `requester_account_id`.
--
-- Policy: requester may SELECT own rows; service_role writes.

BEGIN;

ALTER TABLE nex.emergency_fanout_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON nex.emergency_fanout_log FROM anon;
REVOKE ALL ON nex.emergency_fanout_log FROM public;
GRANT  SELECT ON nex.emergency_fanout_log TO authenticated;
GRANT  SELECT, INSERT, UPDATE ON nex.emergency_fanout_log TO service_role;

DROP POLICY IF EXISTS nex_emergency_fanout_log_requester_select ON nex.emergency_fanout_log;
CREATE POLICY nex_emergency_fanout_log_requester_select
  ON nex.emergency_fanout_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM nex.emergency_incident i
        JOIN nex_account a ON a.id = i.requester_account_id
       WHERE i.incident_id = nex.emergency_fanout_log.incident_id
         AND a.supabase_user_id = auth.uid()
    )
  );

COMMENT ON TABLE nex.emergency_fanout_log IS
  'Emergency fanout dispatch log. Requester-only SELECT · service_role writes. Added via P-RLS proposal 2026-11-10.';

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP POLICY IF EXISTS nex_emergency_fanout_log_requester_select ON nex.emergency_fanout_log;
--     ALTER TABLE nex.emergency_fanout_log DISABLE ROW LEVEL SECURITY;
--   COMMIT;
