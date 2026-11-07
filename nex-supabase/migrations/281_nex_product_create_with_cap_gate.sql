-- 281_nex_product_create_with_cap_gate.sql
-- -----------------------------------------------------------------------------
-- Shop tier 3-tier model · owner-sealed 2026-11-07.
-- Closes the TOCTOU (check-then-act) race in the Shop product create flow.
-- Before this migration, two concurrent requests at count=N-1 could BOTH pass
-- the guardCreateProduct check and BOTH insert, producing N+1 active products
-- on a plan capped at N.
--
-- SECURITY NOTE · updated 2026-11-07 after owner directive §9 static review:
--   The function parameters include the business_id that will own the new
--   row. We MUST NOT expose this to the `authenticated` role via GRANT ·
--   that would let user A create a product in user B's shop by passing
--   B's business_id. The grant is therefore RESTRICTED to `service_role`
--   only. All callers go through a Node server action which runs the
--   ownership check in `src/app/nex-native/create/product/_actions.ts`
--   BEFORE invoking this RPC. Defensive existence check added inside the
--   function as belt-and-braces.
--
-- DESIGN · stored function wraps the (count, check, insert) sequence in a
-- single transaction and holds a per-business advisory lock while the check
-- runs. The advisory lock is scoped to the transaction (pg_advisory_xact_lock)
-- so it auto-releases on COMMIT / ROLLBACK · no manual unlock required.
--
-- LOCKING STRATEGY
--   · Lock key: hashtextextended('nex-product-create-cap-gate:' ||
--     business_id, 0). This is a 64-bit int derived from the string. Two
--     requests for the SAME business_id serialise. Different businesses
--     run concurrently.
--   · Granularity: per-business. A busy shop does not block other shops.
--   · Lock held: for the full duration of the count + insert · typically
--     tens of milliseconds.
--
-- SECURITY DEFINER
--   · Runs with the function owner's privileges so callers do not need
--     direct INSERT privileges on nex_product.
--   · search_path is pinned to avoid injection via rogue public schemas.
--
-- ROLLBACK
--   See the companion rollback file:
--   281_nex_product_create_with_cap_gate.rollback.sql
--   (drops the function and its grants · existing rows are untouched).
--
-- STATUS · PREPARED LOCALLY · NOT APPLIED TO PRODUCTION.
-- Owner authorisation required separately before this file is executed
-- against ijvqdvsvwtwxzcqmoqit. Local rehearsal against a disposable
-- Postgres only (Docker or local disposable instance).

BEGIN;

CREATE OR REPLACE FUNCTION public.nex_product_create_with_cap_gate(
  p_business_id uuid,
  p_product_name text,
  p_description text,
  p_image_url text,
  p_gallery_urls text[],
  p_tags text[],
  p_sku text,
  p_stock_status text,
  p_price_pence integer,
  p_currency text,
  p_status text,
  p_department_id text,
  p_category_id text,
  p_spec jsonb,
  p_dispatch_time text,
  p_background_video_id uuid,
  p_background_image_url text,
  p_background_music_id uuid,
  p_cap integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_active_count integer;
  v_new_id uuid;
  v_lock_key bigint;
  v_business_exists boolean;
BEGIN
  -- Defensive existence check · fail fast with a distinct error so the
  -- Node action can distinguish "bogus business_id" from "cap reached".
  -- This is NOT a substitute for the ownership check in the Node server
  -- action · callers MUST verify ownership before invoking this RPC.
  SELECT EXISTS(SELECT 1 FROM nex_business WHERE id = p_business_id)
    INTO v_business_exists;
  IF NOT v_business_exists THEN
    RAISE EXCEPTION 'nex_product_create_with_cap_gate: business % does not exist', p_business_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Per-business advisory lock · transaction-scoped. Different businesses
  -- do not serialise against each other; two requests for the SAME
  -- business do.
  v_lock_key := hashtextextended('nex-product-create-cap-gate:' || p_business_id::text, 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Count active (live + draft) products for this business. Archived
  -- rows do not count against the cap. Running under the advisory
  -- lock means no concurrent inserter has slipped a row in since we
  -- acquired the lock.
  SELECT count(*) INTO v_active_count
  FROM nex_product
  WHERE business_id = p_business_id
    AND status IN ('live', 'draft');

  IF v_active_count >= p_cap THEN
    RAISE EXCEPTION 'nex_product_create_with_cap_gate: tier limit reached · % active products, cap %', v_active_count, p_cap
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO nex_product (
    business_id, name, description, image_url, gallery_urls, tags, sku,
    stock_status, price_pence, currency, status, department_id, category_id,
    spec, dispatch_time, background_video_id, background_image_url,
    background_music_id
  )
  VALUES (
    p_business_id, p_product_name, p_description, p_image_url, p_gallery_urls,
    p_tags, p_sku, p_stock_status, p_price_pence, p_currency, p_status,
    p_department_id, p_category_id, p_spec, p_dispatch_time,
    p_background_video_id, p_background_image_url, p_background_music_id
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- Lock down · ONLY service_role may execute this. The `authenticated`
-- grant from an earlier draft was removed 2026-11-07 after static review
-- (owner directive §9) · granting to authenticated would let any logged-
-- in user pass an arbitrary p_business_id and create products in another
-- shop. All product-create flows must route through the Node server
-- action which runs the ownership check via listBusinessesByOwner before
-- invoking this RPC with the service-role client.
REVOKE ALL ON FUNCTION public.nex_product_create_with_cap_gate(
  uuid, text, text, text, text[], text[], text, text, integer, text,
  text, text, text, jsonb, text, uuid, text, uuid, integer
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nex_product_create_with_cap_gate(
  uuid, text, text, text, text[], text[], text, text, integer, text,
  text, text, text, jsonb, text, uuid, text, uuid, integer
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.nex_product_create_with_cap_gate(
  uuid, text, text, text, text[], text[], text, text, integer, text,
  text, text, text, jsonb, text, uuid, text, uuid, integer
) TO service_role;

COMMENT ON FUNCTION public.nex_product_create_with_cap_gate IS
'Owner-sealed 2026-11-07. Serialises check-then-insert for Shop tier
product-creation to close the TOCTOU race. Per-business advisory lock.
Raises check_violation when the current active count has reached the
supplied p_cap. Caller passes the cap from the Entry/Professional/Plus
entitlement spec in src/lib/nex-native/commercial/shop-entitlements.ts.
EXECUTE grant is RESTRICTED to service_role · ownership must be checked
by the Node server action before this function is invoked.';

COMMIT;
