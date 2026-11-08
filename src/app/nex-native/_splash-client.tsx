"use client";

// src/app/nex-native/_splash-client.tsx
//
// NEX first-entry splash · client-side 3-second timer that routes the
// visitor to their destination. Owner-authorised 2026-11-08.
//
// The destination is resolved server-side in page.tsx (so a signed-in
// visitor goes to /contacts and a signed-out visitor goes to the theme
// picker). This component just holds the timer and uses router.replace
// so the splash itself is not in the back-button history.
//
// If JS is disabled, the <meta http-equiv="refresh"> tag in page.tsx
// provides a fallback at the same 3-second interval.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const SPLASH_MS = 3_000;

export default function SplashClient({
  destination,
}: {
  readonly destination: string;
}): null {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace(destination);
    }, SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, [destination, router]);
  return null;
}
