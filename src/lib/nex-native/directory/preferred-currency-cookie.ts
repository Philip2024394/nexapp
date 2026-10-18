// src/lib/nex-native/directory/preferred-currency-cookie.ts
//
// NEX Directory · viewer's preferred display currency.
// Owner-authorised 2026-10-18 · Slice 1 (UI only · no live FX).
// -----------------------------------------------------------------------------
// Stores the ISO 4217 code of the currency the viewer picked from the
// directory's "Currency ID" chip. Phase A behaviour is UI-only:
//   · the cookie exists and the picker writes it
//   · nothing yet reads the cookie to re-price cards (that's Slice 2
//     when the Frankfurter / ECB FX pipeline is authorised)
//
// Validation is strict against the sealed `NEX_CURRENCIES` whitelist
// so a tampered cookie value can never leak into render as an
// arbitrary string. Unknown or malformed values resolve to the
// sealed default (`IDR`).
//
// Cookie attributes:
//   · httpOnly        · prevents JS tampering · pure server read/write
//   · path "/"        · available to every nex-native route
//   · sameSite "lax"  · standard same-site posture
//   · maxAge 365 days · effectively permanent for most visitors
//   · secure (prod)   · HTTPS-only in production, dev-permissive

import "server-only";
import { cookies } from "next/headers";
import {
  DEFAULT_CURRENCY,
  findCurrency,
  type NexCurrency,
} from "@/lib/nex-native/currencies";

/** Cookie name · sealed · do not drift. */
export const PREFERRED_CURRENCY_COOKIE = "nex_preferred_currency";

/** 1-year TTL · effectively permanent for most users. */
export const PREFERRED_CURRENCY_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function preferredCurrencyCookieOptions(): {
  httpOnly: true;
  path: "/";
  sameSite: "lax";
  maxAge: number;
  secure: boolean;
} {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: PREFERRED_CURRENCY_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  };
}

/** Server-side READ · returns the viewer's stored currency, falling
 *  back to the sealed default when the cookie is absent / tampered /
 *  no longer in the NEX_CURRENCIES whitelist. Never throws. */
export async function readPreferredCurrency(): Promise<NexCurrency> {
  const store = await cookies();
  const raw = store.get(PREFERRED_CURRENCY_COOKIE)?.value ?? null;
  const resolved = findCurrency(raw);
  if (resolved !== null) return resolved;
  const fallback = findCurrency(DEFAULT_CURRENCY);
  // DEFAULT_CURRENCY is guaranteed to be present in NEX_CURRENCIES,
  // but the non-null assertion is paired with a defensive throw so a
  // future refactor can't silently break this invariant.
  if (fallback === null) {
    throw new Error(
      "[preferred-currency-cookie] DEFAULT_CURRENCY missing from NEX_CURRENCIES",
    );
  }
  return fallback;
}

/** Server-side WRITE · validates the code against the sealed
 *  whitelist and writes the cookie only when valid. Returns the
 *  canonical currency that was stored. Must be called from a
 *  Server Action / Route Handler. */
export async function writePreferredCurrency(
  codeRaw: string,
): Promise<NexCurrency> {
  const chosen = findCurrency(codeRaw);
  if (chosen === null) {
    throw new Error(
      `[preferred-currency-cookie] unsupported currency: ${codeRaw}`,
    );
  }
  const store = await cookies();
  store.set(
    PREFERRED_CURRENCY_COOKIE,
    chosen.code,
    preferredCurrencyCookieOptions(),
  );
  return chosen;
}
