-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P0 on nex.business_outreach_suppression (migration 203 · no RLS).
-- Table contains raw email + suppression reason (hard_bounce, opt_out,
-- complaint) · GDPR exposure if leaked.
--
-- Policy model: zero policies for anon + authenticated; service_role
-- bypasses RLS and is the sole writer/reader.

BEGIN;

ALTER TABLE nex.business_outreach_suppression ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON nex.business_outreach_suppression FROM anon;
REVOKE ALL ON nex.business_outreach_suppression FROM authenticated;
REVOKE ALL ON nex.business_outreach_suppression FROM public;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON nex.business_outreach_suppression TO service_role;

COMMENT ON TABLE nex.business_outreach_suppression IS
  'Global do-not-contact list. RLS enabled with zero policies · service_role only. Added via P-RLS proposal 2026-11-10.';

COMMIT;

-- Rollback:
--   BEGIN;
--     ALTER TABLE nex.business_outreach_suppression DISABLE ROW LEVEL SECURITY;
--   COMMIT;
