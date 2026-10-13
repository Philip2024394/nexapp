// src/lib/nex-native/harvest/city-rotation.ts
//
// Per-country city bounding-box rotation for the nexapp harvester.
// -----------------------------------------------------------------
// Each entry represents a bbox (south, west, north, east) the
// harvester issues to OSM Overpass per tick. The rotation picker
// walks through these in order per country, so a single hourly
// cron produces predictable, bounded coverage.
//
// Edit this file to add cities · the harvester reads from here and
// does NOT need a separate deploy of the walker. Keep bboxes small
// (≤ ~30 km diagonal) so one Overpass response stays under Vercel's
// 300-second serverless ceiling even at busy times.
//
// Pure module · no `server-only` import so vitest can exercise the
// deterministic rotation picker in CI. All consumers (route +
// fetcher) are server-only on their own.

export interface CityBbox {
  readonly id: string;          // stable slug e.g. "id-jakarta"
  readonly isoAlpha2: string;   // "ID", "GB", "US", "AU", "DE", …
  readonly cityName: string;    // "Jakarta"
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
}

/** Starter rotation · each supported country gets 2-5 cities so the
 *  first harvest wave has a real result footprint without burning
 *  OSM Overpass quota. Extend per market as coverage proves out. */
export const CITY_ROTATION: readonly CityBbox[] = [
  // 🇮🇩 Indonesia · re-activation targets
  { id: "id-jakarta",    isoAlpha2: "ID", cityName: "Jakarta",     south: -6.37, west: 106.70, north: -6.09, east: 106.97 },
  { id: "id-surabaya",   isoAlpha2: "ID", cityName: "Surabaya",    south: -7.37, west: 112.63, north: -7.17, east: 112.84 },
  { id: "id-bandung",    isoAlpha2: "ID", cityName: "Bandung",     south: -6.98, west: 107.52, north: -6.84, east: 107.72 },
  { id: "id-bali",       isoAlpha2: "ID", cityName: "Denpasar",    south: -8.76, west: 115.15, north: -8.58, east: 115.30 },
  { id: "id-yogyakarta", isoAlpha2: "ID", cityName: "Yogyakarta",  south: -7.90, west: 110.33, north: -7.70, east: 110.46 },

  // 🇬🇧 United Kingdom
  { id: "gb-london",     isoAlpha2: "GB", cityName: "London",      south: 51.38, west: -0.33, north: 51.63, east:  0.14 },
  { id: "gb-manchester", isoAlpha2: "GB", cityName: "Manchester",  south: 53.40, west: -2.32, north: 53.56, east: -2.11 },
  { id: "gb-birmingham", isoAlpha2: "GB", cityName: "Birmingham",  south: 52.37, west: -1.98, north: 52.57, east: -1.72 },
  { id: "gb-edinburgh",  isoAlpha2: "GB", cityName: "Edinburgh",   south: 55.89, west: -3.28, north: 55.99, east: -3.11 },

  // 🇺🇸 United States
  { id: "us-nyc",        isoAlpha2: "US", cityName: "New York",    south: 40.57, west: -74.14, north: 40.90, east: -73.79 },
  { id: "us-la",         isoAlpha2: "US", cityName: "Los Angeles", south: 33.78, west: -118.40, north: 34.14, east: -118.17 },
  { id: "us-chicago",    isoAlpha2: "US", cityName: "Chicago",     south: 41.65, west: -87.84, north: 42.02, east: -87.52 },
  { id: "us-sf",         isoAlpha2: "US", cityName: "San Francisco", south: 37.70, west: -122.52, north: 37.83, east: -122.36 },
  { id: "us-miami",      isoAlpha2: "US", cityName: "Miami",       south: 25.70, west: -80.33, north: 25.85, east: -80.14 },

  // 🇦🇺 Australia
  { id: "au-sydney",     isoAlpha2: "AU", cityName: "Sydney",      south: -34.00, west: 150.95, north: -33.70, east: 151.30 },
  { id: "au-melbourne",  isoAlpha2: "AU", cityName: "Melbourne",   south: -37.90, west: 144.80, north: -37.70, east: 145.05 },
  { id: "au-brisbane",   isoAlpha2: "AU", cityName: "Brisbane",    south: -27.55, west: 152.95, north: -27.40, east: 153.15 },
  { id: "au-perth",      isoAlpha2: "AU", cityName: "Perth",       south: -32.00, west: 115.80, north: -31.85, east: 115.95 },

  // 🇩🇪 Germany
  { id: "de-berlin",     isoAlpha2: "DE", cityName: "Berlin",      south: 52.40, west: 13.20, north: 52.65, east: 13.60 },
  { id: "de-munich",     isoAlpha2: "DE", cityName: "Munich",      south: 48.07, west: 11.42, north: 48.25, east: 11.72 },
  { id: "de-hamburg",    isoAlpha2: "DE", cityName: "Hamburg",     south: 53.42, west:  9.80, north: 53.65, east: 10.20 },

  // 🇫🇷 France
  { id: "fr-paris",      isoAlpha2: "FR", cityName: "Paris",       south: 48.80, west:  2.22, north: 48.90, east:  2.47 },
  { id: "fr-lyon",       isoAlpha2: "FR", cityName: "Lyon",        south: 45.70, west:  4.75, north: 45.80, east:  4.90 },

  // 🇪🇸 Spain
  { id: "es-madrid",     isoAlpha2: "ES", cityName: "Madrid",      south: 40.33, west: -3.84, north: 40.56, east: -3.52 },
  { id: "es-barcelona",  isoAlpha2: "ES", cityName: "Barcelona",   south: 41.33, west:  2.07, north: 41.47, east:  2.23 },

  // 🇮🇹 Italy
  { id: "it-rome",       isoAlpha2: "IT", cityName: "Rome",        south: 41.80, west: 12.37, north: 42.00, east: 12.60 },
  { id: "it-milan",      isoAlpha2: "IT", cityName: "Milan",       south: 45.40, west:  9.08, north: 45.54, east:  9.28 },

  // 🇳🇱 Netherlands
  { id: "nl-amsterdam",  isoAlpha2: "NL", cityName: "Amsterdam",   south: 52.30, west:  4.75, north: 52.43, east:  5.00 },
];

/** Pick the next city to harvest. Uses a round-robin by iso then
 *  deterministic city order within country · the harvester
 *  dispatches one city per tick so a long-dormant country catches
 *  up fast once activation kicks in. */
export function pickNextCity(
  state: { readonly cursor: string | null },
  allowedIsos: ReadonlySet<string>,
): CityBbox | null {
  const pool = CITY_ROTATION.filter((c) => allowedIsos.has(c.isoAlpha2));
  if (pool.length === 0) return null;
  if (!state.cursor) return pool[0];
  const idx = pool.findIndex((c) => c.id === state.cursor);
  if (idx < 0) return pool[0];
  return pool[(idx + 1) % pool.length];
}
