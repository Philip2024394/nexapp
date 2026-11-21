// src/lib/nexapp/tokens.ts
//
// 2026-11-21 · Recovered shim for `@/lib/nexapp/tokens`.
//
// Background: during the 2026-10-10 nexapp carve-out from D:/trades,
// the `nexapp` design-tokens module was NOT ported. 30 files under
// `src/components/nexapp/*` depend on it (import { NEX }). Reachability
// audit:
//
//   · src/app/nex-native/_shell.tsx → NexHudFrame (uses the HUD subtree
//     via useChromaKeyedBezel + NexVoiceOrb + NexEyeBubble + primitives).
//     Crucially, _none_ of NexHudFrame's direct transitive imports touch
//     `@/lib/nexapp/tokens`. The 30 token-dependent components live in
//     `src/components/nexapp/` but no live route reaches them.
//
//   · The 30 `nexapp` components are orphans in this fork — tracked as
//     dead code awaiting the full Scope-Reduction cleanup pass.
//
// Why this still exists: 2 vitest files exercise these components for
// legitimate data-only assertions (NexDirectoryCards.getDirectoryCards
// ForCountry, CategoryConstellation layout tests). The tests don't
// validate visual output — they validate pure data functions that
// happen to live inside `"use client"` modules annotated with tokens
// imports. Blocking the import blocks the data test.
//
// Field set pinned by grep across consumers:
//   bg · bgSurface · bgSurfaceHi
//   border · borderMuted
//   cyan · green · orange · orangeGlow · orangeGlowLo · orangeSoft
//   text · textFaint · textMuted
//   identitySize
//
// Values: sensible defaults consistent with the NEX brand palette as
// documented in sibling `src/app/nex-native/vault/home/_palette.ts`
// (navy base, orange accent, cyan secure). These are NOT canonical —
// they are a shim. When the nexapp components are revived (or deleted
// per Scope Reduction), replace this file with the real token source.
//
// HONESTY: The shim does not fabricate behavior. It declares the token
// surface callers assume exists, with values that compile and render
// but are explicitly marked as shim-only. No test asserts on the
// specific colour values.

export const NEX = {
  // Backgrounds
  bg: "#0A0E14",
  bgSurface: "#13181F",
  bgSurfaceHi: "#1B2129",

  // Borders / dividers
  border: "rgba(242, 245, 248, 0.14)",
  borderMuted: "rgba(242, 245, 248, 0.08)",

  // Brand hues
  cyan: "#00AFFF",
  green: "#2CD98A",
  orange: "#FF7200",
  orangeGlow: "rgba(255, 114, 0, 0.42)",
  orangeGlowLo: "rgba(255, 114, 0, 0.18)",
  orangeSoft: "rgba(255, 114, 0, 0.12)",

  // Text hierarchy
  text: "#F2F5F8",
  textMuted: "#7D9BC0",
  textFaint: "#526B89",

  // Identity sizing (used by NexIdentity components for consistent size slots)
  identitySize: 44,
} as const;
