// src/lib/nex-native/seo/site-url-resolver.ts
//
// NEX SEO · public site URL resolver.
// Owner-authorised 2026-11-11 (SEO B1-B4 build).
// -----------------------------------------------------------------------------
// Single source of truth for the public base URL that feeds:
//   - metadataBase on the root nex-native layout
//   - canonical URLs
//   - sitemap.xml entries
//   - Open Graph image absolute URLs
//   - JSON-LD `url` fields
//
// Reads country from the existing NEX_APP_IDENTITY / NEX_APP_COUNTRY env
// pattern (same one used by _world-stylesheet.tsx + health route).
//
// Production rules (sealed · B1 safeguards):
//   1. Must be a valid absolute HTTPS URL.
//   2. Must have the country-specific env var set.
//   3. Must NOT resolve to localhost · throws instead of emitting.
//   4. Any emitter that could surface a URL must route it through
//      assertProdSafeUrl() so an accidental localhost leak throws in prod.
//
// Dev rules:
//   - NEX_PUBLIC_LOCAL_DEV_URL (absolute HTTP(S)) wins if set.
//   - Otherwise falls back to http://localhost:<PORT or 3009>.
//   - Invalid URLs log a warning and fall through; dev never throws.

export type NexCountry = "ireland" | "worldwide" | "indonesia";

/** Source trail · lets diagnostics explain *why* a given URL was picked. */
export type NexSiteUrlSource =
  | "env_ie"
  | "env_ww"
  | "env_local_dev"
  | "port_env"
  | "port_default";

export interface ResolvedSiteUrl {
  /** Absolute URL · no trailing slash. */
  readonly url: string;
  readonly country: NexCountry;
  readonly source: NexSiteUrlSource;
  readonly isProduction: boolean;
  readonly isLocalhost: boolean;
}

const LOCAL_HOSTNAMES: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
]);

export function readNexCountry(): NexCountry {
  const raw = (
    process.env.NEX_APP_IDENTITY ??
    process.env.NEX_APP_COUNTRY ??
    ""
  )
    .trim()
    .toLowerCase();
  if (raw === "ireland") return "ireland";
  if (raw === "indonesia") return "indonesia";
  return "worldwide";
}

function envForCountry(country: NexCountry): {
  readonly value: string | null;
  readonly name: "NEX_PUBLIC_SITE_URL_IE" | "NEX_PUBLIC_SITE_URL_WW";
  readonly source: "env_ie" | "env_ww";
} {
  // Ireland has a dedicated env · everything else (worldwide, indonesia) uses
  // the Worldwide env until the owner provisions more country-specific envs.
  if (country === "ireland") {
    const value = process.env.NEX_PUBLIC_SITE_URL_IE?.trim();
    return {
      value: value && value.length > 0 ? value : null,
      name: "NEX_PUBLIC_SITE_URL_IE",
      source: "env_ie",
    };
  }
  const value = process.env.NEX_PUBLIC_SITE_URL_WW?.trim();
  return {
    value: value && value.length > 0 ? value : null,
    name: "NEX_PUBLIC_SITE_URL_WW",
    source: "env_ww",
  };
}

function parseUrlOrNull(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isHttpOrHttps(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:";
}

export function isLocalhostUrl(value: string): boolean {
  const parsed = parseUrlOrNull(value);
  return parsed !== null && LOCAL_HOSTNAMES.has(parsed.hostname);
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

/** Validate an absolute HTTP(S) URL · throws with a specific message. */
export function assertAbsoluteHttpUrl(value: string, fieldLabel: string): URL {
  const parsed = parseUrlOrNull(value);
  if (!parsed) {
    throw new Error(
      `NEX SEO: ${fieldLabel} must be an absolute URL (got ${JSON.stringify(value)})`,
    );
  }
  if (!isHttpOrHttps(parsed)) {
    throw new Error(
      `NEX SEO: ${fieldLabel} must use http(s):// (got protocol ${JSON.stringify(parsed.protocol)})`,
    );
  }
  return parsed;
}

/** Owner directive 2026-11-11 · any URL on its way into a production-visible
 *  SEO artifact (robots, sitemap, canonical, JSON-LD, OG image) must route
 *  through this guard so a stray localhost URL throws instead of silently
 *  poisoning the search index. Dev-mode passes through unchanged. */
export function assertProdSafeUrl(value: string, fieldLabel: string): string {
  if (process.env.NODE_ENV === "production" && isLocalhostUrl(value)) {
    throw new Error(
      `NEX SEO: production output for ${fieldLabel} must not reference localhost (got ${JSON.stringify(value)})`,
    );
  }
  return value;
}

/** Resolve the public site URL for the active country (driven by
 *  NEX_APP_IDENTITY / NEX_APP_COUNTRY). */
export function resolveNexSiteUrl(): ResolvedSiteUrl {
  return resolveNexSiteUrlForCountry(readNexCountry());
}

/** Resolve the public site URL for a specific country. The sitemap uses this
 *  to enumerate BOTH Ireland + Worldwide entries regardless of the deploy's
 *  active identity. */
export function resolveNexSiteUrlForCountry(country: NexCountry): ResolvedSiteUrl {
  const isProduction = process.env.NODE_ENV === "production";
  const envHit = envForCountry(country);

  if (isProduction) {
    if (!envHit.value) {
      throw new Error(
        `NEX SEO: production requires ${envHit.name} to be set (country=${country})`,
      );
    }
    const parsed = assertAbsoluteHttpUrl(envHit.value, envHit.name);
    if (parsed.protocol !== "https:") {
      throw new Error(
        `NEX SEO: ${envHit.name} must be https:// in production (got ${JSON.stringify(envHit.value)})`,
      );
    }
    if (LOCAL_HOSTNAMES.has(parsed.hostname)) {
      throw new Error(
        `NEX SEO: ${envHit.name} must not be localhost in production (got ${JSON.stringify(envHit.value)})`,
      );
    }
    return {
      url: trimTrailingSlash(envHit.value),
      country,
      source: envHit.source,
      isProduction: true,
      isLocalhost: false,
    };
  }

  // Development path · lenient, warn-and-continue instead of throw.
  if (envHit.value) {
    try {
      assertAbsoluteHttpUrl(envHit.value, envHit.name);
      return {
        url: trimTrailingSlash(envHit.value),
        country,
        source: envHit.source,
        isProduction: false,
        isLocalhost: isLocalhostUrl(envHit.value),
      };
    } catch (err) {
      console.warn(
        `NEX SEO (dev): ignoring invalid ${envHit.name}: ${(err as Error).message}`,
      );
    }
  }

  const explicitDev = process.env.NEX_PUBLIC_LOCAL_DEV_URL?.trim();
  if (explicitDev && explicitDev.length > 0) {
    try {
      assertAbsoluteHttpUrl(explicitDev, "NEX_PUBLIC_LOCAL_DEV_URL");
      return {
        url: trimTrailingSlash(explicitDev),
        country,
        source: "env_local_dev",
        isProduction: false,
        isLocalhost: isLocalhostUrl(explicitDev),
      };
    } catch (err) {
      console.warn(
        `NEX SEO (dev): ignoring invalid NEX_PUBLIC_LOCAL_DEV_URL: ${(err as Error).message}`,
      );
    }
  }

  const port = (process.env.PORT ?? "").trim();
  if (/^[0-9]+$/.test(port)) {
    return {
      url: `http://localhost:${port}`,
      country,
      source: "port_env",
      isProduction: false,
      isLocalhost: true,
    };
  }
  return {
    url: "http://localhost:3009",
    country,
    source: "port_default",
    isProduction: false,
    isLocalhost: true,
  };
}

/** Convenience · returns just the URL string for the active country. */
export function nexSiteUrl(): string {
  return resolveNexSiteUrl().url;
}

/** Build a canonical absolute URL for a given app-relative path. The leading
 *  slash on `path` is normalised · empty path returns the base URL. */
export function nexCanonicalUrl(path: string): string {
  const base = nexSiteUrl();
  if (!path || path === "/") return base;
  const normalised = path.startsWith("/") ? path : `/${path}`;
  const combined = `${base}${normalised}`;
  return assertProdSafeUrl(combined, `canonical path ${JSON.stringify(path)}`);
}
