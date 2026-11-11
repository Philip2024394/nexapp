// src/lib/nex-native/navigation/prepare-destination.ts
//
// Cycle 24 Option B · destination-readiness preparation layer.
// Owner-sealed 2026-11-11 · refined later same day (C24.C1) to the
// PREWARM-BEFORE-VT pattern.
// -----------------------------------------------------------------
// Problem we solve:
//   Phase A fired the View Transitions API synchronously on click and
//   the browser snapshotted the slide-root's live DOM moments later ·
//   on heavy cold routes React had committed only the Suspense fallback
//   by then, so the slide animated into an empty page.
//
// Earlier Option B (first iteration · deployed to owner for review):
//   put the readiness wait INSIDE the async View Transitions callback.
//   That proved DOM readiness but had a UX cost · while the async
//   callback awaited, the browser replaces the live DOM with a frozen
//   snapshot of OLD, so CSS inside `.nex-native-frame` (including the
//   amber `::before` progress bar bound to `data-nex-nav-slow`) was
//   captured in that frozen snapshot and could not show new state to
//   the user during the wait.
//
// Refined Option B (this file · owner directive 2026-11-11 · C24.C1):
//   do the full prewarm BEFORE entering the view transition. The
//   OLD DOM stays LIVE throughout the wait, so the amber progress bar
//   renders normally if the user is on a slow connection. Once the
//   destination's RSC payload has streamed into Next.js's router
//   cache, we clear the "slow" attribute and enter a short async VT
//   callback that just calls `router.push` + awaits the DOM commit.
//   The commit happens near-synchronously from the warm cache, so the
//   VT snapshot of NEW captures real content.
//
// Two helpers:
//
//   waitForCachePrewarm(router, path, opts)
//     Fires router.prefetch(path, {kind:"full"}) and awaits the
//     destination's RSC response via a one-shot window.fetch monitor.
//     Resolves when the RSC payload has fully streamed OR on timeout.
//     Called BEFORE startViewTransition so the OLD DOM is live and
//     the amber progress bar is free to render.
//
//   prepareDestination(opts)
//     MutationObserver on the slide root · defence in depth · called
//     INSIDE the async VT callback. Resolves when NEW content has
//     stabilised in the slide root. Catches any case where the warm
//     cache didn't produce a synchronous React commit.
//
// Fallback: if either helper's `maxWaitMs` elapses, it resolves
// "timeout" so the navigation always completes · the user is never
// stranded on OLD page.

export type PrepareResult = "ready" | "timeout" | "no-root";

export type PrewarmResult = "warm" | "timeout";

export type PrewarmOptions = {
  /** Hard cap · if the destination's RSC payload hasn't streamed in
   *  by this deadline we resolve "timeout" and let the slide fire
   *  anyway so the user isn't stuck on OLD page. Default 1500 ms. */
  readonly maxWaitMs?: number;
};

const PREWARM_DEFAULTS: Required<PrewarmOptions> = {
  maxWaitMs: 1500,
};

/** Fire a `kind: "full"` prefetch for the destination and await the
 *  arrival of its RSC payload. Called BEFORE the view transition so
 *  the OLD DOM remains live throughout the wait · CSS tied to
 *  `data-nex-nav-slow` (the amber progress bar) can render normally.
 *
 *  We detect completion by monkey-patching `window.fetch` for the
 *  duration of this call, watching for a fetch whose URL matches the
 *  destination pathname AND carries the Next.js RSC query marker
 *  (`?_rsc=` in the URL · production variant). When the response body
 *  has fully drained, we resolve "warm" and restore the original
 *  fetch.
 *
 *  Production verification against Vercel showed that a prior
 *  `router.prefetch(path, {kind:"full"})` leaves the subsequent
 *  `router.push(path)` with ZERO additional fetches · so after this
 *  helper resolves, the view transition's internal `router.push` will
 *  commit the destination tree from the warm cache without another
 *  network round-trip. */
export function waitForCachePrewarm(
  prefetchFn: (href: string) => void,
  path: string,
  opts: PrewarmOptions = {},
): Promise<PrewarmResult> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve("timeout");
  }
  const o = { ...PREWARM_DEFAULTS, ...opts };

  const origFetch = window.fetch.bind(window);

  return new Promise<PrewarmResult>((resolve) => {
    let settled = false;
    let timeoutHandle: number | null = null;

    const finish = (result: PrewarmResult): void => {
      if (settled) return;
      settled = true;
      if (timeoutHandle !== null) window.clearTimeout(timeoutHandle);
      try {
        window.fetch = origFetch;
      } catch { /* ignore · page unloading */ }
      resolve(result);
    };

    timeoutHandle = window.setTimeout(() => {
      finish("timeout");
    }, o.maxWaitMs);

    // Install the monitor BEFORE calling prefetch so we don't miss a
    // fetch that lands synchronously on the next microtask.
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      let pathname: string | null = null;
      try {
        pathname = new URL(url, window.location.href).pathname;
      } catch { /* ignore */ }
      const matches = pathname === path && url.includes("_rsc=");
      if (!matches) {
        return origFetch(input, init);
      }
      return origFetch(input, init).then(async (res) => {
        try {
          const body = res.clone().body;
          if (body) {
            const reader = body.getReader();
            for (;;) {
              const { done } = await reader.read();
              if (done) break;
            }
          }
        } catch { /* ignore · drain best-effort */ }
        finish("warm");
        return res;
      });
    }) as typeof window.fetch;

    // Kick off the prefetch · this triggers Next.js to fire its own
    // RSC request through our patched fetch.
    try {
      prefetchFn(path);
    } catch {
      finish("timeout");
    }
  });
}

export type PrepareOptions = {
  /** Soft threshold · earliest we can resolve "ready". Prevents
   *  resolving on a transient empty mutation that happens as React
   *  clears the old tree before mounting the new one. Default 50 ms. */
  readonly minWaitMs?: number;
  /** Hard cap · if the destination hasn't committed real content by
   *  this deadline we resolve "timeout" so the slide still fires.
   *  Default 1500 ms — matches the owner's accepted latency budget. */
  readonly maxWaitMs?: number;
  /** Minimum innerHTML.length under the slide root to count as "real
   *  content". Must be larger than a bare SilentLoading panel (which
   *  is ~160 chars) and larger than a transient empty state (0 chars).
   *  Default 500 — generous enough to clear both. */
  readonly minReadyChars?: number;
  /** Stability window · after detecting a "ready" state we re-check
   *  after this many ms. If the content vanished again (destination
   *  page is in a re-render loop or React cleared the tree) we go
   *  back to observing. Default 60 ms — long enough to survive a
   *  single Suspense fallback/flush, short enough to not add visible
   *  latency on stable routes. */
  readonly stabilityMs?: number;
};

const DEFAULTS: Required<PrepareOptions> = {
  minWaitMs: 50,
  maxWaitMs: 1500,
  minReadyChars: 500,
  stabilityMs: 60,
};

/** Sentinel attribute: any destination page that wants to signal
 *  "I am ready" ahead of hitting the character threshold can set
 *  `data-nex-page-ready="true"` on any descendant of the slide root.
 *  Not required · useful for pages whose first paint is small but
 *  meaningful (e.g. a settled 3-item list). */
const READY_SENTINEL = "[data-nex-page-ready]";

/** Wait for the destination to commit real content into the slide
 *  root. Must be called from within a browser context (not SSR). */
export function prepareDestination(
  opts: PrepareOptions = {},
): Promise<PrepareResult> {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return Promise.resolve("no-root");
  }
  const o = { ...DEFAULTS, ...opts };
  const root = document.querySelector<HTMLElement>(
    "[data-nex-page-slide-root]",
  );
  if (!root) return Promise.resolve("no-root");

  const startedAt = performance.now();

  return new Promise<PrepareResult>((resolve) => {
    let settled = false;
    let observer: MutationObserver | null = null;
    // Only count the DOM as "ready" after we've seen at least one
    // mutation. Without this, the eager check would resolve on the
    // OLD page's current content if it already passes the readiness
    // criteria. Owner directive 2026-11-11: do not mistake stale
    // content for the new destination.
    let mutationSeen = false;

    const finish = (result: PrepareResult): void => {
      if (settled) return;
      settled = true;
      if (observer) observer.disconnect();
      window.clearTimeout(timeoutHandle);
      if (stabilityTimer !== null) window.clearTimeout(stabilityTimer);
      resolve(result);
    };

    const isReadyNow = (): boolean => {
      if (root.querySelector(READY_SENTINEL)) return true;
      const chars = root.innerHTML.length;
      return chars >= o.minReadyChars;
    };

    let stabilityTimer: number | null = null;

    const cancelPendingStability = (): void => {
      if (stabilityTimer !== null) {
        window.clearTimeout(stabilityTimer);
        stabilityTimer = null;
      }
    };

    const check = (): boolean => {
      const now = performance.now();
      const elapsed = now - startedAt;
      if (elapsed < o.minWaitMs) return false;
      // Must have seen at least one mutation. The OLD page may
      // already pass the readiness criteria at the moment we install
      // the observer; without this guard we would resolve on the
      // OLD page's own live DOM.
      if (!mutationSeen) return false;
      if (!isReadyNow()) {
        // Lost the ready state (destination re-render loop) · cancel
        // any pending stability confirmation.
        cancelPendingStability();
        return false;
      }
      // We saw a "ready" moment. Confirm it stays ready for
      // `stabilityMs` before resolving · guards against a transient
      // flash that React will clear in the next microtask.
      if (stabilityTimer !== null) return false;
      stabilityTimer = window.setTimeout(() => {
        stabilityTimer = null;
        if (isReadyNow()) {
          finish("ready");
        }
        // Otherwise: observer will call check() again when a new
        // mutation lands and we'll re-arm the stability timer.
      }, o.stabilityMs);
      return false;
    };

    // Set up the hard timeout first so it's always armed.
    const timeoutHandle = window.setTimeout(() => {
      finish("timeout");
    }, o.maxWaitMs);

    // Set up the MutationObserver.
    observer = new MutationObserver(() => {
      mutationSeen = true;
      check();
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: false,
    });

    // No eager check · without a mutation we cannot distinguish OLD
    // from NEW content. Even on a warm-cache hit, router.push will
    // trigger React to replace the slide-root's children, which is
    // a mutation the observer will catch.
  });
}
