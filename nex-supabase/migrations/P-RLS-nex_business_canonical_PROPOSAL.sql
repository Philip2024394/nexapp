-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P1 on nex.business_canonical (migration 167 · no RLS).
--
-- Per CLAUDE.md §8 the canonical directory layer is the source-of-
-- truth · consumed by `nex.business_directory_v`. Public read is the
-- intent for `lifecycle_state IN ('LIVE','PUBLISHED')` style rows;
-- writes must be service-role-only (walker + HQ moderation).

BEGIN;

ALTER TABLE nex.business_canonical ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON nex.business_canonical TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON nex.business_canonical TO service_role;

DROP POLICY IF EXISTS nex_business_canonical_public_read ON nex.business_canonical;
CREATE POLICY nex_business_canonical_public_read
  ON nex.business_canonical
  FOR SELECT
  TO anon, authenticated
  USING (lifecycle_state IN ('LIVE','PUBLISHED','VERIFIED'));

DROP POLICY IF EXISTS nex_business_canonical_deny_client_write ON nex.business_canonical;
CREATE POLICY nex_business_canonical_deny_client_write
  ON nex.business_canonical
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE nex.business_canonical IS
  'Directory canonical layer. Public SELECT limited to LIVE/PUBLISHED/VERIFIED; service_role for writes. Added via P-RLS proposal 2026-11-10.';

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP POLICY IF EXISTS nex_business_canonical_deny_client_write ON nex.business_canonical;
--     DROP POLICY IF EXISTS nex_business_canonical_public_read       ON nex.business_canonical;
--     ALTER TABLE nex.business_canonical DISABLE ROW LEVEL SECURITY;
--   COMMIT;
