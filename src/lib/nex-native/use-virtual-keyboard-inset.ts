"use client";

// src/lib/nex-native/use-virtual-keyboard-inset.ts
//
// NEX · virtual-keyboard viewport inset hook · 2026-10-15.
// -----------------------------------------------------------------------------
// Returns the pixel height of the on-screen keyboard (or any other
// browser UI chrome) that is currently covering the bottom of the
// layout viewport. Zero when no keyboard is open or when the browser
// does not expose `window.visualViewport`.
//
// Why this exists
// ----------------
// Elements rendered with `position: fixed; bottom: 0` are pinned to
// the LAYOUT viewport bottom. On iOS Safari (and some Android
// browsers) the layout viewport does NOT change when the virtual
// keyboard opens · only the VISUAL viewport shrinks. A naive fixed-
// positioned composer therefore sits UNDER the keyboard and the
// user cannot see what they are typing. The affected surface in
// NEX is `src/app/nex-native/chat-standard/_universal-composer-
// footer.tsx` (sealed overlay bar).
//
// The sibling peer composer at `src/app/nex-native/chat/peer/
// [accountId]/_composer.tsx` is `position: relative` inside a
// `height: 100dvh` flex column (Portrait Bloom shell). `dvh` DOES
// shrink when the iOS keyboard opens on Safari 15.4+, so that
// composer stays visible automatically and does NOT need this hook.
//
// Progressive enhancement
// -----------------------
// When `window.visualViewport` is missing (older browsers · SSR)
// the hook returns 0 so callers behave exactly as they do today.
// This is intentional per the owner directive 2026-10-15 ("if
// visualViewport is unavailable, preserve existing behaviour").
//
// Correct inset formula
// ---------------------
// Keyboard inset = layoutHeight - (visualHeight + visualOffsetTop)
//   layoutHeight    = window.innerHeight (layout viewport height)
//   visualHeight    = visualViewport.height (visible pixels)
//   visualOffsetTop = visualViewport.offsetTop (zoom/pinch offset)
// This correctly accounts for the user pinch-zooming in Safari (which
// changes visualOffsetTop) so we don't lift the composer when the
// user is zooming into an image rather than opening the keyboard.
//
// Listeners are attached ONCE per hook instance and cleaned up on
// unmount. We subscribe to both `resize` (keyboard open/close) and
// `scroll` (visual viewport pan during pinch-zoom) because iOS fires
// both independently.

import { useEffect, useState } from "react";

/** Returns the pixel height of the on-screen keyboard currently
 *  covering the layout viewport, or 0 if no keyboard is open / the
 *  browser does not expose `window.visualViewport`. Values are
 *  always ≥ 0 and are rounded to the nearest integer pixel so React
 *  does not thrash the DOM on sub-pixel visual-viewport jitter. */
export function useVirtualKeyboardInset(): number {
  const [inset, setInset] = useState<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    let frame: number | null = null;

    const compute = () => {
      // Guard against sub-pixel rounding noise that would otherwise
      // trigger a React state update every frame while the user
      // scrolls. Round to the nearest integer and clamp to ≥ 0.
      const raw = window.innerHeight - vv.height - vv.offsetTop;
      const next = Math.max(0, Math.round(raw));
      setInset((prev) => (prev === next ? prev : next));
    };

    const scheduleCompute = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        compute();
      });
    };

    compute();
    vv.addEventListener("resize", scheduleCompute);
    vv.addEventListener("scroll", scheduleCompute);
    return () => {
      vv.removeEventListener("resize", scheduleCompute);
      vv.removeEventListener("scroll", scheduleCompute);
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return inset;
}
