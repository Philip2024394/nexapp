// src/lib/nex-native/country/country-hint-cookie.ts
//
// NEX country-hint cookie · 2026-11-06 · Phase 2 Batch 4.
// -----------------------------------------------------------------------------
// Persists the geo-IP / Accept-Language ISO-2 country hint read at
// /nex-native/create-account render time (`readCountryHint` in
// create-account/page.tsx:29-41) so that surfaces consumed AFTER
// signup — currently the `/packages` page and the Shop membership
// upgrade flow — can resolve a country-specific price without a
// second geo lookup.
//
// Why a cookie and not a column?
// ------------------------------
// Per Shop Entitlement Contract §B-3 the country must persist on the
// account record for the core-four launch markets (USD · GBP · IDR ·
// EUR). The `nex_account.country_iso2` column does NOT exist today
// (confirmed by grep of nex-supabase/migrations/ on 2026-11-06 ·
// only `phone_country_code` exists and that stores a dial code, not
// an ISO-2). Adding the column is a schema change that needs a
// separate migration authorisation (see Phase 2a audit § G gate B3).
//
// This cookie is the pragmatic bridge: it carries the hint from the
// create-account page across the signup boundary and is readable
// anywhere on /nex-native/* that needs it. When the schema migration
// lands, the account-service layer takes over and this cookie can
// be retired (or kept as a pre-signup hint).
//
// Guardrails
// ----------
//   · HTTP-only · not readable from client JS · prevents a malicious
//     page reading the user's inferred country from the DOM.
//   · SameSite=lax · survives top-level redirects (packages → signup
//     → packages) but not CSRF.
//   · Max-Age 365 days · the hint is not sensitive and a returning
//     user from the same country benefits from stale-but-correct data.
//   · Shape-checked via a strict ISO-3166-1 alpha-2 regex so an
//     adversarial header value cannot inject arbitrary text.

import { cookies } from "next/headers";

export const NEX_COUNTRY_HINT_COOKIE = "nex_country_hint";

/** ISO-3166-1 alpha-2 shape check. Case-preserved uppercase. */
export function isValidCountryIso2(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z]{2}$/.test(value);
}

/** Persist the country hint. Silently drops invalid input — never
 *  throws — because signup success must not fail on a cookie-write
 *  problem. */
export async function persistCountryHintCookie(
  iso2: string | undefined | null,
): Promise<void> {
  if (!iso2) return;
  const normalised = iso2.toUpperCase();
  if (!isValidCountryIso2(normalised)) return;
  const jar = await cookies();
  jar.set({
    name: NEX_COUNTRY_HINT_COOKIE,
    value: normalised,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Read the country hint from the cookie jar. Returns `null` if the
 *  cookie is absent or malformed. */
export async function readCountryHintCookie(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(NEX_COUNTRY_HINT_COOKIE)?.value ?? null;
  if (raw && isValidCountryIso2(raw)) return raw;
  return null;
}
