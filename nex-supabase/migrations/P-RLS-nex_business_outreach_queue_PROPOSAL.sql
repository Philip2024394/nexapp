-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P0 on nex.business_outreach_queue (migration 203 · no RLS).
-- Table contains raw email + lease state · GDPR exposure if leaked.
--
-- Policy model: zero policies for anon + authenticated; service_role
-- (the outreach worker + HQ dashboard reader) bypasses RLS.

BEGIN;

ALTER TABLE nex.business_outreach_queue ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON nex.business_outreach_queue FROM anon;
REVOKE ALL ON nex.business_outreach_queue FROM authenticated;
REVOKE ALL ON nex.business_outreach_queue FROM public;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON nex.business_outreach_queue TO service_role;

COMMENT ON TABLE nex.business_outreach_queue IS
  'Business-outreach queue · raw email. RLS enabled with zero policies · service_role only. Added via P-RLS proposal 2026-11-10.';

COMMIT;

-- Rollback:
--   BEGIN;
--     ALTER TABLE nex.business_outreach_queue DISABLE ROW LEVEL SECURITY;
--   COMMIT;
