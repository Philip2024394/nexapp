"use client";

// src/app/nex-native/_splash-client.tsx
//
// NEX first-entry splash · hybrid behaviour.
//
// Owner directive 2026-11-09 · Emergency Help UX moved from drawer to
// splash. Behaviour now depends on the device-local activation flag:
//
//   · Activated user   → splash DOES NOT auto-divert · shows round
//                        HELP button top-right + Enter-NEX button
//                        bottom (both rendered by SplashEmergencyUI).
//   · Non-activated    → splash auto-diverts in 2 seconds to the
//                        server-resolved destination (unchanged
//                        behaviour since the original 3-second splash
//                        · interval tightened per owner directive).
//
// JS disabled fallback · the <meta http-equiv="refresh"> tag in
// page.tsx still fires at the same 2-second interval, so a no-JS
// visitor still auto-diverts. Activated users require JS + localStorage
// to be flagged · they'll get the meta refresh fallback too (expected
// since no-JS means no localStorage means no activation visible).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasActivatedEmergency } from "@/lib/nex-native/emergency/emergency-activation";
import { SplashEmergencyUI } from "./_splash-emergency-ui-client";

// Owner directive 2026-11-11 (later) · bumped from 2_000 (2s) to
// 5_000 (5s) alongside the new NEX Chat & Shop App Poster artwork.
// Must stay in sync with SPLASH_SECONDS in page.tsx so the JS timer
// and the <meta http-equiv="refresh"> no-JS fallback agree.
const SPLASH_MS = 5_000;

type ActivationState = "unknown" | "activated" | "not-activated";

export default function SplashClient({
  destination,
}: {
  readonly destination: string;
}): React.ReactElement | null {
  const router = useRouter();
  const [activation, setActivation] = useState<ActivationState>("unknown");

  useEffect(() => {
    // Read the activation flag once on mount. hasActivatedEmergency()
    // guards against SSR + missing localStorage already.
    const isActivated = hasActivatedEmergency();
    setActivation(isActivated ? "activated" : "not-activated");

    if (isActivated) {
      // Remove the no-JS meta refresh fallback so the splash sits on
      // screen until the user taps Enter NEX or Emergency HELP.
      try {
        document
          .querySelectorAll('meta[http-equiv="refresh"]')
          .forEach((el) => el.parentNode?.removeChild(el));
      } catch {
        /* silent · cosmetic fallback */
      }
      return undefined;
    }

    // Non-activated users · standard 2-second auto-divert.
    const timer = window.setTimeout(() => {
      router.replace(destination);
    }, SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, [destination, router]);

  if (activation === "activated") {
    return <SplashEmergencyUI destination={destination} />;
  }

  // "unknown" (pre-hydration) and "not-activated" render nothing extra
  // · the splash image + optional meta-refresh handle the UI.
  return null;
}
