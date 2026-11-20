"use client";

// src/lib/nex-native/translation/client/translation-logout-sweeper.tsx
//
// Defence-in-depth client component for translation-pilot logout
// cleanup. Owner-authorised 2026-11-17 continuation 3 · local only.
//
// Mount at the nex-native layout or a top-level client boundary. The
// component itself renders nothing · its single responsibility is to
// react to pathname changes that indicate auth loss (navigation to
// the sign-in / welcome routes) and run the translation cache sweep.
//
// This is a secondary path · the primary cleanup runs from the
// explicit logout form submit in `LogoutConfirmModal`. Having both
// means a sign-out driven through any other route (session expiry
// forcing a middleware redirect, manual URL navigation) still clears
// the in-memory translation cache so the next viewer never inherits
// the previous viewer's cached translations.
//
// NEVER touches encryption keys, vault state, or non-translation
// storage. Drops zero chat message content; sweeps only the
// translation layer's own cache + DOM nodes + broadcasts a scoped
// logout event per known account.

import * as React from "react";
import { usePathname } from "next/navigation";
import { runTranslationLogoutCleanup } from "./translation-logout-cleanup";

// Routes reached by a signed-out viewer. Hitting any of them is
// treated as a signal that the previous auth state is gone.
const SIGNED_OUT_PATHS: ReadonlyArray<string> = [
  "/nex-native/sign-in",
  "/nex-native/welcome",
];

function isSignedOutPath(p: string | null): boolean {
  if (!p) return false;
  for (const prefix of SIGNED_OUT_PATHS) {
    if (p === prefix || p.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

export function TranslationLogoutSweeper(): null {
  const pathname = usePathname();
  const prevPath = React.useRef<string | null>(null);

  React.useEffect(() => {
    const prev = prevPath.current;
    prevPath.current = pathname;
    if (prev === pathname) return;
    if (isSignedOutPath(pathname) && !isSignedOutPath(prev)) {
      // We crossed from an authenticated route into a signed-out
      // route · treat as logout. `accountId` is unknown here so the
      // cleanup falls back to iterating `nex.translation.prefs.v1.*`
      // keys for scoped broadcasts.
      runTranslationLogoutCleanup(null);
    }
  }, [pathname]);

  return null;
}
