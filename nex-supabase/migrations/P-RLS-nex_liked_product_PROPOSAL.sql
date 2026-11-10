-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-10 by RLS classification audit.
-- Target: close GAP-P0 on nex_liked_product (migration 074 · no RLS).
-- Sandbox-only envelope once authorised: kdstoyyeygcopkogqsyv.
-- Production ijvqdvsvwtwxzcqmoqit remains sealed.
--
-- Risk if un-RLS'd: any authenticated PostgREST client reads the entire
-- liked-product graph for every account (taste graph · PII-adjacent).
--
-- Policy model: owner-scoped CRUD on liker_account_id = auth.uid().
-- Writes go through the server action layer today, but RLS adds a
-- defence-in-depth layer so a future client-direct path cannot open this.

BEGIN;

ALTER TABLE nex_liked_product ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_liked_product_owner_select ON nex_liked_product;
CREATE POLICY nex_liked_product_owner_select
  ON nex_liked_product
  FOR SELECT
  TO authenticated
  USING (
    liker_account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS nex_liked_product_owner_insert ON nex_liked_product;
CREATE POLICY nex_liked_product_owner_insert
  ON nex_liked_product
  FOR INSERT
  TO authenticated
  WITH CHECK (
    liker_account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS nex_liked_product_owner_delete ON nex_liked_product;
CREATE POLICY nex_liked_product_owner_delete
  ON nex_liked_product
  FOR DELETE
  TO authenticated
  USING (
    liker_account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

COMMIT;

-- Rollback:
--   BEGIN;
--     DROP POLICY IF EXISTS nex_liked_product_owner_delete ON nex_liked_product;
--     DROP POLICY IF EXISTS nex_liked_product_owner_insert ON nex_liked_product;
--     DROP POLICY IF EXISTS nex_liked_product_owner_select ON nex_liked_product;
--     ALTER TABLE nex_liked_product DISABLE ROW LEVEL SECURITY;
--   COMMIT;
