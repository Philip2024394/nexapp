// src/lib/nex-native/reviews/mock-review-store.ts
//
// NEX · Reviews demo · mock adapter.
// Owner-authorised 2026-11-16 · MOCK-ONLY checkpoint.
// -----------------------------------------------------------------
// In-memory store with a localStorage shadow so the owner can:
//   · open /nex-native/product/preview
//   · tap the stars → see seeded reviews
//   · post their own → see it immediately in the drawer + product
//   · reload the page → review is still there
//
// No DB writes · no network calls · no migration. The store is
// seeded on first load with a small reviewer pool so the average
// has meaningful variance.

import type {
  OrderPlacedItem,
  OrderPlacedRecord,
  PostReviewInput,
  ProductReviewSummary,
  ReviewRecord,
  ReviewStoreAdapter,
} from "./types";

const STORAGE_KEY = "nex.reviewDemo.store.v1";
const ME_ID_KEY = "nex.reviewDemo.meId";

// ─── Mock product thumbnails ──────────────────────────────────────
//
// Inline SVGs so the three mock carts render instantly without any
// external CDN or seeded DB row. The product IDs below are static
// UUIDs that are NOT present in `nex_product` · tapping through to
// `/nex-native/product/<id>` will still 404 on the real route · the
// drawer demo is isolated to the drawer itself.

function mockThumbSvg(label: string, body: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><rect width="120" height="120" fill="${body}"/><text x="60" y="68" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="800" fill="#f8efdc">${label}</text></svg>`;
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(svg, "utf8").toString("base64")
      : btoa(svg);
  return `data:image/svg+xml;base64,${b64}`;
}

// ─── Mock product catalog ─────────────────────────────────────────

interface MockProduct {
  readonly id: string;
  readonly name: string;
  readonly thumb: string;
  readonly pricePence: number;
}

const MOCK_PRODUCT_P1: MockProduct = {
  id: "00000000-0000-4000-8000-00000000d001",
  name: "Premium Leather Phone Cover",
  thumb: mockThumbSvg("TAN", "#b58a52"),
  pricePence: 4999,
};

const MOCK_PRODUCT_P2: MockProduct = {
  id: "00000000-0000-4000-8000-00000000d002",
  name: "Handwoven Rattan Basket",
  thumb: mockThumbSvg("RATTAN", "#9c7a3f"),
  pricePence: 2999,
};

const MOCK_PRODUCT_P3: MockProduct = {
  id: "00000000-0000-4000-8000-00000000d003",
  name: "Ceramic Pour-Over Mug",
  thumb: mockThumbSvg("MUG", "#4e6b78"),
  pricePence: 1899,
};

const MOCK_PRODUCT_P4: MockProduct = {
  id: "00000000-0000-4000-8000-00000000d004",
  name: "Linen Table Runner",
  thumb: mockThumbSvg("LINEN", "#b8a380"),
  pricePence: 3499,
};

const MOCK_PRODUCT_P5: MockProduct = {
  id: "00000000-0000-4000-8000-00000000d005",
  name: "Brass Candle Snuffer",
  thumb: mockThumbSvg("BRASS", "#7a5c2b"),
  pricePence: 1299,
};

const MOCK_PRODUCT_P6: MockProduct = {
  id: "00000000-0000-4000-8000-00000000d006",
  name: "Hand-poured Soy Candle",
  thumb: mockThumbSvg("SOY", "#d4a85d"),
  pricePence: 1999,
};

const MOCK_PRODUCT_P7: MockProduct = {
  id: "00000000-0000-4000-8000-00000000d007",
  name: "Cork Coaster Set (4)",
  thumb: mockThumbSvg("CORK", "#a07348"),
  pricePence: 1499,
};

// Owner-authorised 2026-11-16 · PRODUCT_P1 is the id the preview
// route uses, so the review list on `/nex-native/product/preview`
// stays in sync with the drawer rows. Preview page passes this
// same id to the client.
export const REVIEW_DEMO_PREVIEW_PRODUCT_ID = MOCK_PRODUCT_P1.id;

const MOCK_PRODUCTS: ReadonlyArray<MockProduct> = [
  MOCK_PRODUCT_P1,
  MOCK_PRODUCT_P2,
  MOCK_PRODUCT_P3,
  MOCK_PRODUCT_P4,
  MOCK_PRODUCT_P5,
  MOCK_PRODUCT_P6,
  MOCK_PRODUCT_P7,
];

function findProduct(id: string): MockProduct | null {
  return MOCK_PRODUCTS.find((p) => p.id === id) ?? null;
}

// ─── Seed reviewers + reviews ─────────────────────────────────────

interface SeedReview {
  readonly productId: string;
  readonly authorId: string;
  readonly authorHandle: string;
  readonly stars: number;
  readonly body: string;
  readonly minutesAgo: number;
}

const SEED_REVIEWS: ReadonlyArray<SeedReview> = [
  {
    productId: MOCK_PRODUCT_P1.id,
    authorId: "reviewer-1",
    authorHandle: "Aoife L.",
    stars: 5,
    body: "Beautiful stitching, fits perfectly. Smells like a proper leather shop.",
    minutesAgo: 60 * 24 * 3,
  },
  {
    productId: MOCK_PRODUCT_P1.id,
    authorId: "reviewer-2",
    authorHandle: "Rónán",
    stars: 5,
    body: "Noticeably better than the generic covers. Worth it.",
    minutesAgo: 60 * 24 * 10,
  },
  {
    productId: MOCK_PRODUCT_P1.id,
    authorId: "reviewer-3",
    authorHandle: "Cillian",
    stars: 4,
    body: "Great feel in the hand. One stitch loose on arrival but seller sorted it.",
    minutesAgo: 60 * 24 * 17,
  },
  {
    productId: MOCK_PRODUCT_P1.id,
    authorId: "reviewer-4",
    authorHandle: "Eoin",
    stars: 5,
    body: "Camera cutout is spot on.",
    minutesAgo: 60 * 24 * 22,
  },
  {
    productId: MOCK_PRODUCT_P2.id,
    authorId: "reviewer-5",
    authorHandle: "Niamh",
    stars: 4,
    body: "Lovely weave. Slightly smaller than expected.",
    minutesAgo: 60 * 24 * 6,
  },
  {
    productId: MOCK_PRODUCT_P3.id,
    authorId: "reviewer-6",
    authorHandle: "Saoirse",
    stars: 5,
    body: "Pours cleanly, no drips.",
    minutesAgo: 60 * 24 * 2,
  },
  {
    productId: MOCK_PRODUCT_P4.id,
    authorId: "reviewer-7",
    authorHandle: "Fionn",
    stars: 4,
    body: "Beautiful on the table.",
    minutesAgo: 60 * 24 * 12,
  },
];

// ─── Mock orders ──────────────────────────────────────────────────

const MOCK_ORDERS: ReadonlyArray<OrderPlacedRecord> = [
  {
    id: "order-demo-1",
    shopName: "NEX Leatherwork",
    placedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    currency: "EUR",
    items: [
      {
        productId: MOCK_PRODUCT_P1.id,
        name: MOCK_PRODUCT_P1.name,
        thumbnailUrl: MOCK_PRODUCT_P1.thumb,
        qty: 1,
        pricePence: MOCK_PRODUCT_P1.pricePence,
      },
    ],
  },
  {
    id: "order-demo-2",
    shopName: "Treaty Home",
    placedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    currency: "EUR",
    items: [
      {
        productId: MOCK_PRODUCT_P2.id,
        name: MOCK_PRODUCT_P2.name,
        thumbnailUrl: MOCK_PRODUCT_P2.thumb,
        qty: 1,
        pricePence: MOCK_PRODUCT_P2.pricePence,
      },
      {
        productId: MOCK_PRODUCT_P3.id,
        name: MOCK_PRODUCT_P3.name,
        thumbnailUrl: MOCK_PRODUCT_P3.thumb,
        qty: 2,
        pricePence: MOCK_PRODUCT_P3.pricePence,
      },
      {
        productId: MOCK_PRODUCT_P4.id,
        name: MOCK_PRODUCT_P4.name,
        thumbnailUrl: MOCK_PRODUCT_P4.thumb,
        qty: 1,
        pricePence: MOCK_PRODUCT_P4.pricePence,
      },
    ],
  },
  {
    id: "order-demo-3",
    shopName: "Cork Candle Co.",
    placedAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    currency: "EUR",
    items: [
      {
        productId: MOCK_PRODUCT_P5.id,
        name: MOCK_PRODUCT_P5.name,
        thumbnailUrl: MOCK_PRODUCT_P5.thumb,
        qty: 1,
        pricePence: MOCK_PRODUCT_P5.pricePence,
      },
      {
        productId: MOCK_PRODUCT_P6.id,
        name: MOCK_PRODUCT_P6.name,
        thumbnailUrl: MOCK_PRODUCT_P6.thumb,
        qty: 3,
        pricePence: MOCK_PRODUCT_P6.pricePence,
      },
      {
        productId: MOCK_PRODUCT_P7.id,
        name: MOCK_PRODUCT_P7.name,
        thumbnailUrl: MOCK_PRODUCT_P7.thumb,
        qty: 2,
        pricePence: MOCK_PRODUCT_P7.pricePence,
      },
      {
        productId: MOCK_PRODUCT_P2.id,
        name: MOCK_PRODUCT_P2.name,
        thumbnailUrl: MOCK_PRODUCT_P2.thumb,
        qty: 1,
        pricePence: MOCK_PRODUCT_P2.pricePence,
      },
      {
        productId: MOCK_PRODUCT_P3.id,
        name: MOCK_PRODUCT_P3.name,
        thumbnailUrl: MOCK_PRODUCT_P3.thumb,
        qty: 1,
        pricePence: MOCK_PRODUCT_P3.pricePence,
      },
      {
        productId: MOCK_PRODUCT_P4.id,
        name: MOCK_PRODUCT_P4.name,
        thumbnailUrl: MOCK_PRODUCT_P4.thumb,
        qty: 1,
        pricePence: MOCK_PRODUCT_P4.pricePence,
      },
    ],
  },
];

// ─── Store implementation ─────────────────────────────────────────

interface StoreState {
  reviews: ReviewRecord[];
}

function loadState(): StoreState {
  if (typeof window === "undefined") return { reviews: seedReviews() };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded: StoreState = { reviews: seedReviews() };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as StoreState;
    // Guard against shape drift.
    if (!parsed || !Array.isArray(parsed.reviews)) {
      return { reviews: seedReviews() };
    }
    return parsed;
  } catch {
    return { reviews: seedReviews() };
  }
}

function saveState(state: StoreState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage disabled · skip.
  }
}

function seedReviews(): ReviewRecord[] {
  const now = Date.now();
  return SEED_REVIEWS.map((s, i) => ({
    id: `seed-${i + 1}`,
    productId: s.productId,
    authorId: s.authorId,
    authorHandle: s.authorHandle,
    stars: s.stars,
    body: s.body,
    createdAt: new Date(now - s.minutesAgo * 60 * 1000).toISOString(),
  }));
}

function getOrCreateMeId(): string {
  if (typeof window === "undefined") return "me-ssr";
  try {
    const existing = window.localStorage.getItem(ME_ID_KEY);
    if (existing) return existing;
    const fresh = `me-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(ME_ID_KEY, fresh);
    return fresh;
  } catch {
    return "me-local";
  }
}

export interface MockReviewStore extends ReviewStoreAdapter {
  /** Subscribe to change notifications. Returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void;
  /** Convenience · the current viewer's opaque id. */
  myId(): string;
}

export function createMockReviewStore(): MockReviewStore {
  let state: StoreState = loadState();
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const l of listeners) l();
  }

  function emit(next: StoreState): void {
    state = next;
    saveState(state);
    notify();
  }

  return {
    isDemo: true,
    myId: () => getOrCreateMeId(),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    listForProduct(productId) {
      return state.reviews
        .filter((r) => r.productId === productId)
        .slice()
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    },
    summaryFor(productId) {
      const rows = state.reviews.filter((r) => r.productId === productId);
      if (rows.length === 0) {
        return { productId, count: 0, averageScore: 0 };
      }
      const total = rows.reduce((acc, r) => acc + r.stars, 0);
      return {
        productId,
        count: rows.length,
        averageScore: total / rows.length,
      };
    },
    myReviewFor(productId) {
      const me = getOrCreateMeId();
      return (
        state.reviews.find(
          (r) => r.productId === productId && r.authorId === me,
        ) ?? null
      );
    },
    postOrUpdate(input) {
      const me = getOrCreateMeId();
      const stars = Math.max(1, Math.min(5, Math.round(input.stars)));
      const body = input.body.slice(0, 500);
      const existingIdx = state.reviews.findIndex(
        (r) => r.productId === input.productId && r.authorId === me,
      );
      const now = new Date().toISOString();
      const next: ReviewRecord =
        existingIdx >= 0
          ? {
              ...state.reviews[existingIdx]!,
              stars,
              body,
              createdAt: now,
            }
          : {
              id: `mine-${Math.random().toString(36).slice(2, 10)}`,
              productId: input.productId,
              authorId: me,
              authorHandle: "You",
              stars,
              body,
              createdAt: now,
            };
      const reviews =
        existingIdx >= 0
          ? state.reviews.map((r, i) => (i === existingIdx ? next : r))
          : [...state.reviews, next];
      emit({ reviews });
      return next;
    },
    listMockOrders() {
      return MOCK_ORDERS;
    },
  };
}

/** Sealed no-op adapter · returned when the demo flag is off so no
 *  mock content ever reaches a real user. UI treats a zero-count
 *  summary + an empty list the same way it treats an unwired rating
 *  prop (star row hidden). */
export const NOOP_REVIEW_STORE: ReviewStoreAdapter = {
  isDemo: false,
  listForProduct: () => [],
  summaryFor: (productId) => ({ productId, count: 0, averageScore: 0 }),
  myReviewFor: () => null,
  postOrUpdate: () => {
    throw new Error("Review store disabled · demo flag is off.");
  },
  listMockOrders: () => [],
};

export { findProduct as _findMockProduct };
export type { MockProduct };
