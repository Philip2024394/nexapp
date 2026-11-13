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
import { BurgerMenu } from "../../_burger-menu";
import { ShopChatFab } from "../../_shop-chat-fab";
// Owner directive 2026-11-07 · ShopSideChatDrawer (top-left chat icon
// on the preview image) retired · the preview is embedded via iframe
// into /manage/shop/themes and the icon was still painting over each
// template image. Unmounted here to match the public [businessSlug]
// retirement in commit 6cad37d. ShopChatFab bottom-right remains.
// import { ShopSideChatDrawer } from "../../_shop-side-chat-drawer";
// Owner directive 2026-11-06 · "is all work wired and connected
// supabase". Load the owner's real nex_business row (when a dev-
// impersonated session is present) so the burger-menu overlays
// paint with persisted content instead of the hardcoded mock.
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { getShopCoverContent } from "@/lib/nex-native/shop-cover-service";
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

// Owner directive 2026-11-06 · default theme flipped from pink-dream
// to nex-flat so the shop-themes picker iframe doesn't render under
// the dream-themed hero by default. Callers that want a specific
// theme still pass `?theme=<id>`.
const DEFAULT_THEME = "nex-flat";

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
          background: "var(--nex-world-background-base, #020914)",
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
          background: "var(--nex-world-background-base, #020914)",
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

  // Owner directive 2026-11-06 · resolve the effective accent once
  // so sibling components outside CoverThemeSkin (ShopChatFab in
  // particular) can match the theme colour · the FAB is a sibling
  // of the skin wrapper so --nex-accent CSS var doesn't inherit.
  const effectiveAccent =
    typeof sp.tint === "string" && /^#[0-9A-Fa-f]{6}$/.test(sp.tint)
      ? sp.tint
      : theme.accent_hex;

  // Owner directive 2026-11-06 · load the owner's real business row
  // when a session is present so the burger-menu overlays + FAB
  // paint with persisted content (display_name · city · description ·
  // address · hours_display · social handles · logo). Silent fallback
  // to null means visitors + unauthenticated preview iframes still
  // see the mock copy (unchanged behaviour).
  const shopContent = await (async () => {
    try {
      const session = await resolveSessionWithDevOverride();
      if (!session) return null;
      const businesses = await listBusinessesByOwner(session.account.id);
      const business = businesses[0];
      if (!business) return null;
      return await getShopCoverContent(business.id);
    } catch {
      return null;
    }
  })();
  const ownerHandle = shopContent?.slug ?? null;

  return (
    <>
      {/* Owner directive 2026-11-06 · when embedded inside the
          shop-themes picker iframe, nuke every layer of chrome that
          sits between the iframe and the actual template render:
          dev-impersonation banner, the sealed phone-frame bezel +
          clamp, stage padding, the global hero backdrop. The
          template fills the iframe fully. */}
      {isEmbedded && (
        <style>{`
          /* Dev-impersonation banner · top:0 fixed strip */
          body > div[style*="position:fixed"][style*="top:0"],
          body > div[style*="position: fixed"][style*="top: 0"] { display: none !important; }
          /* Lift the sealed phone-frame clamp */
          html, body { background: transparent !important; }
          .nex-native-stage {
            display: block !important;
            padding: 0 !important;
            background: transparent !important;
            width: 100vw !important;
            min-height: 100vh !important;
          }
          .nex-native-frame {
            width: 100vw !important;
            max-width: 100vw !important;
            height: 100vh !important;
            max-height: 100vh !important;
            min-height: 100vh !important;
            aspect-ratio: initial !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            transform: none !important;
          }
          /* Owner directive 2026-11-06 · "remove shade from screen" ·
             hide CoverThemeSkin's legibility scrim (dark top+bottom
             gradient) + accent-glow radial so the chosen background
             paints clean, not dimmed. These overlays stay in place
             on the real shop surface outside the preview iframe. */
          [aria-hidden][style*="linear-gradient(180deg, rgba(3,8,20"],
          [aria-hidden][style*="linear-gradient(180deg,rgba(3,8,20"],
          [aria-hidden][style*="radial-gradient(60% 40% at 50% 8%"],
          [aria-hidden][style*="radial-gradient(60%40%at 50% 8%"] {
            display: none !important;
          }
          /* Owner directive 2026-11-06 · "remove the shade from
             screen of shops we want fresh clear view" · the sealed
             wallpaper layer paints at opacity:0.35 for text
             legibility on real shop pages (see theme-skin.tsx
             line 294). Inside the embed preview we want the image
             at full opacity so the owner sees it clean. */
          [aria-hidden][style*="position:fixed"][style*="opacity:0.35"],
          [aria-hidden][style*="position: fixed"][style*="opacity: 0.35"] {
            opacity: 1 !important;
          }
          /* Owner directive 2026-11-06 · "the back ground image
             must fit the template shop back ground width and
             height". Inside the picker preview, the wallpaper
             fills both axes exactly (no Ken Burns zoom, no
             transform drift, stretch to 100% × 100%) so the owner
             sees the chosen preset painted edge-to-edge. Real-shop
             pages keep the sealed cinematic Ken Burns + cover. */
          [data-nex-cover-wallpaper] {
            animation: none !important;
            transform: none !important;
            background-size: 100% 100% !important;
            background-position: center !important;
            background-repeat: no-repeat !important;
          }
          /* Owner directive 2026-11-06 · "we can remove this from
             home page as we have in burger drawer Visit us ·
             Directions ↗ · address · Opening Hours". Hide the
             inline Visit-Us panel (the dashed <a> block rendered
             in all 11 cover layouts) because the burger menu top-
             right now carries the same info. Target via the
             block's distinctive inline-style pattern:
             border:1px dashed var(--nex-accent-soft) +
             background linear-gradient with --nex-accent-faint. */
          a[style*="dashed var(--nex-accent-soft)"],
          a[style*="dashed var(--nex-accent-soft,"] {
            display: none !important;
          }
          /* Owner directive 2026-11-06 · "footer text field still
             showing remove" · hide the sealed CoverComposer footer
             input (+ · emoji · text · send) since the floating
             Chat FAB bottom-right + burger menu together now carry
             every user intent the composer previously served. */
          [data-nex-cover-composer] {
            display: none !important;
          }
          /* Owner directive 2026-11-06 · "move cart icon up to header
             on left side of burger button and remove the button from
             cart - just icon". Hide the sealed bottom sticky bar
             (Chat/Menu/Cart chunky buttons) · Chat is now a floating
             FAB bottom-right, Cart is now the small icon in the top
             header left of the burger button. */
          [data-nex-cover-sticky-bar] {
            display: none !important;
          }
          /* Owner directive 2026-11-06 · "why is there a cart button
             on hero area · we have the main cart icon which should
             be connected one cart for slider or shop or any other
             cart check out experince on the owners chat app". The
             sealed hero floating CoverCartButton (layouts.tsx
             ~L1579) reads a separate "nex_cart_v1" localStorage key,
             while the HeaderCartIcon in the burger-menu cluster
             reads the app-wired NEX_CART_STORAGE_KEY. Hiding the
             hero button here keeps the single header cart as the
             only entry point visible in the picker preview. Follow-
             up: unify the two keys at the shop-cart-service layer
             so production surfaces inherit the one-cart contract. */
          [data-nex-cover-cart-button] {
            display: none !important;
          }
        `}</style>
      )}
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
          accentHex={effectiveAccent}
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
        {/* Owner directive 2026-11-06 · world-class shop apps keep
            address + hours + policies behind a burger · this top-
            right button opens a right-anchored dropdown with Visit
            us + Hours + Dispatch + Returns + Wholesale + Chat +
            Share. Position: absolute so it stays scoped to the
            phone frame on both preview + real shop surfaces. */}
        <BurgerMenu
          ownerHandle={ownerHandle}
          address={shopContent?.address ?? null}
          hours={null}
          shopUrl={shopContent?.slug ? `/nex-native/${shopContent.slug}` : null}
          accentHex={effectiveAccent}
          content={shopContent}
        />
        {/* Owner directive 2026-11-06 · "Chat with us is floating
            button bottom right on screen". Replaces the burger's
            Chat row with a dedicated FAB · send-first, signup
            contextual flow. */}
        {/* Preview surface · no live business UUID · pass ownerAccountId
            as null so the FAB renders visually but doesn't navigate.
            isSignedIn=false so the registration popup appears on tap
            (matches the signed-out buyer's real experience). */}
        <ShopChatFab
          ownerAccountId={ownerHandle}
          shopName={shopContent?.displayName ?? null}
          shopSlug={null}
          isSignedIn={false}
          accentHex={effectiveAccent}
        />
        {/* Owner directive 2026-11-07 · ShopSideChatDrawer unmounted ·
            the top-left chat trigger was painting over every template
            preview image when embedded in /manage/shop/themes. The
            bottom-right ShopChatFab remains as the sole owner-chat
            entry point. File preserved at cover/_shop-side-chat-drawer
            .tsx for revert-safety. */}
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
