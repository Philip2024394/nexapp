-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P0 on nex.incident_recipient (migration 224 · no RLS).
-- Risk: table encodes the user's trusted-contact fan-out graph.
--
-- Policy: recipient-only SELECT OR triggering-incident owner SELECT;
-- service_role bypass for dispatch logic.

BEGIN;

ALTER TABLE nex.incident_recipient ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON nex.incident_recipient FROM anon;
REVOKE ALL ON nex.incident_recipient FROM public;
GRANT  SELECT ON nex.incident_recipient TO authenticated;
GRANT  SELECT, INSERT, UPDATE ON nex.incident_recipient TO service_role;

DROP POLICY IF EXISTS nex_incident_recipient_scoped_select ON nex.incident_recipient;
CREATE POLICY nex_incident_recipient_scoped_select
  ON nex.incident_recipient
  FOR SELECT
  TO authenticated
  USING (
    recipient_account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
        FROM nex.emergency_incident i
        JOIN nex_account a ON a.id = i.triggered_by_account_id
       WHERE i.id = nex.incident_recipient.incident_id
         AND a.supabase_user_id = auth.uid()
    )
  );

COMMENT ON TABLE nex.incident_recipient IS
  'Per-recipient fan-out rows. Recipient OR triggering-owner SELECT · service_role dispatch. Added via P-RLS proposal 2026-11-10.';

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP POLICY IF EXISTS nex_incident_recipient_scoped_select ON nex.incident_recipient;
--     ALTER TABLE nex.incident_recipient DISABLE ROW LEVEL SECURITY;
--   COMMIT;
