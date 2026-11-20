// src/lib/nex-native/commercial/region-resolver.ts
//
// A10 · 2026-11-18 · viewer-region resolver for commercial surfaces.
// Owner-sealed regional-pricing comment (lines 298-307 of
// regional-pricing.ts) spells out the resolution order:
//
//   1. Account-stored preference (nex_account.region_pref · nullable
//      column · NOT YET MIGRATED · future state)
//   2. Accept-Language header country hint
//   3. Vercel/Cloudflare IP country header
//   4. NEX_APP_COUNTRY env fallback
//   5. Hard fallback · IE
//
// This resolver is deliberately pure · it takes a header getter and
// an optional account preference, returns the chosen region. The DB
// lookup for region_pref is NOT performed here · the caller passes
// an already-resolved string (or null) through `accountRegionPref`.
// That keeps the resolver testable without DB mocks and lets the
// DB-column migration land in a separate owner-authorised task
// without changing this file's contract.

import type {
  SupportedRegion,
} from "./regional-pricing";

/** The four markets the Shop checkout actually supports today. The
 *  resolver returns one of these four · never a planned-but-inactive
 *  region (AU / CA / JP / IN / PH), because the checkout endpoint
 *  does not have Stripe price IDs for those yet. */
export type CheckoutRegion = Extract<SupportedRegion, "IE" | "GB" | "US" | "ID">;

export const DEFAULT_CHECKOUT_REGION: CheckoutRegion = "IE";

const ACTIVE_CHECKOUT_REGIONS: ReadonlySet<CheckoutRegion> = new Set([
  "IE",
  "GB",
  "US",
  "ID",
]);

// Which ISO 3166-1 alpha-2 codes map onto which CheckoutRegion.
// The EU/EEA bloc maps to IE because IE is the EUR representative in
// the pricing table. The hint is country-level only; we never guess
// a user's billing country from language (en-GB in a Dublin cafe is
// fine, we trust the explicit header over the lang hint).
const EU_EEA_TO_IE: ReadonlySet<string> = new Set([
  "IE", "FR", "DE", "ES", "IT", "PT", "NL", "BE", "LU", "AT", "FI",
  "GR", "CY", "MT", "SK", "SI", "EE", "LV", "LT", "HR", "BG", "RO",
  "HU", "PL", "CZ", "DK", "SE", "IS", "LI", "NO",
]);

const DIRECT_COUNTRY_TO_REGION: ReadonlyMap<string, CheckoutRegion> =
  new Map([
    ["GB", "GB"],
    ["UK", "GB"],
    ["US", "US"],
    ["ID", "ID"],
  ]);

/** Ingest either the full header value (e.g. "en-GB,en;q=0.9,fr;q=0.8")
 *  or a single language tag · returns the first country-tagged
 *  sub-language if any. Case-insensitive. Returns null for qvalue-only
 *  lists or malformed inputs. */
export function countryFromAcceptLanguage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const tokens = raw.split(",").map((t) => t.trim()).filter(Boolean);
  for (const token of tokens) {
    // Strip qvalue.
    const lang = token.split(";")[0]?.trim();
    if (!lang) continue;
    const parts = lang.split("-");
    if (parts.length < 2) continue;
    const country = parts[1]?.toUpperCase();
    // ISO 3166-1 alpha-2 is two uppercase letters.
    if (country && /^[A-Z]{2}$/.test(country)) {
      return country;
    }
  }
  return null;
}

/** Normalise any ISO-alpha-2 country code (or raw region pref) to one
 *  of the four CheckoutRegions, or `null` if the input doesn't map. */
export function normaliseToCheckoutRegion(
  raw: string | null | undefined,
): CheckoutRegion | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  if (upper.length === 0) return null;
  // Already a CheckoutRegion?
  if (ACTIVE_CHECKOUT_REGIONS.has(upper as CheckoutRegion)) {
    return upper as CheckoutRegion;
  }
  // Direct country-code → CheckoutRegion.
  const direct = DIRECT_COUNTRY_TO_REGION.get(upper);
  if (direct) return direct;
  // EU/EEA → IE (EUR representative).
  if (EU_EEA_TO_IE.has(upper)) return "IE";
  return null;
}

export interface RegionResolverInput {
  /** Account-level preference · passed by the caller after reading
   *  nex_account.region_pref. Pass `null` if not set, or if the
   *  column does not yet exist in this environment. */
  readonly accountRegionPref?: string | null;
  /** Thin header accessor · supply a function so this resolver stays
   *  independent of NextRequest / Fetch API shape differences. */
  readonly getHeader: (name: string) => string | null | undefined;
  /** Optional env fallback override · tests can inject. Falls back to
   *  `process.env.NEX_APP_COUNTRY` at runtime when omitted. */
  readonly envFallback?: string | null;
}

export interface ResolvedRegion {
  readonly region: CheckoutRegion;
  readonly source:
    | "account_pref"
    | "accept_language"
    | "edge_geo"
    | "env_fallback"
    | "hard_default";
}

/** Resolve the viewer region using the owner-sealed priority order.
 *  Always returns a `CheckoutRegion` plus a transparent `source` so
 *  callers can log or surface which rung the choice came from. */
export function resolveViewerRegion(
  input: RegionResolverInput,
): ResolvedRegion {
  // 1 · account-stored preference
  const fromPref = normaliseToCheckoutRegion(input.accountRegionPref);
  if (fromPref) return { region: fromPref, source: "account_pref" };

  // 2 · Accept-Language country sub-tag (en-GB · es-ES · id-ID · etc.)
  const acceptLang = input.getHeader("accept-language");
  const langCountry = countryFromAcceptLanguage(
    typeof acceptLang === "string" ? acceptLang : null,
  );
  const fromLang = normaliseToCheckoutRegion(langCountry);
  if (fromLang) return { region: fromLang, source: "accept_language" };

  // 3 · edge geo header (Vercel first · Cloudflare fallback)
  const vercel = input.getHeader("x-vercel-ip-country");
  const cf = input.getHeader("cf-ipcountry");
  const edge = normaliseToCheckoutRegion(
    (typeof vercel === "string" && vercel) ||
      (typeof cf === "string" && cf) ||
      null,
  );
  if (edge) return { region: edge, source: "edge_geo" };

  // 4 · env fallback
  const env =
    input.envFallback !== undefined
      ? input.envFallback
      : process.env.NEX_APP_COUNTRY ?? null;
  const fromEnv = normaliseToCheckoutRegion(env);
  if (fromEnv) return { region: fromEnv, source: "env_fallback" };

  // 5 · hard default
  return { region: DEFAULT_CHECKOUT_REGION, source: "hard_default" };
}
