// src/lib/nex-native/seo/__tests__/route-coverage.test.ts
//
// NEX SEO B1 audit · route-coverage acceptance test.
// Owner-authorised 2026-11-11.
// -----------------------------------------------------------------------------
// Hard-pins two contracts:
//
//   1. Every CONFIRMED public route stays crawlable · a regression here means
//      we accidentally blocked a shop, a discoverable profile, pricing, or
//      a marketing page.
//   2. Every CONFIRMED private route is covered by at least one prefix in
//      PRIVATE_PATH_PREFIXES · a regression here means we might leak a
//      private surface (settings, chat, orders) into the sitemap or into
//      a friendly `User-Agent: Googlebot / Allow: /` hit.
//
// This test does NOT check whether routes are gated by authentication —
// robots.txt is not an access-control mechanism. Auth gates are enforced
// by middleware + route handlers + RLS, verified elsewhere.

import { describe, expect, it } from "vitest";
import {
  isPrivatePath,
  PRIVATE_PATH_PREFIXES,
} from "../exclude-routes";

// Confirmed real routes under src/app/nex-native/* that must stay public.
// Spot-verified against the actual filesystem on 2026-11-11.
const MUST_STAY_PUBLIC: readonly string[] = [
  "/",
  "/nex-native",
  "/nex-native/about",
  "/nex-native/developers",
  "/nex-native/directory",
  "/nex-native/directory/landing",
  "/nex-native/features/shops",
  "/nex-native/features/link-in-bio",
  "/nex-native/features/chat",
  "/nex-native/features/chat-themes",
  "/nex-native/features/directory",
  "/nex-native/features/vault",
  "/nex-native/for-creators",
  "/nex-native/for-sellers",
  "/nex-native/free-chat",
  "/nex-native/ireland-entry",
  "/nex-native/pricing",
  "/nex-native/privacy",
  "/nex-native/terms",
  // Dynamic public surfaces (sample slugs).
  "/nex-native/example-shop-slug",
  "/nex-native/example-shop-slug/anything",
  "/nex-native/profile/discoverable-handle",
  "/nex-native/product/pub-123",
  "/nex-native/chat-themes-library",
  "/nex-native/chat-themes-library/all",
  "/nex-native/cover-themes-library",
  "/nex-native/store",
];

// Confirmed real routes that must stay disallowed. Spot-verified against
// filesystem on 2026-11-11.
const MUST_STAY_PRIVATE: readonly string[] = [
  "/nex-native/admin",
  "/nex-native/call",
  "/nex-native/call/dial",
  "/nex-native/call-centre",
  "/nex-native/cart",
  "/nex-native/chat",
  "/nex-native/chat/peer/some-id",
  "/nex-native/chat/guest/some-id",
  "/nex-native/contacts",
  "/nex-native/create/product",
  "/nex-native/emergency-help",
  "/nex-native/emergency-help/activate",
  "/nex-native/free-chat/call/abc",
  "/nex-native/friends",
  "/nex-native/group-chat",
  "/nex-native/group-chat/some-group",
  "/nex-native/home",
  "/nex-native/hq",
  "/nex-native/hq/alerts",
  "/nex-native/hq/support-tickets",
  "/nex-native/library",
  "/nex-native/library/backgrounds",
  "/nex-native/live-commerce/studio",
  "/nex-native/manage",
  "/nex-native/manage/shop",
  "/nex-native/manage/orders",
  "/nex-native/orders",
  "/nex-native/orders/some-id",
  "/nex-native/profile/me",
  "/nex-native/profile/theme",
  "/nex-native/prototypes",
  "/nex-native/settings",
  "/nex-native/settings/payments",
  "/nex-native/share",
  "/nex-native/sign-in",
  "/nex-native/support",
  "/nex-native/unsubscribe/some-token",
  "/nex-native/vault",
  "/nex-native/vault/setup",
  "/api/nex-native/anything",
  "/api/anything",
];

describe("robots coverage · public routes stay crawlable", () => {
  for (const path of MUST_STAY_PUBLIC) {
    it(`public: ${path}`, () => {
      expect(
        isPrivatePath(path),
        `${path} is incorrectly treated as private — it is a confirmed public route`,
      ).toBe(false);
    });
  }
});

describe("robots coverage · private routes stay disallowed", () => {
  for (const path of MUST_STAY_PRIVATE) {
    it(`private: ${path}`, () => {
      expect(
        isPrivatePath(path),
        `${path} is a confirmed private route but no prefix in PRIVATE_PATH_PREFIXES matches it`,
      ).toBe(true);
    });
  }
});

describe("private-path prefix list size", () => {
  it("has at least 25 sealed prefixes (defensive floor)", () => {
    expect(PRIVATE_PATH_PREFIXES.length).toBeGreaterThanOrEqual(25);
  });
});
