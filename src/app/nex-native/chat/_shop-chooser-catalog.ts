// src/app/nex-native/chat/_shop-chooser-catalog.ts
//
// NEX · S5 · shop-type chooser catalogue · owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Plain data module (not "use client") so tests can import the
// catalogue without pulling the full `_shop-grid-modal.tsx` client
// bundle (which depends on react-dom's createPortal + a dozen SVG
// components).
//
// Scope boundary (sealed by the owner directive 2026-10-18):
//
//   · ONLY an additive alignment of the chooser's card list to the
//     four Sell categories + a separate Earn-with-NEX section.
//   · Preserves the sealed modal / trigger architecture · the
//     chooser's parent (`_shop-grid-modal.tsx`), its trigger
//     (`_header-right-cluster.tsx`), and its default-closed state
//     are UNCHANGED.
//   · "Coming soon" cards are visibly marked and NOT navigable ·
//     no synthetic backend, no fake flow. `href: null` + a
//     corresponding `available: false` are the honest signal.
//   · "Products", "Food", and "Affiliate" keep their sealed live
//     destinations verbatim.
//
// Services and Accommodation are deliberately `available: false`
// because the `/nex-native/onboarding` route does NOT yet handle
// `?type=service` or `?type=accommodation`. Marking them "Coming
// soon" is the only truthful treatment per the owner's
// "do not invent working services" rule.

/** The five discoverable shop-type cards · stable string ids used
 *  for analytics / tests · the catalogue is the only source of
 *  truth. */
export type ShopChooserCardId =
  | "products"
  | "services"
  | "food"
  | "accommodation"
  | "affiliate";

/** Two visual sections in the chooser · owner-approved split. */
export type ShopChooserSection = "sell" | "earn";

export interface ShopChooserCard {
  readonly id: ShopChooserCardId;
  readonly section: ShopChooserSection;
  readonly label: string;
  readonly caption: string;
  /** Live destination or `null` when the card is "Coming soon".
   *  Callers MUST NOT fabricate a working route for `null` cards. */
  readonly href: string | null;
  /** Honest availability signal · `false` means the real backend
   *  is not yet in place AND the UI should render the Coming-soon
   *  chip (no navigation on tap). */
  readonly available: boolean;
}

/** Sealed Sell + Earn catalogue · S5-aligned. Order matters · it
 *  drives the on-screen row order in the chooser. */
export const SHOP_CHOOSER_CATALOG: readonly ShopChooserCard[] = [
  // ─── Sell lane · four cards (owner-approved spec) ────────────────
  {
    id: "products",
    section: "sell",
    label: "Sell Products",
    caption: "Physical goods · home-made, retail, trades, maker.",
    // Sealed route · onboarding?type=product&commerce=1 bypasses the
    // Phase 1 launch gate because the user tapping this IS the
    // authorised intent (sealed 2026-10-01).
    href: "/nex-native/onboarding?type=product&commerce=1",
    available: true,
  },
  {
    id: "services",
    section: "sell",
    label: "Sell Services",
    caption: "Bookable services · appointments, home visits, trades.",
    // No backend yet · `/nex-native/onboarding` does not handle
    // ?type=service. Marked Coming-soon so the UI tells the truth.
    href: null,
    available: false,
  },
  {
    id: "food",
    section: "sell",
    label: "Sell Food",
    caption: "Kitchen, cafe, bar, catering · menu driven.",
    href: "/nex-native/onboarding?type=food&commerce=1",
    available: true,
  },
  {
    id: "accommodation",
    section: "sell",
    label: "Sell Accommodation",
    caption: "Rooms, villas, homestay · stay-and-book listings.",
    // Owner directive 2026-10-20 · Accommodation unblocked · the
    // sealed LayoutAccommodation cover (Phase 1 of 3 variants) is
    // live · owner-onboarding reuses the existing onboarding flow
    // with ?type=accommodation&commerce=1, same shape Products +
    // Food already route to.
    href: "/nex-native/onboarding?type=accommodation&commerce=1",
    available: true,
  },
  // ─── Earn with NEX · separate section · one card today ──────────
  {
    id: "affiliate",
    section: "earn",
    label: "Affiliate",
    caption: "Promote others' products · earn commission.",
    // Sealed route · /affiliate/join exists with the sealed
    // joinAffiliateAction (2026-10-01).
    href: "/nex-native/affiliate/join",
    available: true,
  },
] as const;

/** Return only the Sell-lane cards (keeps ordering). */
export function sellCards(): readonly ShopChooserCard[] {
  return SHOP_CHOOSER_CATALOG.filter((c) => c.section === "sell");
}

/** Return only the Earn-with-NEX cards (keeps ordering). */
export function earnCards(): readonly ShopChooserCard[] {
  return SHOP_CHOOSER_CATALOG.filter((c) => c.section === "earn");
}

/** Narrow a card id to one of the sealed values. Used by tests and
 *  by callers that receive a token from an untrusted boundary. */
export function isShopChooserCardId(
  value: string,
): value is ShopChooserCardId {
  return SHOP_CHOOSER_CATALOG.some((c) => c.id === value);
}
