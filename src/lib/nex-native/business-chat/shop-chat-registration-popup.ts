// src/lib/nex-native/business-chat/shop-chat-registration-popup.ts
//
// Stage 4 · 2026-11-14 · owner-authorised.
// -----------------------------------------------------------------------------
// Pure helpers for the polished in-shop "message this shop" popup
// that replaces the Stage-3 full-page bounce to /sign-in for anon
// visitors tapping More Details.
//
// The popup lives inside _product-detail-sheet.tsx (and other anon
// entry points that want to reuse it). This file owns:
//
//   1. The copy the popup renders · centralised so a future i18n
//      pass only has to visit one file, and so two different entry
//      surfaces can never drift apart.
//   2. The href builder that stamps Create / Sign-in CTAs with the
//      correct `?next=` so the selected shop + product survive the
//      auth round-trip (same shape the Stage 3 round-trip accepts).
//   3. The whitelist validation re-used from the Stage 3 next-path
//      builder so downstream consumers can refuse crafted inputs
//      at defense-in-depth level.
//
// Honesty rules:
//   · NEVER claim the account is phone-verified or SMS-verified ·
//     signup collects phone number as metadata only (gap tracked
//     in Stage 3 REMAINING item #4).
//   · NEVER claim push notifications are enabled until permission
//     + subscription are established (that's Stage 5's gap).
//   · DO explain that replies arrive in the customer's OWN NEX
//     account so they understand they aren't entering the owner's
//     private inbox (owner's "most important design decision").

import { buildSignedOutNextPath } from "@/lib/nex-native/business-chat/anon-next-path";

/** Shape the client component reads to render the popup. All strings
 *  are literal · no interpolation of untrusted values. shopName is
 *  the ONLY dynamic field · it's HTML-escaped by React when rendered. */
export interface ShopChatRegistrationCopy {
  readonly headline: string;
  readonly explainer: string;
  readonly replyPromise: string;
  readonly primaryCta: string;
  readonly secondaryCta: string;
  readonly dismissLabel: string;
}

export function getShopChatRegistrationCopy(
  shopName: string | null | undefined,
): ShopChatRegistrationCopy {
  // Owner's "most important design decision" captured verbatim in the
  // explainer · the customer should understand they are contacting the
  // shop, and the shop replies into the customer's OWN NEX account.
  const trimmedShop = (shopName ?? "").trim();
  const shopLabel = trimmedShop.length > 0 ? trimmedShop : "this shop";
  return {
    headline: `Message ${shopLabel}`,
    explainer:
      "Create your free NEX account to message this shop. Your account is YOUR own private NEX — not an account belonging to the shop.",
    replyPromise:
      "The shop's replies arrive in your own NEX Chat, so you can return any time and pick up the conversation where you left off.",
    primaryCta: "Create Free Account",
    secondaryCta: "Already have an account? Sign In",
    dismissLabel: "Not now",
  };
}

export interface RegistrationHrefs {
  readonly signUpHref: string;
  readonly signInHref: string;
}

/** Build the Create / Sign In hrefs with the Stage-3 `next=` round-
 *  trip already in place · the sign-in page accepts `?mode=signup` to
 *  open directly on the sign-up form (per the existing
 *  redirectToCreateAccountWithError convention · _actions.ts line 147). */
export function buildShopChatRegistrationHrefs(
  slug: string,
  productId: string | null,
): RegistrationHrefs {
  const next = buildSignedOutNextPath(slug, productId);
  const encoded = encodeURIComponent(next);
  return {
    signUpHref: `/nex-native/sign-in?mode=signup&next=${encoded}`,
    signInHref: `/nex-native/sign-in?next=${encoded}`,
  };
}
