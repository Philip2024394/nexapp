// src/lib/nex-native/harvest/canonical-metadata.ts
//
// Pure builder for the `metadata` jsonb stamped on each
// nex.business_canonical row written by the tick harvester.
// --------------------------------------------------------
// Lives in its own file so vitest can exercise the shape without
// pulling the server-only writer. Zero IO · zero clock reads (the
// caller passes `discoveredAt`), so tests are deterministic.

export interface CanonicalMetadata {
  readonly source: "osm_overpass";
  readonly bbox: string;
  readonly osm_lat: number;
  readonly osm_lon: number;
  readonly discovered_at: string; // ISO 8601
  readonly cycle_id: string;      // UUID · stamped at tick start
}

export interface CanonicalMetadataInput {
  readonly bbox: string;
  readonly osmLat: number;
  readonly osmLon: number;
  readonly cycleId: string;
  readonly discoveredAt?: Date;
}

/** Build the metadata object for a single DISCOVERED canonical row.
 *  All keys present · OSM provenance (`source`, `bbox`, `osm_lat`,
 *  `osm_lon`) remains intact alongside the new `cycle_id`. Preserves
 *  the previous key order so grep-based consumers of the metadata
 *  blob keep working. */
export function buildCanonicalMetadata(
  input: CanonicalMetadataInput,
): CanonicalMetadata {
  const discoveredAt = (input.discoveredAt ?? new Date()).toISOString();
  return {
    source: "osm_overpass",
    bbox: input.bbox,
    osm_lat: input.osmLat,
    osm_lon: input.osmLon,
    discovered_at: discoveredAt,
    cycle_id: input.cycleId,
  };
}
