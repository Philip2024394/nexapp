-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P0 on nex.support_ticket (migration 315 · no RLS).
--
-- Migration 315 does `REVOKE ALL ON nex.support_ticket FROM anon,
-- authenticated` but never `ENABLE ROW LEVEL SECURITY`. REVOKE alone is
-- a defence-in-depth layer, not RLS; a future grant to authenticated
-- would silently open the full table. This proposal adds explicit RLS +
-- a requester-only SELECT policy so future grants do not break the model.
--
-- Note: PROD ijvqdvsvwtwxzcqmoqit is sealed · this is sandbox-only.

BEGIN;

ALTER TABLE nex.support_ticket ENABLE ROW LEVEL SECURITY;

-- Keep REVOKEs from mig 315 and add a scoped GRANT so that if admin UI
-- flips to direct PostgREST reads, the RLS policy is the deciding layer.
GRANT SELECT ON nex.support_ticket TO authenticated;

DROP POLICY IF EXISTS nex_support_ticket_requester_select ON nex.support_ticket;
CREATE POLICY nex_support_ticket_requester_select
  ON nex.support_ticket
  FOR SELECT
  TO authenticated
  USING (
    requester_account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

COMMENT ON TABLE nex.support_ticket IS
  'Support ticket envelope. Requester-only SELECT via RLS · service_role for HQ admin. Added via P-RLS proposal 2026-11-10. Supersedes REVOKE-only lockdown from mig 315.';

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP POLICY IF EXISTS nex_support_ticket_requester_select ON nex.support_ticket;
--     REVOKE SELECT ON nex.support_ticket FROM authenticated;
--     ALTER TABLE nex.support_ticket DISABLE ROW LEVEL SECURITY;
--   COMMIT;
