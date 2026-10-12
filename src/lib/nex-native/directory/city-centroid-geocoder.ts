// src/lib/nex-native/directory/city-centroid-geocoder.ts
//
// Local city/area → centroid geocoder.
//
// Resolves a user-typed location string ("Yogyakarta", "Denpasar",
// "Bandar Lampung") to a lat/lng centroid using the real coordinates
// of businesses in `nex.food_business` as the corpus. Zero third-party
// dependency. Fully local. No rate limits. No per-request fee.
//
// Honesty contract:
//   · Returns a centroid ONLY when the match is sufficiently reliable:
//     ≥ MIN_SUPPORT rows carry the queried city (case-insensitive
//     exact match) in `nex.food_business.city`.
//   · The centroid is the mean of the real business coordinates for
//     that city. It is not fabricated.
//   · When the match is weak (zero rows OR below MIN_SUPPORT) the
//     function returns null · the caller shows "we couldn't find that
//     area" and must not persist anything.
//   · The resolver NEVER modifies verification state in food_business
//     or any publication gate · it is pure read.
//
// Why "manual_city centroid" is NOT the user's precise location:
//   A city centroid is a rough neighborhood anchor, not a GPS pin.
//   The SavedLocation.source field keeps this honest downstream: UI
//   that cares about precision checks `source === "gps"`.

import "server-only";
import { withClient } from "@/lib/nex/db";

export interface CityCentroid {
  readonly cityLabel: string;
  readonly countryIso: string | null;
  readonly lat: number;
  readonly lng: number;
  readonly supportRows: number;
}

/** Minimum number of food_business rows that must carry the queried
 *  city (exact, case-insensitive) before we trust the centroid. Below
 *  this we return null · caller must show "not found" and not
 *  fabricate. */
export const MIN_CENTROID_SUPPORT = 5;

/** Maximum length of user-typed location string we accept. Pure
 *  input-size guard · prevents absurd queries. */
export const MAX_QUERY_LEN = 80;

/** Resolve a free-form location string to a centroid. Returns null
 *  when the query is empty / absurd / unsupported. Pure read. */
export async function geocodeCityToCentroid(
  rawQuery: string,
): Promise<CityCentroid | null> {
  if (typeof rawQuery !== "string") return null;
  const q = rawQuery.trim();
  if (q.length === 0 || q.length > MAX_QUERY_LEN) return null;

  const sql =
    "SELECT city, country, " +
    "COUNT(*)::int AS support, " +
    "AVG(coordinates_lat)::float8 AS lat, " +
    "AVG(coordinates_lng)::float8 AS lng " +
    "FROM nex.food_business " +
    "WHERE coordinates_lat IS NOT NULL " +
    "  AND coordinates_lng IS NOT NULL " +
    "  AND city IS NOT NULL " +
    "  AND lower(city) = lower($1) " +
    "GROUP BY city, country " +
    "ORDER BY support DESC " +
    "LIMIT 1";

  try {
    const result = await withClient(async (client) =>
      client.query(sql, [q]),
    );
    if (result === null) return null;
    if (!Array.isArray(result.rows) || result.rows.length === 0) return null;
    const row = result.rows[0] as {
      city: string | null;
      country: string | null;
      support: number | null;
      lat: number | null;
      lng: number | null;
    };
    if (row.city === null || row.lat === null || row.lng === null) return null;
    if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) return null;
    if (row.lat < -90 || row.lat > 90) return null;
    if (row.lng < -180 || row.lng > 180) return null;
    const support = typeof row.support === "number" ? row.support : 0;
    if (support < MIN_CENTROID_SUPPORT) return null;
    return {
      cityLabel: row.country ? `${row.city}, ${row.country}` : row.city,
      countryIso: isValidIsoAlpha2(row.country) ? row.country : null,
      lat: row.lat,
      lng: row.lng,
      supportRows: support,
    };
  } catch {
    return null;
  }
}

/** Case-insensitive prefix suggestions for the manual-entry dropdown.
 *  Returns up to `limit` cities that appear in food_business, each
 *  with their row count. Weakly-supported cities are filtered out so
 *  the suggestion list is honest · never offer a city we won't resolve. */
export async function suggestCities(
  rawQuery: string,
  limit: number = 8,
): Promise<readonly { readonly cityLabel: string; readonly supportRows: number }[]> {
  if (typeof rawQuery !== "string") return [];
  const q = rawQuery.trim();
  if (q.length < 2 || q.length > MAX_QUERY_LEN) return [];
  const clampedLimit = Math.max(1, Math.min(20, Math.floor(limit)));

  const sql =
    "SELECT city, country, COUNT(*)::int AS support " +
    "FROM nex.food_business " +
    "WHERE city IS NOT NULL " +
    "  AND coordinates_lat IS NOT NULL " +
    "  AND coordinates_lng IS NOT NULL " +
    "  AND lower(city) LIKE lower($1) || '%' " +
    "GROUP BY city, country " +
    "HAVING COUNT(*) >= $2 " +
    "ORDER BY support DESC, city ASC " +
    "LIMIT $3";

  try {
    const result = await withClient(async (client) =>
      client.query(sql, [q, MIN_CENTROID_SUPPORT, clampedLimit]),
    );
    if (result === null) return [];
    if (!Array.isArray(result.rows)) return [];
    const out: { cityLabel: string; supportRows: number }[] = [];
    for (const r of result.rows as {
      city: string | null;
      country: string | null;
      support: number | null;
    }[]) {
      if (r.city === null || typeof r.support !== "number") continue;
      out.push({
        cityLabel: r.country ? `${r.city}, ${r.country}` : r.city,
        supportRows: r.support,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function isValidIsoAlpha2(v: string | null): v is string {
  return typeof v === "string" && /^[A-Z]{2}$/.test(v);
}
