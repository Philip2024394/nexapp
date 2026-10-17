// src/lib/nex-native/design-tokens.ts
//
// NEX nex-native design tokens · single source of truth.
// ------------------------------------------------------------------
// Owner-sealed 2026-10-17 (verbatim directive): "we must make rule of
// the app font style not keep changing and all text must be mobile
// screen size view and same for profile image nex in header 1 size
// all profile same".
//
// Every nex-native surface that previously declared its own
// `fontFamily` string OR picked its own `NexPingBadge size={…}` value
// consumes these tokens instead. Future surfaces MUST do the same ·
// never redeclare a font stack or badge size locally.
//
// Scope of this module (deliberately narrow):
//   · NEX_FONT_SANS           · the single body/UI font stack
//   · NEX_PING_BADGE_HEADER_SIZE · the single in-header ping-badge px
//
// Explicitly NOT in scope (owner can seal later if desired):
//   · Serif stack · 59 call-sites still use Cormorant Garamond for
//     intentional display headlines (hero on Welcome, etc.) · retire
//     or keep decided in a separate pass.
//   · Monospace stack · 37 call-sites use ui-monospace for handles,
//     code, Vault IDs · intentional type-system contrast · untouched.
//   · Text-size scale · the shell CSS at
//     `src/app/nex-native/nex-native.css` already clamps every page
//     into the mobile 420px phone column on desktop, so every text
//     size literally IS a mobile size · no breakpoint-switched
//     fontSize rules are introduced here.
//   · Color constants · each surface's palette (e.g. Vault _palette.ts,
//     Welcome's NEX object, Directory landing's COLOR_CYAN) stays
//     local to its surface until explicitly consolidated.

/**
 * Owner-sealed 2026-10-17 · canonical NEX nex-native font stack.
 *
 * Matches the Welcome page h1 at
 * `src/app/nex-native/welcome/page.tsx:110`. The dominant stack
 * across nex-native pre-seal (123 of the ~200 non-"inherit"
 * fontFamily call-sites already used a bytewise-equivalent string
 * via a locally-redeclared `const SANS = ...`).
 *
 * Consume this value directly as an inline style string:
 *   `style={{ fontFamily: NEX_FONT_SANS, ... }}`
 */
export const NEX_FONT_SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/**
 * Owner-sealed 2026-10-17 · canonical in-header NexPingBadge size.
 *
 * Every surface that mounts the `NexPingBadge` as the identity
 * element inside a page header uses this value. Pre-seal state
 * (12 call-sites): 56 × 7, 44 × 1 (Contacts), 48 × 1 (Vault intro),
 * 78 × 1 (Landing · splash context). 56 is the strongest existing
 * standard (shared `NexPageHeader`, Welcome, Directory landing, Chat
 * first-visit, Sign-in, Create account, Portrait bloom shell).
 *
 * Non-header splash/hero contexts may still use a larger value when
 * explicitly authorized (e.g. a future Landing splash at 78) · but
 * every "in-header" mount uses this constant.
 *
 * Consume as:
 *   `<NexPingBadge size={NEX_PING_BADGE_HEADER_SIZE} accent={...} />`
 */
export const NEX_PING_BADGE_HEADER_SIZE = 56;
