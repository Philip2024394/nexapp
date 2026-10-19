"use client";

// src/app/nex-native/cover-themes-library/_prefetch-cover-themes.tsx
//
// Preload the Cover Themes Library and every per-layout preview
// before the user clicks into them.
// -------------------------------------------------------------------
// Owner directive 2026-10-18 · "these shop themes must be loading
// once user has entered the nex app · world standards required".
//
// Approach · standard pattern:
//   · Fires on `requestIdleCallback` (or a short setTimeout fallback)
//     so the main thread stays free for first paint / interactivity.
//   · Appends <link rel="prefetch" href="…"> tags to document.head
//     for the library + each of the 10 /cover/preview/{layoutId}
//     routes. Browser schedules the fetches at low priority and
//     caches the responses at the HTTP layer.
//   · Runs ONCE per browser session (sessionStorage sentinel) so a
//     user navigating around nex-native doesn't re-queue 11 fetches
//     on every page view.
//   · Guarded against SSR, double-mount in Strict Mode, and absent
//     DOM APIs. Silently no-ops in environments without window /
//     requestIdleCallback.
//
// This component renders nothing. Mount once in the nex-native root
// layout so prefetch starts the moment a user opens any nex-native
// surface.

import * as React from "react";
import { COVER_LAYOUT_IDS } from "../cover/layout-ids";

const SESSION_SENTINEL = "nex:cover-themes-prefetched:v1";

export function PrefetchCoverThemes(): null {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.sessionStorage.getItem(SESSION_SENTINEL) === "1") return;
    } catch {
      // sessionStorage can throw in private-browsing · fall through,
      // the browser cache de-dupes identical prefetches anyway.
    }

    const urls = [
      "/nex-native/cover-themes-library",
      ...COVER_LAYOUT_IDS.map(
        (id) => `/nex-native/cover/preview/${id}?embed=1`,
      ),
    ];

    const schedule =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 400);

    const handle = schedule(() => {
      try {
        for (const href of urls) {
          const link = document.createElement("link");
          link.rel = "prefetch";
          link.href = href;
          // `as="document"` tells the browser these are top-level
          // HTML documents (iframes count as documents). Without
          // it some browsers warn about mismatched destinations.
          link.setAttribute("as", "document");
          document.head.appendChild(link);
        }
        try {
          window.sessionStorage.setItem(SESSION_SENTINEL, "1");
        } catch {
          /* ignore */
        }
      } catch {
        // Any DOM failure is non-fatal · we silently drop the hint.
      }
    });

    return () => {
      if (typeof window.cancelIdleCallback === "function") {
        try {
          window.cancelIdleCallback(handle as unknown as number);
        } catch {
          /* ignore */
        }
      } else {
        window.clearTimeout(handle as unknown as number);
      }
    };
  }, []);

  return null;
}
