-- 281_nex_product_create_with_cap_gate.rollback.sql
-- -----------------------------------------------------------------------------
-- Rollback for migration 281.
--
-- Dropping the function does NOT affect any existing nex_product rows.
-- Existing products remain with their current status + fields intact.
-- Future product creates fall back to the application-layer guard in
-- src/lib/nex-native/billing/shop-tier-guard.ts (which has the known
-- TOCTOU race · same posture as before migration 281).
--
-- To apply this rollback:
--   psql $DATABASE_URL -f nex-supabase/migrations/281_nex_product_create_with_cap_gate.rollback.sql
--
-- STATUS · PREPARED LOCALLY · NOT APPLIED.

DROP FUNCTION IF EXISTS public.nex_product_create_with_cap_gate(
  uuid, text, text, text, text[], text[], text, text, integer, text,
  text, text, text, jsonb, text, uuid, text, uuid, integer
);
