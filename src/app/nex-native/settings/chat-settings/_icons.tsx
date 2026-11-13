// src/app/nex-native/settings/chat-settings/_icons.tsx
//
// Line-icon set for the Chat Settings rows · owner directive 2026-11-13.
// All icons are 24×24, stroke-based, currentColor · match the
// outlined-system-settings look in adsASDADS.png.

import type * as React from "react";

const SVG_PROPS = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
} satisfies React.SVGProps<SVGSVGElement>;

export function IconChatInterface(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1.1-4.2A8 8 0 1 1 21 12z" />
    </svg>
  );
}

export function IconTheme(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M12 3a9 9 0 1 0 9 9c0-1.3-.7-2-2-2h-2a2 2 0 0 1 0-4 2 2 0 0 0 0-4h-5z" />
      <circle cx="8" cy="10" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="10" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconVisibility(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconBubbles(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M17 11a5 5 0 1 0-9.9-.9" />
      <path d="M14 20a5 5 0 1 1-4.9-5" />
    </svg>
  );
}

export function IconBlocked(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.5 5.5l13 13" />
    </svg>
  );
}

export function IconFont(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M5 20l5-14h4l5 14" />
      <path d="M7 15h10" />
    </svg>
  );
}

export function IconReadReceipts(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2 12l5 5 9-11" />
      <path d="M8 12l5 5 9-11" />
    </svg>
  );
}

export function IconTyping(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1.1-4.2A8 8 0 1 1 21 12z" />
      <circle cx="8" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconClock(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconOnlineDot(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconHourglass(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M6 3h12" />
      <path d="M6 21h12" />
      <path d="M6 3v3c0 3 6 3 6 6s-6 3-6 6v3" />
      <path d="M18 3v3c0 3-6 3-6 6s6 3 6 6v3" />
    </svg>
  );
}

export function IconCamera(): React.JSX.Element {
  return (
    <svg {...SVG_PROPS}>
      <path d="M3 8h3l2-3h8l2 3h3v12H3z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
