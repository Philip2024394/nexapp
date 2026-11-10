-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P0 on nex.emergency_location_update (migration 224 · no RLS).
--
-- Per sealed Emergency Help doctrine 2026-11-09 this table is
-- SCHEMA-CORRECTION DEBT · the table exists but MUST NOT persist
-- coordinates. Pure Option A: lat/lng captured on device + embedded in
-- message body only · NO server-side coordinate persistence EVER.
--
-- Policy: lock down to service_role only until the table is dropped
-- per doctrine; add RLS so any accidental authenticated write is
-- rejected by PostgREST. Do NOT grant SELECT to authenticated.

BEGIN;

ALTER TABLE nex.emergency_location_update ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON nex.emergency_location_update FROM anon;
REVOKE ALL ON nex.emergency_location_update FROM authenticated;
REVOKE ALL ON nex.emergency_location_update FROM public;

-- Even service_role should be cautioned; keep grant minimal.
GRANT SELECT ON nex.emergency_location_update TO service_role;

COMMENT ON TABLE nex.emergency_location_update IS
  'SCHEMA-CORRECTION DEBT per sealed doctrine 2026-11-09. Must not persist coordinates. RLS enabled with zero policies for anon/authenticated; service_role SELECT only. Added via P-RLS proposal 2026-11-10.';

COMMIT;

-- Rollback:
--   BEGIN;
--     ALTER TABLE nex.emergency_location_update DISABLE ROW LEVEL SECURITY;
--   COMMIT;
