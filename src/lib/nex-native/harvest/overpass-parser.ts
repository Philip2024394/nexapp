// src/lib/nex-native/harvest/overpass-parser.ts
//
// Pure parsing of raw OSM Overpass JSON into typed elements.
// ---------------------------------------------------------
// No `server-only` import · importable from vitest. Called by
// `overpass-fetcher.ts` (which IS server-only, uses fetch).

export type OverpassElementType = "node" | "way" | "relation";

export interface OverpassElement {
  readonly type: OverpassElementType;
  readonly id: number;
  readonly lat: number | null;
  readonly lon: number | null;
  readonly tags: Readonly<Record<string, string>>;
}

/** Parse Overpass response. Tolerates malformed inputs by filtering
 *  invalid elements out individually rather than erroring on the
 *  whole response. Overpass mirrors occasionally return partial /
 *  malformed JSON on heavy load. */
export function parseOverpassElements(
  raw: unknown,
): readonly OverpassElement[] {
  if (!raw || typeof raw !== "object") return [];
  const data = raw as { elements?: unknown };
  if (!Array.isArray(data.elements)) return [];
  const out: OverpassElement[] = [];
  for (const el of data.elements) {
    if (!el || typeof el !== "object") continue;
    const e = el as {
      type?: unknown;
      id?: unknown;
      lat?: unknown;
      lon?: unknown;
      center?: { lat?: unknown; lon?: unknown } | null;
      tags?: unknown;
    };
    const type = e.type;
    if (type !== "node" && type !== "way" && type !== "relation") continue;
    const id = typeof e.id === "number" ? e.id : null;
    if (id === null) continue;
    const tags =
      e.tags && typeof e.tags === "object"
        ? (e.tags as Record<string, string>)
        : {};
    const lat =
      typeof e.lat === "number"
        ? e.lat
        : typeof e.center?.lat === "number"
          ? e.center.lat
          : null;
    const lon =
      typeof e.lon === "number"
        ? e.lon
        : typeof e.center?.lon === "number"
          ? e.center.lon
          : null;
    out.push({ type, id, lat, lon, tags });
  }
  return out;
}
