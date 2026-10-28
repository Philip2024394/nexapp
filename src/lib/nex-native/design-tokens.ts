// src/lib/nex-native/design-tokens.ts
//
// NEX nex-native design tokens · single source of truth.
// ------------------------------------------------------------------
// Owner-sealed 2026-10-17 (verbatim directive): "we must make rule of
// the app font style not keep changing and all text must be mobile
// screen size view and same for profile image nex in header 1 size
// all profile same".
//
// Font-stack value re-sealed 2026-10-26 (owner typography
// standardization): the canonical NEX font stack is now
// Arial / Helvetica / sans-serif. The 24 files that already consume
// `NEX_FONT_SANS` propagate the change automatically.
//
// Every nex-native surface that previously declared its own
// `fontFamily` string OR picked its own `NexPingBadge size={…}` value
// consumes these tokens instead. Future surfaces MUST do the same ·
// never redeclare a font stack or badge size locally.
//
// Scope of this module (deliberately narrow):
//   · NEX_FONT_SANS            · the single body/UI font stack
//   · NEX_TEXT_*               · typography hierarchy (sizes, weights,
//                                line-heights) · added 2026-10-26
//   · NEX_PING_BADGE_HEADER_SIZE · the single in-header ping-badge px
//
// Explicitly NOT in scope (owner can seal later if desired):
//   · Serif stack · 59 call-sites still use Cormorant Garamond for
//     intentional display headlines (hero on Welcome, etc.) · retire
//     or keep decided in a separate pass.
//   · Monospace stack · 37 call-sites use ui-monospace for handles,
//     code, Vault IDs · intentional type-system contrast · untouched.
//   · Color constants · each surface's palette (e.g. Vault _palette.ts,
//     Welcome's NEX object, Directory landing's COLOR_CYAN) stays
//     local to its surface until explicitly consolidated.

// ──────────────────────────────────────────────────────────────────
// Font family
// ──────────────────────────────────────────────────────────────────

/**
 * Owner-sealed 2026-10-17 · re-sealed 2026-10-26 · canonical NEX
 * nex-native font stack.
 *
 * Arial is the primary face. Helvetica is the macOS/iOS fallback.
 * `sans-serif` is the final OS fallback.
 *
 * Consume this value directly as an inline style string:
 *   `style={{ fontFamily: NEX_FONT_SANS, ... }}`
 *
 * The root body style (`src/app/layout.tsx`) now sets this at the
 * document level, so any new element that does NOT declare its own
 * fontFamily inherits Arial automatically. Existing surfaces that
 * declare `fontFamily: NEX_FONT_SANS` continue to work and pick up
 * the Arial value through this constant.
 *
 * Known downstream consumers (as of 2026-10-26): 24 files · 88
 * import sites. New surfaces MUST consume this token · never
 * redeclare a bytewise-local font stack string.
 */
export const NEX_FONT_SANS = "Arial, Helvetica, sans-serif";

// ──────────────────────────────────────────────────────────────────
// Typography hierarchy · sealed 2026-10-26
// ──────────────────────────────────────────────────────────────────
//
// Owner directive 2026-10-26 (NEX global typography standardization):
// one hierarchy across every nex-native surface so pages read as one
// coherent application. Sizes are CSS pixels; weights follow the
// standard Inter/Arial numeric scale.
//
// Semantic ROLE matters more than exact pixel size. A card title
// MUST use the card-heading role even if visually similar to a
// section heading in a specific layout. Context-specific tweaks are
// valid when they follow the hierarchy.
//
// Line-heights pair with the sizes to keep multi-line copy readable
// on narrow phones (420 px shell · NEX is mobile-first).

/** 24 px / 700 · Primary screen heading · one per route. */
export const NEX_TEXT_PAGE_TITLE = {
  fontSize: 24,
  fontWeight: 700,
  lineHeight: 1.25,
} as const;

/** 20 px / 700 · Major content section inside a page. */
export const NEX_TEXT_SECTION_HEADING = {
  fontSize: 20,
  fontWeight: 700,
  lineHeight: 1.3,
} as const;

/** 16 px / 600 · Product / shop / card / modal title. */
export const NEX_TEXT_CARD_HEADING = {
  fontSize: 16,
  fontWeight: 600,
  lineHeight: 1.3,
} as const;

/** 14 px / 400 · Primary body copy · descriptions, paragraphs. */
export const NEX_TEXT_BODY = {
  fontSize: 14,
  fontWeight: 400,
  lineHeight: 1.5,
} as const;

/** 13 px / 400 · Secondary / supporting description. */
export const NEX_TEXT_BODY_SECONDARY = {
  fontSize: 13,
  fontWeight: 400,
  lineHeight: 1.5,
} as const;

/** 12 px / 400 · Compact supporting text · metadata, dates. */
export const NEX_TEXT_COMPACT = {
  fontSize: 12,
  fontWeight: 400,
  lineHeight: 1.45,
} as const;

/** 11 px / 600 · Short labels · status chips, button context labels. */
export const NEX_TEXT_LABEL = {
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.4,
  letterSpacing: "0.02em",
} as const;

/** 10 px / 700 · Micro-label · exceptional compact metadata ONLY. Not
 *  for essential or accessibility-critical information. */
export const NEX_TEXT_MICRO_LABEL = {
  fontSize: 10,
  fontWeight: 700,
  lineHeight: 1.35,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
} as const;

/** Convenience bundle · callers can `import { NEX_TEXT } from ...`
 *  and reach every role via a single namespace. */
export const NEX_TEXT = {
  pageTitle: NEX_TEXT_PAGE_TITLE,
  sectionHeading: NEX_TEXT_SECTION_HEADING,
  cardHeading: NEX_TEXT_CARD_HEADING,
  body: NEX_TEXT_BODY,
  bodySecondary: NEX_TEXT_BODY_SECONDARY,
  compact: NEX_TEXT_COMPACT,
  label: NEX_TEXT_LABEL,
  microLabel: NEX_TEXT_MICRO_LABEL,
} as const;

// ──────────────────────────────────────────────────────────────────
// NexPingBadge · in-header canonical size
// ──────────────────────────────────────────────────────────────────

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
