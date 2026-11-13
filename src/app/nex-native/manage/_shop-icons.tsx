// src/app/nex-native/manage/_shop-icons.tsx
//
// Line-icon set for the Shop Management Centre rows · owner directive
// 2026-11-13 · 24×24 strokeWidth 1.6 currentColor · same vocabulary as
// the Chat Settings icons.

import type * as React from "react";

const SVG_PROPS = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
} satisfies React.SVGProps<SVGSVGElement>;

/** Eye · "View as buyer". */
export function IconEye(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2.5 12c1.8-3.6 5.4-6.5 9.5-6.5s7.7 2.9 9.5 6.5c-1.8 3.6-5.4 6.5-9.5 6.5S4.3 15.6 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Storefront · profile / identity. */
export function IconStorefront(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M3 9l1.5-4h15L21 9" />
      <path d="M3 9v11h18V9" />
      <path d="M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3 1.3 3 3 3 3-1.3 3-3 1.3 3 3 3 3-1.3 3-3" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

/** Palette · cover template. */
export function IconPalette(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M12 2.5a9.5 9.5 0 1 0 0 19c1.1 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.4-1.3-.2-.3-.3-.6-.3-.9 0-.9.7-1.6 1.6-1.6h1.9c2.6 0 4.9-2.1 4.9-4.7C21.5 6.1 17.3 2.5 12 2.5z" />
      <circle cx="7.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="18" cy="11" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Picture · background library. */
export function IconPicture(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="M3 17l5-5 4 4 3-3 6 6" />
    </svg>
  );
}

/** Package · products list. */
export function IconPackage(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}

/** Plus square · add product. */
export function IconPlusSquare(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

/** Menu / cutlery · food venue. */
export function IconMenu(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M8 3v8a3 3 0 1 1-4 0V3" />
      <path d="M6 11v10" />
      <path d="M16 3c-2.5 0-4 2-4 5v5h3v8h2V3z" />
    </svg>
  );
}

/** Bed · accommodation rooms. */
export function IconBed(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M3 9v11" />
      <path d="M21 14v6" />
      <path d="M3 14h18" />
      <path d="M3 9h12a6 6 0 0 1 6 6" />
      <circle cx="8" cy="11" r="1.6" />
    </svg>
  );
}

/** Clipboard list · orders. */
export function IconClipboard(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M9 10h6" />
      <path d="M9 14h6" />
      <path d="M9 18h4" />
    </svg>
  );
}

/** Credit card · payment providers. */
export function IconCard(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
      <path d="M2.5 10h19" />
      <path d="M6 15h3" />
    </svg>
  );
}

/** Diamond · subscription tier. */
export function IconDiamond(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M6 3h12l4 6-10 12L2 9z" />
      <path d="M8 9h8" />
      <path d="M12 3L8 9l4 12 4-12-4-6z" />
    </svg>
  );
}

/** Database · storage packs. */
export function IconDatabase(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <ellipse cx="12" cy="5" rx="8" ry="2.5" />
      <path d="M4 5v6c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V5" />
      <path d="M4 11v6c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-6" />
    </svg>
  );
}

/** Share / QR node · public shop share. */
export function IconShare(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="18" cy="6" r="2.4" />
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="18" cy="18" r="2.4" />
      <path d="M8.1 11l7.8-3.9" />
      <path d="M8.1 13l7.8 3.9" />
    </svg>
  );
}

/** Compass · setup wizard (only when incomplete). */
export function IconCompass(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-1.6 5.4-5.4 1.6 1.6-5.4z" />
    </svg>
  );
}

/** Mail · customer contact + notifications. */
export function IconMail(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

/** Scroll · policies / returns. */
export function IconScroll(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M8 3h11v15a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-1h11" />
      <path d="M11 7h5" />
      <path d="M11 11h5" />
      <path d="M11 15h3" />
    </svg>
  );
}
