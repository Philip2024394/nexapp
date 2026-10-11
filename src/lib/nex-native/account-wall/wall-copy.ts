// src/lib/nex-native/account-wall/wall-copy.ts
//
// NEX Account Wall · copy registry · Phase 0 of first-time experience.
// --------------------------------------------------------------------
// Every account wall in the product reads its copy from this one file.
// A new wall = a new entry here. The client component does not accept
// freeform copy; it looks up the registry by `action` id so we can:
//
//   · audit every wall in the product in one place
//   · translate centrally when i18n lands
//   · guarantee tone + benefit-list consistency across surfaces
//   · prevent a developer from improvising a weak wall
//
// Benefit lines are intentionally short (<= 60 chars). The three slots
// are: headline → 1-line explanation → 2-3 genuine benefits.
//
// Honesty rules:
//   · Do NOT promise a capability the product doesn't actually ship.
//   · Do NOT claim free-forever unless the capability truly is.
//   · Do NOT invent counts, numbers, or stats.
//   · Benefit lines describe REAL outcomes.

export type AccountWallActionId =
  | "pick-theme"
  | "save-business"
  | "message-business"
  | "order-product"
  | "book-service"
  | "join-community"
  | "post-community-notice"
  | "confirm-community-notice"
  | "message-community-author"
  | "join-affiliate"
  | "open-chat"
  | "open-vault"
  | "open-contacts"
  | "generic";

export interface AccountWallCopy {
  /** Short action-specific headline. Shown large at the top. */
  headline: string;
  /** One-sentence explanation. Shown under the headline. */
  explainer: string;
  /** 2-3 genuine benefits · each a short clause (<= 60 chars). */
  benefits: readonly string[];
  /** Primary CTA label · drops into the "Create free account" button. */
  primaryCta: string;
  /** Secondary CTA label · drops into the "Sign in" row. */
  secondaryCta: string;
  /** Label on the dismiss link. null hides the dismiss affordance for
   *  actions where staying would make no sense (e.g. open-chat). */
  dismissLabel: string | null;
}

export const WALL_COPY: Readonly<Record<AccountWallActionId, AccountWallCopy>> = {
  "pick-theme": {
    headline: "Make this chat yours.",
    explainer:
      "Choose your NEX theme and make your communication feel personal.",
    benefits: [
      "Preview the full style before you commit",
      "Switch themes any time",
      "Free account · no card needed",
    ],
    primaryCta: "Create free account",
    secondaryCta: "Already have one? Sign in",
    dismissLabel: "Keep looking",
  },
  "save-business": {
    headline: "Keep this business in your NEX.",
    explainer: "Save it to your Home so you can find it again in one tap.",
    benefits: [
      "Save businesses to your Home",
      "Follow updates and new offers",
      "Free account · 10 seconds",
    ],
    primaryCta: "Create free account",
    secondaryCta: "Already have one? Sign in",
    dismissLabel: "Keep browsing",
  },
  "message-business": {
    headline: "Start the conversation.",
    explainer: "Create your free NEX account to message this business.",
    benefits: [
      "Message the business directly",
      "Keep every reply in one place",
      "Free account · no card needed",
    ],
    primaryCta: "Create free account",
    secondaryCta: "Already have one? Sign in",
    dismissLabel: "Keep looking",
  },
  "order-product": {
    headline: "Place your order.",
    explainer: "You'll continue to checkout with your NEX account.",
    benefits: [
      "Order from local businesses",
      "Keep your orders in one place",
      "Free account · no card needed",
    ],
    primaryCta: "Create free account",
    secondaryCta: "Already have one? Sign in",
    dismissLabel: "Back to the product",
  },
  "book-service": {
    headline: "Book this service.",
    explainer: "Create your NEX account to request and manage the booking.",
    benefits: [
      "Request a time with the provider",
      "Manage your bookings in one place",
      "Free account · no card needed",
    ],
    primaryCta: "Create free account",
    secondaryCta: "Already have one? Sign in",
    dismissLabel: "Back to the service",
  },
  "join-community": {
    headline: "Join this community.",
    explainer:
      "Your neighbours already share updates here. Join to get notifications and post.",
    benefits: [
      "Get notified about local alerts",
      "Post notices · confirm reports",
      "Free account · no card needed",
    ],
    primaryCta: "Create free account",
    secondaryCta: "Already have one? Sign in",
    dismissLabel: "Keep reading",
  },
  "post-community-notice": {
    headline: "Share this with your neighbours.",
    explainer:
      "Create your free NEX account to post a notice in this community.",
    benefits: [
      "Reach everyone in your zone",
      "Keep posts tied to your profile",
      "Free account · 15 seconds",
    ],
    primaryCta: "Create free account",
    secondaryCta: "Already have one? Sign in",
    dismissLabel: "Keep reading",
  },
  "confirm-community-notice": {
    headline: "Confirm you saw this too.",
    explainer:
      "Create your free NEX account to confirm reports and help neighbours.",
    benefits: [
      "Confirm reports from neighbours",
      "Join your local zone",
      "Free account · 15 seconds",
    ],
    primaryCta: "Create free account",
    secondaryCta: "Already have one? Sign in",
    dismissLabel: "Keep reading",
  },
  "message-community-author": {
    headline: "Reach out directly.",
    explainer:
      "Create your free NEX account to message the author of this post.",
    benefits: [
      "Message other members 1-on-1",
      "Keep every reply in one place",
      "Free account · no card needed",
    ],
    primaryCta: "Create free account",
    secondaryCta: "Already have one? Sign in",
    dismissLabel: "Back to the post",
  },
  "join-affiliate": {
    headline: "Earn with NEX.",
    explainer:
      "Create your free account to join the Affiliate Network and share tracked links.",
    benefits: [
      "No products to sell required",
      "Earn commission on paid orders",
      "Free account · nothing upfront",
    ],
    primaryCta: "Create free account",
    secondaryCta: "Already have one? Sign in",
    dismissLabel: "Read more first",
  },
  "open-chat": {
    headline: "Your NEX chat lives here.",
    explainer: "Create your free account to open conversations.",
    benefits: [
      "Message friends · businesses · communities",
      "One inbox for everything on NEX",
      "Free account · no card needed",
    ],
    primaryCta: "Create free account",
    secondaryCta: "Already have one? Sign in",
    dismissLabel: null,
  },
  "open-vault": {
    headline: "The Vault is a private room.",
    explainer:
      "Create your free NEX account to protect conversations in your Vault.",
    benefits: [
      "End-to-end encrypted chats",
      "Only unlocked by your device",
      "Free account · no card needed",
    ],
    primaryCta: "Create free account",
    secondaryCta: "Already have one? Sign in",
    dismissLabel: null,
  },
  "open-contacts": {
    headline: "Build your NEX contacts.",
    explainer: "Create your free account to save people and businesses.",
    benefits: [
      "Save friends · businesses · communities",
      "Find anyone you've met on NEX",
      "Free account · no card needed",
    ],
    primaryCta: "Create free account",
    secondaryCta: "Already have one? Sign in",
    dismissLabel: null,
  },
  generic: {
    headline: "Create your NEX account.",
    explainer: "Free · 15 seconds · no card needed.",
    benefits: [
      "Save your preferences",
      "Chat with people and businesses",
      "Explore the full NEX experience",
    ],
    primaryCta: "Create free account",
    secondaryCta: "Already have one? Sign in",
    dismissLabel: "Keep looking",
  },
};

/** True when the id corresponds to a registered wall. Narrows `string`
 *  to `AccountWallActionId` for safe lookup. */
export function isRegisteredAccountWallAction(
  id: string,
): id is AccountWallActionId {
  return Object.prototype.hasOwnProperty.call(WALL_COPY, id);
}

/** Look up a wall copy entry · falls back to `generic` for unknown ids
 *  so a UI that passes a typo'd action still renders a sane modal. */
export function getAccountWallCopy(id: string): AccountWallCopy {
  if (isRegisteredAccountWallAction(id)) return WALL_COPY[id];
  return WALL_COPY.generic;
}
