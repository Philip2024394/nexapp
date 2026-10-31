// src/lib/nex-native/nex-feed/country-feed-mode.ts
//
// NEX Global Feed · country-feed mode resolver · owner directive
// 2026-11-01 (Batch E · Stage 3B).
// --------------------------------------------------------------------
// Translates the URL searchParam `?country=<ISO>` into a validated
// country-feed mode (Worldwide default · Ireland selected · future).
// Fails SAFE: unknown codes, disabled countries, and malformed input
// all fall back to Worldwide — never a broken feed.
//
// Owner safeguards honoured (2026-11-01):
//   · §4 Fallback: invalid or disabled country codes safely fall back
//     to Worldwide.
//   · §5 "No new countries": only countries present in nex_country_
//     registry with hq_enabled + public_feed_enabled both true may
//     become a feed mode. This is read from the DB at request time
//     (one SELECT per request) so adding Indonesia later is a data
//     change, not a code change.
//
// This module is server-only · the resolver issues a Supabase SELECT.
// The CountryFeedSwitcher client reads only the current mode (from
// the URL) + the list of eligible countries (passed down from the
// server shell).

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";

/** Country-feed mode as a plain discriminated union · never a bare
 *  nullable string so callers can switch exhaustively. */
export type CountryFeedMode =
  | { readonly kind: "worldwide" }
  | { readonly kind: "country"; readonly code: string; readonly displayName: string };

/** Row shape read from nex_country_registry · minimal projection. */
export interface EligibleFeedCountry {
  readonly code: string;
  readonly displayName: string;
  readonly flagEmoji: string;
}

/** Load the active-feed-eligible countries (hq_enabled + public_feed_
 *  enabled both true). Fail-open: on any error returns an empty list
 *  so the switcher degrades to Worldwide-only.
 *
 *  Called by the Feed page shell. Caller passes the list down to the
 *  client-side switcher so the toggle knows what to cycle between. */
export async function listEligibleFeedCountries(): Promise<
  readonly EligibleFeedCountry[]
> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_country_registry")
      .select("code, display_name, flag_emoji")
      .eq("hq_enabled", true)
      .eq("public_feed_enabled", true)
      .order("code");
    if (error || !data) return [];
    return data.map((r: { code: string; display_name: string; flag_emoji: string }) => ({
      code: r.code,
      displayName: r.display_name,
      flagEmoji: r.flag_emoji,
    }));
  } catch {
    return [];
  }
}

/** Resolve the active mode for THIS request. Rules:
 *   · No `country` param → Worldwide.
 *   · `country` param present AND matches a row in nex_country_registry
 *     with hq_enabled + public_feed_enabled both true → Country mode.
 *   · Everything else (unknown ISO, disabled country, malformed input,
 *     DB error) → Worldwide (safe fallback per owner §4).
 *
 *  `countryParam` is the raw value from `searchParams.country` (string
 *  or undefined). It is NEVER trusted as-is — the registry validates. */
export async function resolveCountryFeedMode(
  countryParam: string | undefined,
): Promise<CountryFeedMode> {
  if (!countryParam) return { kind: "worldwide" };
  const code = countryParam.trim().toUpperCase();
  // Shape check first · the registry's PK CHECK is ^[A-Z]{2}$ so any
  // code that doesn't match that shape cannot be a hit · short-circuit.
  if (!/^[A-Z]{2}$/.test(code)) return { kind: "worldwide" };
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_country_registry")
      .select("code, display_name")
      .eq("code", code)
      .eq("hq_enabled", true)
      .eq("public_feed_enabled", true)
      .maybeSingle<{ code: string; display_name: string }>();
    if (error || !data) return { kind: "worldwide" };
    return { kind: "country", code: data.code, displayName: data.display_name };
  } catch {
    return { kind: "worldwide" };
  }
}

/** Build the href for toggling between Worldwide and a country mode.
 *  The switcher component is a client component that calls
 *  `router.push(buildCountryToggleHref(currentPath, nextMode))`.
 *
 *  Rules:
 *   · Target Worldwide → strip `country` param entirely.
 *   · Target Country   → set `country` to the ISO code.
 *
 *  Preserves ALL other searchParams (e.g. `?chain=...` for the sealed
 *  chain-playback flow) so switching feeds never drops unrelated
 *  state. */
export function buildCountryToggleHref(
  currentPathname: string,
  currentSearch: URLSearchParams,
  nextMode: CountryFeedMode,
): string {
  const next = new URLSearchParams(currentSearch);
  if (nextMode.kind === "worldwide") {
    next.delete("country");
  } else {
    next.set("country", nextMode.code);
  }
  const q = next.toString();
  return q.length > 0 ? `${currentPathname}?${q}` : currentPathname;
}
