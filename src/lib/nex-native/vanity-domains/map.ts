// src/lib/nex-native/vanity-domains/map.ts
//
// Owner directive 2026-11-28 · XRATEDBELTS.COM vanity-domain setup.
// -----------------------------------------------------------------
// Declarative table of shop-specific customer-facing domains that
// map to a single NEX shop slug. A request arriving on one of these
// hosts is rewritten at the edge (src/middleware.ts) so the
// customer sees `xratedbelts.com/` and the app renders the
// `/nex-native/x-rated-tool-belts` shop as if the customer had
// visited the shop under its canonical NEX path.
//
// The underlying Supabase project, accounts, products, chat, cart,
// RLS rules and E2E encryption are UNCHANGED · only the hostname
// → shop slug mapping lives here. Cookies are host-scoped per
// Supabase SSR defaults, so sessions on xratedbelts.com are
// isolated from nexcorner.com sessions at the COOKIE layer, but
// the ACCOUNT layer is the single shared NEX account system.
//
// Adding a new vanity domain is purely a config change here plus a
// Cloudflare Worker route and DNS at the registrar.

export interface VanityDomainConfig {
  /** Apex host · lowercase · no scheme · no port · no trailing dot. */
  readonly host: string;
  /** www variant that must 308-redirect to the apex. */
  readonly wwwHost: string;
  /** NEX shop slug this host maps to (nex_business.slug). */
  readonly shopSlug: string;
  /** Human-readable label used in diagnostics + canonical metadata. */
  readonly displayName: string;
}

export const VANITY_DOMAINS: readonly VanityDomainConfig[] = [
  {
    host: "xratedbelts.com",
    wwwHost: "www.xratedbelts.com",
    shopSlug: "x-rated-tool-belts",
    displayName: "X-Rated Tool Belts",
  },
];

/** Normalise an inbound Host header · strips port + lowercases.
 *  Returns null for null / empty / malformed inputs. */
export function normaliseHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) return null;
  // Strip port if present (e.g., "localhost:3008" → "localhost").
  const noPort = trimmed.split(":")[0];
  // Reject empty / wildcard / IPv6-bracket markers (best effort).
  if (noPort.length === 0 || noPort === "*") return null;
  return noPort;
}

/** Look up vanity config by Host header. Matches apex OR www variant. */
export function findVanityByHost(
  rawHost: string | null | undefined,
): VanityDomainConfig | null {
  const host = normaliseHost(rawHost);
  if (!host) return null;
  for (const v of VANITY_DOMAINS) {
    if (host === v.host || host === v.wwwHost) return v;
  }
  return null;
}

/** True when the given host is the www variant of the config. */
export function isWwwHost(
  rawHost: string | null | undefined,
  config: VanityDomainConfig,
): boolean {
  const host = normaliseHost(rawHost);
  return host === config.wwwHost;
}
