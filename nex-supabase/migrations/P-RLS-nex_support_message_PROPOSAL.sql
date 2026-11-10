-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P0 on nex.support_message (migration 315 · no RLS).
-- Per-ticket message body (up to 4000 chars). Same REVOKE-without-RLS
-- issue as nex.support_ticket.
--
-- Policy: SELECT allowed if ticket.requester_account_id is auth.uid()
-- (i.e., participant); writes via service_role.

BEGIN;

ALTER TABLE nex.support_message ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON nex.support_message TO authenticated;

DROP POLICY IF EXISTS nex_support_message_participant_select ON nex.support_message;
CREATE POLICY nex_support_message_participant_select
  ON nex.support_message
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM nex.support_ticket t
        JOIN nex_account a ON a.id = t.requester_account_id
       WHERE t.ticket_id = nex.support_message.ticket_id
         AND a.supabase_user_id = auth.uid()
    )
  );

COMMENT ON TABLE nex.support_message IS
  'Support ticket messages. Requester-only SELECT via RLS · service_role writes. Added via P-RLS proposal 2026-11-10.';

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP POLICY IF EXISTS nex_support_message_participant_select ON nex.support_message;
--     REVOKE SELECT ON nex.support_message FROM authenticated;
--     ALTER TABLE nex.support_message DISABLE ROW LEVEL SECURITY;
--   COMMIT;
