// src/lib/nex/indonesia/commerce/retrieval.ts
//
// 2026-11-21 · Recovered shim for `@/lib/nex/indonesia/commerce/retrieval`.
//
// Background: Not ported during the 2026-10-10 nexapp carve-out from
// D:/trades. Sole live importer is brain/commerce-composer.ts, which
// *already* explicitly handles the empty-corpus path:
//
//   commerce-composer.ts:101 ·
//     "if (corpusSize.products === 0 && corpusSize.offers === 0)"
//     → returns honest "no listings yet · pipeline ready" reply,
//       suggestions pointing to marketplace, empty offers array.
//
// This is the SAME honesty invariant as the knowledge shim: when the
// corpus is empty (which it IS in this fork), the composer refuses
// to fabricate products. Returning [] everywhere preserves that
// invariant perfectly — the composer behaves correctly on top of an
// empty shim.
//
// Type contract pinned by commerce-composer.ts:82-97 call sites:
//
//   findProducts({ categoryPrefix? })  → ProductRecord[]
//   findOffers({ market?, limit?, status? }) → OfferRecord[]
//   joinOffers(OfferRecord[])          → OfferWithRefs[]
//
// Reversal path: if/when real Indonesia commerce infrastructure is
// ported, replace this file with the real retriever. Type contract
// above is stable.

import type {
  OfferRecord,
  OfferStatus,
  OfferWithRefs,
  ProductRecord,
} from "@/lib/nex/indonesia/commerce/types";
import type { Market } from "@/lib/nex/indonesia/data/types";

export interface FindProductsFilter {
  readonly categoryPrefix?: string;
}

export interface FindOffersFilter {
  readonly market?: Market;
  readonly limit?: number;
  readonly status?: ReadonlyArray<OfferStatus>;
}

/**
 * Query the Indonesia commerce product corpus.
 *
 * Shim behaviour: always returns []. The composer treats empty-corpus
 * as the honest "no listings yet" boundary (commerce-composer.ts:101).
 */
export function findProducts(_filter: FindProductsFilter): ProductRecord[] {
  return [];
}

/**
 * Query the Indonesia commerce offer corpus.
 *
 * Shim behaviour: always returns []. See findProducts rationale.
 */
export function findOffers(_filter: FindOffersFilter): OfferRecord[] {
  return [];
}

/**
 * Join offers to their referenced product + seller records.
 *
 * Shim behaviour: filters the (necessarily empty) input through the
 * (necessarily empty) retrieval functions. Returns [].
 */
export function joinOffers(_offers: ReadonlyArray<OfferRecord>): OfferWithRefs[] {
  return [];
}
