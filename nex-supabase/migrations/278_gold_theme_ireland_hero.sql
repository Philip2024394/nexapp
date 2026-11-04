-- 278_gold_theme_ireland_hero.sql
-- Owner-authorised 2026-11-04 later-same-day.
--
-- Backfills the `gold` chat theme's hero_image_url with an Ireland-brand
-- wallpaper. The row existed from migration 048 but hero_image_url was
-- NULL, causing the sealed PortraitBloomShell to render without a
-- wallpaper layer · the chat surface appeared white.
--
-- Target database: canonical NEX Supabase ijvqdvsvwtwxzcqmoqit.
-- Asset path references public/nex-brand/hq/ireland-emerald-sunrise.png
-- (owner-approved Ireland world asset · sibling of the sealed desktop
-- backdrop ireland-studio.png).
--
-- Why gold: the 6 Ireland mock personas seeded by migration 277 all
-- use chat_theme='gold'. The gold-ireland pairing is the canonical
-- Ireland chat aesthetic.

UPDATE nex_chat_theme
SET hero_image_url = '/nex-brand/hq/ireland-emerald-sunrise.png',
    updated_at = now()
WHERE id = 'gold'
  AND hero_image_url IS NULL;
