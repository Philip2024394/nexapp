"use client";

// src/app/nex-native/welcome/entering-free-chat/_splash-client.tsx
//
// NEX · Free Chat splash · client-side 2-second timer + forward.
// Owner-authorised 2026-10-21 (iteration 21).
// -----------------------------------------------------------------------------
// Mounts on the server-rendered splash page. The splash image is already
// painted by the parent server component · this client component only
// handles the 2-second timer, then pushes to the sealed standard chat
// preview at /nex-native/themes/nex-bubbles.
//
// Why client-side instead of a meta refresh: router.push preserves the
// Next.js router state so the destination hydrates cleanly without a
// full page reload. 2 seconds is short enough that an interrupted
// timer (page close, tab switch) is non-destructive.

import * as React from "react";
import { useRouter } from "next/navigation";

const DESTINATION = "/nex-native/themes/nex-bubbles";
const SPLASH_MS = 2000;

export function FreeChatSplashClient(): null {
  const router = useRouter();
  React.useEffect(() => {
    const id = window.setTimeout(() => {
      router.push(DESTINATION);
    }, SPLASH_MS);
    return () => window.clearTimeout(id);
  }, [router]);
  // No visible output · the server component paints the splash image.
  return null;
}
