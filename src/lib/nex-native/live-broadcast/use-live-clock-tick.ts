// src/lib/nex-native/live-broadcast/use-live-clock-tick.ts
//
// NEX Live S8 · Plan v4 · AC-4 + AC-5 + AC-7 + AC-11 + AC-12 + AC-13.
// -----------------------------------------------------------------------------
// Shared client-side countdown for every DB-heartbeat-derived LIVE chip.
//
// Contract
// --------
// Consumers pass the SERVER-COMPUTED relative TTL (`liveExpiresInMs`
// from `LivenessVerdict`). The hook returns `true` once the TTL has
// elapsed against a monotonic anchor; the consumer hides its chip.
//
// Server authority
// ----------------
// The hook never reads the client's wall clock (`Date.now()`,
// `new Date()`, `Date.parse(...)`). All elapsed-time arithmetic uses
// `performance.now()` so a user whose device clock is skewed cannot
// extend an authorised LIVE state. The server decided the TTL at
// render time; the client is a dumb timer.
//
// Timing origin (AC-5 corrected per owner's I-6 scrutiny 2026-10-25)
// -----------------------------------------------------------------------------
// Two realistic client contexts for a DB-heartbeat-derived chip:
//
//   1 · HARD navigation (initial document load, hard refresh).
//       Server computed TTL at `nowMs`, serialised, networked. The
//       browser records `navigation.responseEnd` at ~that server-
//       done moment (plus serialise + first-byte lag of ~30–170 ms).
//       Anchoring to `responseEnd` compresses mount-to-TTL drift to
//       just the parse + hydrate time (<<100 ms typical).
//
//   2 · SOFT navigation (Next.js RSC fetch) OR bfcache restoration.
//       `navigation.responseEnd` is the ORIGINAL hard-nav moment,
//       potentially minutes or hours ago. Using it as anchor would
//       falsely fail-close every chip. We instead anchor to
//       `performance.now()` at mount — honest for soft nav (new
//       data just arrived), honest for bfcache (the stale TTL from
//       before suspension correctly fails-closed when the hook ticks
//       after `pageshow`).
//
// Heuristic: if `now - responseEnd < NAV_FRESHNESS_BUDGET_MS` we
// treat the hard-nav anchor as fresh enough. Otherwise fall back
// to `performance.now()` at mount. The budget is set equal to the
// server's STALENESS_WINDOW_MS so a TTL that would have survived
// the hard-nav anchor is honoured; past that, any TTL would have
// expired anyway and the fallback is harmless.
//
// Fail-closed on unreliable timing (AC-5 + AC-13 reinforced
// 2026-10-25 per owner's post-review audit)
// -----------------------------------------------------------------------------
// When `performance` is absent, non-functional, or returns a
// non-finite / negative value, `pickLiveClockAnchorMs` returns `null`
// and the hook sets `expired = true` immediately. This is deliberate:
// the server already authorised a time-bounded LIVE claim; if we
// cannot measure elapsed time monotonically, we MUST hide the chip
// rather than extend the server's authorisation indefinitely. The
// alternative (anchor = 0 → elapsed stays small forever → chip
// visible forever) violated the fail-closed requirement.
//
// Exact expiry (no "wait for the next tick" drift)
// -----------------------------------------------------------------------------
// The hook schedules a dedicated `setTimeout` that fires AT the
// computed deadline, so a chip whose TTL falls between two 20 s
// ticks hides at the right moment · not at the next tick. The 20 s
// interval + `visibilitychange` + `pageshow` listeners are a
// defence-in-depth: when the browser throttles our `setTimeout`
// (hidden tab, mobile backgrounded, low-power), the deadline may
// fire late. On return to foreground these listeners re-evaluate
// immediately and set `expired = true` if the deadline has already
// passed. In the meantime, a backgrounded chip may display stale
// for the duration of the background period (irreducible under
// current browser timer policies).
//
// bfcache (back-forward cache)
// -----------------------------------------------------------------------------
// On restoration, Safari/Chrome fire `pageshow` with
// `event.persisted === true`. React does not re-run `useEffect`
// across bfcache, so the hook's existing timer resumes with
// `performance.now()` advanced by the suspension duration. Our
// handler re-evaluates on `pageshow`, so a restored chip that was
// live before suspension correctly fails-closed if the TTL has
// elapsed in the meantime.

"use client";

import * as React from "react";

/** Shared tick granularity · AC-4. 20 seconds is an in-foreground
 *  best-effort cadence; see AC-12 note above for honest bounds. The
 *  tick is a backup heartbeat; exact expiry is primarily driven by a
 *  dedicated `setTimeout` scheduled for the computed deadline. */
export const LIVE_CLOCK_TICK_MS = 20_000;

/** Hard-nav anchor freshness budget · see "Timing origin" above.
 *  Set to the server's STALENESS_WINDOW_MS so any TTL that would
 *  outlive the hard-nav anchor is correctly honoured; beyond that
 *  the anchor is treated as stale and we fall back to mount time. */
const NAV_FRESHNESS_BUDGET_MS = 90_000;

/** Resolve the monotonic anchor point in `performance.now()` units
 *  for the current mount. Returns `null` when a reliable timing
 *  origin cannot be established (fail-closed · the hook hides the
 *  chip rather than extending the server's authorised LIVE state).
 *  Pure · can be called once per mount. */
export function pickLiveClockAnchorMs(): number | null {
  if (typeof performance === "undefined") return null;
  if (typeof performance.now !== "function") return null;
  const now = performance.now();
  if (!Number.isFinite(now) || now < 0) return null;
  const entries =
    typeof performance.getEntriesByType === "function"
      ? performance.getEntriesByType("navigation")
      : [];
  const nav = entries[0] as PerformanceNavigationTiming | undefined;
  if (
    nav !== undefined &&
    typeof nav.responseEnd === "number" &&
    Number.isFinite(nav.responseEnd) &&
    nav.responseEnd > 0 &&
    now - nav.responseEnd < NAV_FRESHNESS_BUDGET_MS
  ) {
    return nav.responseEnd;
  }
  return now;
}

/** Return `true` once the TTL has elapsed relative to the mount
 *  anchor. Pass `Number.POSITIVE_INFINITY` (or any non-finite value)
 *  to opt out of decay for a legacy caller · the hook short-circuits
 *  without allocating a timer. */
export function useLiveClockTick(liveExpiresInMs: number): boolean {
  const [expired, setExpired] = React.useState(false);
  const anchorRef = React.useRef<number | null>(null);
  const expiryTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    // Non-finite TTL (Infinity / NaN) · legacy caller opts out of
    // decay. Skip timer allocation entirely.
    if (!Number.isFinite(liveExpiresInMs)) return;

    // AC-10 fail-safe (defence-in-depth) · server should never emit
    // a non-positive TTL alongside `isLive: true`, but if it does,
    // hide immediately.
    if (liveExpiresInMs <= 0) {
      setExpired(true);
      return;
    }

    // AC-5 reinforcement · fail-closed when timing APIs cannot
    // establish a reliable monotonic anchor. Hiding is safer than
    // extending the server-authorised window.
    const anchor = pickLiveClockAnchorMs();
    if (anchor === null) {
      setExpired(true);
      return;
    }
    anchorRef.current = anchor;

    // Resolve `performance.now()` safely · if it has disappeared
    // between the anchor pick and here (unlikely but defensive),
    // treat as unreliable → fail closed.
    const safeNow = (): number | null => {
      if (typeof performance === "undefined") return null;
      if (typeof performance.now !== "function") return null;
      const n = performance.now();
      if (!Number.isFinite(n) || n < 0) return null;
      return n;
    };

    const clearExpiryTimeout = () => {
      if (expiryTimeoutRef.current !== null) {
        window.clearTimeout(expiryTimeoutRef.current);
        expiryTimeoutRef.current = null;
      }
    };

    const evaluate = () => {
      const n = safeNow();
      if (n === null) {
        // Timing API went away mid-session · fail closed.
        setExpired(true);
        clearExpiryTimeout();
        return;
      }
      const currentAnchor = anchorRef.current;
      if (currentAnchor === null) {
        setExpired(true);
        clearExpiryTimeout();
        return;
      }
      const elapsed = n - currentAnchor;
      if (elapsed >= liveExpiresInMs) {
        setExpired(true);
        clearExpiryTimeout();
        return;
      }
      // Re-arm the dedicated expiry timeout against the current
      // remaining time. Clears any previously-scheduled timeout so
      // we never leak overlapping deadline timers.
      const remaining = liveExpiresInMs - elapsed;
      clearExpiryTimeout();
      expiryTimeoutRef.current = window.setTimeout(() => {
        setExpired(true);
        expiryTimeoutRef.current = null;
      }, remaining);
    };

    // Immediate evaluation on mount · AC-4 + exact-expiry.
    evaluate();

    // Shared 20 s tick · AC-4. Defence-in-depth backup heartbeat
    // against `setTimeout` throttling in hidden tabs. Not the primary
    // expiry trigger · that's the dedicated `setTimeout` above.
    const intervalId = window.setInterval(evaluate, LIVE_CLOCK_TICK_MS);

    const handleVisibility = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        evaluate();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // bfcache restoration · AC-5 corner case. `pageshow` fires on
    // every page display (initial + bfcache). We re-evaluate so a
    // long-paused tab that resumes with a stale TTL immediately
    // hides.
    const handlePageshow = () => {
      evaluate();
    };
    window.addEventListener("pageshow", handlePageshow);

    return () => {
      clearExpiryTimeout();
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", handlePageshow);
    };
  }, [liveExpiresInMs]);

  return expired;
}
