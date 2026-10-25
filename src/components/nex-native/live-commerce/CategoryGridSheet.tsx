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
 *  table. These are visual placeholders only. */
export interface CategoryTile {
  readonly slug: string;
  readonly glyph: string;
  readonly label: string;
}

// Owner directive 2026-10-24 · "category name only 1 word".
export const DEFAULT_CATEGORY_TILES: readonly CategoryTile[] = [
  { slug: "food-drink",    glyph: "🍜", label: "Food" },
  { slug: "fashion",       glyph: "👗", label: "Fashion" },
  { slug: "travel",        glyph: "🏝️", label: "Travel" },
  { slug: "services",      glyph: "🔧", label: "Services" },
  { slug: "products",      glyph: "🛍️", label: "Products" },
  { slug: "events",        glyph: "🎉", label: "Events" },
  { slug: "stay",          glyph: "🏠", label: "Stay" },
  { slug: "transport",     glyph: "🏍️", label: "Transport" },
  { slug: "deals",         glyph: "💐", label: "Deals" },
  { slug: "creators",      glyph: "👤", label: "Creators" },
  { slug: "art",           glyph: "🎨", label: "Art" },
  { slug: "sports",        glyph: "🏃", label: "Sports" },
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
          {tiles.slice(0, 12).map((t) => (
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
                // Owner directive 2026-10-24 · "more blue app color
                // rim and white buttons frosted". White translucent
                // frosted-glass fill + bright NEX cyan rim.
                aspectRatio: "1 / 1",
                borderRadius: "50%",
                // Owner directive 2026-10-24 · "change the frosted
                // button color same as rim color". Fill now matches
                // the NEX cyan rim · translucent cyan gradient
                // behind the frosted blur.
                background:
                  "linear-gradient(135deg, rgba(0, 175, 255, 0.42) 0%, rgba(0, 116, 255, 0.18) 100%)",
                backdropFilter: "blur(18px) saturate(140%)",
                WebkitBackdropFilter: "blur(18px) saturate(140%)",
                border: "2px solid rgba(0, 175, 255, 0.9)",
                boxShadow:
                  "inset 0 0 0 1px rgba(0, 175, 255, 0.5), 0 0 14px -4px rgba(0, 175, 255, 0.6), 0 4px 10px -6px rgba(0, 20, 50, 0.45)",
                color: NEX.text,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                cursor: "pointer",
                padding: "4px 2px",
                fontFamily: "inherit",
                textShadow: "0 1px 3px rgba(0,0,0,0.55)",
                pointerEvents: "auto",
              }}
            >
              <span aria-hidden style={{ fontSize: 26, lineHeight: 1 }}>
                {t.glyph}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textAlign: "center",
                  lineHeight: 1.2,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                }}
              >
                {t.label}
              </span>
            </button>
          ))}
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
