// src/app/nex-native/chat-themes-library/_catalog.ts
//
// NEX Chat Themes Library · paid-theme catalog.
// Owner-authorised 2026-11-02 (rev 5 · downloads + label cleanup
// 2026-11-03).
// -----------------------------------------------------------------------------
// 58 paid chat themes · €3.99 one-time or community subscription
// (monthly €2.99 / yearly €2.50/mo billed €30 up front).
//
// IMPORTANT · the Buy / Join buttons on this surface are placeholders
// today (open a "Payment coming soon" sheet). The prices + downloads
// below are NOT yet synced to the country pricing registry or any
// server-side counter. Downloads values are hand-seeded for social-
// proof display · older releases carry higher numbers because they've
// been available longer. Real-counter wiring is Phase 2.

export interface LibraryTheme {
  readonly id: string;
  readonly label: string;
  readonly wallpaperUrl: string;
  /** One-time purchase price · displayed in the Buy button only ·
   *  no on-image badge (owner directive 2026-11-03). */
  readonly oneTimePriceEUR: 3.99;
  /** Hue the active state glows with on the tile · Ireland Gold today. */
  readonly accentHex: "#C6A15B";
  /** Owner-authorised 2026-11-03 · when true the full-library tile
   *  renders a small yellow "NEW" badge in the top-right. Flip off
   *  once a release has aged out. */
  readonly isNew?: boolean;
  /** Owner-authorised 2026-11-03 · display-only download count for
   *  social proof. Older releases carry higher numbers. NOT connected
   *  to a server counter today · Phase 2. */
  readonly downloads: number;
}

export const LIBRARY_THEMES: readonly LibraryTheme[] = [
  // ── Release 1 · 2026-11-02 (Ireland first drop) ─────────────────
  { id: "library-ireland-1", label: "Ireland · Dawn",     wallpaperUrl: "/nex-themes/library/preview/ireland-1.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 2847 },
  { id: "library-ireland-2", label: "Ireland · Dusk",     wallpaperUrl: "/nex-themes/library/preview/ireland-2.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 2104 },
  { id: "library-ireland-4", label: "Ireland · Mist",     wallpaperUrl: "/nex-themes/library/preview/ireland-4.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1988, isNew: true },
  { id: "library-ireland-5", label: "Ireland · Harbour",  wallpaperUrl: "/nex-themes/library/preview/ireland-5.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1762 },
  { id: "library-ireland-6", label: "Ireland · Field",    wallpaperUrl: "/nex-themes/library/preview/ireland-6.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1534 },
  { id: "library-ireland-9", label: "Ireland · Night",    wallpaperUrl: "/nex-themes/library/preview/ireland-9.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1289 },
  { id: "library-ire1",      label: "Ireland · Highland", wallpaperUrl: "/nex-themes/library/preview/ire1.png",      oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1105 },
  { id: "library-pattern-2", label: "Celtic Pattern",     wallpaperUrl: "/nex-themes/library/preview/pattern-2.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 892 },

  // ── Release 2 · 2026-11-03 · owner batch (15 named "Ireland · N") ─
  { id: "library-this-1",  label: "Ireland · 1",  wallpaperUrl: "/nex-themes/library/preview/this-1.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1472 },
  { id: "library-this-2",  label: "Ireland · 2",  wallpaperUrl: "/nex-themes/library/preview/this-2.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1398 },
  { id: "library-this-3",  label: "Ireland · 3",  wallpaperUrl: "/nex-themes/library/preview/this-3.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1218, isNew: true },
  { id: "library-this-4",  label: "Ireland · 4",  wallpaperUrl: "/nex-themes/library/preview/this-4.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1174 },
  { id: "library-this-5",  label: "Ireland · 5",  wallpaperUrl: "/nex-themes/library/preview/this-5.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1092 },
  { id: "library-this-6",  label: "Ireland · 6",  wallpaperUrl: "/nex-themes/library/preview/this-6.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1025 },
  { id: "library-this-7",  label: "Ireland · 7",  wallpaperUrl: "/nex-themes/library/preview/this-7.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 983 },
  { id: "library-this-8",  label: "Ireland · 8",  wallpaperUrl: "/nex-themes/library/preview/this-8.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 917 },
  { id: "library-this-9",  label: "Ireland · 9",  wallpaperUrl: "/nex-themes/library/preview/this-9.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 854, isNew: true },
  { id: "library-this-10", label: "Ireland · 10", wallpaperUrl: "/nex-themes/library/preview/this-10.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 798 },
  { id: "library-this-11", label: "Ireland · 11", wallpaperUrl: "/nex-themes/library/preview/this-11.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 742 },
  { id: "library-this-12", label: "Ireland · 12", wallpaperUrl: "/nex-themes/library/preview/this-12.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 681 },
  { id: "library-this-13", label: "Ireland · 13", wallpaperUrl: "/nex-themes/library/preview/this-13.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 624 },
  { id: "library-this-14", label: "Ireland · 14", wallpaperUrl: "/nex-themes/library/preview/this-14.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 573 },
  { id: "library-this-15", label: "Ireland · 15", wallpaperUrl: "/nex-themes/library/preview/this-15.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 518, isNew: true },

  // ── Release 3 · 2026-11-03 · owner batch (named downloads) ──────
  { id: "library-countryside-sunrise", label: "Misty Countryside Sunrise", wallpaperUrl: "/nex-themes/library/preview/countryside-sunrise.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 967 },
  { id: "library-aerial-dream",        label: "Dreamy Aerial View",         wallpaperUrl: "/nex-themes/library/preview/aerial-dream.png",        oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 889 },
  { id: "library-pipe-elder",          label: "Misty Dawn · Pipe Elder",    wallpaperUrl: "/nex-themes/library/preview/pipe-elder.png",          oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 821 },
  { id: "library-pub-moonlight",       label: "Pub Toast · Moonlight",      wallpaperUrl: "/nex-themes/library/preview/pub-moonlight.png",       oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 773 },
  { id: "library-pub-sunset",          label: "Golden Pub · Sunset",        wallpaperUrl: "/nex-themes/library/preview/pub-sunset.png",          oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 702 },
  { id: "library-countryside-collage", label: "Countryside Collage",        wallpaperUrl: "/nex-themes/library/preview/countryside-collage.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 648, isNew: true },
  { id: "library-emerald-lane",        label: "Emerald Lane · Golden Hour", wallpaperUrl: "/nex-themes/library/preview/emerald-lane.png",        oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 597 },
  { id: "library-pub-village",         label: "Village Pub · Golden Hour",  wallpaperUrl: "/nex-themes/library/preview/pub-village.png",         oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 541 },
  { id: "library-pub-folk",            label: "Cozy Pub · Folk Session",    wallpaperUrl: "/nex-themes/library/preview/pub-folk.png",            oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 492 },
  { id: "library-pub-country",         label: "Country Pub · Golden Hour",  wallpaperUrl: "/nex-themes/library/preview/pub-country.png",         oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 438 },
  { id: "library-highlander",          label: "Golden Hour Highlander",     wallpaperUrl: "/nex-themes/library/preview/highlander.png",          oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 394 },
  { id: "library-pub-cliffs",          label: "Festive Pub · Cliffs",       wallpaperUrl: "/nex-themes/library/preview/pub-cliffs.png",          oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 349 },
  { id: "library-celtic-sunset",       label: "Celtic Sunset · Lion & Lady", wallpaperUrl: "/nex-themes/library/preview/celtic-sunset.png",      oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 302 },
  { id: "library-celtic-coast",        label: "Emerald Celtic Coast",       wallpaperUrl: "/nex-themes/library/preview/celtic-coast.png",        oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 258, isNew: true },
  { id: "library-leprechaun",          label: "Sunlit Leprechaun",          wallpaperUrl: "/nex-themes/library/preview/leprechaun.png",          oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 221 },

  // ── Release 4 · 2026-11-03 · 20 m-series · FLAGGED NEW ──────────
  { id: "library-m-1",  label: "Ireland · M1",  wallpaperUrl: "/nex-themes/library/preview/m-1.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 487 },
  { id: "library-m-2",  label: "Ireland · M2",  wallpaperUrl: "/nex-themes/library/preview/m-2.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 412 },
  { id: "library-m-3",  label: "Ireland · M3",  wallpaperUrl: "/nex-themes/library/preview/m-3.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 365 },
  { id: "library-m-4",  label: "Ireland · M4",  wallpaperUrl: "/nex-themes/library/preview/m-4.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 328 },
  { id: "library-m-5",  label: "Ireland · M5",  wallpaperUrl: "/nex-themes/library/preview/m-5.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 294 },
  { id: "library-m-6",  label: "Ireland · M6",  wallpaperUrl: "/nex-themes/library/preview/m-6.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 267 },
  { id: "library-m-7",  label: "Ireland · M7",  wallpaperUrl: "/nex-themes/library/preview/m-7.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 238 },
  { id: "library-m-8",  label: "Ireland · M8",  wallpaperUrl: "/nex-themes/library/preview/m-8.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 215, isNew: true },
  { id: "library-m-9",  label: "Ireland · M9",  wallpaperUrl: "/nex-themes/library/preview/m-9.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 196 },
  { id: "library-m-10", label: "Ireland · M10", wallpaperUrl: "/nex-themes/library/preview/m-10.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 178 },
  { id: "library-m-11", label: "Ireland · M11", wallpaperUrl: "/nex-themes/library/preview/m-11.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 164 },
  { id: "library-m-12", label: "Ireland · M12", wallpaperUrl: "/nex-themes/library/preview/m-12.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 149 },
  { id: "library-m-13", label: "Ireland · M13", wallpaperUrl: "/nex-themes/library/preview/m-13.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 137, isNew: true },
  { id: "library-m-14", label: "Ireland · M14", wallpaperUrl: "/nex-themes/library/preview/m-14.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 125 },
  { id: "library-m-15", label: "Ireland · M15", wallpaperUrl: "/nex-themes/library/preview/m-15.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 112 },
  { id: "library-m-16", label: "Ireland · M16", wallpaperUrl: "/nex-themes/library/preview/m-16.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 98  },
  { id: "library-m-17", label: "Ireland · M17", wallpaperUrl: "/nex-themes/library/preview/m-17.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 83  },
  { id: "library-m-18", label: "Ireland · M18", wallpaperUrl: "/nex-themes/library/preview/m-18.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 69  },
  { id: "library-m-19", label: "Ireland · M19", wallpaperUrl: "/nex-themes/library/preview/m-19.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 57, isNew: true },
  { id: "library-m-20", label: "Ireland · M20", wallpaperUrl: "/nex-themes/library/preview/m-20.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 42  },

  // ── Release 5 · 2026-11-03 · 12 y-series ────────────────────────
  { id: "library-y-1",  label: "Ireland · Y1",  wallpaperUrl: "/nex-themes/library/preview/y-1.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 182 },
  { id: "library-y-2",  label: "Ireland · Y2",  wallpaperUrl: "/nex-themes/library/preview/y-2.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 164 },
  { id: "library-y-3",  label: "Ireland · Y3",  wallpaperUrl: "/nex-themes/library/preview/y-3.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 151 },
  { id: "library-y-4",  label: "Ireland · Y4",  wallpaperUrl: "/nex-themes/library/preview/y-4.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 139 },
  { id: "library-y-5",  label: "Ireland · Y5",  wallpaperUrl: "/nex-themes/library/preview/y-5.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 126 },
  { id: "library-y-6",  label: "Ireland · Y6",  wallpaperUrl: "/nex-themes/library/preview/y-6.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 115 },
  { id: "library-y-7",  label: "Ireland · Y7",  wallpaperUrl: "/nex-themes/library/preview/y-7.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 104 },
  { id: "library-y-8",  label: "Ireland · Y8",  wallpaperUrl: "/nex-themes/library/preview/y-8.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 93 },
  { id: "library-y-9",  label: "Ireland · Y9",  wallpaperUrl: "/nex-themes/library/preview/y-9.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 81 },
  { id: "library-y-10", label: "Ireland · Y10", wallpaperUrl: "/nex-themes/library/preview/y-10.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 69 },
  { id: "library-y-11", label: "Ireland · Y11", wallpaperUrl: "/nex-themes/library/preview/y-11.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 54 },
  { id: "library-y-12", label: "Ireland · Y12", wallpaperUrl: "/nex-themes/library/preview/y-12.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 38 },
];

// ─── Subscription plans ───────────────────────────────────────────

export type LibraryPlanId = "monthly" | "yearly";

export interface LibraryPlan {
  readonly id: LibraryPlanId;
  readonly label: string;
  readonly priceEUR: number;
  readonly period: "month";
  readonly billingNote: string | null;
  readonly savingsBadge: string | null;
}

export const LIBRARY_PLANS: readonly LibraryPlan[] = [
  {
    id: "monthly",
    label: "Monthly",
    priceEUR: 2.99,
    period: "month",
    billingNote: "Billed monthly · cancel anytime",
    savingsBadge: null,
  },
  {
    id: "yearly",
    label: "Yearly",
    priceEUR: 2.50,
    period: "month",
    billingNote: "Billed €30 yearly · save ~€6/year",
    savingsBadge: "Best value",
  },
];

export const LIBRARY_SUBSCRIPTION = {
  label: "NEX Theme Library",
  pitch: "All themes · new releases included · cancel anytime.",
} as const;

/** Format a download count for tile copy · e.g. 2847 → "2,847 downloads". */
export function formatDownloads(n: number): string {
  return `${n.toLocaleString("en-IE")} downloads`;
}
