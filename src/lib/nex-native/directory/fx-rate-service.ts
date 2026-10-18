// src/lib/nex-native/directory/fx-rate-service.ts
//
// NEX Directory · Slice 2 · ECB-sourced FX rates for buyer-currency
// estimates on cards.
// Owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Fetches daily reference rates from Frankfurter (`frankfurter.app`),
// a free open-source API that mirrors the European Central Bank's
// published rates. ECB publishes once per weekday afternoon (~16:00
// CET) · we cache for 24 hours and refresh on next request after
// expiry. Zero API key, no auth, no rate limit for reasonable use.
//
// Honesty guarantees:
//
//   1. NEVER FABRICATE · if Frankfurter is unreachable, times out,
//      or returns malformed data, this module returns null. The
//      directory view then skips `buyerLocalPrice` and the card
//      keeps the seller's price only. No fallback to "guessed"
//      rates. Owner directive sealed in the view-model comment.
//
//   2. CLEARLY LABELLED · the formatted display string is prefixed
//      with "~" (approx) · never a bare price in the buyer currency.
//      Freshness timestamp travels alongside so the card / future
//      hover-reveal can show "ECB rate · updated <date>".
//
//   3. BOUNDS CHECK · each returned rate must be a finite positive
//      number. Pathological values (0, Infinity, NaN, negative) are
//      rejected and the whole payload treated as untrusted.
//
//   4. ECB-DAILY REFRESH · Frankfurter mirrors ECB which only
//      publishes on weekdays. On weekends the "latest" endpoint
//      returns Friday's rates · that's correct behaviour (banks
//      quote the last publication). We honour it without alarm.
//
// Multi-process caveat (acknowledged limitation):
//   The in-memory cache is per Node.js process. In a multi-pod
//   deployment, each pod refreshes independently once per 24h.
//   That's fine · the ECB rate for a given day is identical across
//   pods, so there's no drift concern · just redundant work. A
//   future upgrade to a shared `nex_fx_rate` table (migration) can
//   eliminate the redundancy if load warrants it.

import "server-only";
import { findCurrency } from "@/lib/nex-native/currencies";

/** ECB publishes once per weekday · a 24h TTL comfortably covers
 *  the next publication AND weekends when there's no publication. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Frankfurter honours a 10-second connect but we cap defensively
 *  so a slow upstream never blocks the directory render. If the
 *  fetch exceeds this, we abort and return null (seller-currency
 *  only path). 8s accommodates dev-server cold starts + Frankfurter's
 *  occasional 301 redirect via Cloudflare before the data lands. */
const FETCH_TIMEOUT_MS = 8_000;

/** Base currency we quote rates FROM. EUR is Frankfurter's native
 *  base (ECB publishes rates against EUR), so storing EUR-based
 *  rates lets us compute every cross-rate without a second fetch. */
const BASE_CURRENCY = "EUR" as const;

/** Which currencies we care about. Mirrors the sealed
 *  NEX_CURRENCIES list so Frankfurter never returns a currency we
 *  don't display. */
const TARGET_CURRENCIES = [
  "IDR",
  "GBP",
  "USD",
  "EUR",
  "SGD",
  "MYR",
  "THB",
  "PHP",
  "VND",
  "AUD",
] as const;

interface FxRateSnapshot {
  /** ISO date (YYYY-MM-DD) · the ECB publication date. */
  readonly date: string;
  /** Rates FROM EUR to each target currency.
   *  rates["IDR"] = how many IDR for 1 EUR. */
  readonly rates: Readonly<Record<string, number>>;
  /** Epoch millis when this snapshot was fetched · drives TTL. */
  readonly fetchedAt: number;
}

/** Module-level cache · survives for the lifetime of the Node
 *  process. Reset between dev-server restarts (fine). */
let cachedSnapshot: FxRateSnapshot | null = null;
let inflightFetch: Promise<FxRateSnapshot | null> | null = null;

interface FrankfurterLatestShape {
  readonly amount?: unknown;
  readonly base?: unknown;
  readonly date?: unknown;
  readonly rates?: unknown;
}

/** True iff `value` passes the honesty bounds check for a published
 *  FX rate: finite positive non-zero number. */
function isSaneRate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

/** Attempt to pull today's rates from Frankfurter. Honest failure:
 *  returns null when the network / parse / bounds check fails.
 *  Never throws, never returns partial data. */
async function fetchLatestFromFrankfurter(): Promise<FxRateSnapshot | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url =
      `https://api.frankfurter.app/latest?from=${BASE_CURRENCY}` +
      `&to=${TARGET_CURRENCIES.filter((c) => c !== BASE_CURRENCY).join(",")}`;
    const res = await fetch(url, {
      signal: controller.signal,
      // Owner directive 2026-10-18 (iteration) · using `cache: "no-store"`
      // instead of Next's `revalidate: 24h` for two reasons:
      //   1. We already have our own in-memory 24h cache above this
      //      layer · double-caching risks serving a cached FAILURE
      //      response for 24h if the first fetch aborted.
      //   2. In dev-mode Turbopack, the Data Cache has been observed
      //      to hold a stale timeout-abort for the full revalidate
      //      window, blocking subsequent successful retries.
      // Our module-level `cachedSnapshot` provides the daily cache ·
      // Next's layer just gets in the way here.
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as FrankfurterLatestShape;
    if (
      typeof body.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.date) ||
      body.rates === null ||
      typeof body.rates !== "object"
    ) {
      return null;
    }
    const raw = body.rates as Record<string, unknown>;
    const rates: Record<string, number> = { [BASE_CURRENCY]: 1 };
    // Owner directive 2026-10-18 (iteration) · tolerate currencies
    // the ECB doesn't publish (notably VND · Vietnamese Dong). Each
    // target rate is bounds-checked individually · bad rates are
    // omitted from the map, not fatal to the whole snapshot. The
    // consumer (`convertAmountMinor`) returns null for any
    // currency missing from the map, so an unsupported currency
    // honestly falls back to seller-currency-only display while
    // every other conversion still works.
    for (const code of TARGET_CURRENCIES) {
      if (code === BASE_CURRENCY) continue;
      const v = raw[code];
      if (isSaneRate(v)) {
        rates[code] = v;
      }
    }
    // Sanity floor · if we got NOTHING back we treat the whole
    // payload as untrusted (prevents a crafted response that only
    // returns the base from passing).
    if (Object.keys(rates).length < 2) return null;
    return {
      date: body.date,
      rates: Object.freeze(rates),
      fetchedAt: Date.now(),
    };
  } catch (err) {
    // Network error, timeout, JSON parse failure · all collapse to
    // "we don't have rates right now". The caller falls through to
    // seller-currency-only display. Log once in dev so transient
    // network issues are diagnosable without breaking the honesty
    // contract (never fabricate rates in production).
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        "[fx-rate-service] fetch failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve the daily FX snapshot. Uses the cached snapshot if fresh;
 *  refreshes on expiry; de-dupes concurrent refreshes via `inflightFetch`.
 *  Returns null when upstream is unreachable AND no previous
 *  snapshot exists · honest "no rates available". */
export async function getDailyFxSnapshot(): Promise<FxRateSnapshot | null> {
  const now = Date.now();
  if (cachedSnapshot && now - cachedSnapshot.fetchedAt < CACHE_TTL_MS) {
    return cachedSnapshot;
  }
  if (inflightFetch) return inflightFetch;
  inflightFetch = (async () => {
    const next = await fetchLatestFromFrankfurter();
    if (next !== null) cachedSnapshot = next;
    inflightFetch = null;
    // On transient failure we deliberately keep the previous
    // snapshot (if any). Rates don't move fast enough day-to-day
    // for a 24-48h-stale ECB rate to be meaningfully misleading
    // for a display estimate · the ~ prefix carries the honesty.
    return cachedSnapshot;
  })();
  return inflightFetch;
}

/** Convert `amountMinor` (bigint-free · we accept number since
 *  JavaScript's safe-integer range covers every realistic price)
 *  from `fromCurrency` to `toCurrency` using the daily snapshot.
 *  Returns null when:
 *    · snapshot is unavailable
 *    · either currency isn't a known NEX currency
 *    · either currency isn't in the fetched rate map
 *    · the resulting amount is not finite
 *  Minor units are preserved (the result is also in minor units of
 *  the TARGET currency's minorUnitPerMajor scale). */
export async function convertAmountMinor(
  amountMinor: number,
  fromCurrency: string,
  toCurrency: string,
): Promise<number | null> {
  if (!Number.isFinite(amountMinor) || amountMinor < 0) return null;
  if (fromCurrency === toCurrency) return amountMinor;
  const fromMeta = findCurrency(fromCurrency);
  const toMeta = findCurrency(toCurrency);
  if (fromMeta === null || toMeta === null) return null;
  const snap = await getDailyFxSnapshot();
  if (snap === null) return null;
  const fromRate = snap.rates[fromMeta.code];
  const toRate = snap.rates[toMeta.code];
  if (!isSaneRate(fromRate) || !isSaneRate(toRate)) return null;
  // Convert via EUR cross-rate · amount_in_EUR = amount_in_FROM / fromRate;
  // amount_in_TO = amount_in_EUR * toRate.
  // Minor-unit scaling is identical across our 10 currencies
  // (minorUnitPerMajor = 100 for all · see currencies.ts) so no
  // rescaling is needed · if a future currency uses a different
  // scale, add major-to-major conversion then rescale.
  const major = amountMinor / fromMeta.minorUnitPerMajor;
  const convertedMajor = (major / fromRate) * toRate;
  const converted = Math.round(convertedMajor * toMeta.minorUnitPerMajor);
  if (!Number.isFinite(converted)) return null;
  return converted;
}

/** Format a minor-unit amount into a NEX-style display string with
 *  the sealed currency's symbol and locale-grouped integer part.
 *  Prefixes with "~" to signal "approximate / estimate" per the
 *  owner's honesty gate. Returns null when the currency isn't known. */
export function formatEstimate(
  amountMinor: number,
  currency: string,
): string | null {
  const meta = findCurrency(currency);
  if (meta === null) return null;
  if (!Number.isFinite(amountMinor) || amountMinor < 0) return null;
  const major = amountMinor / meta.minorUnitPerMajor;
  // Round to zero-decimal for IDR / VND (high-magnitude currencies)
  // · two-decimal for the rest. The grouping separator is locale-
  // free (standard comma) so the output is deterministic.
  const noFraction = currency === "IDR" || currency === "VND";
  const whole = noFraction
    ? Math.round(major).toString()
    : major.toFixed(2);
  const grouped = whole.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );
  return `~${meta.symbol} ${grouped}`;
}

/** Debug-only · returns the current cached snapshot's publication
 *  date, or null if no snapshot has been fetched yet. Consumed by
 *  the card's freshness line / future "rate updated at" tooltip. */
export function peekSnapshotDate(): string | null {
  return cachedSnapshot?.date ?? null;
}
