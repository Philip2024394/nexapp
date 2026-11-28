-- 373_nex_product_variant_image_url_DRAFT.sql
--
-- Owner directive 2026-11-28 (ninth pass) · color-variant image swap.
-- -----------------------------------------------------------------
-- Adds an optional per-variant image URL so the product page can
-- render round color swatches in the gallery footer and swap the
-- main image to that variant's image when a swatch is tapped.
--
-- STATUS: DRAFT · NOT APPLIED
-- Apply gate: requires explicit owner approval phrase per the
--             2026-11-27 Source-Control Standing Policy:
--               `APPROVE MIG 373 SANDBOX APPLY (REVISED 2026-11-27)`
--             (Do NOT apply to production `ijvqdvsvwtwxzcqmoqit` · ever
--              — production migrations require a separate explicit
--              owner approval beyond this phrase.)
--
-- Shape:
--   · `image_url` is optional (nullable) text. A product with no
--     per-variant images simply has no swatch footer rendered on the
--     product page; existing variants without images continue to
--     behave exactly as they do today.
--   · Not a foreign key to storage · we store a hosted URL string the
--     client can `<img src>` directly. Storage-object linkage lives
--     in the upload path (delta F).
--   · No additional index · the variant row is already looked up by
--     `product_id` + `position`, and the swatch footer reads all
--     variants for a product in one query.
--   · Backwards-compatible · existing reads of nex_product_variant
--     ignore the new column until the client is wired to consume it.
--
-- Rollback:
--   ALTER TABLE public.nex_product_variant DROP COLUMN image_url;

BEGIN;

ALTER TABLE public.nex_product_variant
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.nex_product_variant.image_url IS
  'Ninth-pass 2026-11-28 · optional hosted image URL painted by the product-page gallery footer when the shop uploads a dedicated image per color variant. NULL when the seller has not uploaded an image for this variant.';

COMMIT;
