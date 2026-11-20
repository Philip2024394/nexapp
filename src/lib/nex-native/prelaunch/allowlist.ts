// src/lib/nex-native/prelaunch/allowlist.ts
//
// NEX prelaunch · public-path allowlist (pure).
// Authored 2026-11-18 for the Nexcorner prelaunch landing.
//
// When `NEX_PRELAUNCH_MODE=true`, ONLY the paths matched here are
// publicly reachable without a founder session. Everything else must be
// redirected (pages) or 404'd (APIs) at the server boundary — see
// `src/middleware.ts`.
//
// Design rules:
//   · Exact-match list for single-URL paths (e.g. "/", "/robots.txt").
//   · Prefix list for path families (e.g. "/nexcorner/", "/_next/").
//     Prefixes compare WITH a trailing slash so "/nex-corner" does NOT
//     match "/nexcorner".
//   · API allowlist is deliberately SEPARATE — browser-public page
//     allowlisting does not grant API callability.
//   · This module is pure (no I/O, no imports from supabase-admin). It is
//     safe to import from Edge middleware.

const EXACT_PUBLIC_PATHS: ReadonlySet<string> = new Set([
  "/",
  "/nexcorner",
  "/nex-generated/buying-guides",
  "/nex-native/privacy",
  "/nex-native/terms",
  // 2026-11-19 · Prompt-7 round 2 · owner-stated access-policy.
  // Sign-in is the authorised re-entry path for the verified founder.
  // Authentication (password + session cookies) remains the gate
  // check; typing any email in a public form grants NO access.
  // Companion server-side guard in createNexAccountAction refuses
  // non-founder signups during prelaunch so this allowlist entry
  // cannot be abused to create accounts before launch.
  "/nex-native/sign-in",
  "/nex-native/sign-in/forgot",
  "/nex-native/sign-in/new-password",
  // 2026-11-19 · Prompt-7 round 3 · owner-authorised Google OAuth
  // wiring. The OAuth callback and the email-confirmation callback
  // are BOTH anonymous inbound hits (cookies not set yet or not
  // trusted yet). Middleware must let them through so the route
  // handlers can perform the actual gate (signOut + redirect for
  // non-founder Google identities; ?e=&m= banner on exchange error).
  // Treating these as "the authoritative gate point" matches the
  // callback's in-handler decideCallbackOutcome / verifyOtp flow.
  "/nex-native/auth/callback",
  "/nex-native/auth/confirm",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/nex-manifest.json",
  "/favicon.ico",
  "/apple-touch-icon.png",
  "/favicon-16.png",
  "/favicon-32.png",
]);

const PREFIX_PUBLIC_PATHS: readonly string[] = [
  "/nexcorner/",
  "/nex-generated/buying-guides/",
  "/_next/", // framework assets
  "/icons/", // PWA icons
];

const EXACT_PUBLIC_APIS: ReadonlySet<string> = new Set([
  "/api/nex-native/prelaunch/notify",
]);

/** True if the given pathname is a public PAGE under prelaunch mode. */
export function isPrelaunchPublicPath(pathname: string): boolean {
  if (typeof pathname !== "string" || pathname.length === 0) return false;
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (EXACT_PUBLIC_PATHS.has(p)) return true;
  for (const prefix of PREFIX_PUBLIC_PATHS) {
    if (p.startsWith(prefix)) return true;
  }
  return false;
}

/** True if the given pathname is a public API under prelaunch mode. */
export function isPrelaunchPublicApi(pathname: string): boolean {
  if (typeof pathname !== "string" || pathname.length === 0) return false;
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return EXACT_PUBLIC_APIS.has(p);
}

/** Snapshot for tests + doctrine docs. Never mutate at runtime. */
export function listPublicAllowlistSnapshot(): {
  exactPaths: readonly string[];
  prefixPaths: readonly string[];
  exactApis: readonly string[];
} {
  return {
    exactPaths: Array.from(EXACT_PUBLIC_PATHS),
    prefixPaths: PREFIX_PUBLIC_PATHS,
    exactApis: Array.from(EXACT_PUBLIC_APIS),
  };
}
