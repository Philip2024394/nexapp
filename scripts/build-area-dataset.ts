// scripts/build-area-dataset.ts
//
// NEX Location Sharing · Phase 1A · reproducible dataset build script.
// Owner-authorised 2026-11-05.
// -----------------------------------------------------------------------------
// Reads a GeoJSON FeatureCollection (typically an OSM extract exported
// via Overpass API or a government open-data portal) and emits a
// bundled AreaDataset JSON for the Area-only resolver.
//
// Usage:
//   npx tsx scripts/build-area-dataset.ts \
//     --input ./raw/ireland-neighbourhoods.geojson \
//     --country-iso IE \
//     --country-label "Ireland" \
//     --source "OpenStreetMap contributors via Overpass API 2026-11" \
//     --license "ODbL 1.0 (OpenStreetMap Foundation)" \
//     --simplify-tolerance 0.0003 \
//     --out ./public/nex-location/ireland-areas.json
//
// Input GeoJSON conventions:
//   · Each feature MUST have properties.name (becomes area_label).
//   · Optional properties.code (preferred) OR we generate from name.
//   · Geometry MUST be Polygon or MultiPolygon.
//
// Output:
//   · AreaDataset JSON matching src/lib/nex-native/location/area-resolver.ts.
//   · generated_at = real ISO timestamp (NOT prefixed with "fixture-").
//   · Production-ready IF the input was validated · script does not
//     validate that for you · you must certify the input source + license.
//
// This script runs IN YOUR ENVIRONMENT · it is NOT invoked at app build
// time · the resulting JSON is committed under public/nex-location/.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface CliArgs {
  readonly input: string;
  readonly out: string;
  readonly countryIso: string;
  readonly countryLabel: string;
  readonly source: string;
  readonly license: string;
  readonly simplifyTolerance: number;
}

interface GeoJsonFeature {
  readonly type: "Feature";
  readonly properties: { readonly name?: string; readonly code?: string };
  readonly geometry:
    | {
        readonly type: "Polygon";
        readonly coordinates: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
      }
    | {
        readonly type: "MultiPolygon";
        readonly coordinates: ReadonlyArray<
          ReadonlyArray<ReadonlyArray<readonly [number, number]>>
        >;
      };
}

interface GeoJsonCollection {
  readonly type: "FeatureCollection";
  readonly features: ReadonlyArray<GeoJsonFeature>;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const get = (k: string): string | undefined => {
    const i = argv.indexOf(`--${k}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const required = (k: string): string => {
    const v = get(k);
    if (!v) throw new Error(`missing required --${k}`);
    return v;
  };
  return {
    input: required("input"),
    out: required("out"),
    countryIso: required("country-iso").toUpperCase(),
    countryLabel: required("country-label"),
    source: required("source"),
    license: required("license"),
    simplifyTolerance: Number(get("simplify-tolerance") ?? "0.0003"),
  };
}

function readGeoJson(path: string): GeoJsonCollection {
  const raw = readFileSync(resolve(path), "utf8");
  const parsed = JSON.parse(raw);
  if (parsed?.type !== "FeatureCollection") {
    throw new Error("input must be a GeoJSON FeatureCollection");
  }
  return parsed as GeoJsonCollection;
}

/** Douglas-Peucker polyline simplification. Keeps the polygon shape
 *  recognisable while reducing storage. Tolerance is in degrees. */
function simplify(
  points: ReadonlyArray<readonly [number, number]>,
  tol: number,
): Array<[number, number]> {
  if (points.length < 3) return points.map((p) => [p[0], p[1]] as [number, number]);
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = perpendicularDistance(points[i]!, points[a]!, points[b]!);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  const out: Array<[number, number]> = [];
  for (let i = 0; i < points.length; i++) {
    if (keep[i]) out.push([points[i]![0], points[i]![1]]);
  }
  return out;
}

function perpendicularDistance(
  p: readonly [number, number],
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) {
    const ex = p[0] - a[0];
    const ey = p[1] - a[1];
    return Math.sqrt(ex * ex + ey * ey);
  }
  const num = Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]);
  const den = Math.sqrt(dx * dx + dy * dy);
  return num / den;
}

function bboxOf(ring: ReadonlyArray<readonly [number, number]>): [number, number, number, number] {
  let lngMin = Infinity;
  let latMin = Infinity;
  let lngMax = -Infinity;
  let latMax = -Infinity;
  for (const p of ring) {
    if (p[0] < lngMin) lngMin = p[0];
    if (p[0] > lngMax) lngMax = p[0];
    if (p[1] < latMin) latMin = p[1];
    if (p[1] > latMax) latMax = p[1];
  }
  return [lngMin, latMin, lngMax, latMax];
}

function codeFromName(name: string, iso: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `${iso}-${slug}`;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const collection = readGeoJson(args.input);

  const areas: Array<{
    code: string;
    label: string;
    bbox: [number, number, number, number];
    polygon: Array<[number, number]>;
  }> = [];

  for (const feature of collection.features) {
    const name = feature.properties?.name;
    if (!name || typeof name !== "string") continue;
    const code =
      feature.properties?.code && feature.properties.code.length > 0
        ? feature.properties.code
        : codeFromName(name, args.countryIso);

    // Extract outer ring from Polygon / first Polygon's outer ring from MultiPolygon.
    let ring: ReadonlyArray<readonly [number, number]> | null = null;
    if (feature.geometry.type === "Polygon") {
      ring = feature.geometry.coordinates[0] ?? null;
    } else if (feature.geometry.type === "MultiPolygon") {
      ring = feature.geometry.coordinates[0]?.[0] ?? null;
    }
    if (!ring || ring.length < 3) continue;

    const simplified = simplify(ring, args.simplifyTolerance);
    if (simplified.length < 3) continue;

    areas.push({
      code,
      label: name,
      bbox: bboxOf(simplified),
      polygon: simplified,
    });
  }

  if (areas.length === 0) {
    throw new Error("no valid polygons produced · check input + simplify-tolerance");
  }

  const dataset = {
    country_iso: args.countryIso,
    country_label: args.countryLabel,
    generated_at: new Date().toISOString(),
    source: args.source,
    license: args.license,
    areas,
  };

  writeFileSync(resolve(args.out), JSON.stringify(dataset) + "\n", "utf8");
  // eslint-disable-next-line no-console
  console.log(
    `Wrote ${areas.length} areas to ${args.out} (${args.countryIso} · ${args.countryLabel})`,
  );
}

main();
