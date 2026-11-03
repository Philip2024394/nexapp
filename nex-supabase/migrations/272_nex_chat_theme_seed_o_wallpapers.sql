-- 272_nex_chat_theme_seed_o_wallpapers.sql
--
-- Owner-authorised 2026-11-03 · Phase 1 chat-theme-templates.
-- Seeds 97 gratis chat themes · each one has a wallpaper hosted in
-- Supabase Storage bucket `nex-chat-themes/library/o<N>.png` (uploaded
-- via scripts/upload-chat-theme-wallpapers.mjs). All rows ship as
-- tier='gratis', category='standard' so no sealed Theme Commerce /
-- Package Contract / Launch Pricing DRAFT is touched. Owner can
-- rename / re-tier / re-order individually from HQ.
--
-- Idempotent via ON CONFLICT (id) DO UPDATE SET (matches the sealed
-- INSERT pattern in migration 048 line 103+).

-- Apply guard
DO $$ BEGIN
  RAISE EXCEPTION 'Migration 272 is DRAFT · comment out this block before applying.';
END $$;

INSERT INTO nex_chat_theme
  (id, name, accent_hex, tier, category, hero_image_url, is_active, sort_order)
VALUES
  ('theme-o1', 'Theme 1', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o1.png', true, 1),
  ('theme-o2', 'Theme 2', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o2.png', true, 2),
  ('theme-o3', 'Theme 3', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o3.png', true, 3),
  ('theme-o4', 'Theme 4', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o4.png', true, 4),
  ('theme-o5', 'Theme 5', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o5.png', true, 5),
  ('theme-o6', 'Theme 6', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o6.png', true, 6),
  ('theme-o7', 'Theme 7', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o7.png', true, 7),
  ('theme-o8', 'Theme 8', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o8.png', true, 8),
  ('theme-o9', 'Theme 9', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o9.png', true, 9),
  ('theme-o10', 'Theme 10', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o10.png', true, 10),
  ('theme-o11', 'Theme 11', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o11.png', true, 11),
  ('theme-o12', 'Theme 12', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o12.png', true, 12),
  ('theme-o13', 'Theme 13', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o13.png', true, 13),
  ('theme-o14', 'Theme 14', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o14.png', true, 14),
  ('theme-o15', 'Theme 15', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o15.png', true, 15),
  ('theme-o16', 'Theme 16', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o16.png', true, 16),
  ('theme-o17', 'Theme 17', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o17.png', true, 17),
  ('theme-o18', 'Theme 18', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o18.png', true, 18),
  ('theme-o19', 'Theme 19', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o19.png', true, 19),
  ('theme-o20', 'Theme 20', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o20.png', true, 20),
  ('theme-o21', 'Theme 21', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o21.png', true, 21),
  ('theme-o22', 'Theme 22', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o22.png', true, 22),
  ('theme-o23', 'Theme 23', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o23.png', true, 23),
  ('theme-o24', 'Theme 24', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o24.png', true, 24),
  ('theme-o25', 'Theme 25', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o25.png', true, 25),
  ('theme-o26', 'Theme 26', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o26.png', true, 26),
  ('theme-o27', 'Theme 27', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o27.png', true, 27),
  ('theme-o28', 'Theme 28', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o28.png', true, 28),
  ('theme-o29', 'Theme 29', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o29.png', true, 29),
  ('theme-o30', 'Theme 30', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o30.png', true, 30),
  ('theme-o31', 'Theme 31', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o31.png', true, 31),
  ('theme-o32', 'Theme 32', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o32.png', true, 32),
  ('theme-o33', 'Theme 33', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o33.png', true, 33),
  ('theme-o34', 'Theme 34', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o34.png', true, 34),
  ('theme-o35', 'Theme 35', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o35.png', true, 35),
  ('theme-o36', 'Theme 36', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o36.png', true, 36),
  ('theme-o37', 'Theme 37', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o37.png', true, 37),
  ('theme-o38', 'Theme 38', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o38.png', true, 38),
  ('theme-o39', 'Theme 39', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o39.png', true, 39),
  ('theme-o40', 'Theme 40', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o40.png', true, 40),
  ('theme-o41', 'Theme 41', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o41.png', true, 41),
  ('theme-o42', 'Theme 42', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o42.png', true, 42),
  ('theme-o43', 'Theme 43', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o43.png', true, 43),
  ('theme-o44', 'Theme 44', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o44.png', true, 44),
  ('theme-o45', 'Theme 45', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o45.png', true, 45),
  ('theme-o46', 'Theme 46', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o46.png', true, 46),
  ('theme-o47', 'Theme 47', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o47.png', true, 47),
  ('theme-o48', 'Theme 48', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o48.png', true, 48),
  ('theme-o49', 'Theme 49', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o49.png', true, 49),
  ('theme-o50', 'Theme 50', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o50.png', true, 50),
  ('theme-o51', 'Theme 51', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o51.png', true, 51),
  ('theme-o52', 'Theme 52', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o52.png', true, 52),
  ('theme-o53', 'Theme 53', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o53.png', true, 53),
  ('theme-o54', 'Theme 54', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o54.png', true, 54),
  ('theme-o55', 'Theme 55', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o55.png', true, 55),
  ('theme-o56', 'Theme 56', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o56.png', true, 56),
  ('theme-o57', 'Theme 57', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o57.png', true, 57),
  ('theme-o58', 'Theme 58', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o58.png', true, 58),
  ('theme-o59', 'Theme 59', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o59.png', true, 59),
  ('theme-o60', 'Theme 60', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o60.png', true, 60),
  ('theme-o61', 'Theme 61', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o61.png', true, 61),
  ('theme-o62', 'Theme 62', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o62.png', true, 62),
  ('theme-o63', 'Theme 63', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o63.png', true, 63),
  ('theme-o64', 'Theme 64', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o64.png', true, 64),
  ('theme-o65', 'Theme 65', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o65.png', true, 65),
  ('theme-o66', 'Theme 66', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o66.png', true, 66),
  ('theme-o67', 'Theme 67', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o67.png', true, 67),
  ('theme-o68', 'Theme 68', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o68.png', true, 68),
  ('theme-o69', 'Theme 69', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o69.png', true, 69),
  ('theme-o70', 'Theme 70', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o70.png', true, 70),
  ('theme-o71', 'Theme 71', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o71.png', true, 71),
  ('theme-o72', 'Theme 72', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o72.png', true, 72),
  ('theme-o73', 'Theme 73', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o73.png', true, 73),
  ('theme-o74', 'Theme 74', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o74.png', true, 74),
  ('theme-o75', 'Theme 75', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o75.png', true, 75),
  ('theme-o76', 'Theme 76', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o76.png', true, 76),
  ('theme-o77', 'Theme 77', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o77.png', true, 77),
  ('theme-o78', 'Theme 78', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o78.png', true, 78),
  ('theme-o79', 'Theme 79', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o79.png', true, 79),
  ('theme-o80', 'Theme 80', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o80.png', true, 80),
  ('theme-o81', 'Theme 81', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o81.png', true, 81),
  ('theme-o82', 'Theme 82', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o82.png', true, 82),
  ('theme-o83', 'Theme 83', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o83.png', true, 83),
  ('theme-o84', 'Theme 84', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o84.png', true, 84),
  ('theme-o85', 'Theme 85', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o85.png', true, 85),
  ('theme-o86', 'Theme 86', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o86.png', true, 86),
  ('theme-o87', 'Theme 87', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o87.png', true, 87),
  ('theme-o88', 'Theme 88', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o88.png', true, 88),
  ('theme-o89', 'Theme 89', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o89.png', true, 89),
  ('theme-o90', 'Theme 90', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o90.png', true, 90),
  ('theme-o91', 'Theme 91', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o91.png', true, 91),
  ('theme-o92', 'Theme 92', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o92.png', true, 92),
  ('theme-o93', 'Theme 93', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o93.png', true, 93),
  ('theme-o94', 'Theme 94', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o94.png', true, 94),
  ('theme-o95', 'Theme 95', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o95.png', true, 95),
  ('theme-o96', 'Theme 96', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o96.png', true, 96),
  ('theme-o97', 'Theme 97', '#C6A15B', 'gratis', 'standard', 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o97.png', true, 97)
ON CONFLICT (id) DO UPDATE SET
  name           = EXCLUDED.name,
  accent_hex     = EXCLUDED.accent_hex,
  tier           = EXCLUDED.tier,
  category       = EXCLUDED.category,
  hero_image_url = EXCLUDED.hero_image_url,
  is_active      = EXCLUDED.is_active,
  sort_order     = EXCLUDED.sort_order;

INSERT INTO nex_migration_history (version, description, applied_at)
VALUES ('272', 'chat themes · seed 97 gratis o-wallpaper rows', now())
ON CONFLICT (version) DO NOTHING;
