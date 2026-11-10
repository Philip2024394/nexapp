"use client";

// src/app/nex-native/_navigation-transitions-client.tsx
//
// Owner directive 2026-11-10 (chat-speed P3 · iter 2 · research pass):
// WhatsApp / iOS-style page transitions across every /nex-native/*
// route. Uses the native browser View Transitions API — zero extra
// bundle size — paired with CSS @keyframes in nex-native.css that
// replicate the iOS UINavigationController push+pop animations:
//
//   · Push: outgoing parallax-pushes 25 % left + darkens; incoming
//     slides in from the right with a soft left-edge shadow.
//   · Pop:  outgoing slides out to the right; incoming (older
//     route) eases from its parallax depth back to centre.
//
// Direction detection: forward <a> clicks are "push". `popstate`
// events (back button, keyboard back, Android system back, iOS
// swipe-back where supported) are "back" — we flip
// `document.documentElement.dataset.nexNavDir = "back"` BEFORE
// starting the transition so the CSS plays the pop animation. The
// attribute is cleared 400 ms later (just after the 320 ms animation
// finishes) so the next push doesn't inherit it.
//
// Safari swipe-back note (from research): Safari's native page
// swipe-back on iOS plays its own animation in native code BEFORE
// firing the popstate event. Running our CSS transition on top
// double-plays. We accept this trade-off for now — swipe-back is
// uncommon on in-app PWAs (standalone mode disables it) and we
// prefer a crisp back animation on all other surfaces (Android back
// button, in-app back button, keyboard back).
//
// Prefers-reduced-motion is handled in CSS (1 ms animations).
// Browsers without startViewTransition: no-op (jump-cut, unchanged).

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type StartViewTransitionFn = (
  callback: () => void | Promise<void>,
) => { finished: Promise<void> };

const NAV_DIR_ATTR = "nexNavDir";

function setNavDirection(dir: "back" | null): void {
  if (typeof document === "undefined") return;
  if (dir === null) {
    delete document.documentElement.dataset[NAV_DIR_ATTR];
  } else {
    document.documentElement.dataset[NAV_DIR_ATTR] = dir;
  }
}

function getStartViewTransition(): StartViewTransitionFn | null {
  if (typeof document === "undefined") return null;
  const fn = (document as unknown as {
    startViewTransition?: StartViewTransitionFn;
  }).startViewTransition;
  return typeof fn === "function" ? fn : null;
}

export function NexNavigationTransitions(): null {
  const router = useRouter();

  // ── Forward push: capture internal <a> clicks ────────────────────
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
      // Explicit forward direction. Clear any lingering "back" flag so
      // the CSS plays the push animation.
      setNavDirection(null);
      startViewTransition(() => {
        router.push(path + destUrl.search + destUrl.hash);
      });
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, [router]);

  // ── Back pop: INTENTIONALLY DISABLED ─────────────────────────────
  // The custom popstate → startViewTransition(router.refresh()) path
  // was removed 2026-11-10 (owner directive, verification pass).
  // Reason: Next.js has its own popstate handler that reconciles the
  // route tree. Our handler also fired router.refresh(), creating two
  // competing navigation updates and risking:
  //   · visible flicker on back navigation,
  //   · a race on the data-nex-nav-dir CSS attribute,
  //   · occasional stuck frames when multiple popstate events overlap.
  //
  // Owner directive: *"I would rather have a reliable Back button than
  // a beautiful animation that occasionally flickers."*
  //
  // The browser's native back now jump-cuts to the previous page. The
  // push animation on forward navigation is unchanged. Reduced-motion
  // still honoured. When the right-shaped primitive lands (likely the
  // Navigation API's `navigate` event with `event.intercept({handler})`
  // that returns a promise the browser can await for a VT wrapper), we
  // can restore the pop animation without competing with Next.js's
  // internal handler.

  return null;
}
