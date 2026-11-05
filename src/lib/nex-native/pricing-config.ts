// src/lib/nex-native/pricing-config.ts
//
// NEX Pricing Configuration · single source of truth for package offers.
// Owner-authorised 2026-10-21 (end-to-end welcome card build).
// -----------------------------------------------------------------------------
// Why this module exists
//
// Prior state: pricing values were hard-coded across welcome cards,
// /packages (911 lines, inline "Rp 99,000"), test fixtures and
// marketing copy. There was no authoritative place that answered
// "is this price approved for live display?" or "does this trial
// actually auto-fire on signup?"
//
// This module centralises three things:
//   1. Package catalogue · the three welcome offers (Chat / Themes Shop /
//      Business) with their displayable copy, price and trial terms.
//   2. Approval status · every price AND every trial carries a
//      `PROPOSAL | APPROVED | WITHDRAWN` flag. Only APPROVED values may
//      drive user-facing pricing or trial advertising.
//   3. Readiness guards · `isPackageReadyForLive(pkg)` encodes the
//      "same story" rule from owner memo 2026-10-21: a Business
//      package can only advertise "7 days free, then {price}/month"
//      when BOTH the price is APPROVED and the trial has an actual
//      activation path (auto-fire OR manual-start). Otherwise consumers
//      must fall back to "See all plans →".
//
// What this module DOES NOT do
//   · It does NOT fire a trial. Trial activation lives in the account-
//     service layer (see `startThemesTrial` for the themes-trial path)
//     and the business-trial service layer (see `startBusinessTrial` ·
//     wired into createBusinessAction 2026-11-06 per Shop Entitlement
//     Contract §K-3 LOCK · retires the sealed 2026-10-18 hold).
//   · It does NOT charge users. There is no billing provider wired to
//     this configuration today · hence `trial.convertsAutomatically`
//     stays `false` for every package until billing is proven.
//   · It does NOT replace /packages. The /packages page continues to
//     be the designated detailed-pricing surface · future work can
//     refactor it to consume this module.
//
// Doctrine anchors (sealed in memory 2026-10-21 · "same story principle")
//   · No advertising a trial that doesn't auto-fire.
//   · No hard-coded unapproved prices on welcome-adjacent surfaces.
//   · Welcome card, pricing page, signup flow and billing MUST tell
//     the same story.
//   · Three unlocks required before Business card can show pricing +
//     trial copy: price APPROVED · trial actually wired · guards
//     updated together in the same commit.

// ─── Approval status ───────────────────────────────────────────────

export const PRICING_APPROVAL_STATUSES = [
  "PROPOSAL",
  "APPROVED",
  "WITHDRAWN",
] as const;

export type PricingApprovalStatus =
  (typeof PRICING_APPROVAL_STATUSES)[number];

// ─── Amount + currency ────────────────────────────────────────────

/** Billing interval. `once` is a one-time purchase (per-theme), `monthly`
 *  / `yearly` are recurring subscriptions. */
export type PricingInterval = "once" | "monthly" | "yearly";

export interface PricingAmount {
  /** Amount in the smallest currency unit (cents, pence, sen). Keeping
   *  prices as integers avoids all floating-point rounding. */
  readonly amountMinorUnits: number;
  /** ISO 4217 three-letter code. */
  readonly currency: string;
  readonly interval: PricingInterval;
  /** Whether the amount already includes applicable tax. If `false`,
   *  display copy MUST state "excl. tax" or an equivalent disclosure. */
  readonly taxInclusive: boolean;
  readonly status: PricingApprovalStatus;
  /** ISO 8601 timestamp when the status flipped to APPROVED. Only
   *  populated when status === "APPROVED". Used by audit logs. */
  readonly approvedAt?: string;
  /** Who approved it. Kept intentionally generic (string) so this
   *  module stays decoupled from account/role types. */
  readonly approvedBy?: string;
}

// ─── Trial terms ──────────────────────────────────────────────────

export interface PricingTrial {
  readonly durationDays: number;
  /** CRITICAL honesty flag. When `true`, the signup flow is wired to
   *  fire the trial automatically. When `false`, UI copy MUST NOT
   *  claim "X days free" without disclosing the manual activation
   *  step. Default `false` until the signup-trial integration ships. */
  readonly autoFiresOnSignup: boolean;
  /** When `true`, a dedicated "Start X-day trial" button exists in the
   *  product and can be used by the UI to disclose activation
   *  explicitly. When `false`, the trial has no activation path at all
   *  and MUST NOT be advertised. */
  readonly manualStartAvailable: boolean;
  /** When `true`, trial end converts to a paid subscription without
   *  further user action. Requires a billing provider + payment-method
   *  collection BEFORE activation. When `false`, trial end simply
   *  removes paid entitlements until the user manually subscribes. */
  readonly convertsAutomatically: boolean;
  readonly status: PricingApprovalStatus;
}

// ─── Package catalogue ────────────────────────────────────────────

export const PRICING_PACKAGE_IDS = [
  "nex_chat_free",
  "chat_themes_premium",
  "nex_business",
] as const;

export type PricingPackageId = (typeof PRICING_PACKAGE_IDS)[number];

export interface PricingPackage {
  readonly id: PricingPackageId;
  readonly displayName: string;
  readonly tagline: string;
  readonly isFree: boolean;
  /** Omitted for free packages. */
  readonly price?: PricingAmount;
  /** Omitted when no trial applies. */
  readonly trial?: PricingTrial;
  /** Short feature list used by welcome-card value-prop rows and the
   *  /packages page. Order-sensitive · the first ~4 entries are what
   *  renders on the welcome card. */
  readonly entitlements: readonly string[];
}

/** The canonical package catalogue. Edit values here ONLY when the
 *  owner has signed off on the change · never flip a status to
 *  APPROVED speculatively. */
export const NEX_PRICING_PACKAGES: readonly PricingPackage[] = [
  {
    id: "nex_chat_free",
    displayName: "NEX Chat",
    tagline: "Personal chat, themes and friends",
    isFree: true,
    entitlements: [
      "Personal chat",
      "Standard NEX themes",
      "Public shop browsing",
      "NEX Directory search",
    ],
  },
  {
    id: "chat_themes_premium",
    displayName: "Chat Themes Shop",
    tagline: "Premium backgrounds and styles",
    isFree: false,
    // Memory 2026-10-20 · US$3.99 per theme (one-time, 12 regional
    // prices) · PROPOSAL · must be validated with real customers
    // before hard-coding payment.
    price: {
      amountMinorUnits: 399,
      currency: "USD",
      interval: "once",
      taxInclusive: false,
      status: "PROPOSAL",
    },
    entitlements: [
      "Live preview before buy",
      "Premium themes",
      "Lifetime access per purchase",
      "Theme ownership persists per purchase, not subscription",
    ],
  },
  {
    id: "nex_business",
    displayName: "NEX Business",
    tagline: "Tools to grow your business",
    isFree: false,
    // Memory 2026-10-20 · US$9.99/mo or US$99/yr (12 regional prices,
    // ~17% annual saving) · PROPOSAL · must be validated before
    // hard-coding payment.
    price: {
      amountMinorUnits: 999,
      currency: "USD",
      interval: "monthly",
      taxInclusive: false,
      status: "PROPOSAL",
    },
    trial: {
      durationDays: 7,
      // 2026-11-06 · Shop Entitlement Contract §K-3 LOCK retires the
      // sealed 2026-10-18 "signup leaves the trial UNTOUCHED" hold.
      // `startBusinessTrial` service exists (business-trial/service.ts
      // · writes nex_account.business_trial_status + _start_at + _end_at
      // · migration 214 schema) AND is now wired into
      // createBusinessAction (first business signup auto-fires). The
      // runtime wiring is gated by the `NEX_BUSINESS_TRIAL_ENABLED`
      // env flag · when the flag is off the service short-circuits
      // honestly rather than silently granting the trial, so this
      // module can reflect the CODE path truthfully.
      //
      // `manualStartAvailable` is also true: `/api/nex-native/trial/start`
      // (POST) exists as an idempotent manual-start path.
      autoFiresOnSignup: true,
      manualStartAvailable: true,
      // No billing provider is wired. Setting this true without
      // integration tested would be an unsupported auto-conversion
      // claim. Memory doctrine: "no surprise charges".
      convertsAutomatically: false,
      // Status stays PROPOSAL until §B-1 price-validation gate opens ·
      // the three-unlocks rule (price APPROVED + trial wired + copy
      // aligned) requires all three. Only the trial-wired leg is
      // satisfied by this LOCK.
      status: "PROPOSAL",
    },
    entitlements: [
      "Your NEX Chat",
      "Public shop page + bio link",
      "Directory listing",
      "Customer enquiries routed to chat",
    ],
  },
];

// ─── Lookup + readiness guards ────────────────────────────────────

export function getPricingPackage(
  id: PricingPackageId,
): PricingPackage | null {
  return NEX_PRICING_PACKAGES.find((p) => p.id === id) ?? null;
}

/** True when the package's price (if any) AND trial (if any) are
 *  BOTH approved and have real activation paths. Free packages are
 *  always ready.
 *
 *  Consumers (welcome cards, /packages promotional sections) MUST
 *  gate "advertise price + trial" rendering on this helper. When it
 *  returns `false`, fall back to "See all plans →" or hide the price. */
export function isPackageReadyForLive(pkg: PricingPackage): boolean {
  if (pkg.isFree) return true;
  // Paid packages need APPROVED price.
  if (!pkg.price || pkg.price.status !== "APPROVED") return false;
  // If a trial is defined, it must also be approved AND have an
  // activation path · otherwise advertising the trial misrepresents.
  if (pkg.trial) {
    if (pkg.trial.status !== "APPROVED") return false;
    if (!pkg.trial.autoFiresOnSignup && !pkg.trial.manualStartAvailable) {
      return false;
    }
    // If the trial claims automatic conversion, we must have a
    // billing wire. Without one, the auto-convert claim is false.
    // (A conservative paranoia check · nothing in the current config
    // sets this true, but belt-and-braces.)
    if (pkg.trial.convertsAutomatically) {
      // No billing today · never ready-for-live with auto-convert.
      return false;
    }
  }
  return true;
}

/** True when the trial's activation + conversion story is honest to
 *  advertise. If `false`, UI copy MUST NOT say "X days free" or
 *  equivalent. Independently useful for test assertions. */
export function isTrialReadyForLive(trial: PricingTrial): boolean {
  if (trial.status !== "APPROVED") return false;
  if (!trial.autoFiresOnSignup && !trial.manualStartAvailable) return false;
  if (trial.convertsAutomatically) return false; // same billing paranoia
  return true;
}

// ─── Formatters ───────────────────────────────────────────────────

/** Format a `PricingAmount` using Intl.NumberFormat. Returns an empty
 *  string when the amount is not APPROVED · callers get a safe
 *  fallback string to render. */
export function formatPricingAmount(
  amount: PricingAmount,
  locale?: string,
): string {
  if (amount.status !== "APPROVED") return "";
  const major = amount.amountMinorUnits / 100;
  let body: string;
  try {
    body = new Intl.NumberFormat(locale ?? undefined, {
      style: "currency",
      currency: amount.currency,
      minimumFractionDigits: Number.isInteger(major) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    body = `${amount.currency} ${major.toFixed(2)}`;
  }
  switch (amount.interval) {
    case "monthly":
      return `${body}/month`;
    case "yearly":
      return `${body}/year`;
    case "once":
    default:
      return body;
  }
}

/** Build the welcome-card display chip for a package.
 *  · Free package → "FREE"
 *  · Paid package, not ready → "See all plans"
 *  · Paid package with trial, ready → "7 days free, then {price}/month"
 *  · Paid package without trial, ready → "{price}"
 *
 *  The caller provides the hyperlink separately · this helper only
 *  returns the DISPLAY STRING. */
export function welcomeCardChipFor(
  pkg: PricingPackage,
  locale?: string,
): string {
  if (pkg.isFree) return "FREE";
  if (!isPackageReadyForLive(pkg)) return "See all plans";
  if (pkg.price && pkg.trial && isTrialReadyForLive(pkg.trial)) {
    return `${pkg.trial.durationDays} days free, then ${formatPricingAmount(pkg.price, locale)}`;
  }
  if (pkg.price) return formatPricingAmount(pkg.price, locale);
  return "See all plans";
}
