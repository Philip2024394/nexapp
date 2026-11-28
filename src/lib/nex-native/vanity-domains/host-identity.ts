// src/lib/nex-native/vanity-domains/host-identity.ts
//
// Request-time helper that answers "is the current request being served
// on a vanity domain?" by reading the Host header via next/headers.
//
// Used by metadata routes (/sitemap.xml, /robots.txt) + any shop page
// that needs to emit host-aware canonical / OG URLs.
//
// Kept separate from map.ts so map.ts stays a pure module that can be
// unit-tested without next/* imports.

import { headers } from "next/headers";
import { findVanityByHost, type VanityDomainConfig } from "./map";

/** Resolve the vanity-domain config matching the current request's Host
 *  header, or null when the request is on a non-vanity host (nexcorner.com,
 *  nexapp-preview.*.workers.dev, localhost, etc.). */
export async function resolveVanityForCurrentRequest(): Promise<VanityDomainConfig | null> {
  try {
    const h = await headers();
    // Prefer x-forwarded-host (set by Cloudflare / proxies) and fall back
    // to the Host header. Either value is normalised inside findVanityByHost.
    const raw = h.get("x-forwarded-host") ?? h.get("host");
    return findVanityByHost(raw);
  } catch {
    // headers() throws if called outside a request scope (e.g. during
    // static generation that doesn't opt into dynamic). Treat as "not a
    // vanity request" so static artefacts fall back to the country base.
    return null;
  }
}

/** The public https origin for a vanity domain (apex, no trailing slash). */
export function vanityOrigin(config: VanityDomainConfig): string {
  return `https://${config.host}`;
}
