"use client";

// src/app/nex-native/_navigation-transitions-client.tsx
//
// Owner directive 2026-11-11 (Cycle 23 iter 3) · READY-BEFORE-SLIDE
// navigation. Previously the slide fired IMMEDIATELY on click and the
// destination's loading.tsx (skeleton) slid in from the right while
// the real content was still streaming. Owner wants the destination
// to be READY before the slide begins · so the user sees their real
// contacts list / real chat / real profile slide in, not a skeleton.
//
// Implementation:
//
// 1. Hover + touchstart PREFETCH · as soon as the user gestures
//    towards a link we fire `router.prefetch(href)` so most clicks
//    hit a warm Next.js router cache. Zero cost on already-prefetched
//    routes.
//
// 2. Click → WARM-WAIT → SLIDE · on click we:
//    a. preventDefault
//    b. mark the DOM `data-nex-nav-pending="true"` so the current
//       page can show subtle feedback (a thin amber progress line)
//       if the wait exceeds 1200 ms. Current page stays INTERACTIVE
//       — no blocking overlay.
//    c. fire a manual RSC fetch of the destination URL with Next.js's
//       sealed RSC + Next-Router-Prefetch headers. We await the
//       response body drain so the browser has the full payload in
//       its HTTP cache.
//    d. clear the pending flag.
//    e. fire startViewTransition(router.push). Because the browser
//       cache + Next.js router cache are now warm, router.push
//       commits almost synchronously · the "after" snapshot is the
//       real destination content, not the loading skeleton.
//
// 3. Safety · if the RSC fetch fails or takes > 4 seconds (user can
//    be on a terrible network), we abort the warm-wait and fire the
//    transition anyway with the streaming loading.tsx as destination
//    snapshot. Never leave the user staring at their old page
//    indefinitely.
//
// 4. E2E + auth posture preserved · the RSC fetch hits the SAME
//    server endpoint the full navigation would, so every privacy
//    gate, RLS rule, and auth check fires identically. We just
//    front-load the latency into the "current page still visible"
//    window instead of the "destination shell visible" window.

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type StartViewTransitionFn = (
  callback: () => void | Promise<void>,
) => { finished: Promise<void> };

const NAV_DIR_ATTR = "nexNavDir";
const NAV_PENDING_ATTR = "nexNavPending";
const NAV_SLOW_ATTR = "nexNavSlow";
const SLOW_FEEDBACK_MS = 1200;
const MAX_WARM_WAIT_MS = 4000;

function setNavDirection(dir: "back" | null): void {
  if (typeof document === "undefined") return;
  if (dir === null) {
    delete document.documentElement.dataset[NAV_DIR_ATTR];
  } else {
    document.documentElement.dataset[NAV_DIR_ATTR] = dir;
  }
}

function setPending(pending: boolean): void {
  if (typeof document === "undefined") return;
  if (pending) {
    document.documentElement.dataset[NAV_PENDING_ATTR] = "true";
  } else {
    delete document.documentElement.dataset[NAV_PENDING_ATTR];
    delete document.documentElement.dataset[NAV_SLOW_ATTR];
  }
}

function getStartViewTransition(): StartViewTransitionFn | null {
  if (typeof document === "undefined") return null;
  const fn = (
    document as unknown as {
      startViewTransition?: StartViewTransitionFn;
    }
  ).startViewTransition;
  return typeof fn === "function" ? fn.bind(document) : null;
}

/** Fire a manual RSC fetch of the destination URL so Next.js's router
 *  cache + the browser's HTTP cache are warm before we invoke
 *  router.push. Awaits body-drain so we know the full payload arrived.
 *  Caller is responsible for the slow-wait timeout. */
async function warmDestination(fullHref: string): Promise<void> {
  const url = new URL(fullHref, window.location.href);
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      RSC: "1",
      "Next-Router-Prefetch": "1",
    },
    credentials: "same-origin",
    cache: "default",
  });
  // Drain the body stream so the response is fully received before
  // we resolve. A non-drained stream looks "complete" to fetch but
  // the RSC payload may still be in-flight.
  if (response.body) {
    const reader = response.body.getReader();
    for (;;) {
      const { done } = await reader.read();
      if (done) break;
    }
  }
}

/** Wrap a promise with a hard timeout · resolves to `timeout` sentinel
 *  so callers can tell whether the warm fetch completed or we gave up. */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | "timeout"> {
  return new Promise((resolve) => {
    const t = window.setTimeout(() => resolve("timeout"), ms);
    promise
      .then((v) => {
        window.clearTimeout(t);
        resolve(v);
      })
      .catch(() => {
        window.clearTimeout(t);
        resolve("timeout");
      });
  });
}

export function NexNavigationTransitions(): null {
  const router = useRouter();

  // ── Hover / touchstart prefetch · warm the destination as early as
  //    possible so most clicks hit a cache. ──────────────────────────
  useEffect(() => {
    if (typeof document === "undefined") return;

    const prefetched = new Set<string>();
    const prefetchFromEvent = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      const hrefAttr = anchor.getAttribute("href");
      if (!hrefAttr) return;
      if (
        !hrefAttr.startsWith("/nex-native/") &&
        !hrefAttr.startsWith("/chat/")
      )
        return;
      if (prefetched.has(hrefAttr)) return;
      prefetched.add(hrefAttr);
      try {
        router.prefetch(hrefAttr);
      } catch {
        /* ignore · network transient */
      }
    };

    const onMouseEnter = (event: MouseEvent): void =>
      prefetchFromEvent(event);
    const onTouchStart = (event: TouchEvent): void =>
      prefetchFromEvent(event);

    // Use capture so we see events on link descendants (icons, text).
    document.addEventListener("mouseenter", onMouseEnter, true);
    document.addEventListener("touchstart", onTouchStart, {
      capture: true,
      passive: true,
    });
    return () => {
      document.removeEventListener("mouseenter", onMouseEnter, true);
      document.removeEventListener(
        "touchstart",
        onTouchStart,
        true,
      );
    };
  }, [router]);

  // ── Forward push · warm-wait before firing the slide ─────────────
  useEffect(() => {
    if (typeof document === "undefined") return;
    const startViewTransition = getStartViewTransition();
    if (!startViewTransition) return;

    const onClick = async (event: MouseEvent): Promise<void> => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor) return;

      const hrefAttr = anchor.getAttribute("href");
      if (!hrefAttr) return;
      if (anchor.hasAttribute("download")) return;
      const anchorTarget = anchor.getAttribute("target");
      if (anchorTarget && anchorTarget !== "_self") return;

      let destUrl: URL;
      try {
        destUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (destUrl.origin !== window.location.origin) return;
      if (destUrl.pathname === window.location.pathname) return;

      const path = destUrl.pathname;
      const isNexRoute =
        path.startsWith("/nex-native/") || path.startsWith("/chat/");
      if (!isNexRoute) return;

      event.preventDefault();
      setNavDirection(null);
      setPending(true);

      // Slow-feedback timer · flips data-nex-nav-slow after
      // SLOW_FEEDBACK_MS so CSS can reveal a subtle amber progress bar
      // at the top of the phone frame. Current page stays interactive.
      const slowTimer = window.setTimeout(() => {
        document.documentElement.dataset[NAV_SLOW_ATTR] = "true";
      }, SLOW_FEEDBACK_MS);

      // Warm the destination · await either the fetch or the max timeout.
      const warmResult = await withTimeout(
        warmDestination(path + destUrl.search + destUrl.hash),
        MAX_WARM_WAIT_MS,
      );
      void warmResult;

      window.clearTimeout(slowTimer);
      setPending(false);

      // Fire the transition · destination is now cached, the "after"
      // snapshot should capture real content, not the loading skeleton.
      startViewTransition(() => {
        router.push(path + destUrl.search + destUrl.hash);
      });
    };

    const onClickWrapper = (event: MouseEvent): void => {
      void onClick(event);
    };
    document.addEventListener("click", onClickWrapper, { capture: true });
    return () => {
      document.removeEventListener("click", onClickWrapper, {
        capture: true,
      });
    };
  }, [router]);

  // ── Back pop: INTENTIONALLY DISABLED ─────────────────────────────
  // Native browser back · reliable jump-cut · no custom animation.
  // See 2026-11-10 verification-pass note in earlier iterations.
  return null;
}
