// src/lib/nex-native/navigation/public-route-allowlist.ts
//
// Phase A (persistent-shell performance) · owner-sealed 2026-11-11.
// -----------------------------------------------------------------
// Which /nex-native/* paths are safe to prefetch into the Next.js
// router cache?
//
// Owner directive: "Do not prefetch private chat content, contacts,
// orders, account sessions or other sensitive per-user data into a
// persistent or shared cache." The router cache is in-memory +
// session-scoped, but still a cache, so this module enforces a strict
// ALLOWLIST (default-deny) model:
//
//   · Public pages whose RSC payload does NOT embed per-user private
//     data MAY be prefetched. These are listed in PUBLIC_PREFIXES.
//   · Everything else — chat, contacts, orders, settings, cart,
//     manage, vault, home, free-chat, etc. — is NEVER prefetched.
//
// If a public page later grows per-user bits (e.g. a follow-state
// pill on /directory/[id]), revisit this allowlist. Err on the side
// of removing an entry rather than leaking cross-user state.
//
// IMPORTANT · router.prefetch is session-scoped to the browser tab
// that issued it; there is no cross-user leakage risk from the
// prefetch itself. The concern the allowlist addresses is subtler:
// we don't want a user's own private data (their chat list, their
// orders) pulled into the router cache ahead of click. If they tap
// a private link, pay the cold-nav cost · this is the owner's
// chosen tradeoff per 2026-11-11 Phase A directive.

/** Path prefixes that are safe to prefetch. Matched with
 *  `startsWith` · a trailing `/` on the prefix means "and everything
 *  below"; no slash means "exact match only". */
const PUBLIC_PREFIXES: Array<{ prefix: string; exact: boolean }> = [
  { prefix: "/nex-native/directory", exact: false },
  // Public business detail pages at /nex-native/[businessSlug] are
  // covered by a separate matcher below (dynamic top-level segment).
  { prefix: "/nex-native/pricing", exact: false },
  { prefix: "/nex-native/support", exact: false },
  { prefix: "/nex-native/help", exact: false },
  { prefix: "/nex-native/sign-in", exact: false },
  { prefix: "/nex-native/ireland-entry", exact: false },
  { prefix: "/nex-native/chat-themes-library", exact: false },
  { prefix: "/nex-native/cover-themes-library", exact: false },
  { prefix: "/nex-native/profile/", exact: false },
  // NOTE: /nex-native/profile/me is handled by the explicit block
  // below so it falls through even though /profile/ matches.
];

/** Paths that are explicitly PRIVATE even if a public prefix would
 *  otherwise match them. Order matters: block list wins over allow
 *  list. */
const PRIVATE_EXACT_OR_PREFIX: string[] = [
  "/nex-native/profile/me",
];

/** Returns true if the supplied path (origin-less, starts with "/")
 *  is safe to prefetch per the Phase A allowlist. */
export function isPublicPrefetchablePath(path: string): boolean {
  if (!path.startsWith("/nex-native/")) return false;

  for (const blocked of PRIVATE_EXACT_OR_PREFIX) {
    if (path === blocked || path.startsWith(blocked + "/")) {
      return false;
    }
  }

  for (const { prefix, exact } of PUBLIC_PREFIXES) {
    if (exact) {
      if (path === prefix) return true;
    } else {
      if (path === prefix || path.startsWith(prefix + "/")) return true;
    }
  }

  // Public business slug pages · /nex-native/<slug> where <slug> is
  // not a known reserved segment. Keep this list tight · any new
  // reserved top-level segment must be added here to prevent its
  // path from being prefetched.
  const RESERVED_TOP_SEGMENTS = new Set<string>([
    "admin",
    "api",
    "call",
    "call-centre",
    "cart",
    "chat",
    "chat-themes-library",
    "community",
    "contacts",
    "cover",
    "cover-themes-library",
    "create",
    "create-account",
    "directory",
    "emergency-help",
    "free-chat",
    "friends",
    "group-chat",
    "help",
    "home",
    "hq",
    "ireland-entry",
    "manage",
    "orders",
    "pricing",
    "profile",
    "prototypes",
    "search",
    "settings",
    "sign-in",
    "store",
    "support",
    "vault",
  ]);
  const parts = path.split("/").filter(Boolean); // ["nex-native", "<slug>", ...]
  if (parts.length === 2 && parts[0] === "nex-native") {
    const seg = parts[1];
    if (!RESERVED_TOP_SEGMENTS.has(seg)) {
      return true;
    }
  }

  return false;
}

/** The small set of public destinations the persistent shell should
 *  warm proactively on idle. Kept intentionally short · prefetching
 *  the whole public surface would waste bandwidth. */
export const SHELL_WARM_PATHS: readonly string[] = [
  "/nex-native/directory",
  "/nex-native/directory/landing",
];
