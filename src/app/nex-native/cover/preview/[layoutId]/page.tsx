// src/app/nex-native/cover/preview/[layoutId]/page.tsx
//
// Dynamic layout preview · Founder-set 2026-09-30 · Bridge 98.
// -----------------------------------------------------------------------------
// Renders a single sealed cover template inside the PhoneFrame. A small
// header pill above the frame tells the founder which template number
// they're on (01-10), its name, the current theme, and links back to
// the numbered gallery.

import Link from "next/link";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { CoverThemeSkin } from "../../theme-skin";
import { CoverLayoutSwitch } from "../../layout-switch";
import {
  COVER_LAYOUT_IDS,
  COVER_LAYOUT_LABELS,
  isValidCoverLayoutId,
} from "../../layout-ids";
import {
  CRISPY_CHICKEN_MOCK,
  MARIA_MOCK,
  PRODUCT_SELLER_MOCK,
  type MockCoverContent,
} from "../../mock-data";

/** Owner directive 2026-10-22 · brand-specific mock registry · the
 *  NEX Themes Marketplace shop preview passes `?brand=<themeId>` so
 *  each chat theme (Crispy Chicken, Pink Dream, etc.) renders its
 *  11 shop templates with brand-fit content (menu items for Crispy
 *  Chicken, products for Pink Dream, etc.) instead of generic
 *  MARIA_MOCK. Unknown brand values fall back to MARIA_MOCK silently
 *  so the sealed path for direct navigation is unaffected. */
const BRAND_MOCKS: Readonly<Record<string, MockCoverContent>> = {
  "crispy-chicken": CRISPY_CHICKEN_MOCK,
};
import { listThemeEmojis } from "@/lib/nex-native/theme-emoji-service";
import { PhoneFrame } from "../_phone-frame";
// Owner-authorised 2026-10-18 · S7 · discreet bottom action bar
// renders ONLY in full-page preview mode (never when ?embed=1 is on,
// so mini-phone iframes inside /cover-themes-library stay clean).
import { CoverActionBar } from "./_cover-action-bar";
// Owner directive 2026-10-22 · intercept product-card taps when
// the preview is embedded with `?brand=` so the marketplace parent
// can open its menu-item sheet instead of the sealed peer-chat flow.
import { BrandTapBridge } from "./_brand-tap-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_THEME = "pink-dream";

const HEADER_STYLE: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 50,
  padding: "12px 16px",
  background:
    "linear-gradient(180deg, rgba(2,7,14,0.94), rgba(2,7,14,0.72))",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  borderBottom: "1px solid rgba(0,175,255,0.22)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  color: "#F2F5F8",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

export default async function CoverLayoutPreview({
  params,
  searchParams,
}: {
  params: Promise<{ layoutId: string }>;
  searchParams?: Promise<{
    theme?: string;
    embed?: string;
    /** Owner directive 2026-10-20 · ?tint=#RRGGBB overrides the theme
     *  accent on this render only (the Edit Shop Cover editor passes
     *  this so the preview iframe reflects the user's colour pick
     *  before any save hits the database). */
    tint?: string;
    /** Owner directive 2026-10-20 · ?bg=<url> overrides the theme
     *  hero wallpaper on this render only. */
    bg?: string;
    /** Owner directive 2026-10-22 · ?brand=<themeId> selects a
     *  brand-specific preview mock from BRAND_MOCKS (e.g.
     *  crispy-chicken → menu items instead of generic products).
     *  Unknown values fall back to MARIA_MOCK · the sealed direct-
     *  navigation path is unaffected. */
    brand?: string;
  }>;
}) {
  const { layoutId } = await params;
  const sp = (await searchParams) ?? {};
  // Owner directive 2026-10-18 · the `?embed=1` flag hides the sticky
  // design header (back link, template number, APPLY) so this page
  // can be mounted as a mini preview inside the Cover Themes Library.
  // The PhoneFrame's mobile-collapse CSS kicks in at the iframe's
  // native 390px width, so the cover fills the entire frame edge-to-
  // edge with no bezel, notch, or home-indicator.
  const isEmbedded = sp.embed === "1";

  if (!isValidCoverLayoutId(layoutId)) {
    return (
      <pre
        style={{
          padding: 24,
          color: "#F2F5F8",
          background: "#020914",
          fontFamily: "ui-monospace, monospace",
          minHeight: "100dvh",
          margin: 0,
          whiteSpace: "pre-wrap",
        }}
      >
        Unknown cover layout id: [{String(layoutId)}]{"\n"}
        Valid: {COVER_LAYOUT_IDS.join(", ")}
      </pre>
    );
  }

  const themeId = sp.theme ?? DEFAULT_THEME;
  const theme = await chatThemeService.getThemeById(themeId);
  if (!theme || !theme.is_active) {
    return (
      <pre
        style={{
          padding: 24,
          color: "#F2F5F8",
          background: "#020914",
          fontFamily: "ui-monospace, monospace",
          minHeight: "100dvh",
          margin: 0,
        }}
      >
        Theme not found or inactive: {themeId}
      </pre>
    );
  }

  const themes = await chatThemeService.listActiveThemes().catch(() => []);
  const templateNumber =
    String(COVER_LAYOUT_IDS.indexOf(layoutId) + 1).padStart(2, "0");
  const templateName = COVER_LAYOUT_LABELS[layoutId];

  return (
    <>
      {/* Design header · founder always knows which template + theme
          they're working on, and can jump back to the gallery.
          Owner directive 2026-10-18 · header is HIDDEN when ?embed=1
          so this page can be mounted as a mini preview inside the
          Cover Themes Library without any chrome. */}
      {!isEmbedded && (
        <header style={HEADER_STYLE}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              minWidth: 0,
            }}
          >
            <Link
              href="/nex-native/cover/preview"
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                background: "transparent",
                border: "1px solid rgba(0,175,255,0.35)",
                color: "#00AFFF",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              ‹ All templates
            </Link>
            <div
              style={{
                display: "inline-flex",
                alignItems: "baseline",
                gap: 10,
                minWidth: 0,
              }}
            >
              <span
                aria-hidden
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#00AFFF",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {templateNumber}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "-0.005em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {templateName}
              </span>
            </div>
          </div>
          {/* Theme picker · switches which theme paints the preview. */}
          {themes.length > 1 && (
            <form
              method="get"
              style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}
            >
              <select
                name="theme"
                defaultValue={themeId}
                style={{
                  padding: "5px 8px",
                  borderRadius: 6,
                  background: "#03101D",
                  border: "1px solid rgba(0,175,255,0.35)",
                  color: "#F2F5F8",
                  fontSize: 11,
                  fontFamily: "inherit",
                }}
              >
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {/* 2026-10-27 · NexChatThemeRow exposes `name` */}
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                style={{
                  padding: "5px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: "#00AFFF",
                  color: "#02070E",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                APPLY
              </button>
            </form>
          )}
        </header>
      )}

      <PhoneFrame>
        {/* Owner directive 2026-10-20 · ?tint= and ?bg= query params
            override the chat_theme accent + hero image for this render
            only · lets the Edit Shop Cover editor's preview iframe
            show the owner's live colour / image pick instantly without
            a database write. Validation: tint must match the standard
            #RRGGBB pattern · bg must look like a relative or absolute
            URL · untrusted / malformed values fall back to the sealed
            chat_theme defaults. */}
        <CoverThemeSkin
          accentHex={
            typeof sp.tint === "string" && /^#[0-9A-Fa-f]{6}$/.test(sp.tint)
              ? sp.tint
              : theme.accent_hex
          }
          bubbleRimHex={theme.bubble_rim_hex}
          composerRimHex={theme.composer_rim_hex}
          wallpaperUrl={
            typeof sp.bg === "string" && /^https?:\/\/|^\//.test(sp.bg)
              ? sp.bg
              : theme.hero_image_url
          }
          wallpaperConfig={theme.wallpaper_config}
          themeId={theme.id}
          layoutId={layoutId}
        >
          <CoverLayoutSwitch
            layoutId={layoutId}
            content={{
              // Founder direction 2026-09-30 · product-vertical mock
              // for Template 03 so the sections tabs read Electronics /
              // Mens Wear / Watches with matching products. Every
              // other template still gets MARIA_MOCK.
              //
              // Owner directive 2026-10-22 · when ?brand=<themeId> is
              // present AND the id is in BRAND_MOCKS, that brand mock
              // wins over the layout fallback (so Crispy Chicken shows
              // Burgers / Chicken / Meal Deals on every layout). Unknown
              // brand values fall through to the layout fallback above.
              ...(typeof sp.brand === "string" && BRAND_MOCKS[sp.brand]
                ? BRAND_MOCKS[sp.brand]
                : layoutId === "product"
                ? PRODUCT_SELLER_MOCK
                : MARIA_MOCK),
              // Bridge ThemeEmoji-B · load emojis for the currently-
              // previewed theme so the composer picker matches. Fails
              // soft to empty (composer falls back to default set).
              themeEmojis: (
                await listThemeEmojis(theme.id).catch(() => [])
              ).map((row) => ({
                slug: row.slug,
                imageUrl: row.image_url,
                label: row.label,
              })),
            }}
            themeId={theme.id}
          />
        </CoverThemeSkin>
      </PhoneFrame>
      {/* Owner-authorised 2026-10-18 · S7 · the action bar is a
          sibling of the sealed PhoneFrame so the frame's mobile
          collapse CSS (which hides chrome at max-width:767px) does
          not swallow it. Embed mode (iframe inside the cover-themes-
          library mini tiles) skips it entirely · the mini tiles
          stay chrome-free. */}
      {!isEmbedded && <CoverActionBar layoutId={layoutId} />}
      {/* Owner directive 2026-10-22 · when the preview is embedded
          with a brand id, intercept product-card clicks and post
          them to the parent window. The sealed CoverCatalog + its
          peer-chat navigation are untouched · the bridge only
          fires inside an iframe with cross-document parent. */}
      {typeof sp.brand === "string" && sp.brand.length > 0 && (
        <BrandTapBridge brand={sp.brand} />
      )}
    </>
  );
}
