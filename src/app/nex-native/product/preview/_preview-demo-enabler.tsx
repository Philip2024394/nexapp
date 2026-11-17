"use client";

// src/app/nex-native/product/preview/_preview-demo-enabler.tsx
//
// Owner-authorised 2026-11-16 · MOCK-ONLY.
// -----------------------------------------------------------------
// Flips the review-demo sessionStorage key on as soon as the preview
// route mounts, without touching the URL query. Reloads the page
// once (first visit only) so the layout's ReviewStoreProvider picks
// up the flag · subsequent navigations don't reload because the
// session key is already set.

import * as React from "react";
import {
  REVIEW_DEMO_SESSION_KEY,
  forcePreviewDemoFlag,
} from "@/lib/nex-native/reviews/demo-flag";
import { useReviewStoreContext } from "@/lib/nex-native/reviews/review-store-provider";

export function PreviewDemoEnabler(): null {
  const { isDemo } = useReviewStoreContext();
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let already = false;
    try {
      already = window.sessionStorage.getItem(REVIEW_DEMO_SESSION_KEY) === "1";
    } catch {
      // ignore
    }
    forcePreviewDemoFlag();
    // If the provider resolved to NOOP on first paint (flag wasn't
    // set yet), reload once so the provider re-initialises with the
    // mock store. Guarded by sessionStorage so we don't loop.
    if (!already && !isDemo) {
      window.location.reload();
    }
  }, [isDemo]);
  return null;
}
