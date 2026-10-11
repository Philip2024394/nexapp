// src/app/nex-native/chat-themes-library/_category-grid.tsx
//
// Category Landing Grid · Step 1B (sealed 2026-10-06).
// Phone-frame hero tiles · Step 1B.1 (sealed 2026-10-06).
//
// Renders one phone-frame tile per registered category. The LANDING
// level of the Theme Library. The phone is the hero of the tile · its
// screen paints a representative World (ThemePackage) through the
// existing Theme Engine (ThemeWorld + ThemeBubble primitives), so the
// visitor sees a live miniature of what the category opens into. The
// surrounding chrome (frame · caption) uses the category's palette ·
// not NEX chrome · so Ocean reads blue, Café reads warm, Explore reads
// NEX-cyan.
//
// Tapping a tile navigates to the showcase route for that category:
//
//   /nex-native/chat-themes-library/category/[categoryId]
//
// Load-bearing architectural rules:
//
//   · DATA-DRIVEN · iterates `listCategories()` and renders a uniform
//     tile for every entry. Zero per-category UI branches · no
//     `if cat.id === "ocean"`. Adding a new category to the registry
//     automatically produces a new phone-frame tile here with no code
//     change (as long as the category declares a heroThemeId or
//     contains at least one world).
//   · HERO RESOLUTION is a universal, data-driven step · the grid
//     looks up `category.heroThemeId` in the merged theme collection ·
//     if absent or unresolvable it falls back to the first world in
//     that category. Zero per-id JSX.
//   · NO IFRAME · the phone screen renders ThemePackage visuals via
//     the Theme Engine primitives (ThemeWorld + ThemeBubble) directly ·
//     NOT inside an iframe. Sealed by the 8f805d7d doctrine · the
//     dev-mode performance.measure race from universalising
//     PhoneFramePreview iframes in Library tiles must never return.
//   · UNIVERSAL THEME COLOUR RULE applies with a two-tier split sealed
//     by the Step 1B.1 directive (point 13):
//       outer phone frame + caption → category.colours
//       inner phone screen         → World ThemePackage via engine
//     This preserves the room/world distinction: the category room
//     stays its own colour even when you see a world of a different
//     palette inside the phone.
//   · ZERO-MEMBER categories ARE SHOWN on the landing with a visible
//     "Coming soon" state (re-seal 2026-10-11 · Step 1C). Prior rule
//     hid empty categories · the founder reversed that so visitors
//     can see the full IA on day one (e.g. Products / Services ship
//     empty but visible). The empty-tile marker is
//     `data-nex-category-empty="true"` and the phone screen paints
//     the category's own palette plus a `Coming soon` glyph.
//     The showcase route still handles zero-member categories
//     gracefully for deep-link correctness (tested).
//   · The Explore collection is a general / uncategorised bucket ·
//     presented as a phone-frame tile but NEVER described as a visual
//     family. The caption copy comes from the registry so a future
//     rename of the display name ripples automatically.
//   · The tile is a server-rendered <Link> wrapping ThemeWorld +
//     ThemeBubble (both server-safe primitives). No client JS needed
//     to navigate · no useEffect required for the phone paint.
//   · UNIVERSAL THEME HANDOFF is unchanged · tiles link to
//     /chat-themes-library/category/${id}, NEVER /nex-native/themes/${id}
//     (that URL is minted by _theme-browser-client via themePreviewHref
//     at the per-world level inside the showcase room).

import * as React from "react";
import Link from "next/link";
import {
  EXPLORE_CATEGORY_ID,
  listCategories,
} from "@/lib/nex-native/theme-category/registry";
import { sortCategoriesByIndustry } from "@/lib/nex-native/theme-category/industry-order";
import type { ThemeCategory } from "@/lib/nex-native/theme-category/types";
import {
  ThemeBubble,
  ThemeWorld,
  type BubblePreset,
} from "@/lib/nex-native/chat-render/theme-world";
import type { BrowserThemeRow } from "./_theme-browser-client";
import {
  miniPhoneBubbleBackground,
  miniPhoneAvatarBorder,
  miniPhoneAvatarGlow,
  miniPhoneHeaderCluster,
  miniPhoneSendBackground,
  miniPhoneSendIconColor,
  miniPhoneAmbient,
  hexToRgba as paletteHexToRgba,
} from "../chat-standard/_engine/preview-mini-phone";
import { MiniPhoneAmbientLayer } from "./_mini-phone-ambient-layer";

// Soft caption/text colours used on top of the category's own palette.
// The category's `highlight` slot carries the on-dark text colour · we
// derive a dimmer variant via rgba on the same channel below.
const CAPTION_DIM_ALPHA = 0.72;
const CAPTION_MUTE_ALPHA = 0.5;

export interface CategoryGridProps {
  /** The merged theme collection · one BrowserThemeRow per theme
   *  across code-registered live-worlds + DB themes. Used to compute
   *  member counts per category AND to resolve each category's hero
   *  World for the phone-screen paint. The grid does not render the
   *  themes themselves at the per-world level · that happens inside
   *  the showcase route. */
  browserThemes: ReadonlyArray<BrowserThemeRow>;
  /** Optional industry-first ordering · when the viewer's business
   *  category maps to a theme category id, that category moves to the
   *  front of the grid. The sealed registry snapshot stays
   *  deterministic · reorder is a pure view-time operation. */
  preferredCategoryId?: string | null;
}

export function CategoryGrid({
  browserThemes,
  preferredCategoryId,
}: CategoryGridProps): React.JSX.Element {
  // Universal rule · iterate the registry · one tile per entry.
  // Re-seal 2026-10-11 (Step 1C) · empty categories ARE shown with
  // the EmptyScreen fallback + a `data-nex-category-empty` marker ·
  // the previous hide-rule has been dropped so the founder-authorised
  // Food/Products/Services/Explore IA is visible on day one even when
  // Products + Services have zero worlds.
  //
  // Industry-first reorder (2026-10-11) · if the caller passes a
  // preferredCategoryId that resolves to a registered category, that
  // category moves to the front · the rest keep the sealed order.
  const orderedCategories = sortCategoriesByIndustry(
    listCategories(),
    preferredCategoryId ?? null,
  );
  const categoriesWithMembers = orderedCategories.map((category) => {
    const inCategory = browserThemes.filter(
      (t) => t.category_id === category.id,
    );
    return {
      category,
      count: inCategory.length,
      hero: resolveHeroWorld(category, inCategory),
    };
  });

  return (
    <>
      <style>{`
        /* Step 1H · 2026-10-11 · forced 2-per-row at every breakpoint.
         * Prior 1/2/3-col auto-fit layout dropped to 1 column on
         * mobile and bloated to 3 columns on desktop. Founder set the
         * design to a strict 2-column grid for predictable scanning.
         * Phones scale down inside their column so narrow phones
         * stay legible without a layout shift. */
        .nex-category-phone-grid {
          display: grid;
          /* Category phones get space on BOTH axes · founder-flipped
           * 2026-10-11 twice ("space between them on each row" ·
           * "category phone screens should have space between them").
           * Column + row gap generous enough that adjacent phones
           * never touch · each tile reads as its own object. */
          column-gap: 28px;
          row-gap: 40px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          max-width: 760px;
          margin: 18px auto 0;
          justify-items: center;
        }
        @media (min-width: 601px) {
          .nex-category-phone-grid {
            column-gap: 44px;
            row-gap: 56px;
          }
        }
        .nex-category-phone-tile {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          text-decoration: none;
          width: 100%;
          max-width: 320px;
          transition: transform 180ms ease;
        }
        .nex-category-phone-tile:hover,
        .nex-category-phone-tile:focus-visible {
          transform: translateY(-2px);
        }
        .nex-category-phone-tile:focus-visible {
          outline: none;
        }
        .nex-category-phone-tile:focus-visible .nex-category-phone-frame {
          box-shadow: 0 0 0 3px rgba(255,255,255,0.4),
                      0 10px 30px rgba(0,0,0,0.5);
        }
      `}</style>
      <div
        data-nex-category-grid
        className="nex-category-phone-grid"
      >
        {categoriesWithMembers.map(({ category, count, hero }) => (
          <CategoryTile
            key={category.id}
            category={category}
            count={count}
            hero={hero}
          />
        ))}
      </div>
    </>
  );
}

/** A single category tile · universal · identical shape for every
 *  category. The phone is the hero · the caption below is secondary. */
function CategoryTile({
  category,
  count,
  hero,
}: {
  category: ThemeCategory;
  count: number;
  hero: BrowserThemeRow | null;
}): React.JSX.Element {
  const isExplore = category.id === EXPLORE_CATEGORY_ID;
  const { colours } = category;
  const captionText = colours.highlight;
  const captionDim = withAlpha(colours.highlight, CAPTION_DIM_ALPHA);
  const captionMute = withAlpha(colours.highlight, CAPTION_MUTE_ALPHA);

  const isEmpty = count === 0;
  return (
    <Link
      href={`/nex-native/chat-themes-library/category/${category.id}`}
      prefetch={false}
      data-nex-category-tile
      data-nex-category-id={category.id}
      data-nex-category-empty={isEmpty ? "true" : undefined}
      className="nex-category-phone-tile"
      aria-label={`${category.name} · ${count} ${count === 1 ? "world" : "worlds"} · ${category.tagline ?? ""}`.trim()}
    >
      <CategoryPhoneFrame
        category={category}
        hero={hero}
      />
      <div
        data-nex-category-caption
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          padding: "0 8px",
          textAlign: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {category.icon && (
            <span
              aria-hidden
              style={{
                fontSize: 20,
                lineHeight: 1,
                filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
              }}
            >
              {category.icon}
            </span>
          )}
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: captionText,
            }}
          >
            {category.name}
          </div>
        </div>
        <div
          data-nex-category-member-count
          style={{
            fontSize: 11,
            color: isEmpty || isExplore ? captionMute : captionDim,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          {isEmpty
            ? "Coming soon"
            : `${count} ${count === 1 ? "World" : "Worlds"}`}
        </div>
        {category.tagline && (
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: captionDim,
              marginTop: 2,
              maxWidth: 280,
            }}
          >
            {category.tagline}
          </div>
        )}
      </div>
    </Link>
  );
}

/** Phone silhouette · outer frame is the CATEGORY palette · screen
 *  inside paints the hero World through the Theme Engine. When the
 *  category has no resolvable hero (fallback failed) renders a neutral
 *  screen so the layout stays stable. */
function CategoryPhoneFrame({
  category,
  hero,
}: {
  category: ThemeCategory;
  hero: BrowserThemeRow | null;
}): React.JSX.Element {
  const { colours } = category;
  const bezelOuter = colours.deep;
  const bezelBorder = colours.primary;
  const bezelGlow = colours.glow;
  const notchFill = withAlpha(colours.deep, 0.9);
  const notchBorder = withAlpha(colours.highlight, 0.14);

  return (
    <div
      data-nex-category-phone
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 300,
        aspectRatio: "9 / 18",
        borderRadius: 32,
        padding: 6,
        background: `linear-gradient(165deg, ${bezelOuter} 0%, ${withAlpha(bezelOuter, 0.72)} 100%)`,
        border: `1px solid ${withAlpha(bezelBorder, 0.5)}`,
        boxShadow: `0 18px 44px rgba(0,0,0,0.55), 0 0 32px ${bezelGlow}`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 6,
          borderRadius: 26,
          overflow: "hidden",
          background: bezelOuter,
          border: `1px solid ${withAlpha(bezelBorder, 0.35)}`,
        }}
      >
        {hero ? <HeroScreen hero={hero} /> : <EmptyScreen colours={colours} />}

        {/* Phone notch · subtle island shape · uses the category's
            deep + highlight channel so the notch reads as part of the
            phone chrome, not the theme beneath. */}
        <div
          aria-hidden
          data-nex-category-phone-notch
          style={{
            position: "absolute",
            top: 8,
            left: "50%",
            transform: "translateX(-50%)",
            width: 70,
            height: 8,
            borderRadius: 999,
            background: notchFill,
            border: `1px solid ${notchBorder}`,
            zIndex: 4,
          }}
        />
      </div>
    </div>
  );
}

/** The phone's screen · ThemeWorld paints the real wallpaper + overlays,
 *  two ThemeBubble instances float the archetypal "hey!" / "love this"
 *  so the visitor sees a chat-like preview. Byte-equivalent to the
 *  per-world Phone Gallery tile in _phone-tile.tsx · same engine
 *  primitives, same preset-first bubble pattern · no second
 *  implementation.
 *
 *  Wallpaper-null fallback · when the hero's ThemePackage declares no
 *  wallpaper art (coffee / botanical / midnight / french-cafe today),
 *  the screen paints an accent-tinted gradient derived from the World's
 *  own BrowserThemeRow colours. This keeps every category phone
 *  visually dominated by its World's identity rather than blending
 *  into the bezel. The gradient uses the three colour slots that live
 *  on BrowserThemeRow (accent · bubble-rim · composer-rim) so no
 *  per-id branches are needed. */
function HeroScreen({
  hero,
}: {
  hero: BrowserThemeRow;
}): React.JSX.Element {
  const preset: BubblePreset =
    hero.wallpaper_config?.bubbleStyle?.preset ?? "classic";
  const bubbleRim = hero.bubble_rim_hex ?? hero.accent_hex;
  // Sealed Final Parity Pass 2026-10-11 · bubble background now
  // dispatches through the LIVE engine's `resolveBubbleBackground`
  // via the shared helper, keyed off this theme's actual
  // `bubble_material`. Each theme paints its own declared material
  // (solid for nex-flat · neon-glass for midnight-cafe · etc) so
  // the category phone matches the live chat per-theme.
  const accentGlassMine = miniPhoneBubbleBackground(
    hero.palette,
    true,
    hero.bubble_material,
  );
  const accentGlassPeer = miniPhoneBubbleBackground(
    hero.palette,
    false,
    hero.bubble_material,
  );

  const hasWallpaper = Boolean(hero.hero_image_url);
  const gradientTop = hero.accent_hex;
  const gradientMid = hero.bubble_rim_hex ?? hero.accent_hex;
  const gradientBottom = hero.composer_rim_hex ?? hero.accent_hex;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
      }}
    >
      {!hasWallpaper && (
        // Accent-tinted gradient · derived from the World's own
        // palette slots on BrowserThemeRow. Zero per-id JSX · the
        // same three channels drive every wallpaper-null World.
        <div
          aria-hidden
          data-nex-category-phone-fallback
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(165deg, ${gradientTop} 0%, ${gradientMid} 55%, ${gradientBottom} 100%)`,
            opacity: 0.92,
            zIndex: 0,
          }}
        />
      )}
      <ThemeWorld
        wallpaperUrl={hero.hero_image_url}
        wallpaperConfig={hero.wallpaper_config}
        size="preview"
      />
      {/* Sealed Final Parity Pass 2026-10-11 · static ambient layer
          · each theme's `ambient.families` renders a lightweight
          representation at category-phone scale. Behind bubbles. */}
      <MiniPhoneAmbientLayer
        specs={miniPhoneAmbient(
          hero.palette,
          hero.ambient_families,
          "sparse",
        )}
      />
      {/* Phone top-header · matches the live chat shell layout:
          avatar with pink/green rim on the left + theme name +
          three circular right-cluster buttons (Home · Shop · Cart)
          painted in NEX orange with a pink cart dot · identical
          visual language to the real `/chat/peer/<id>` surface. */}
      <div
        aria-hidden
        data-nex-category-phone-header
        style={{
          position: "absolute",
          top: 20,
          left: 8,
          right: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
          zIndex: 4,
        }}
      >
        <span
          data-nex-category-phone-avatar
          style={{
            position: "relative",
            width: 20,
            height: 20,
            borderRadius: 999,
            background: `linear-gradient(135deg, ${hero.accent_hex}, ${hero.bubble_rim_hex ?? hero.accent_hex})`,
            color: "#021022",
            display: "grid",
            placeItems: "center",
            fontSize: 9,
            fontWeight: 800,
            flex: "none",
            // Sealed 2026-10-11 · avatar border is UNIVERSAL GREEN
            // (presence indicator) · mirrors the live chat's semantic
            // for the online dot which is green on every theme. Was
            // hardcoded NEX pink · a wrong semantic (pink implied
            // notification/active · but this is presence).
            border: miniPhoneAvatarBorder(),
            boxShadow: miniPhoneAvatarGlow(),
          }}
        >
          {(hero.name ?? "N").charAt(0).toUpperCase()}
        </span>
        <span
          style={{
            fontSize: 8,
            fontWeight: 700,
            color: "#F2F5F8",
            letterSpacing: "0.01em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textShadow: "0 1px 3px rgba(0,0,0,0.65)",
            flex: 1,
            minWidth: 0,
          }}
        >
          {hero.name}
        </span>
        {/* Right-cluster · sealed 2026-10-11 · home/shop/cart derived
            from the SHARED mini-phone treatment so every category
            phone reads in its own palette (Haunted purples, Ocean
            blues, Property terracotta, NEX orange). `preview-mini-
            phone.ts` owns the formula so a change to the live
            engine's R1 cluster propagates to every preview. */}
        <span
          aria-hidden
          data-nex-category-phone-right-cluster
          style={{ display: "inline-flex", alignItems: "center", gap: 3, flex: "none" }}
        >
          {miniPhoneHeaderCluster(hero.palette).map((b) => (
            <span
              key={b.key}
              style={{
                position: "relative",
                width: 14,
                height: 14,
                borderRadius: 999,
                background: b.bg,
                border: b.border,
                color: b.color,
                display: "grid",
                placeItems: "center",
                fontSize: 7.5,
                fontWeight: 800,
                boxShadow: b.shadow,
              }}
            >
              {b.glyph}
              {b.hasBadge && (
                <span
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    width: 5,
                    height: 5,
                    borderRadius: 999,
                    background: hero.palette.highlight,
                    border: `0.5px solid ${hero.palette.deep}`,
                  }}
                />
              )}
            </span>
          ))}
        </span>
      </div>
      {/* Live chat preview · six bubbles alternating peer / me so
          the phone paints a real conversation in the theme's own
          palette. Message copy sealed by the founder 2026-10-11. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 5,
          padding: "0 10px 44px",
          zIndex: 3,
        }}
      >
        {[
          // Founder-flipped 2026-10-11 · trimmed to two sealed lines ·
          // "i want" (peer) + "check themes on NEX" (mine). The earlier
          // 6-line conversation (hey / love this / wow / supercool /
          // i want / check themes on NEX) is gone.
          { text: "i want", mine: false },
          { text: "check themes on NEX 👆", mine: true },
        ].map((m, i) => (
          <ThemeBubble
            key={i}
            preset={preset}
            mine={m.mine}
            bubbleRim={bubbleRim}
            accentGlassMine={accentGlassMine}
            accentGlassPeer={accentGlassPeer}
            size="preview"
          >
            {m.text}
          </ThemeBubble>
        ))}
      </div>
      {/* Composer footer · theme-tinted pill matching the live
          chat shell composer. Send glyph is the universal NEX
          orange cone sealed by the composer-footer rule. */}
      <div
        aria-hidden
        data-nex-category-phone-footer
        style={{
          position: "absolute",
          left: 8,
          right: 8,
          bottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 4px 4px 10px",
          borderRadius: 999,
          background: withAlpha(hero.accent_hex, 0.14),
          border: `1px solid ${withAlpha(hero.accent_hex, 0.35)}`,
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          zIndex: 4,
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: 7,
            color: "rgba(242, 245, 248, 0.55)",
            fontStyle: "italic",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Message…
        </span>
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            // Sealed 2026-10-11 · send button derived from the SHARED
            // mini-phone treatment · solid theme primary matches the
            // live engine's `resolveControlsTreatment().sendButton`
            // (never a gradient · always solid). Was hardcoded NEX
            // orange gradient on every theme.
            background: miniPhoneSendBackground(hero.palette),
            border: `0.5px solid ${paletteHexToRgba(hero.palette.primary, 0.6)}`,
            color: miniPhoneSendIconColor(hero.palette),
            display: "grid",
            placeItems: "center",
            fontSize: 8,
            fontWeight: 800,
            flex: "none",
            boxShadow: `0 1px 3px ${paletteHexToRgba(hero.palette.primary, 0.4)}`,
          }}
        >
          ➤
        </span>
      </div>
    </div>
  );
}

/** Fallback screen · appears only when a category has members but
 *  neither heroThemeId nor the first-world fallback resolve to a
 *  BrowserThemeRow (should be unreachable in practice; the registry
 *  guard ensures hero ids are valid and resolveHeroWorld falls back to
 *  the first in-category world). Keeps the layout stable rather than
 *  crashing. */
function EmptyScreen({
  colours,
}: {
  colours: ThemeCategory["colours"];
}): React.JSX.Element {
  return (
    <div
      aria-hidden
      data-nex-category-empty-screen
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(180deg, ${colours.deep} 0%, ${colours.primary} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        color: colours.highlight,
        padding: "0 20px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          background: withAlpha(colours.highlight, 0.1),
          border: `1px solid ${withAlpha(colours.highlight, 0.25)}`,
          display: "grid",
          placeItems: "center",
          fontSize: 20,
          lineHeight: 1,
          color: colours.highlight,
        }}
      >
        ✨
      </div>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: colours.highlight,
        }}
      >
        Coming soon
      </div>
      <div
        style={{
          fontSize: 11.5,
          lineHeight: 1.45,
          color: withAlpha(colours.highlight, 0.7),
          maxWidth: 180,
        }}
      >
        No Worlds in this family yet
      </div>
    </div>
  );
}

/** Resolve the hero World for a category · universal rule, no per-id
 *  branches. heroThemeId takes precedence · a null hero or a hero that
 *  does not resolve against the in-category rows falls back to the
 *  first in-category row. Exported so tests can exercise it directly. */
export function resolveHeroWorld(
  category: ThemeCategory,
  inCategory: ReadonlyArray<BrowserThemeRow>,
): BrowserThemeRow | null {
  if (category.heroThemeId) {
    const hero = inCategory.find((r) => r.id === category.heroThemeId);
    if (hero) return hero;
  }
  return inCategory[0] ?? null;
}

/** Convert a hex colour (`#RRGGBB`) or rgba(...) string into an rgba
 *  string with the given alpha. Falls back to the input unchanged if
 *  parsing fails so a category with an unexpected colour format still
 *  paints something. */
// Sealed 2026-10-11 · local `withAlpha` body REMOVED · the single
// implementation now lives in `preview-mini-phone.ts#hexToRgba`.
// `withAlpha` stays as a thin aliased re-export so the ~11 existing
// call sites below (captions · notch · bezel · composer pill) keep
// their compact name while sharing the one implementation.
function withAlpha(colour: string, alpha: number): string {
  return paletteHexToRgba(colour, alpha);
}
