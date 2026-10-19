-- 209_nex_account_intro_video.sql
--
-- NEX account intro video + chat screen image customization
-- Owner-authorised 2026-10-20 · "ship all · fully ready for customer"
-- =============================================================================
-- Backs the /nex-native/settings/intro-video surface.
--
-- Schema philosophy: all customisation lives on nex_account (single
-- source of truth per account · no separate table · no join at render
-- time). The video + wallpaper BINARIES live in Supabase Storage
-- buckets created in 210_nex_user_intros_storage.sql; this migration
-- adds the ten text/scalar columns that point at those binaries and
-- carry the overlay typography.
--
-- Mobile-first design assumptions baked into CHECK constraints:
--   · 9:16 portrait video / wallpaper (validated in app layer)
--   · 5 position / 5 font / 4 size / 3 align tokens (fixed vocabulary)
--   · all textual columns NULLABLE so a fresh account inherits the
--     active chat theme's packaged intro + wallpaper + typography
--     until the user explicitly saves a custom.

BEGIN;

-- 1 · Enable / disable the entire intro overlay for this account.
--     Default TRUE so a new account that has no custom intro still
--     plays the theme-packaged intro on first open.
ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS intro_enabled boolean NOT NULL DEFAULT true;

-- 2 · Pointer to the user's custom intro video stored in the
--     nex-user-intros Supabase Storage bucket. NULL = fall back to
--     the active chat theme's packaged intro (sealed per-theme).
ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS intro_video_url text;

-- 3 · Video duration in milliseconds (ffprobe-measured on upload).
--     Hard-capped to 8 seconds in the server action (MAX_SECONDS * 1000
--     + 250 ms tolerance = 8250 ms). Validated here too so direct DB
--     writes can't bypass the UX cap.
ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS intro_video_duration_ms int;
ALTER TABLE nex_account
  ADD CONSTRAINT nex_account_intro_video_duration_ms_within_cap
  CHECK (intro_video_duration_ms IS NULL
         OR (intro_video_duration_ms > 0 AND intro_video_duration_ms <= 8250));

-- 4 · Title overlay text (plain string · up to 140 chars across 3
--     lines · newline chars \n are preserved for multi-line layout).
ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS intro_title_text text;
ALTER TABLE nex_account
  ADD CONSTRAINT nex_account_intro_title_text_length
  CHECK (intro_title_text IS NULL OR char_length(intro_title_text) <= 140);

-- 5 · Where the title sits in the 9:16 video frame.
--     'hero'   = top-left offset · hero banner feel
--     'center' = centre-aligned middle · minimal / name-only
--     'footer' = bottom banner · tagline / call-to-action
ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS intro_title_position text;
ALTER TABLE nex_account
  ADD CONSTRAINT nex_account_intro_title_position_token
  CHECK (intro_title_position IS NULL
         OR intro_title_position IN ('hero', 'center', 'footer'));

-- 6 · Font family token. Resolved client-side to a Google Font via
--     the sealed overlay-fonts module (Inter / Playfair / Montserrat
--     / Caveat / Bebas Neue). Fixed vocabulary · additions require a
--     follow-up migration.
ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS intro_title_font text;
ALTER TABLE nex_account
  ADD CONSTRAINT nex_account_intro_title_font_token
  CHECK (intro_title_font IS NULL
         OR intro_title_font IN ('classic', 'elegant', 'strong', 'casual', 'neon'));

-- 7 · Font size preset. Multiplier applied on top of the position-
--     based base pt (hero 24 · center 20 · footer 15).
--       s = 0.75x · m = 1x · l = 1.35x · xl = 1.75x
ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS intro_title_size text;
ALTER TABLE nex_account
  ADD CONSTRAINT nex_account_intro_title_size_token
  CHECK (intro_title_size IS NULL
         OR intro_title_size IN ('s', 'm', 'l', 'xl'));

-- 8 · Text colour as a 7-char hex string (#RRGGBB). Validated at the
--     app boundary · DB rejects anything that isn't a 7-char hex
--     code. Picker ships 8 presets but any valid hex is persisted
--     verbatim (future segment-model migration will relax this).
ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS intro_title_color text;
ALTER TABLE nex_account
  ADD CONSTRAINT nex_account_intro_title_color_hex
  CHECK (intro_title_color IS NULL
         OR intro_title_color ~ '^#[0-9A-Fa-f]{6}$');

-- 9 · Horizontal alignment of the title within its position band.
ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS intro_title_align text;
ALTER TABLE nex_account
  ADD CONSTRAINT nex_account_intro_title_align_token
  CHECK (intro_title_align IS NULL
         OR intro_title_align IN ('left', 'center', 'right'));

-- 10 · Background highlight pill on/off. When TRUE the overlay
--      renders text on a dark rgba pill for max legibility over busy
--      video.
ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS intro_title_highlight boolean NOT NULL DEFAULT false;

-- 11 · Pointer to the user's custom chat wallpaper stored in the
--      nex-user-wallpapers Supabase Storage bucket. NULL = fall back
--      to the active chat theme's packaged wallpaper. Separate from
--      intro_video_url so a user can mix-and-match (custom wallpaper
--      with theme intro, or vice-versa).
ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS intro_wallpaper_url text;

COMMIT;
