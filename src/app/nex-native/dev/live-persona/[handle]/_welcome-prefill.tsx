"use client";

// src/app/nex-native/dev/live-persona/[handle]/_welcome-prefill.tsx
//
// Owner directive 2026-10-26 · "pressed Live and diverted to agreement
// page". The /nex-native/live-commerce/welcome agreement is gated by
// a localStorage flag (`nex-live-welcome-seen`). In dev-persona mode
// the broadcaster is a seeded mock persona so the agreement step is
// unnecessary · we pre-flip the flag inside this layout so Live
// routes land Hendra (or whichever persona) directly on the Live-
// surface instead of the welcome agreement.
//
// Pure client-side effect · no server impact.

import * as React from "react";
import { LIVE_WELCOME_STORAGE_KEY } from "@/lib/nex-native/live-broadcast/live-welcome-acceptance";

export function LiveWelcomePrefill(): null {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(LIVE_WELCOME_STORAGE_KEY) !== "1") {
        window.localStorage.setItem(LIVE_WELCOME_STORAGE_KEY, "1");
      }
    } catch {
      /* localStorage blocked · ignore */
    }
  }, []);
  return null;
}
