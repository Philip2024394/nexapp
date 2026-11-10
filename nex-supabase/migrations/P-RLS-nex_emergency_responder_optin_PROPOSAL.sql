-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P0 on nex.emergency_responder_optin (migration 224 · no RLS).
--
-- Per sealed Emergency Help doctrine 2026-11-09 the community-zone
-- responder fan-out is REJECTED. This table may be dead schema; while
-- it exists it must deny all reads outside service_role.

BEGIN;

ALTER TABLE nex.emergency_responder_optin ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON nex.emergency_responder_optin FROM anon;
REVOKE ALL ON nex.emergency_responder_optin FROM authenticated;
REVOKE ALL ON nex.emergency_responder_optin FROM public;

GRANT SELECT ON nex.emergency_responder_optin TO service_role;

COMMENT ON TABLE nex.emergency_responder_optin IS
  'Community-zone responder fan-out · REJECTED per sealed doctrine 2026-11-09. RLS enabled with zero policies · service_role SELECT only. Added via P-RLS proposal 2026-11-10.';

COMMIT;

-- Rollback:
--   BEGIN;
--     ALTER TABLE nex.emergency_responder_optin DISABLE ROW LEVEL SECURITY;
--   COMMIT;
