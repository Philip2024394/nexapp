// src/lib/nex-native/location/area-resolver.ts
//
// NEX Location Sharing · Phase 1A · local area polygon lookup.
// Owner-authorised 2026-11-05.
// -----------------------------------------------------------------------------
// Resolves (lat, lng) to a labelled area using a bundled, static polygon
// dataset. Zero external network calls · the dataset is a public JSON
// asset loaded on demand by the picker.
//
// Hard invariants:
//   · Never calls any geocoder (no Nominatim · no Mapbox · no Google).
//   · Never sends coordinates off-device.
//   · Returns null when no matching polygon exists · caller must surface
//     "Area label not available" UI, not silently fall back to anything.
//   · In production builds, if the dataset is a fixture (generated_at
//     starts with "fixture-"), Area-only is UNAVAILABLE and this resolver
//     returns null regardless of input. Production readiness gated on
//     real validated data being generated and loaded.

export interface AreaPolygon {
  readonly code: string;
  readonly label: string;
  /** [lngMin, latMin, lngMax, latMax] for fast bounding-box pre-filter. */
  readonly bbox: readonly [number, number, number, number];
  /** Simplified polygon ring · [lng, lat] pairs · last point not required
   *  to repeat the first (point-in-polygon tolerates both). */
  readonly polygon: ReadonlyArray<readonly [number, number]>;
}

export interface AreaDataset {
  readonly country_iso: string;
  readonly country_label: string;
  readonly generated_at: string;
  readonly source: string;
  readonly license: string;
  readonly areas: ReadonlyArray<AreaPolygon>;
}

export interface AreaMatch {
  readonly area_code: string;
  readonly area_label: string;
  readonly country_iso: string;
  readonly country_label: string;
}

/** Returns true when the dataset is a development fixture (not real data).
 *  Production surfaces must refuse Area-only when this returns true. */
export function isFixtureDataset(dataset: AreaDataset): boolean {
  return dataset.generated_at.startsWith("fixture-");
}

/** Find the area containing (lat, lng) in the supplied dataset. Returns
 *  null when no area matches · caller surfaces "unavailable" copy. */
export function resolveArea(
  lat: number,
  lng: number,
  dataset: AreaDataset,
  options?: { readonly allowFixture?: boolean },
): AreaMatch | null {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return null;

  // Production surfaces pass allowFixture=false · fixture datasets are
  // ignored even if loaded.
  if (isFixtureDataset(dataset) && !options?.allowFixture) {
    return null;
  }

  for (const area of dataset.areas) {
    if (!bboxContains(area.bbox, lat, lng)) continue;
    if (pointInPolygon(lat, lng, area.polygon)) {
      return {
        area_code: area.code,
        area_label: area.label,
        country_iso: dataset.country_iso,
        country_label: dataset.country_label,
      };
    }
  }
  return null;
}

/** Fast bounding-box pre-filter · coordinates in [lngMin, latMin,
 *  lngMax, latMax] form. */
function bboxContains(
  bbox: readonly [number, number, number, number],
  lat: number,
  lng: number,
): boolean {
  return (
    lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]
  );
}

/** Ray-casting point-in-polygon · treats `polygon` as a single ring.
 *  Uses lng as x, lat as y. */
function pointInPolygon(
  lat: number,
  lng: number,
  polygon: ReadonlyArray<readonly [number, number]>,
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]![0];
    const yi = polygon[i]![1];
    const xj = polygon[j]![0];
    const yj = polygon[j]![1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
