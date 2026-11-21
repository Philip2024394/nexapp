// src/lib/nex/indonesia/commerce/types.ts
//
// 2026-11-21 · Recovered shim for `@/lib/nex/indonesia/commerce/types`.
//
// Background: Not ported during the 2026-10-10 nexapp carve-out from
// D:/trades. Type-only module · no runtime behavior. Shape pinned by
// field accesses in:
//
//   · brain/commerce-composer.ts:91       — OfferWithRefs.offer.id,
//                                            .product.name, .seller.name,
//                                            .offer.price.{amount,currency}
//   · brain/commerce-composer.test.ts:10-39 — SellerRecord/ProductRecord/
//                                              OfferRecord constructors
//
// Nothing in the shim fabricates data · these are structural types only.
// If/when the real Stage-4 data model is ported, replace with the
// authoritative types.

import type { Market } from "@/lib/nex/indonesia/data/types";

export type Lifecycle = "DRAFT" | "PUBLISHED" | "RETIRED" | string;
export type SourceTier = "A" | "B" | "C" | "D" | string;
export type Verification = "self_declared" | "verified" | "unknown" | string;
export type OfferStatus = "active" | "paused" | "delisted" | "unknown" | string;

export interface ProvenanceEntry {
  readonly walkerId: string;
  readonly sourceKey: string;
  readonly sourceName: string;
  readonly sourceTier: SourceTier;
  readonly market: Market;
  readonly firstDiscoveredAt: string;
  readonly lastCheckedAt: string;
  readonly lastChangedAt: string;
  readonly observedAt: string;
}

export interface SellerRecord {
  readonly id: string;
  readonly kind: "seller";
  readonly name: string;
  readonly market: Market;
  readonly lifecycle: Lifecycle;
  readonly lifecycleChangedAt: string;
  readonly provenance: ReadonlyArray<ProvenanceEntry>;
  readonly verification: Verification;
  readonly categories: ReadonlyArray<string>;
}

export interface ProductRecord {
  readonly id: string;
  readonly kind: "product";
  readonly name: string;
  readonly brand?: string;
  readonly category: string;
  readonly market: Market;
  readonly lifecycle: Lifecycle;
  readonly lifecycleChangedAt: string;
  readonly provenance: ReadonlyArray<ProvenanceEntry>;
}

export interface OfferPrice {
  readonly amount: number;
  readonly currency: string;
  readonly unit?: string;
  readonly observedAt: string;
  readonly sourceKey: string;
}

export interface OfferRecord {
  readonly id: string;
  readonly kind: "offer";
  readonly sellerId: string;
  readonly productId: string;
  readonly market: Market;
  readonly lifecycle: Lifecycle;
  readonly lifecycleChangedAt: string;
  readonly provenance: ReadonlyArray<ProvenanceEntry>;
  readonly status: OfferStatus;
  readonly price?: OfferPrice;
}

/** Join of an offer with its referenced product + seller records. */
export interface OfferWithRefs {
  readonly offer: OfferRecord;
  readonly product: ProductRecord;
  readonly seller: SellerRecord;
}
