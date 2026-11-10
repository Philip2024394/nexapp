-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P0 on nex_pilot_operator_audit (migration 214 · no RLS).
-- The migration's own header literally says:
--   "Service-role-only via application code · no RLS added by G1.
--    Owner may elect to add RLS policies in a later migration."
-- This is that migration (proposal form).
--
-- Policy model: zero policies for anon + authenticated; service_role
-- bypasses RLS and remains the sole writer/reader.

BEGIN;

ALTER TABLE nex_pilot_operator_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON nex_pilot_operator_audit FROM anon;
REVOKE ALL ON nex_pilot_operator_audit FROM authenticated;
REVOKE ALL ON nex_pilot_operator_audit FROM public;

GRANT SELECT, INSERT, UPDATE ON nex_pilot_operator_audit TO service_role;

COMMENT ON TABLE nex_pilot_operator_audit IS
  'G1 · S4 pilot audit. RLS enabled with zero policies for anon/authenticated · service_role bypasses. Added via P-RLS proposal 2026-11-10.';

COMMIT;

-- Rollback:
--   BEGIN;
--     ALTER TABLE nex_pilot_operator_audit DISABLE ROW LEVEL SECURITY;
--   COMMIT;
