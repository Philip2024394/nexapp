-- 280_nex_product_background_media.sql
-- Owner-authorised 2026-11-05 iter 24 · adds the three optional
-- background-media foreign keys to nex_product so a product post can
-- carry a looped video background OR an image background OR a music
-- loop (TikTok-Shop-style shoppable card). STATUS: DRAFT · NOT YET
-- APPLIED · needs separate owner authorisation per CLAUDE.md §5
-- before running against Supabase project ijvqdvsvwtwxzcqmoqit.
--
-- Column design:
--   background_video_id   · uuid · references nex_uploaded_video(id)
--                           ON DELETE SET NULL. Nullable · when non-
--                           null the product viewer plays the video
--                           on loop behind the product card overlay.
--   background_image_id   · uuid · references a future image table
--                           (not created yet · see migration 281+).
--                           Nullable. For v1 we also accept a direct
--                           URL via background_image_url (below).
--   background_image_url  · text · fallback plain URL when the image
--                           lives outside a NEX-owned table (seed
--                           data · imported libraries · etc.).
--   background_music_id   · uuid · references nex_music_track(id)
--                           ON DELETE SET NULL. Nullable · when non-
--                           null the product viewer loops the track
--                           underneath the card.
--
-- Rendering contract (enforced in app code, not SQL):
--   · If background_video_id is set, it wins over background_image_*
--     (video motion > static image).
--   · If no background_* field is set, the product card renders over
--     a plain NEX-world gradient (sealed behaviour · unchanged).
--
-- RLS: inherits the sealed nex_product RLS from migration 003. The
--   new columns are readable to everyone who can already read the
--   row; writeable only by the product's owner (seller) through the
--   same policy chain.

BEGIN;

ALTER TABLE public.nex_product
  ADD COLUMN IF NOT EXISTS background_video_id uuid
    REFERENCES public.nex_uploaded_video(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS background_image_id uuid,
  ADD COLUMN IF NOT EXISTS background_image_url text,
  ADD COLUMN IF NOT EXISTS background_music_id uuid
    REFERENCES public.nex_music_track(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.nex_product.background_video_id IS
  'Owner directive 2026-11-05 · optional looped video behind the product card (TikTok-Shop-style shoppable card). SET NULL on video delete so the product survives.';
COMMENT ON COLUMN public.nex_product.background_image_id IS
  'Owner directive 2026-11-05 · future FK to a NEX-owned image table · currently uuid-typed but unreferenced · use background_image_url for v1 plain-URL images.';
COMMENT ON COLUMN public.nex_product.background_image_url IS
  'Owner directive 2026-11-05 · plain URL fallback for the background image slot · used when the image lives outside a NEX-owned table.';
COMMENT ON COLUMN public.nex_product.background_music_id IS
  'Owner directive 2026-11-05 · optional looped music track behind the product card.';

COMMIT;
