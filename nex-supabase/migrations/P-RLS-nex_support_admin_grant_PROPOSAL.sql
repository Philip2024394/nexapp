-- P-RLS-nex_support_admin_grant_PROPOSAL.sql
-- =========================================================================
-- STATUS: PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY · SANDBOX ONLY
-- =========================================================================
--
-- Owner-sealed 2026-11-10 (cycle 5 WARN · caller trace).
-- Modelled on P-RLS-nex_pilot_operator_audit_PROPOSAL.sql · same shape ·
-- service-role-only · no authenticated SELECT.
--
-- Background: nex.support_admin_grant was rated GAP-P1 in the RLS
-- classification (mig 315 includes `REVOKE ALL FROM anon, authenticated`
-- which closes the PostgREST surface). This PROPOSAL adds belt-and-
-- braces RLS so that if a future migration ever grants to authenticated
-- (deliberately or by mistake), the admin-grant rows still don't leak.
--
-- Every live caller of this table uses `withClient` (pooler role via
-- NEX_POSTGRES_URL) or `nexSupabaseAdmin` (service-role). Both bypass
-- RLS. NO session-scoped Supabase client reads this table. The policy
-- is defence-in-depth · it will NOT break any present caller.
--
-- The HQ admin overlay migration (P-RLS-HQ-admin-overlay_PROPOSAL.sql)
-- also adds an admin SELECT policy for this table. Both policies co-
-- exist · the UNION of permit clauses applies.
--
-- Apply target: SANDBOX ONLY (kdstoyyeygcopkogqsyv) · production
-- (ijvqdvsvwtwxzcqmoqit) stays sealed.

BEGIN;

-- Belt + braces: ensure RLS is enabled even if mig 315's REVOKE pattern
-- was the only gate. Idempotent.
ALTER TABLE IF EXISTS nex.support_admin_grant ENABLE ROW LEVEL SECURITY;

-- No policy for anon · effectively deny.
-- No policy for authenticated · effectively deny · service-role + pooler
-- are the only legitimate paths.
-- Admin-overlay SELECT is added separately by the HQ admin overlay
-- PROPOSAL (nex_is_hq_admin() predicate).

-- Explicit deny-by-default comment so the intent is grep-able.
COMMENT ON TABLE nex.support_admin_grant IS
  'Owner-sealed 2026-11-10 · RLS defence-in-depth · no authenticated SELECT policy · reads only via service-role (writes) or HQ admin overlay (nex_is_hq_admin). PROPOSAL state until sandbox applied.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    'P-RLS-nex_support_admin_grant',
    'P-RLS · nex.support_admin_grant · defence-in-depth · no authenticated policy',
    'Sealed 2026-11-10 cycle 5 WARN. Modelled on nex_pilot_operator_audit. Live callers are service-role or pooler · RLS will not break current access. Admin SELECT added by HQ admin overlay PROPOSAL separately.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'support_admin_grant';
--   -- expect true
--   SELECT policyname, cmd FROM pg_policies
--    WHERE schemaname = 'nex' AND tablename = 'support_admin_grant';
--   -- expect zero rows until HQ admin overlay PROPOSAL also applies
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = 'P-RLS-nex_support_admin_grant';
--     ALTER TABLE IF EXISTS nex.support_admin_grant DISABLE ROW LEVEL SECURITY;
--   COMMIT;
