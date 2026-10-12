// src/lib/nex-native/user-location/types.ts
//
// Hybrid user-location · pure types + validators.
//
// Importable from server AND client. No DB. No network. No clock
// (callers pass `now` for TTL checks).

export const USER_LOCATION_TTL_DAYS = 30;
export const USER_LOCATION_LOCAL_STORAGE_KEY = "nex:userLocation:v1";

export type SavedLocationSource = "gps" | "manual_city";

export interface SavedLocation {
  readonly lat: number;
  readonly lng: number;
  readonly cityLabel: string | null;
  readonly countryIso: string | null;
  readonly source: SavedLocationSource;
  readonly setAt: string;
}

/**
 * Parse an unknown value as a SavedLocation. Returns null when any
 * field is missing, out of range, or malformed. Pure · no clock.
 *
 * manual_city MUST have a non-empty cityLabel · gps MAY lack one
 * (the browser geolocation API does not return a label).
 */
export function parseSavedLocation(raw: unknown): SavedLocation | null {
  if (raw === null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.lat !== "number" || !Number.isFinite(r.lat)) return null;
  if (r.lat < -90 || r.lat > 90) return null;
  if (typeof r.lng !== "number" || !Number.isFinite(r.lng)) return null;
  if (r.lng < -180 || r.lng > 180) return null;

  if (r.source !== "gps" && r.source !== "manual_city") return null;

  if (typeof r.setAt !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(r.setAt)) return null;
  if (Number.isNaN(Date.parse(r.setAt))) return null;

  const cityLabel =
    typeof r.cityLabel === "string" && r.cityLabel.trim().length > 0
      ? r.cityLabel.trim().slice(0, 120)
      : null;
  if (r.source === "manual_city" && cityLabel === null) return null;

  const countryIso =
    typeof r.countryIso === "string" && /^[A-Z]{2}$/.test(r.countryIso)
      ? r.countryIso
      : null;

  return {
    lat: r.lat,
    lng: r.lng,
    cityLabel,
    countryIso,
    source: r.source,
    setAt: r.setAt,
  };
}

/** True when the location was set within the TTL window. Pure. */
export function isLocationFresh(
  loc: SavedLocation,
  now: Date,
  ttlDays: number = USER_LOCATION_TTL_DAYS,
): boolean {
  const setAtMs = Date.parse(loc.setAt);
  if (Number.isNaN(setAtMs)) return false;
  const diffMs = now.getTime() - setAtMs;
  if (diffMs < 0) return false;
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  return diffMs <= ttlMs;
}

/** Combined parse + freshness. Lightweight predicate for anywhere
 *  that needs "do I have a usable location right now?" semantics. */
export function isUsableLocation(
  raw: unknown,
  now: Date,
): raw is SavedLocation {
  const parsed = parseSavedLocation(raw);
  if (parsed === null) return false;
  return isLocationFresh(parsed, now);
}

/** Build a fresh SavedLocation from GPS coords. Pure. */
export function makeGpsLocation(
  lat: number,
  lng: number,
  now: Date = new Date(),
): SavedLocation | null {
  return parseSavedLocation({
    lat,
    lng,
    cityLabel: null,
    countryIso: null,
    source: "gps",
    setAt: now.toISOString(),
  });
}

/** Build a fresh SavedLocation from a manually chosen city. Pure. */
export function makeManualCityLocation(args: {
  readonly lat: number;
  readonly lng: number;
  readonly cityLabel: string;
  readonly countryIso: string | null;
  readonly now?: Date;
}): SavedLocation | null {
  return parseSavedLocation({
    lat: args.lat,
    lng: args.lng,
    cityLabel: args.cityLabel,
    countryIso: args.countryIso,
    source: "manual_city",
    setAt: (args.now ?? new Date()).toISOString(),
  });
}
