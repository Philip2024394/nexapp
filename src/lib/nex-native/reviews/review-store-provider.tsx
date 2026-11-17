"use client";

// src/lib/nex-native/reviews/review-store-provider.tsx
//
// NEX · Reviews demo · React context + hook.
// Owner-authorised 2026-11-16 · MOCK-ONLY checkpoint.
// -----------------------------------------------------------------
// Resolves which adapter to use based on the demo flag and exposes
// stable hooks so consuming UI never imports the mock directly.
// Phase 2 (NOT authorised) swaps `createMockReviewStore()` here for
// a REST-backed adapter · zero UI changes required.

import * as React from "react";
import type {
  OrderPlacedRecord,
  ProductReviewSummary,
  ReviewRecord,
  ReviewStoreAdapter,
} from "./types";
import {
  NOOP_REVIEW_STORE,
  createMockReviewStore,
  type MockReviewStore,
} from "./mock-review-store";
import { detectClientDemoFlag, initialDemoFlag } from "./demo-flag";

interface ReviewStoreContextValue {
  readonly adapter: ReviewStoreAdapter;
  readonly isDemo: boolean;
  /** Monotonic counter · bumps on every mock write so consumers can
   *  re-read without each needing its own subscription. */
  readonly version: number;
}

const ReviewStoreContext = React.createContext<ReviewStoreContextValue>({
  adapter: NOOP_REVIEW_STORE,
  isDemo: false,
  version: 0,
});

export function ReviewStoreProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  // Render-safe initial value · env-bake only (SSR friendly).
  const [isDemo, setIsDemo] = React.useState<boolean>(() => initialDemoFlag());
  const [version, setVersion] = React.useState(0);
  const storeRef = React.useRef<MockReviewStore | null>(null);

  // Client effect · promote to demo-on when query param / session
  // flag detected. Lazily instantiates the mock store.
  React.useEffect(() => {
    const on = detectClientDemoFlag();
    if (on) setIsDemo(true);
  }, []);

  React.useEffect(() => {
    if (!isDemo) return;
    if (!storeRef.current) {
      storeRef.current = createMockReviewStore();
    }
    const unsub = storeRef.current.subscribe(() => {
      setVersion((v) => v + 1);
    });
    // Nudge once so first paint after flip picks up the seeded state.
    setVersion((v) => v + 1);
    return unsub;
  }, [isDemo]);

  const value = React.useMemo<ReviewStoreContextValue>(() => {
    const adapter: ReviewStoreAdapter = isDemo
      ? storeRef.current ?? NOOP_REVIEW_STORE
      : NOOP_REVIEW_STORE;
    return { adapter, isDemo, version };
  }, [isDemo, version]);

  return (
    <ReviewStoreContext.Provider value={value}>
      {children}
    </ReviewStoreContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────

export function useReviewStoreContext(): ReviewStoreContextValue {
  return React.useContext(ReviewStoreContext);
}

export function useIsReviewDemoOn(): boolean {
  return React.useContext(ReviewStoreContext).isDemo;
}

export function useProductReviewSummary(
  productId: string,
): ProductReviewSummary {
  const { adapter, version } = React.useContext(ReviewStoreContext);
  return React.useMemo(
    () => adapter.summaryFor(productId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adapter, productId, version],
  );
}

export function useProductReviews(
  productId: string,
): ReadonlyArray<ReviewRecord> {
  const { adapter, version } = React.useContext(ReviewStoreContext);
  return React.useMemo(
    () => adapter.listForProduct(productId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adapter, productId, version],
  );
}

export function useMyReviewFor(productId: string): ReviewRecord | null {
  const { adapter, version } = React.useContext(ReviewStoreContext);
  return React.useMemo(
    () => adapter.myReviewFor(productId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adapter, productId, version],
  );
}

export function usePostReview(): (
  input: { productId: string; stars: number; body: string },
) => ReviewRecord | null {
  const { adapter } = React.useContext(ReviewStoreContext);
  return React.useCallback(
    (input) => {
      if (!adapter.isDemo) return null;
      return adapter.postOrUpdate(input);
    },
    [adapter],
  );
}

export function useMockOrders(): ReadonlyArray<OrderPlacedRecord> {
  const { adapter, version } = React.useContext(ReviewStoreContext);
  return React.useMemo(
    () => adapter.listMockOrders(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adapter, version],
  );
}
