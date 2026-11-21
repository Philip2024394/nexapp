// src/lib/nex/indonesia/commerce/storage.ts
//
// 2026-11-21 · Recovered shim for `@/lib/nex/indonesia/commerce/storage`.
//
// Background: Not ported during the 2026-10-10 nexapp carve-out from
// the test-only `_seedCommerceForTests` + `_resetCommerceCacheForTests`
// helpers to seed/clear an in-memory commerce cache.
//
// Since the sibling `retrieval.ts` shim is empty-corpus-only, the
// seed helpers are no-ops: they silently discard the seeded data,
// and retrieval continues to return [] regardless of what was
// "seeded." This means:
//
//   · commerce-composer.test.ts 'empty corpus' cases PASS
//   · commerce-composer.test.ts 'seeded data' cases FAIL (legitimately)
//
// The seeded-data failures are HONEST: this fork has no commerce
// corpus to retrieve from, so asserting "after seeding X, retrieval
// returns X" would require the shim to fabricate a working retriever.
// The alternative — skipping those tests — would hide the fact that
// commerce infrastructure is missing. The failures remain visible
// until the real module ports.

import type {
  OfferRecord,
  ProductRecord,
  SellerRecord,
} from "@/lib/nex/indonesia/commerce/types";

export interface CommerceSeed {
  readonly sellers: ReadonlyArray<SellerRecord>;
  readonly products: ReadonlyArray<ProductRecord>;
  readonly offers: ReadonlyArray<OfferRecord>;
}

/**
 * Test-only · seed the commerce cache.
 *
 * Shim behaviour: silently discards. The sibling retrieval shim is
 * empty-corpus-only, so seeded data cannot surface via findProducts/
 * findOffers.
 */
export function _seedCommerceForTests(_seed: CommerceSeed): void {
  // No-op · fork carve-out · see file header.
}

/**
 * Test-only · reset the commerce cache.
 *
 * Shim behaviour: no-op (nothing to reset).
 */
export function _resetCommerceCacheForTests(): void {
  // No-op · fork carve-out.
}
