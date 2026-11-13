// src/lib/nex-native/seo/exclude-routes.ts
//
// NEX SEO · central private-path exclusion list.
// Owner-sealed 2026-11-11 (SEO B1-B4 build).
// -----------------------------------------------------------------------------
// Any route under one of these prefixes is HARD-EXCLUDED from robots.txt
// (Disallow: for every user-agent · regardless of per-crawler policy) AND
// never emitted into the sitemap. Chat, attachments, orders, settings, HQ,
// Vault, admin and raw API are all private · they must not reach a search
// index under any circumstance.
//
// Add entries here, not scattered across robots.ts / sitemap.ts.

export const PRIVATE_PATH_PREFIXES: readonly string[] = [
  // ── Confirmed real routes under /nex-native/* that MUST stay private ──
  "/nex-native/admin",
  "/nex-native/call",
  "/nex-native/call-centre",
  "/nex-native/cart",
  "/nex-native/chat",
  "/nex-native/contacts",
  "/nex-native/create",
  "/nex-native/emergency-help",
  "/nex-native/free-chat/call",
  "/nex-native/friends",
  "/nex-native/group-chat",
  "/nex-native/home",
  "/nex-native/hq",
  "/nex-native/library",
  "/nex-native/live-commerce/studio",
  "/nex-native/manage",
  "/nex-native/orders",
  "/nex-native/profile/me",
  "/nex-native/profile/theme",
  "/nex-native/prototypes",
  "/nex-native/settings",
  "/nex-native/share",
  "/nex-native/sign-in",
  "/nex-native/support",
  "/nex-native/unsubscribe",
  "/nex-native/vault",
  // ── Alt route trees (private) ──
  "/nex-generated",
  // ── API + auth + defensive root wildcards (no route today but reserved) ──
  "/api",
  "/trpc",
  "/manage",
  "/hq",
  "/vault",
  "/chat",
  "/sign-in",
  "/sign-out",
  "/signup",
  "/auth",
  "/callback",
];

/** True when the given path starts with any sealed private prefix. The check
 *  is strict prefix matching (not substring) so /about-nex doesn't collide
 *  with /about. */
export function isPrivatePath(path: string): boolean {
  if (typeof path !== "string" || path.length === 0) return false;
  const normalised = path.startsWith("/") ? path : `/${path}`;
  for (const prefix of PRIVATE_PATH_PREFIXES) {
    if (normalised === prefix || normalised.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}
