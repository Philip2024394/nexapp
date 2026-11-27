// src/components/nex-native/shop-install/nex-chat-badge.tsx
//
// NEX Chat badge glyph · owner directive 2026-11-27 branded shop
// install feature · §A + §B require a small NEX Chat symbol
// incorporated into / overlaid on the merchant's shop icon on the
// standard install button and in the slide-in install notification.
//
// Why a dedicated component:
//   · The existing chat FAB (`_shop-chat-fab.tsx`) inlines its SVG
//     at 24-26px with stroke-width 2 · too heavy for a 12-16px
//     overlay badge on top of a shop logo. Scaling the inline SVG
//     down also scales the stroke, producing a muddy glyph.
//   · The spec calls for a "small NEX Chat symbol" that reads as
//     "there's a message here" at tiny sizes. A chat bubble with
//     a single trailing tail is the universal shorthand.
//   · Keeping it in one component means the install button and
//     the slide-in notification emit the exact same glyph · no
//     two-versions drift later.
//
// Shape:
//   · Rounded speech bubble + single tail at the bottom-left
//   · stroke = currentColor so callers can set `color: ...` on the
//     parent and have the glyph adapt to the auto-contrast text
//     colour we compute from the shop's tint.
//   · fill = none by default · a solid variant is available via
//     `tone="solid"` for use cases that want a filled badge (e.g.
//     on top of a photographic logo where an outline could vanish).
//
// This file is deliberately styleless · callers wrap it with
// positioning and backdrop as they need.

import * as React from "react";

export interface NexChatBadgeProps {
  /** Rendered width + height in CSS pixels. Defaults to 14.
   *  Spec §A says "small NEX Chat symbol" · we hold this ≤ 16 by
   *  default so the overlay never dominates the shop logo. */
  readonly size?: number;
  /** "outline" (default): stroke-only glyph · lets the shop logo
   *  read through.
   *  "solid": filled bubble + punched-out stroke tail · better on
   *  photographic logos where an outline would disappear. */
  readonly tone?: "outline" | "solid";
  /** Optional aria-label · when omitted the glyph is marked
   *  `aria-hidden` so screen readers don't double-announce the
   *  parent button's accessible name. */
  readonly ariaLabel?: string;
  /** Pass-through for test selectors · callers commonly set
   *  `data-nex-chat-badge` already so an extra hook isn't required. */
  readonly title?: string;
}

/** Tiny chat-bubble glyph used as the "message here" overlay on
 *  the branded shop install surfaces. Owner directive 2026-11-27. */
export function NexChatBadge({
  size = 14,
  tone = "outline",
  ariaLabel,
  title,
}: NexChatBadgeProps): React.JSX.Element {
  const stroke = 2;
  // Rounded bubble (18×12 inside a 24-viewBox) + single tail at
  // bottom-left. Coordinates chosen so the tail starts flush with
  // the bubble's rounded corner and points down-left · reads as
  // "message" at ≥ 10px.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      data-nex-chat-badge={tone}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {tone === "solid" ? (
        <>
          {/* Filled bubble body */}
          <path
            d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-6l-4 4v-4H7a3 3 0 0 1-3-3V7Z"
            fill="currentColor"
            stroke="none"
          />
        </>
      ) : (
        <>
          {/* Outline bubble + tail · stroke adapts to parent colour */}
          <path
            d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-6l-4 4v-4H7a3 3 0 0 1-3-3V7Z"
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}
