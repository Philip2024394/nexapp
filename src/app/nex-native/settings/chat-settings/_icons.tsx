// src/app/nex-native/settings/chat-settings/_icons.tsx
//
// Line-icon set for the Chat Settings rows · owner directive 2026-11-13
// iter 2 · higher-quality outlined icons (Phosphor / Lucide style).
// All icons are 24×24, stroke 1.6, currentColor · match the
// outlined-system-settings look in adsASDADS.png.

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

/** Chat Interface · rounded chat bubble with tail. */
export function IconChatInterface(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M4 5.8A2.8 2.8 0 0 1 6.8 3h10.4A2.8 2.8 0 0 1 20 5.8v8.4a2.8 2.8 0 0 1-2.8 2.8H10l-4 3.5v-3.5H6.8A2.8 2.8 0 0 1 4 14.2z" />
    </svg>
  );
}

/** Theme · paint palette with thumb cutout + 3 colour dots. */
export function IconTheme(): React.JSX.Element {
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

/** Visibility · eye (open) with centred pupil. */
export function IconVisibility(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2.5 12c1.8-3.6 5.4-6.5 9.5-6.5s7.7 2.9 9.5 6.5c-1.8 3.6-5.4 6.5-9.5 6.5S4.3 15.6 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Bubbles · two overlapping chat bubbles · outgoing (lower-right)
 *  overlaps incoming (upper-left) · clearly reads as "two bubbles". */
export function IconBubbles(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      {/* Incoming · upper-left · tail bottom-left */}
      <path d="M3.5 4.5h9A1.5 1.5 0 0 1 14 6v4.5a1.5 1.5 0 0 1-1.5 1.5H7l-2.5 2v-2H3.5A1.5 1.5 0 0 1 2 10.5V6a1.5 1.5 0 0 1 1.5-1.5z" />
      {/* Outgoing · lower-right · tail bottom-right */}
      <path d="M20.5 10h-8A1.5 1.5 0 0 0 11 11.5v5A1.5 1.5 0 0 0 12.5 18H17l2.5 2v-2h1A1.5 1.5 0 0 0 22 16.5v-5A1.5 1.5 0 0 0 20.5 10z" />
    </svg>
  );
}

/** Blocked · circle with diagonal slash. */
export function IconBlocked(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </svg>
  );
}

/** Font · stylised letter A with serifs + baseline. */
export function IconFont(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M5 20L10 5h4l5 15" />
      <path d="M7.6 14h8.8" />
    </svg>
  );
}

/** Read receipts · double check (WhatsApp-style). */
export function IconReadReceipts(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2 13.5l4 4L15.5 7.5" />
      <path d="M8.5 13.5l4 4L22 7.5" />
    </svg>
  );
}

/** Typing · chat bubble with three dots inside. */
export function IconTyping(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M4 5.8A2.8 2.8 0 0 1 6.8 3h10.4A2.8 2.8 0 0 1 20 5.8v8.4a2.8 2.8 0 0 1-2.8 2.8H10l-4 3.5v-3.5H6.8A2.8 2.8 0 0 1 4 14.2z" />
      <circle cx="8.5" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Clock · with 12/3/6/9 tick marks + hands. */
export function IconClock(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 2" />
    </svg>
  );
}

/** Online dot · ring + filled inner. */
export function IconOnlineDot(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Hourglass · twin funnels with top/bottom caps + sand curves. */
export function IconHourglass(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M6 3h12" />
      <path d="M6 21h12" />
      <path d="M7 3v3.5c0 2.5 3.5 3.3 4.4 5.2a1 1 0 0 1 0 .6C10.5 14.2 7 15 7 17.5V21" />
      <path d="M17 3v3.5c0 2.5-3.5 3.3-4.4 5.2a1 1 0 0 0 0 .6c.9 1.9 4.4 2.7 4.4 5.2V21" />
    </svg>
  );
}

/** Camera · body + lens + viewfinder dot. */
export function IconCamera(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M3 8.5a2 2 0 0 1 2-2h2.4l1.5-2.3a1 1 0 0 1 .8-.4h4.6a1 1 0 0 1 .8.4l1.5 2.3H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.8" />
      <circle cx="17.3" cy="9" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
