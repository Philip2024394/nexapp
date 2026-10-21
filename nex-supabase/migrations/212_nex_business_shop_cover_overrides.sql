-- ═══════════════════════════════════════════════════════════════════
-- 212_nex_business_shop_cover_overrides.sql
-- NEX Business · Owner-authored shop face cover overrides.
-- Philip 2026-10-20 · FOUNDER AUTHORISATION PENDING · Shop Cover Wave
-- ═══════════════════════════════════════════════════════════════════
--
-- WHAT THIS MIGRATION DOES
--   Adds two nullable override columns to `public.nex_business` so a
--   Bisnis account owner can tune the public shop face cover at
--   `/nex-native/{businessSlug}` on top of the sealed Cover-A theme
--   (Migration 100). Both default NULL · zero regression · existing
--   rows keep the current chat_theme-driven render.
--
--     shop_cover_image_url text NULL
--       Owner-uploaded background image for the shop hero. When
--       non-null the shop face cover paints this image instead of
--       the chat_theme.hero_image_url. Stored in the sealed
--       `nex-user-wallpapers` bucket (Migration 210) under
--       `shop/{business_id}/cover.{ext}`.
--
--     shop_cover_tint_hex text NULL
--       Owner-selected accent hex (format `#RRGGBB`) applied to the
--       shop face cover chrome (CoverThemeSkin accentHex +
--       bubbleRimHex). Overrides chat_theme.accent_hex for THIS
--       business's shop page only · the owner's chat surface accent
--       is unchanged.
--
-- OWNER DIRECTIVE 2026-10-20
--   "under each theme shop will have button for view theme or edit
--    theme . if selected edit theme new page will displaying with
--    the selected shop theme and options for edit the theme color
--    and replace only shop theme back ground image".
--   This migration persists the "edit theme color" + "replace shop
--   theme background image" fields. Precedence (sealed):
--     1. shop_cover_image_url   (owner edit · wins)
--     2. theme.hero_image_url   (chat_theme default)
--     3. moody-gradient fallback
--
--     1. shop_cover_tint_hex    (owner edit · wins)
--     2. theme.accent_hex       (chat_theme default)
--
-- APPEND-ONLY SAFETY
--   Pure ADD COLUMN. No ALTERs to existing columns. No DML. No
--   triggers. No GRANT/REVOKE changes.
--
-- IDEMPOTENCE
--   ADD COLUMN IF NOT EXISTS × 2. Safe to re-run.
--
-- ROLLBACK
--   ALTER TABLE public.nex_business
--     DROP COLUMN IF EXISTS shop_cover_image_url;
--   ALTER TABLE public.nex_business
--     DROP COLUMN IF EXISTS shop_cover_tint_hex;
--
-- SAFE ON POPULATED DB
--   Yes. Two nullable text columns · no row rewrite · brief metadata
--   update only. Zero impact on current readers / writers of
--   `nex_business` or the sealed Cover-A render path.
--
-- CHECK CONSTRAINT
--   shop_cover_tint_hex is validated against the standard `#RRGGBB`
--   lower/upper-case hex pattern. Matches the pattern used by
--   nex_account.intro_title_color in migration 209. NULL is allowed
--   (default · falls through to theme accent).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS shop_cover_image_url text NULL;

ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS shop_cover_tint_hex text NULL;

-- Constraint added only when both columns exist. Hex pattern mirrors
-- intro_title_color's CHECK from migration 209 (one source of truth
-- for colour-hex validation across the app).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nex_business_shop_cover_tint_hex_format'
  ) THEN
    ALTER TABLE public.nex_business
      ADD CONSTRAINT nex_business_shop_cover_tint_hex_format
      CHECK (
        shop_cover_tint_hex IS NULL
        OR shop_cover_tint_hex ~ '^#[0-9A-Fa-f]{6}$'
      );
  END IF;
END$$;

COMMENT ON COLUMN public.nex_business.shop_cover_image_url IS
  'Owner-uploaded background image for the public /{slug} shop face '
  'cover. Overrides theme.hero_image_url when non-null. Stored in '
  'bucket nex-user-wallpapers (migration 210). Owner directive '
  '2026-10-20 · Shop Cover Overrides.';

COMMENT ON COLUMN public.nex_business.shop_cover_tint_hex IS
  'Owner-selected accent hex (#RRGGBB) applied to the shop face '
  'cover chrome. Overrides theme.accent_hex for this business only. '
  'Owner directive 2026-10-20 · Shop Cover Overrides.';
