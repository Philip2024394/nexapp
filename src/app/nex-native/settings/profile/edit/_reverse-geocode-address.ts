"use server";

// src/app/nex-native/settings/profile/edit/_reverse-geocode-address.ts
//
// NEX Ireland · reverse-geocoder for the profile address field.
// Owner directive 2026-11-04 · "Set my location" button on
// /nex-native/settings/profile/edit.
// --------------------------------------------------------
// Why a page-local action and not the shared `reverseGeocode`?
//   The shared helper is city-level (zoom=10) and returns only
//   {cityLabel, countryIso} — intentional for the Discover hard
//   location gate. The profile address field needs a FULL postal
//   address string (building/street level), so this action calls
//   Nominatim with zoom=18 and composes house_number/road/town/
//   county/postcode/country into a single comma-separated string.
//
// Transport · Nominatim (OSM) · same attribution + rate-limit
// policy as the shared helper. 4-second timeout · failures return
// null · the button then surfaces a short retry message to the
// user and stays in its idle state.

const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";

export interface ReverseGeocodeAddressResult {
  readonly formatted: string;
}

export async function reverseGeocodeAddressAction(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeAddressResult | null> {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return null;

  const url = new URL(NOMINATIM);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "nex-native/profile-edit (support@nex.app)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      display_name?: string;
      address?: {
        house_number?: string;
        road?: string;
        residential?: string;
        pedestrian?: string;
        hamlet?: string;
        village?: string;
        town?: string;
        suburb?: string;
        city?: string;
        municipality?: string;
        county?: string;
        state?: string;
        postcode?: string;
        country?: string;
      };
    };

    const a = data?.address ?? {};
    const street = [a.house_number, a.road ?? a.residential ?? a.pedestrian]
      .filter((s): s is string => Boolean(s && s.trim()))
      .join(" ");
    const locality =
      a.town?.trim() ||
      a.city?.trim() ||
      a.village?.trim() ||
      a.suburb?.trim() ||
      a.hamlet?.trim() ||
      a.municipality?.trim() ||
      "";
    const county = a.county?.trim() ?? "";
    const postcode = a.postcode?.trim() ?? "";
    const country = a.country?.trim() ?? "";

    const parts = [street, locality, county, postcode, country].filter(Boolean);
    const formatted = parts.length > 0 ? parts.join(", ") : data?.display_name?.trim() ?? "";
    if (!formatted) return null;

    return { formatted: formatted.slice(0, 300) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
