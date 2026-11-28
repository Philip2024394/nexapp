// src/lib/nex-native/vanity-domains/rewrite-path.ts
//
// Pure function that decides what to do with a request on a
// vanity-domain host. Lives in isolation (no next/* imports) so
// it is trivially unit-testable and safe to run at the Edge.
//
// Decision taxonomy:
//
//   kind: "passthrough"   · host but not a path we want to remap ·
//                           let Next route normally (used for /api/*,
//                           /_next/*, /favicon*, already-internal
//                           /nex-native/* URLs, etc.)
//   kind: "www_redirect"  · host is www variant · emit a 308 to the
//                           apex with the same path + search. Owner
//                           §6: enforce canonical apex.
//   kind: "rewrite"       · internal rewrite · the browser URL does
//                           not change, Next renders the resolved
//                           NEX route. e.g. /our-story on
//                           xratedbelts.com → /nex-native/
//                           x-rated-tool-belts/our-story.
//
// IMPORTANT: rewrites only CHANGE the pathname. Query string and
// the user-visible URL are preserved.

import type { VanityDomainConfig } from "./map";

export type VanityRewriteAction =
  | { readonly kind: "passthrough" }
  | { readonly kind: "www_redirect"; readonly targetHost: string }
  | { readonly kind: "rewrite"; readonly internalPath: string };

/** Framework and app internals we must never rewrite. */
const RESERVED_EXACT: ReadonlySet<string> = new Set([
  "/sitemap.xml",
  "/robots.txt",
  "/manifest.webmanifest",
  "/favicon.ico",
]);

const RESERVED_PREFIXES: readonly string[] = [
  "/_next/",
  "/api/",
  "/favicon",
  "/opengraph-image",
  "/twitter-image",
];

/** Shop-level subpaths that live under /nex-native/<slug>/<sub>. Each
 *  entry MUST match the directory name of an existing shop subpage. */
const SHOP_SUBPATHS: readonly string[] = ["our-story", "chat", "wholesale"];

/** Top-level NEX surfaces that we expose under the vanity domain as-is,
 *  e.g. xratedbelts.com/product/123 → /nex-native/product/123. */
const NEX_ALIAS_PREFIXES: readonly string[] = [
  "product",
  "cart",
  "sign-in",
  "contacts",
  "chat-themes-library",
  "account",
];

function startsWithAnyPrefix(path: string, prefixes: readonly string[]): boolean {
  for (const p of prefixes) {
    if (path === p || path.startsWith(p)) return true;
  }
  return false;
}

function isReserved(path: string): boolean {
  if (RESERVED_EXACT.has(path)) return true;
  return startsWithAnyPrefix(path, RESERVED_PREFIXES);
}

/** Decide what the Edge should do with `pathname` on a vanity host. */
export function resolveVanityAction(
  pathname: string,
  config: VanityDomainConfig,
  isWww: boolean,
): VanityRewriteAction {
  // www → apex redirect takes precedence over EVERY other decision.
  if (isWww) {
    return { kind: "www_redirect", targetHost: config.host };
  }

  // Framework internals · never rewrite.
  if (isReserved(pathname)) return { kind: "passthrough" };

  // Already-internal NEX paths · pass through so existing <Link>s keep
  // working on the vanity domain. The shop renders correctly either
  // way; the browser URL keeps the /nex-native/<slug>/... shape until
  // a future polish pass rewrites outbound links too.
  if (pathname === "/nex-native" || pathname.startsWith("/nex-native/")) {
    return { kind: "passthrough" };
  }

  const shopHome = `/nex-native/${config.shopSlug}`;

  // Root → shop home.
  if (pathname === "/") {
    return { kind: "rewrite", internalPath: shopHome };
  }

  // Shop-level subpages · /our-story → /nex-native/<slug>/our-story,
  // keeping any deeper path (e.g. /our-story/anything) intact.
  for (const sub of SHOP_SUBPATHS) {
    if (pathname === `/${sub}` || pathname.startsWith(`/${sub}/`)) {
      return { kind: "rewrite", internalPath: `${shopHome}${pathname}` };
    }
  }

  // Top-level NEX surfaces aliased onto the vanity domain.
  for (const alias of NEX_ALIAS_PREFIXES) {
    if (pathname === `/${alias}` || pathname.startsWith(`/${alias}/`)) {
      return { kind: "rewrite", internalPath: `/nex-native${pathname}` };
    }
  }

  // Everything else · let Next render normally. Direct hits on
  // /directory, /nexcorner, etc. will render the platform page as
  // if the user had arrived on the canonical host. This is
  // deliberately permissive · tightening to "redirect anything
  // off-shop back to shop home" is a future polish decision.
  return { kind: "passthrough" };
}
