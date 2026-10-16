// src/lib/nex-native/user-location/reverse-geocode.ts
//
// Server-side reverse-geocoder (lat/lng → city + ISO country code).
// -----------------------------------------------------------------
// Used by NEX Discover's hard location gate to turn a browser-GPS
// hit into a human-readable "Viewing Jakarta, Indonesia" line + a
// country flag emoji.
//
// Transport · Nominatim (OSM) public reverse endpoint. Server-side
// so the browser never leaks the viewer's coords to a 3rd-party
// script. 3-second timeout · failures return null · the page then
// falls back to showing coords without a city label.
//
// Attribution: © OpenStreetMap contributors (ODbL).
//
// This is intentionally lightweight and dependency-free. If NEX
// later ships its own reverse-geocoder (city centroid index on
// nex.business_canonical, offline bbox table, etc.) it drops in
// behind the same signature.

"use server";

// NOTE: `flagEmojiForIso` and `countryNameForIso` moved to the pure
// module `./country-labels` so they can be imported from client +
// server code without going through a server-action round trip.

export interface ReverseGeocodeResult {
  readonly cityLabel: string | null;
  readonly countryIso: string | null;
}

const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";

/** Resolve (lat, lng) → city + ISO-2 country via OSM Nominatim.
 *  Returns null when the input is invalid, the request times out,
 *  or the response has no address block. Never throws. */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult | null> {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return null;

  const url = new URL(NOMINATIM);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "10"); // city-level
  url.searchParams.set("addressdetails", "1");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      headers: {
        // Nominatim usage policy · identify your app so they can
        // rate-limit per-caller instead of blocking the shared pool.
        "User-Agent": "nex-native/discover (support@nex.app)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        suburb?: string;
        county?: string;
        state?: string;
        country_code?: string;
      };
    };
    const addr = data?.address ?? {};
    const cityLabel =
      addr.city?.trim() ||
      addr.town?.trim() ||
      addr.village?.trim() ||
      addr.municipality?.trim() ||
      addr.suburb?.trim() ||
      addr.county?.trim() ||
      addr.state?.trim() ||
      null;
    const countryIso =
      typeof addr.country_code === "string" && /^[a-z]{2}$/i.test(addr.country_code)
        ? addr.country_code.toUpperCase()
        : null;
    return { cityLabel, countryIso };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

