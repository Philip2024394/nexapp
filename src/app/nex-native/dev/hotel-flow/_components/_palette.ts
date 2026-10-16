// src/app/nex-native/dev/hotel-flow/_components/_palette.ts
// Sealed design tokens for the NEX mobile hotel experience.
// Matches the Bumas Hotel reference mockup exactly · white premium.

export const NEX = {
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceAlt: "#F6F8FB",
  surfaceTint: "#F1F5FD",
  text: "#1A2B4A",         // navy headings
  textMid: "#44557A",      // slate body
  textMuted: "#6B7B99",    // captions
  textSoft: "#9AA6BC",     // fine print
  accent: "#3B6CE0",       // NEX blue action
  accentSoft: "#E6ECFA",   // light blue tint
  accentMuted: "#F1F5FD",  // very light blue
  orange: "#FF7200",       // NEX brand
  verified: "#2E8F5B",
  verifiedSoft: "#E3F5EC",
  warn: "#C97A1D",
  warnSoft: "#FCF2E0",
  danger: "#C94A4A",
  divider: "#E6EBF2",
  dividerSoft: "#F1F4F9",
  shadow: "0 1px 2px rgba(26,43,74,0.04), 0 1px 3px rgba(26,43,74,0.06)",
  shadowMd: "0 4px 10px rgba(26,43,74,0.06), 0 2px 4px rgba(26,43,74,0.04)",
  shadowLg: "0 10px 25px rgba(26,43,74,0.10), 0 2px 6px rgba(26,43,74,0.06)",
} as const;

export const FONT_STACK =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// Mobile-first shell · 480 max on wide viewports.
export const MOBILE_SHELL_MAX_WIDTH = 480;
