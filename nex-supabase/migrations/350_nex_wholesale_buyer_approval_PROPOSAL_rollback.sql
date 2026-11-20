-- =============================================================================
-- Rollback for migration 350 · nex_wholesale_buyer_approval
-- STATUS: PROPOSAL · NOT AUTHORISED FOR APPLY
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS nex_wholesale_buyer_approval_touch
  ON public.nex_wholesale_buyer_approval;

DROP FUNCTION IF EXISTS public.nex_wholesale_buyer_approval_touch_updated_at();

DROP TABLE IF EXISTS public.nex_wholesale_buyer_approval;

COMMIT;
