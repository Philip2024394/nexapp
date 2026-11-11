"use client";

// src/app/nex-native/_navigation-transitions-client.tsx
//
// Phase A (persistent-shell performance) · owner-sealed 2026-11-11.
// -----------------------------------------------------------------
// This replaces the iter-3 "warm-wait before slide" regression that
// manually fetched the destination RSC payload, hit Next.js's
// `Cache-Control: no-cache` wall, then let `router.push` re-fetch
// the same URL · a confirmed double-fetch.
//
// Phase A behaviour:
//
//   1. HOVER + TOUCHSTART prefetch · for PUBLIC-ALLOWLISTED routes
//      only (see `public-route-allowlist.ts`). Populates the Next.js
//      router cache so a subsequent click hits a warm destination
//      with zero additional network requests. Private routes (chat,
//      contacts, orders, settings, cart, etc.) are NEVER prefetched
//      per the owner's 2026-11-11 directive.
//
//   2. CLICK → IMMEDIATE SLIDE · the slide fires synchronously via
//      startViewTransition(router.push). No manual fetch. No warm-
//      wait. No second request. If the destination was prefetched
//      and is in the router cache, the slide reveals real content;
//      otherwise it reveals loading.tsx briefly while the RSC
//      streams in. Either way we never fetch the same URL twice.
//
//   3. SLOW-NETWORK FEEDBACK · if the transition is still in flight
//      after 1200 ms we flag `data-nex-nav-slow="true"` on <html>
//      so CSS can reveal a subtle progress indicator. The current
//      page stays interactive · no blocking overlay.
//
// E2E + auth posture preserved · Next.js's own prefetch uses the
// same session cookie as the eventual navigation, so every privacy
// gate, RLS rule and auth check fires identically.
//
// Related: the shell also mounts `<PublicRoutePrefetcher />` which
// proactively warms a tiny set of public destinations on idle so
// first-visit nav is also fast.

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { isPublicPrefetchablePath } from "@/lib/nex-native/navigation/public-route-allowlist";
import { prefetchFull } from "@/lib/nex-native/navigation/prefetch-full";
import {
  prepareDestination,
  waitForCachePrewarm,
} from "@/lib/nex-native/navigation/prepare-destination";

type StartViewTransitionFn = (
  callback: () => void | Promise<void>,
) => { finished: Promise<void> };

const NAV_DIR_ATTR = "nexNavDir";
const NAV_PENDING_ATTR = "nexNavPending";
const NAV_SLOW_ATTR = "nexNavSlow";
const SLOW_FEEDBACK_MS = 1200;

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

export function NexNavigationTransitions(): null {
  const router = useRouter();

  // ── Hover / touchstart prefetch · PUBLIC ALLOWLIST ONLY ────────
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

      // Normalise to a pathname · relative hrefs resolve against
      // location, absolute hrefs check origin.
      let path: string;
      try {
        const u = new URL(hrefAttr, window.location.href);
        if (u.origin !== window.location.origin) return;
        path = u.pathname;
      } catch {
        return;
      }

      // Owner-sealed 2026-11-11 · Phase A · public allowlist only.
      // Private routes (chat/contacts/orders/settings/cart/home/
      // free-chat/manage/vault/call/community/hq/etc.) are NEVER
      // prefetched · the user pays cold-nav latency for those by
      // design.
      if (!isPublicPrefetchablePath(path)) return;

      // Dedupe · a given pathname only needs one prefetch per mount.
      if (prefetched.has(path)) return;
      prefetched.add(path);
      try {
        // kind: "full" prefetches the full render (not just the
        // partial stub). Needed for dynamic routes (every
        // /nex-native/* page has `export const dynamic = "force-
        // dynamic"`) so router.push on click hits a fully warm
        // segment cache with zero additional fetches. Only
        // allowlisted public routes reach this line.
        prefetchFull(router, path);
      } catch {
        /* non-fatal · a failed prefetch just means cold nav for that
           destination */
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
      document.removeEventListener("touchstart", onTouchStart, true);
    };
  }, [router]);

  // ── Click handler · immediate slide, no warm-wait ──────────────
  useEffect(() => {
    if (typeof document === "undefined") return;
    const startViewTransition = getStartViewTransition();
    if (!startViewTransition) return;

    const onClick = (event: MouseEvent): void => {
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

      // Slow-feedback timer · flips `data-nex-nav-slow` after
      // SLOW_FEEDBACK_MS so CSS can reveal a subtle amber progress
      // bar. Owner directive 2026-11-11 (C24.C1 refinement) · the
      // prewarm phase now runs BEFORE the view transition, so the
      // OLD DOM is live during the wait and the CSS attached to
      // `.nex-native-frame::before` can render normally.
      const slowTimer = window.setTimeout(() => {
        document.documentElement.dataset[NAV_SLOW_ATTR] = "true";
      }, SLOW_FEEDBACK_MS);

      const clearProgressFeedback = (): void => {
        window.clearTimeout(slowTimer);
        delete document.documentElement.dataset[NAV_SLOW_ATTR];
      };

      // Cycle 24 Option B · owner-sealed 2026-11-11 · refined C24.C1.
      // PREWARM BEFORE VIEW TRANSITION.
      //
      // Phase 1 · warm the router cache while OLD page stays LIVE.
      //   `waitForCachePrewarm` fires router.prefetch(path, {kind:"full"})
      //   and awaits the destination's RSC payload via a one-shot
      //   window.fetch monitor. During this wait the browser has NOT
      //   entered a view transition, so the amber progress-bar CSS
      //   (bound to [data-nex-nav-slow] on <html>) renders normally
      //   if the user crosses SLOW_FEEDBACK_MS. User can still click
      //   around OLD page · the wait does not freeze the UI.
      //
      // Phase 2 · animate using the warm cache.
      //   startViewTransition's async callback calls router.push.
      //   Because the router cache is now warm, Next.js commits the
      //   destination tree without another RSC round-trip. The
      //   defence-in-depth `prepareDestination()` guards against a
      //   case where React's commit lands a microtask late · its
      //   MutationObserver resolves when the slide-root actually
      //   contains real content, so the browser's "new" snapshot
      //   captures real content, not a transient fallback.
      (async () => {
        // Phase 1 · prewarm (OLD live · amber bar renders if slow).
        await waitForCachePrewarm(
          (href) => prefetchFull(router, href),
          path + destUrl.search + destUrl.hash,
          { maxWaitMs: 1500 },
        );
        // Clear the slow-feedback attribute BEFORE entering the view
        // transition so the OLD snapshot does not capture the amber
        // bar · otherwise the bar would persist into the animation
        // and look wrong. The bar only communicates "we're waiting"
        // and that window is over.
        clearProgressFeedback();

        if (!startViewTransition) {
          router.push(path + destUrl.search + destUrl.hash);
          setPending(false);
          return;
        }

        // Phase 2 · animate from the warm cache.
        const transition = startViewTransition(async () => {
          router.push(path + destUrl.search + destUrl.hash);
          await prepareDestination({ maxWaitMs: 500 });
        });
        transition.finished
          .catch(() => { /* aborted transitions are fine */ })
          .finally(() => {
            setPending(false);
          });
      })().catch(() => {
        // Phase 1 threw · clear progress + reset pending so the user
        // isn't stranded. Fall back to a plain router.push.
        clearProgressFeedback();
        try {
          router.push(path + destUrl.search + destUrl.hash);
        } catch { /* ignore */ }
        setPending(false);
      });
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, [router]);

  // ── Back pop: INTENTIONALLY DISABLED ─────────────────────────────
  // Native browser back · reliable jump-cut · no custom animation.
  return null;
}
