-- nex-supabase/migrations/308_nex_business_storage_metering.sql
--
-- NEX Shop capacity metering · owner-authorised 2026-11-08 (round 29).
-- WRITE-ONLY · not applied to any DB by this commit.
-- -----------------------------------------------------------------------------
-- Adds the metering columns that `shop-entitlements.ts` and
-- `metering-service.ts` expect:
--
--   · storage_bytes_used          · running total of shop-media bytes stored
--   · bandwidth_bytes_month       · running total of egress this calendar month
--   · storage_pack_bytes          · additional storage from active packs
--   · bandwidth_pack_bytes        · additional bandwidth from active packs
--   · bandwidth_period_start      · timestamp the current bandwidth month started
--
-- Plus two SECURITY DEFINER increment RPCs so the service_role-only
-- metering writes go through a single auditable path.
--
-- RLS: nex_business keeps its sealed service_role-only policy. These
-- columns inherit that posture · anon clients cannot read or write
-- them. Public shop rendering continues to read other nex_business
-- columns via the sealed read path · it does NOT need these counters.
--
-- Apply discipline:
--   · SANDBOX apply only via `scripts/apply-migration-308-sandbox.mjs`
--     (hard ref-check refusing prod · same pattern as 307).
--   · PRODUCTION apply is a separate owner authorisation.
--
-- Rollback: see 308_nex_business_storage_metering.rollback.sql.

BEGIN;

-- Idempotency guard · safe to re-run if migration 308 is already partial.
ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS storage_bytes_used bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bandwidth_bytes_month bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_pack_bytes bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bandwidth_pack_bytes bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bandwidth_period_start timestamptz;

-- Backfill · default the bandwidth window start to NOW() for any
-- existing row that has already received bandwidth counts (future
-- rollover cron keys off this value).
UPDATE public.nex_business
   SET bandwidth_period_start = date_trunc('month', NOW() AT TIME ZONE 'UTC')
 WHERE bandwidth_period_start IS NULL;

-- Non-negative sanity · counters never go below zero.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'ck_nex_business_storage_nonneg'
  ) THEN
    ALTER TABLE public.nex_business
      ADD CONSTRAINT ck_nex_business_storage_nonneg
        CHECK (storage_bytes_used >= 0 AND bandwidth_bytes_month >= 0
               AND storage_pack_bytes >= 0 AND bandwidth_pack_bytes >= 0);
  END IF;
END $$;

-- SECURITY DEFINER RPCs · service_role-only increment path.
-- Pattern mirrors the sealed migration 236 nex_music_publish_as_active_slot
-- RPC · search_path pinned · EXECUTE scoped to service_role only.

CREATE OR REPLACE FUNCTION public.nex_shop_increment_storage_bytes(
  p_business_id uuid,
  p_delta_bytes bigint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'business_id required';
  END IF;
  UPDATE public.nex_business
     SET storage_bytes_used = GREATEST(0, storage_bytes_used + p_delta_bytes)
   WHERE id = p_business_id;
END $$;

CREATE OR REPLACE FUNCTION public.nex_shop_increment_bandwidth_bytes(
  p_business_id uuid,
  p_delta_bytes bigint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'business_id required';
  END IF;
  IF p_delta_bytes <= 0 THEN
    RETURN;
  END IF;
  UPDATE public.nex_business
     SET bandwidth_bytes_month = bandwidth_bytes_month + p_delta_bytes
   WHERE id = p_business_id;
END $$;

-- Monthly rollover · callable from a cron on the 1st of each month.
CREATE OR REPLACE FUNCTION public.nex_shop_bandwidth_rollover()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows_reset integer;
BEGIN
  UPDATE public.nex_business
     SET bandwidth_bytes_month = 0,
         bandwidth_period_start = date_trunc('month', NOW() AT TIME ZONE 'UTC')
   WHERE bandwidth_period_start IS NULL
      OR bandwidth_period_start < date_trunc('month', NOW() AT TIME ZONE 'UTC');
  GET DIAGNOSTICS v_rows_reset = ROW_COUNT;
  RETURN v_rows_reset;
END $$;

-- Grant EXECUTE to service_role ONLY · anon/authenticated remain
-- without privileges on these functions. This preserves the sealed
-- posture that only the server-side admin client can mutate metering.
REVOKE ALL ON FUNCTION public.nex_shop_increment_storage_bytes(uuid, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nex_shop_increment_bandwidth_bytes(uuid, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nex_shop_bandwidth_rollover() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.nex_shop_increment_storage_bytes(uuid, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.nex_shop_increment_bandwidth_bytes(uuid, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.nex_shop_bandwidth_rollover() TO service_role;

-- Migration history · consistent with migrations 304-307.
INSERT INTO public.nex_migration_history (version, description)
  VALUES ('308', 'nex_business storage + bandwidth metering columns + SECURITY DEFINER increment RPCs')
  ON CONFLICT (version) DO NOTHING;

COMMIT;
