// src/lib/nex-native/harvest/overpass-fetcher.ts
//
// Minimal OSM Overpass fetcher · one bbox per call.
// -------------------------------------------------
// Issues a bounded Overpass query for named businesses within a bbox
// and returns the parsed elements. Rate-limit, timeout and host
// failover are all explicit so a serverless invocation never hangs.
//
// Attribution: © OpenStreetMap contributors, ODbL. Any downstream
// store/display MUST carry the attribution per nex.source_registry
// `osm_overpass_products_v1.attribution_template`.

import "server-only";
import type { CityBbox } from "./city-rotation";
import {
  parseOverpassElements,
  type OverpassElement,
} from "./overpass-parser";
export { parseOverpassElements } from "./overpass-parser";
export type {
  OverpassElement,
  OverpassElementType,
} from "./overpass-parser";

export interface OverpassFetchResult {
  readonly ok: boolean;
  readonly host: string | null;
  readonly elements: readonly OverpassElement[];
  readonly fetchMs: number;
  readonly reason:
    | "ok"
    | "timeout"
    | "rate_limited"
    | "upstream_error"
    | "parse_error"
    | "bbox_invalid"
    | "all_hosts_failed";
}

/** Ordered host list · falls back automatically when the primary
 *  returns 5xx or rate-limits. Matches the enabled set in
 *  `nex.harvest_source`. */
const OVERPASS_HOSTS: readonly string[] = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

const USER_AGENT = "nex-native/harvest-tick (contact: support@nex.app)";
const PER_HOST_TIMEOUT_MS = 60_000;

/** Fetch named businesses (nodes + ways) within the bbox. The query
 *  is deliberately narrow (shop | amenity | tourism | leisure) to
 *  keep response size bounded well under Vercel's 300s ceiling. */
export async function fetchOsmBusinessesInBbox(
  bbox: CityBbox,
): Promise<OverpassFetchResult> {
  if (
    !Number.isFinite(bbox.south) || !Number.isFinite(bbox.west) ||
    !Number.isFinite(bbox.north) || !Number.isFinite(bbox.east) ||
    bbox.south >= bbox.north || bbox.west >= bbox.east
  ) {
    return {
      ok: false,
      host: null,
      elements: [],
      fetchMs: 0,
      reason: "bbox_invalid",
    };
  }

  // Overpass QL · all "named businesses" in bbox · nodes + ways with
  // a `name` tag plus at least one of the four amenity-ish tags.
  // `out tags center` keeps way geometries small (just one centroid
  // per way) and preserves all tags for downstream normalization.
  const query = `
    [out:json][timeout:50];
    (
      nwr(${bbox.south},${bbox.west},${bbox.north},${bbox.east})[name][shop];
      nwr(${bbox.south},${bbox.west},${bbox.north},${bbox.east})[name][amenity~"^(restaurant|cafe|fast_food|bar|pub|bakery|ice_cream|pharmacy|bank|car_rental)$"];
      nwr(${bbox.south},${bbox.west},${bbox.north},${bbox.east})[name][tourism~"^(hotel|motel|hostel|guest_house|apartment|chalet)$"];
      nwr(${bbox.south},${bbox.west},${bbox.north},${bbox.east})[name][leisure~"^(fitness_centre|sports_centre|dance|golf_course)$"];
    );
    out tags center 2000;
  `.trim();

  const start = Date.now();
  let lastReason: OverpassFetchResult["reason"] = "all_hosts_failed";

  for (const host of OVERPASS_HOSTS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PER_HOST_TIMEOUT_MS);
    try {
      const res = await fetch(host, {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (res.status === 429 || res.status === 504) {
        lastReason = "rate_limited";
        continue;
      }
      if (!res.ok) {
        lastReason = "upstream_error";
        continue;
      }

      const data = (await res.json()) as unknown;
      const elements = parseOverpassElements(data);
      return {
        ok: true,
        host,
        elements,
        fetchMs: Date.now() - start,
        reason: "ok",
      };
    } catch (e) {
      clearTimeout(timer);
      const msg = (e as { name?: string; message?: string } | null)?.name ?? "";
      if (msg === "AbortError") {
        lastReason = "timeout";
      } else {
        lastReason = "upstream_error";
      }
      continue;
    }
  }

  return {
    ok: false,
    host: null,
    elements: [],
    fetchMs: Date.now() - start,
    reason: lastReason,
  };
}

// parseOverpassElements moved to ./overpass-parser (pure · testable
// from vitest). This file keeps the server-only fetch logic.
