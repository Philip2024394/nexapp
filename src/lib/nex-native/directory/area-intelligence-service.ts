// src/lib/nex-native/directory/area-intelligence-service.ts
//
// Read-only service · looks up area intelligence for a listing's
// (city, country) tuple in the shared nex.meaningful_area table.
//
// Honesty contract:
//   · Returns null when no area entry carrying the
//     `nex_directory_area_intelligence` provenance namespace matches
//     the (city, country). The UI then renders the honest
//     "Area information not yet researched" fallback · never a
//     fabricated description.
//   · Does NOT invent claims when the DB has none for a category.
//   · Does NOT weaken any existing publication gate · reads only
//     from the already-sealed meaningful_area table.
//
// Lookup rule:
//   SELECT ... FROM nex.meaningful_area
//    WHERE lower(city) = lower($city)
//      AND country = $country
//      AND jsonb_path_exists(provenance, '$.nex_directory_area_intelligence')
//    ORDER BY precedence ASC
//    LIMIT 1
//
// Precedence tiebreaker: the sealed brain-pipeline entries (e.g.
// yogya-city-core) carry precedence=1 but DO NOT contain the
// `nex_directory_area_intelligence` namespace · they are therefore
// filtered out by the jsonb_path_exists clause. Our research entries
// carry precedence=5 and ARE selected · no overwrite risk.

import "server-only";
import { withClient } from "@/lib/nex/db";
import {
  parseAreaIntelligence,
  type AreaIntelligence,
} from "./area-intelligence-types";

interface MeaningfulAreaRow {
  readonly area_id: string;
  readonly name: string | null;
  readonly country: string | null;
  readonly city: string | null;
  readonly provenance: unknown;
}

/** Fetch the area intelligence for a single (city, country). Returns
 *  null when no area carries research in the dedicated provenance
 *  namespace. Safe fallback on DB error · never throws. */
export async function fetchAreaIntelligence(
  city: string | null | undefined,
  country: string | null | undefined,
): Promise<AreaIntelligence | null> {
  if (typeof city !== "string" || city.trim().length === 0) return null;
  if (typeof country !== "string" || country.trim().length === 0) return null;

  const sql =
    "SELECT area_id, name, country, city, provenance " +
    "FROM nex.meaningful_area " +
    "WHERE lower(city) = lower($1) " +
    "  AND country = $2 " +
    "  AND jsonb_path_exists(provenance, '$.nex_directory_area_intelligence') " +
    "ORDER BY precedence ASC " +
    "LIMIT 1";
  try {
    const result = await withClient(async (client) =>
      client.query(sql, [city.trim(), country.trim()]),
    );
    if (result === null) return null;
    if (!Array.isArray(result.rows) || result.rows.length === 0) return null;
    const row = result.rows[0] as unknown as MeaningfulAreaRow;
    if (row.name === null || row.country === null || row.city === null) {
      return null;
    }
    return parseAreaIntelligence({
      areaId: row.area_id,
      areaName: row.name,
      country: row.country,
      city: row.city,
      provenance: row.provenance,
    });
  } catch {
    return null;
  }
}

/** Batch form · fetches area intel for many listings in one query.
 *  Returns a Map keyed by `${country}:${city}` (lowercase city). The
 *  caller resolves each listing's area via the same key shape. */
export async function fetchAreaIntelligenceByCityCountry(
  pairs: readonly { readonly city: string; readonly country: string }[],
): Promise<ReadonlyMap<string, AreaIntelligence>> {
  const map = new Map<string, AreaIntelligence>();
  if (pairs.length === 0) return map;

  // Deduplicate the input (city/country) pairs · callers will often
  // pass a per-row stream that repeats the same city many times.
  const seen = new Set<string>();
  const uniqueCities: string[] = [];
  const uniqueCountries: string[] = [];
  for (const p of pairs) {
    if (typeof p.city !== "string" || typeof p.country !== "string") continue;
    const k = p.country.trim() + ":" + p.city.trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniqueCities.push(p.city.trim());
    uniqueCountries.push(p.country.trim());
  }
  if (uniqueCities.length === 0) return map;

  // We query once per unique city with a tuple predicate · pg's `IN`
  // over a VALUES list keeps this one round trip. For today's 5
  // seeded cities this is trivial · it also scales to the ~98 unique
  // (city, country) tuples that exist in the publication view.
  const valueTuples: string[] = [];
  const params: string[] = [];
  for (let i = 0; i < uniqueCities.length; i++) {
    valueTuples.push("($" + (params.length + 1) + "::text, $" + (params.length + 2) + "::text)");
    params.push(uniqueCities[i], uniqueCountries[i]);
  }
  const sql =
    "SELECT area_id, name, country, city, provenance " +
    "FROM nex.meaningful_area " +
    "WHERE (lower(city), country) IN (" +
    valueTuples.map((_, i) => "(lower($" + (i * 2 + 1) + "), $" + (i * 2 + 2) + ")").join(", ") +
    ") " +
    "AND jsonb_path_exists(provenance, '$.nex_directory_area_intelligence') " +
    "ORDER BY precedence ASC";

  try {
    const result = await withClient(async (client) =>
      client.query(sql, params),
    );
    if (result === null) return map;
    for (const raw of result.rows as unknown as MeaningfulAreaRow[]) {
      if (raw.name === null || raw.country === null || raw.city === null) {
        continue;
      }
      const intel = parseAreaIntelligence({
        areaId: raw.area_id,
        areaName: raw.name,
        country: raw.country,
        city: raw.city,
        provenance: raw.provenance,
      });
      if (intel === null) continue;
      const key = intel.country + ":" + intel.city.toLowerCase();
      // first-write wins (ORDER BY precedence ASC already applied)
      if (!map.has(key)) map.set(key, intel);
    }
  } catch {
    return map;
  }
  return map;
}

/** Shared key helper so callers resolve from the batch Map. */
export function areaIntelMapKey(
  country: string | null | undefined,
  city: string | null | undefined,
): string | null {
  if (typeof country !== "string" || typeof city !== "string") return null;
  const c = country.trim();
  const ci = city.trim();
  if (c.length === 0 || ci.length === 0) return null;
  return c + ":" + ci.toLowerCase();
}
