"use client";

// src/app/nex-native/_public-route-prefetcher.tsx
//
// Phase A (persistent-shell performance) · owner-sealed 2026-11-11.
// -----------------------------------------------------------------
// Mounted once in the /nex-native/* persistent shell. On mount + on
// `requestIdleCallback`, warms the Next.js router cache for a small
// allowlisted set of public destinations so that when the user taps
// a link to one of them, `router.push` commits almost synchronously
// (no cold RSC round-trip).
//
// Deliberately narrow · see `public-route-allowlist.ts`. Private
// routes (chat, contacts, orders, settings, etc.) are NEVER touched
// here · they stay on cold-nav latency, which is the owner's chosen
// tradeoff.
//
// Idempotent across re-mounts · the shell only mounts once per
// session so this effectively fires once.

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { SHELL_WARM_PATHS } from "@/lib/nex-native/navigation/public-route-allowlist";
import { prefetchFull } from "@/lib/nex-native/navigation/prefetch-full";

type IdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;
type IdleHandle = number;
type IdleWindow = Window & {
  requestIdleCallback?: (cb: IdleCallback, opts?: { timeout?: number }) => IdleHandle;
  cancelIdleCallback?: (handle: IdleHandle) => void;
};

export function PublicRoutePrefetcher(): null {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const w = window as IdleWindow;
    const runPrefetches = (): void => {
      for (const path of SHELL_WARM_PATHS) {
        try {
          // kind: "full" so the hover-free route (user never
          // hovered first) still commits without a second fetch
          // on click. See prefetch-full.ts for rationale.
          prefetchFull(router, path);
        } catch {
          /* non-fatal · a failed prefetch just means that destination
             pays its cold-nav cost */
        }
      }
    };

    let handle: IdleHandle | number | null = null;
    if (typeof w.requestIdleCallback === "function") {
      handle = w.requestIdleCallback(runPrefetches, { timeout: 2000 });
    } else {
      // Older browsers · falls back to a short setTimeout so we don't
      // block the critical path.
      handle = window.setTimeout(runPrefetches, 600);
    }

    return () => {
      if (handle === null) return;
      if (typeof w.cancelIdleCallback === "function") {
        try { w.cancelIdleCallback(handle as IdleHandle); } catch { /* ignore */ }
      } else {
        try { window.clearTimeout(handle as number); } catch { /* ignore */ }
      }
    };
  }, [router]);

  return null;
}
