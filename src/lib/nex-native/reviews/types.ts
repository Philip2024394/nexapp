// src/lib/nex-native/reviews/types.ts
//
// NEX · Reviews demo · interface types.
// Owner-authorised 2026-11-16 · MOCK-ONLY checkpoint.
// -----------------------------------------------------------------
// These types are the contract the UI consumes. The mock store in
// `mock-review-store.ts` implements it today using in-memory + a
// localStorage shadow (so the owner can post a review, close the
// tab and still see it on reopen). Phase 2 (NOT authorised) swaps
// the mock for a real adapter backed by a Postgres table + RPC.
// The UI surfaces NEVER import the mock directly · they only touch
// the exported hook `useReviewStore()` which hides the adapter.

export interface ReviewRecord {
  readonly id: string;
  readonly productId: string;
  /** Opaque author id · mock uses a random per-browser value. In
   *  Phase 2 this becomes the authenticated nex_account id. */
  readonly authorId: string;
  /** Display handle shown in the landscape review list. Mock uses
   *  a small pool of friendly handles ("Aoife L.", "Rónán", …). */
  readonly authorHandle: string;
  /** Star rating · integer 1..5. */
  readonly stars: number;
  /** Optional short review body · up to ~500 chars. Mock enforces
   *  the char cap in the post popup; Phase 2 will re-validate on
   *  the server. */
  readonly body: string;
  /** ISO timestamp · used for the reviewer card date label. */
  readonly createdAt: string;
}

export interface ProductReviewSummary {
  readonly productId: string;
  readonly count: number;
  /** Average star score · 0 when count is 0. Rounded to 1 decimal
   *  at the render boundary · the store stores the raw float. */
  readonly averageScore: number;
}

export interface OrderPlacedItem {
  readonly productId: string;
  readonly name: string;
  readonly thumbnailUrl: string;
  readonly qty: number;
  /** Unit price in minor currency units (pence / cents). Matches the
   *  live `nex_product.price_pence` convention. */
  readonly pricePence: number;
}

export interface OrderPlacedRecord {
  readonly id: string;
  readonly shopName: string;
  readonly placedAt: string;
  readonly currency: string;
  readonly items: ReadonlyArray<OrderPlacedItem>;
}

export interface PostReviewInput {
  readonly productId: string;
  readonly stars: number;
  readonly body: string;
}

/** Adapter contract. The mock store implements it; the Phase 2
 *  real store will implement the same shape so no UI changes. */
export interface ReviewStoreAdapter {
  listForProduct(productId: string): ReadonlyArray<ReviewRecord>;
  summaryFor(productId: string): ProductReviewSummary;
  myReviewFor(productId: string): ReviewRecord | null;
  postOrUpdate(input: PostReviewInput): ReviewRecord;
  listMockOrders(): ReadonlyArray<OrderPlacedRecord>;
  /** Owner-authorised 2026-11-16 · demo-only. The real adapter will
   *  have this return `false` so the landing surfaces are identical
   *  with/without the demo flag. */
  readonly isDemo: boolean;
}
