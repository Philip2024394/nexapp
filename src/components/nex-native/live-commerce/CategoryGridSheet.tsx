"use client";

// src/components/nex-native/live-commerce/CategoryGridSheet.tsx
//
// NEX Live · 12-tile category discovery overlay opened by the
// magnifying-glass button in the viewer header.
// -----------------------------------------------------------------------------
// Owner directive 2026-10-24 · "the magnifying glass opens the
// category 12 buttons overlay".
//
// Shape: 3-column × 4-row grid of category tiles. Each tile is a
// large tappable button with an emoji glyph + short label. The sheet
// slides up from the bottom of the viewer frame.
//
// Doctrine honoured:
//   · This is a UI-only overlay. Tiles do NOT yet route anywhere
//     production; they close the sheet and fire an optional
//     onCategoryPick callback so the parent can route when the
//     Discovery system is wired. The 12 labels are PLACEHOLDERS
//     pending the sealed category list the owner approves.
//   · No DB involvement. No admin role check. No scraping. Pure
//     UI chrome.
//   · Respects prefers-reduced-motion by disabling the slide
//     animation.

import * as React from "react";
import {
  UtensilsCrossed,
  Shirt,
  Plane,
  Wrench,
  ShoppingBag,
  PartyPopper,
  Home,
  Bike,
  Tag,
  User,
  Palette,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const NEX = {
  bgSheet: "#0E1526",
  text: "#F2F5F8",
  textDim: "#8BA9D1",
  cyan: "#00AFFF",
  border: "rgba(255,255,255,0.12)",
} as const;

/** Owner directive 2026-10-24 · placeholder 12 tiles. Final labels,
 *  icons, and ordering are STILL PENDING OWNER APPROVAL per the
 *  Discovery category decision — I am NOT seeding these into any DB
 *  table. These are visual placeholders only.
 *
 *  Owner directive 2026-10-25 · the per-tile `glyph` emoji is
 *  retained for backwards compatibility with any caller that passes
 *  custom tiles, but the default renderer swaps to the matching
 *  `iconKey` to show a white line-art SVG instead. Callers that
 *  pass their own `tiles` without `iconKey` will fall back to the
 *  emoji glyph. */
export interface CategoryTile {
  readonly slug: string;
  readonly glyph: string;
  readonly label: string;
  /** Optional · when provided, the component renders the matching
   *  white line-art SVG from the local `CATEGORY_ICONS` map. When
   *  omitted the component falls back to `glyph`. */
  readonly iconKey?: keyof typeof CATEGORY_ICONS;
}

/** Owner directive 2026-10-25 (revised) · 12 high-quality icons
 *  from `lucide-react` (already a dep · `lucide-react@^1.23.0` in
 *  package.json). Previous hand-rolled SVGs are replaced with
 *  curated line-art from the Lucide library · consistent stroke
 *  weight · professional geometry · identical API as React
 *  components. The parent still sets `color: #FFFFFF` so the
 *  strokes render white, with a drop-shadow for separation against
 *  the cyan frosted-glass fill.
 *
 *  To swap any individual icon, replace the import + the map entry
 *  with another from `node_modules/lucide-react/dist/esm/icons/`.
 *
 *  Map values are React components (LucideIcon type). The old
 *  JSX-fragment shape is preserved as a deliberate alias in the
 *  render path · see the `<IconComp …/>` call below. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  food:      UtensilsCrossed,
  fashion:   Shirt,
  travel:    Plane,
  services:  Wrench,
  products:  ShoppingBag,
  events:    PartyPopper,
  stay:      Home,
  transport: Bike,
  deals:     Tag,
  creators:  User,
  art:       Palette,
  sports:    Trophy,
};


// Owner directive 2026-10-24 · "category name only 1 word".
// Owner directive 2026-10-25 · each tile now carries an `iconKey`
// that resolves to a white line-art SVG from `CATEGORY_ICONS`.
export const DEFAULT_CATEGORY_TILES: readonly CategoryTile[] = [
  { slug: "food-drink",    glyph: "🍜", iconKey: "food",      label: "Food" },
  { slug: "fashion",       glyph: "👗", iconKey: "fashion",   label: "Fashion" },
  { slug: "travel",        glyph: "🏝️", iconKey: "travel",    label: "Travel" },
  { slug: "services",      glyph: "🔧", iconKey: "services",  label: "Services" },
  { slug: "products",      glyph: "🛍️", iconKey: "products",  label: "Products" },
  { slug: "events",        glyph: "🎉", iconKey: "events",    label: "Events" },
  { slug: "stay",          glyph: "🏠", iconKey: "stay",      label: "Stay" },
  { slug: "transport",     glyph: "🏍️", iconKey: "transport", label: "Transport" },
  { slug: "deals",         glyph: "💐", iconKey: "deals",     label: "Deals" },
  { slug: "creators",      glyph: "👤", iconKey: "creators",  label: "Creators" },
  { slug: "art",           glyph: "🎨", iconKey: "art",       label: "Art" },
  { slug: "sports",        glyph: "🏃", iconKey: "sports",    label: "Sports" },
];

export interface CategoryGridSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly tiles?: readonly CategoryTile[];
  readonly onCategoryPick?: (tile: CategoryTile) => void;
}

export function CategoryGridSheet(
  props: CategoryGridSheetProps,
): React.JSX.Element | null {
  if (!props.open) return null;
  const tiles = props.tiles ?? DEFAULT_CATEGORY_TILES;

  return (
    <>
      <button
        type="button"
        aria-label="Close category menu"
        data-nex-category-sheet-scrim
        onClick={props.onClose}
        style={{
          // Owner directive 2026-10-24 · full-inset click-catcher.
          // Transparent · no dim, no blur · tiles float directly
          // over the video. Nested sheet uses stopPropagation on
          // click so taps between tiles don't close.
          position: "absolute",
          inset: 0,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          zIndex: 10,
        }}
      />
      <div
        role="dialog"
        aria-label="NEX categories"
        data-nex-category-sheet
        onClick={(e) => e.stopPropagation()}
        style={{
          // Owner directive 2026-10-24 · "move the category buttons
          // up and reduce size that they are positioned on the
          // screen center from header to top of footer buttons".
          // Centred vertically between the header (~70 px) and the
          // top of the footer (~150 px above the bottom edge).
          position: "absolute",
          top: 80,
          bottom: 160,
          left: 16,
          right: 16,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 10,
          zIndex: 11,
          pointerEvents: "none",
          animation: "nexCategorySheetFadeIn 140ms ease-out",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <style>{`
          @keyframes nexCategorySheetFadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            [data-nex-category-sheet] { animation: none !important; }
          }
          [data-nex-category-tile]:active {
            transform: scale(0.94);
          }
          [data-nex-category-tile] {
            transition: transform 120ms ease-out;
          }
        `}</style>
        {/* Owner directive 2026-10-24 · back-button removed · title
            kept, legible over the video via text-shadow. */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: NEX.text,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            textAlign: "center",
            textShadow: "0 1px 4px rgba(0,0,0,0.65)",
            pointerEvents: "none",
          }}
        >
          Discover
        </div>
        {/* 3 × 4 grid */}
        <div
          data-nex-category-grid
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            // Only the grid itself takes pointer events · the parent
            // sheet is pointer-events:none so clicks between tiles
            // bubble to the full-inset scrim and close the overlay.
            pointerEvents: "auto",
          }}
        >
          {tiles.slice(0, 12).map((t) => {
            const IconComp = t.iconKey ? CATEGORY_ICONS[t.iconKey] : null;
            return (
              <button
                key={t.slug}
                type="button"
                data-nex-category-tile
                data-nex-category-slug={t.slug}
                onClick={() => {
                  props.onCategoryPick?.(t);
                  props.onClose();
                }}
                style={{
                  // Owner directive 2026-10-24 · white-frosted button
                  // with cyan rim. Owner directive 2026-10-25 · the
                  // text label now sits inside a "moon-shape" strip at
                  // the bottom-rounded portion of the button · we
                  // make the button position:relative + overflow
                  // hidden so the moon's rectangular edges are clipped
                  // to the circular silhouette.
                  // Owner directive 2026-10-26 (revised) · "category
                  // buttons increase 30%" · 60% × 1.3 = 78% of
                  // grid-cell width + justify-self center.
                  position: "relative",
                  aspectRatio: "1 / 1",
                  width: "78%",
                  justifySelf: "center",
                  borderRadius: "50%",
                  // Owner directive 2026-10-25 · "the category buttons
                  // same background color as 3 dots container". Match
                  // the panel's navy frosted gradient (see
                  // LiveViewerFooter.tsx) · cyan rim preserved as the
                  // shared accent so tiles still read as a NEX chrome
                  // family.
                  // Owner directive 2026-10-26 · "category background
                  // button color same as container back ground color"
                  // · solid #020914 to match the Live Library container
                  // + the chat page bg (sealed earlier).
                  background: "var(--nex-world-background-base, #020914)",
                  backdropFilter: "blur(18px) saturate(140%)",
                  WebkitBackdropFilter: "blur(18px) saturate(140%)",
                  border: "2px solid rgba(0, 175, 255, 0.9)",
                  boxShadow:
                    "inset 0 0 0 1px rgba(0, 175, 255, 0.5), 0 0 14px -4px rgba(0, 175, 255, 0.6), 0 4px 10px -6px rgba(0, 20, 50, 0.45)",
                  color: "#FFFFFF",
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: "inherit",
                  overflow: "hidden",
                  pointerEvents: "auto",
                }}
              >
                {/* Icon · high-quality white line-art from lucide-react
                    · owner directive 2026-10-25 "white icons high
                    quality · center on buttons and smaller size".
                    Owner directive 2026-10-25 (revised again) · "move
                    down the icon on buttons · center button position
                    over text" — icon now sits directly above the
                    moon-strip label instead of in the upper third of
                    the tile. Container shrunk 46% → 32% for a tidier
                    silhouette. */}
                <span
                  aria-hidden
                  data-nex-category-tile-icon
                  style={{
                    position: "absolute",
                    left: "50%",
                    // Owner directive 2026-10-25 (revised) · the icon
                    // was anchored at `top: 27%` (upper third of the
                    // tile). The owner wants the icon centred directly
                    // OVER the label text that lives inside the
                    // moon-strip at the bottom. Moon-strip spans the
                    // bottom 48% of the tile · its top edge is at
                    // ~52% from the top. We anchor the icon's visual
                    // centre at 42% so the icon's bottom edge rests
                    // just above the moon-strip's top edge with ~4%
                    // breathing room, directly above the text.
                    top: "42%",
                    transform: "translate(-50%, -50%)",
                    width: "32%",
                    height: "32%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    filter:
                      "drop-shadow(0 1px 2px rgba(0,0,0,0.45)) drop-shadow(0 0 4px rgba(0,0,0,0.25))",
                  }}
                >
                  {IconComp ? (
                    <IconComp
                      strokeWidth={1.6}
                      style={{
                        width: "100%",
                        height: "100%",
                        color: "currentColor",
                      }}
                    />
                  ) : (
                    // Backwards-compatible fallback · callers that pass
                    // custom tiles without `iconKey` still get the emoji
                    // glyph in the icon position.
                    <span style={{ fontSize: 22, lineHeight: 1 }}>
                      {t.glyph}
                    </span>
                  )}
                </span>
                {/* Moon shape · translucent dark crescent anchored at
                    the bottom of the button · the parent's border-
                    radius:50% + overflow:hidden clips the rectangular
                    edges to the circle's curve so the strip reads as
                    a moon. The text label sits inside, horizontally
                    centred, close to the lower rounded edge. */}
                <span
                  data-nex-category-tile-moon
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: "48%",
                    background:
                      "linear-gradient(180deg, rgba(2, 9, 20, 0) 0%, rgba(2, 9, 20, 0.42) 32%, rgba(2, 9, 20, 0.78) 100%)",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    paddingBottom: "16%",
                    pointerEvents: "none",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: "0.02em",
                      textAlign: "center",
                      lineHeight: 1.1,
                      color: "#FFFFFF",
                      textShadow: "0 1px 3px rgba(0,0,0,0.65)",
                      maxWidth: "88%",
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 2,
                    }}
                  >
                    {t.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {/* Honest footer · placeholder tiles */}
        <div
          style={{
            marginTop: 4,
            fontSize: 10,
            color: NEX.textDim,
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          Final categories pending curation
        </div>
      </div>
    </>
  );
}
