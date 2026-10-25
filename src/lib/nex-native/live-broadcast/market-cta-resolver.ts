// src/lib/nex-native/live-broadcast/market-cta-resolver.ts
//
// NEX Live · context-aware "View Shop" / "View Market" CTA resolver.
// -----------------------------------------------------------------------------
// Owner directive 2026-10-24:
//   "the view shop button for signed in users and when owner is
//    showing live will divert to that owner - but other live posts
//    that has not owner live or not related will show view market
//    which diverts to nex search directory and if the person is
//    viewing car video or restaurant we try to open the same category
//    on the nex search directory"
//
// Policy:
//   1. If the video has a business attachment (video.business_id)
//      the owner has a shop → render "View Shop" + route to that
//      owner's shop surface.
//   2. Otherwise render "View Market" + route to the NEX Search
//      Directory. If the video carries a topic_tag we recognise,
//      route to the directory PRE-FILTERED to that category so the
//      viewer lands on "restaurants" when they were watching a
//      restaurant video, "transport" when they were watching a car
//      video, etc.
//
// Non-claims:
//   · This resolver does NOT query live-session state. The uploaded-
//     video viewer calls it based on the video row alone. For the
//     Live-session viewer surface, keep the sealed "View Shop" to the
//     broadcaster · they are definitionally live right now.
//   · The topic→category map here is a UI-level translation layer. It
//     is NOT the sealed Discovery category list (which is pending
//     owner approval). When Discovery lands, this file should import
//     the sealed catalogue instead of carrying its own mapping.

export type MarketCtaKind = "shop" | "market";

export interface MarketCta {
  readonly kind: MarketCtaKind;
  readonly label: string;        // "View Shop" | "View Market"
  readonly ariaLabel: string;    // honest for screen readers
  readonly href: string;         // concrete URL ready for <a href>
  /** Which category slug was matched · null when no tag matched. */
  readonly matchedCategory: string | null;
}

/** Minimal video shape this resolver needs. Any object matching this
 *  structure can be passed in — we intentionally do not depend on the
 *  full `UploadedVideoRow` type so this file stays free of DB types. */
export interface MarketCtaVideoLike {
  readonly owner_account_id: string;
  readonly business_id: string | null;
  readonly topic_tags: readonly string[];
}

/** Normalise a tag · lowercase + trim · empty strings drop out. */
function normaliseTag(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Topic → category-slug map. Matched case-insensitively on the
 *  video's `topic_tags[]`. First matching tag wins. */
const TOPIC_TO_CATEGORY: ReadonlyMap<string, string> = new Map([
  // food-drink
  ["food", "food-drink"], ["restaurant", "food-drink"],
  ["cafe", "food-drink"],  ["café", "food-drink"],
  ["drink", "food-drink"], ["coffee", "food-drink"],
  ["bakery", "food-drink"],["dessert", "food-drink"],
  // fashion
  ["fashion", "fashion"],  ["beauty", "fashion"],
  ["clothing", "fashion"], ["salon", "fashion"],
  ["makeup", "fashion"],
  // travel
  ["travel", "travel"],       ["destination", "travel"],
  ["trip", "travel"],         ["tour", "travel"],
  // services
  ["service", "services"],    ["repair", "services"],
  ["cleaning", "services"],   ["mechanic", "services"],
  // products
  ["product", "products"],    ["retail", "products"],
  ["shop", "products"],       ["gadget", "products"],
  // events
  ["event", "events"],        ["concert", "events"],
  ["festival", "events"],     ["gig", "events"],
  // stay
  ["stay", "stay"],           ["hotel", "stay"],
  ["accommodation", "stay"],  ["villa", "stay"],
  ["hostel", "stay"],
  // transport
  ["car", "transport"],       ["bike", "transport"],
  ["vehicle", "transport"],   ["scooter", "transport"],
  ["motor", "transport"],     ["transport", "transport"],
  // deals
  ["deal", "deals"],          ["discount", "deals"],
  ["sale", "deals"],          ["promo", "deals"],
  // creators
  ["creator", "creators"],    ["influencer", "creators"],
  ["musician", "creators"],   ["dj", "creators"],
  // art
  ["art", "art"],             ["craft", "art"],
  ["painting", "art"],        ["sculpture", "art"],
  // sports
  ["sport", "sports"],        ["sports", "sports"],
  ["fitness", "sports"],      ["workout", "sports"],
  ["gym", "sports"],
]);

/** Walk the tags in order; return the first mapped category slug or null. */
export function pickCategorySlug(tags: readonly string[]): string | null {
  for (const raw of tags) {
    const t = normaliseTag(raw);
    if (t.length === 0) continue;
    const slug = TOPIC_TO_CATEGORY.get(t);
    if (slug) return slug;
  }
  return null;
}

/** Resolve the CTA for a given uploaded-video row. */
export function resolveMarketCta(video: MarketCtaVideoLike): MarketCta {
  // Case 1 · video has a business attachment → owner has a shop.
  //   Shop surface lives at `/nex-native/u/{owner_account_id}`.
  if (video.business_id !== null && video.business_id.length > 0) {
    return {
      kind: "shop",
      label: "Shop",
      ariaLabel: "Open this seller's shop",
      href: `/nex-native/u/${video.owner_account_id}`,
      matchedCategory: null,
    };
  }

  // Case 2 · no shop → point at the Market (Search Directory). Try
  // to pre-filter the directory by the video's topic.
  const slug = pickCategorySlug(video.topic_tags);
  const href = slug
    ? `/nex-native/directory/${slug}`
    : `/nex-native/directory`;
  return {
    kind: "market",
    label: "Market",
    ariaLabel: slug
      ? `Open NEX Market · ${slug.replace("-", " & ")} category`
      : "Open NEX Market",
    href,
    matchedCategory: slug,
  };
}
