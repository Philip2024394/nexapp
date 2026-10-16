// src/app/nex-native/themes/[id]/_premium-banner-copy.ts
//
// Pure copy-decision helper for the honest premium banner shown
// above /nex-native/themes/[id] when the theme is premium and the
// viewer cannot currently use premium themes.
//
// Load-bearing honesty rules:
//   · NEVER claims direct theme purchase is available (payment is not
//     wired · migrations 191–196 are drafts · Stage 3 is unauthorised).
//   · NEVER claims the viewer owns the theme.
//   · NEVER adds a "Buy" button or any UI that implies a purchase flow.
//   · The CTA is strictly to an existing surface:
//       - signed-in · unable to use premium → /nex-native/settings/tier
//         (the real tier-upgrade settings surface)
//       - guest → /nex-native/sign-in (returning-user path) with the
//         understanding that creating an account is the first step
//
// This helper is a pure function so it can be unit-tested without
// jsdom. The decision rule mirrors the server-side gate on
// /nex-native/themes/[id]/page.tsx.
//
// Decision rule:
//   category == 'premium' AND !canUsePremium
//     → return banner copy appropriate to viewer kind
//   otherwise
//     → return null (banner is suppressed · do NOT render)

export type PremiumBannerCopy = {
  /** Short all-caps eyebrow (e.g. "PREMIUM THEME"). */
  eyebrow: string;
  /** The single most important honest sentence. */
  headline: string;
  /** The subheading that explicitly separates subscription access from
   *  the (NOT YET AVAILABLE) direct purchase path. */
  subheading: string;
  /** Short CTA text. Does NOT say "Buy" or "Purchase". */
  ctaLabel: string;
  /** Target route · always an existing, verified surface. */
  ctaHref: string;
};

export type PremiumBannerInput = {
  /** 'guest' or 'session' per resolveNexAppSessionOrGuest. */
  viewerKind: "guest" | "session";
  /** nex_chat_theme.category · 'standard' | 'premium'. */
  category: "standard" | "premium";
  /** Computed server-side from effectiveTier + isThemesTrialActive.
   *  True iff the signed-in viewer can activate this premium theme
   *  today (either Bisnis/Pro tier or inside their 7-day trial). For
   *  guests this is always false. */
  canUsePremium: boolean;
};

/** The sealed copy strings. Keeping these in one place means the
 *  tests + the page both reference the identical string, and any
 *  future wording change is a single-line edit. */
const COPY = {
  eyebrow: "PREMIUM THEME",
  // Signed-in viewer who can't use premium today.
  session: {
    headline: "Unlocks with NEX Bisnis.",
    subheading:
      "Premium themes are included with NEX Bisnis. Direct theme purchase is coming later and is not yet available.",
    ctaLabel: "See plans",
    ctaHref: "/nex-native/settings/tier",
  },
  // Guest viewer · nudges toward account creation, not toward a
  // non-existent purchase flow.
  guest: {
    headline: "Create a free NEX account to try premium themes.",
    subheading:
      "Signed-in viewers can unlock premium themes with NEX Bisnis. Direct theme purchase is coming later and is not yet available.",
    ctaLabel: "Create free account",
    ctaHref: "/nex-native/sign-in",
  },
} as const;

export function pickPremiumBannerCopy(
  input: PremiumBannerInput,
): PremiumBannerCopy | null {
  if (input.category !== "premium") return null;
  if (input.canUsePremium) return null;
  const variant = input.viewerKind === "guest" ? COPY.guest : COPY.session;
  return {
    eyebrow: COPY.eyebrow,
    headline: variant.headline,
    subheading: variant.subheading,
    ctaLabel: variant.ctaLabel,
    ctaHref: variant.ctaHref,
  };
}

/** Exported for test cross-reference · the exact words that MUST
 *  NOT appear in any honest premium-banner copy. Protects against a
 *  future refactor silently introducing a payment claim. */
export const FORBIDDEN_PURCHASE_PHRASES: readonly string[] = [
  "buy now",
  "complete purchase",
  "purchase theme",
  "pay now",
  "add to cart",
  "checkout",
  "€",
  "$",
  "idr",
  "rp ",
  "owned",
  "you own",
] as const;
