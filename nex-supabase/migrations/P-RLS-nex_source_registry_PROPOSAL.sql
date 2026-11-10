-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P1 on nex.source_registry (migration 166 · no RLS).
--
-- Table holds legal policy flags (can_display, can_derive,
-- can_redistribute, attribution_required). Row leak reveals internal
-- source licensing policy; row tampering could flip a non-displayable
-- source to displayable. Service-role writer only; optional public
-- read restricted to attribution-safe columns via a view (future work).

BEGIN;

ALTER TABLE nex.source_registry ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON nex.source_registry FROM anon;
REVOKE ALL ON nex.source_registry FROM authenticated;
REVOKE ALL ON nex.source_registry FROM public;

GRANT SELECT, INSERT, UPDATE, DELETE ON nex.source_registry TO service_role;

COMMENT ON TABLE nex.source_registry IS
  'Directory source-of-data registry with legal policy flags. RLS enabled · zero policies for anon/authenticated · service_role only. Added via P-RLS proposal 2026-11-10.';

COMMIT;

-- Rollback:
--   BEGIN;
--     ALTER TABLE nex.source_registry DISABLE ROW LEVEL SECURITY;
--   COMMIT;
