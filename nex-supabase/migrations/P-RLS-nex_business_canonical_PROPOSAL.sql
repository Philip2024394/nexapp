-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit · tightened 2026-11-10.
-- Target: close GAP-P1 on nex.business_canonical (migration 167 · no RLS).
--
-- Per CLAUDE.md §8 the canonical directory layer is the source-of-
-- truth · consumed by `nex.business_directory_v`. Public read is the
-- intent for rows in the publishable lifecycle states; writes must be
-- service-role-only (walker + HQ moderation).
--
-- SCHEMA NOTES (verified against mig 167):
--   · lifecycle_state enum is the 7-value set defined by
--     ck_bc_lifecycle_state: DISCOVERED · ENRICHED · VERIFIED ·
--     OWNER_CLAIMED · OWNER_VERIFIED · DORMANT · SUPERSEDED.
--   · Previous draft used ('LIVE','PUBLISHED','VERIFIED') · corrected
--     to the real enum. Publishable set approximates "not raw / not
--     dormant / not retired" · owner may further narrow via view.

BEGIN;

ALTER TABLE nex.business_canonical ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON nex.business_canonical TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON nex.business_canonical TO service_role;

DROP POLICY IF EXISTS nex_business_canonical_public_read ON nex.business_canonical;
CREATE POLICY nex_business_canonical_public_read
  ON nex.business_canonical
  FOR SELECT
  TO anon, authenticated
  USING (
    lifecycle_state IN (
      'ENRICHED',
      'VERIFIED',
      'OWNER_CLAIMED',
      'OWNER_VERIFIED'
    )
  );

DROP POLICY IF EXISTS nex_business_canonical_deny_client_write ON nex.business_canonical;
CREATE POLICY nex_business_canonical_deny_client_write
  ON nex.business_canonical
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE nex.business_canonical IS
  'Directory canonical layer. Public SELECT limited to publishable lifecycle states; service_role for writes. Added via P-RLS proposal 2026-11-10.';

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP POLICY IF EXISTS nex_business_canonical_deny_client_write ON nex.business_canonical;
--     DROP POLICY IF EXISTS nex_business_canonical_public_read       ON nex.business_canonical;
--     ALTER TABLE nex.business_canonical DISABLE ROW LEVEL SECURITY;
--   COMMIT;
