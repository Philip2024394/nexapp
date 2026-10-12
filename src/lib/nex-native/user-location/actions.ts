// src/lib/nex-native/user-location/actions.ts
//
// Server actions for the hybrid user-location system.
//
// Scope:
//   · saveUserLocation       · validates incoming shape and writes to
//                               the viewer's account IF they are signed
//                               in (anonymous visitors use localStorage
//                               directly from the client; this action
//                               is a no-op without a session)
//   · clearUserLocationFromAccount · remove the server copy
//   · resolveManualCityLocation · take a user-typed city string, call
//                                 the geocoder, return a candidate
//                                 SavedLocation (NOT persisted yet;
//                                 the caller confirms + saves)
//
// The actions never read or expose another user's location.

"use server";

import { resolveNexAppSessionFromContext } from "../app/session";
import { geocodeCityToCentroid } from "../directory/city-centroid-geocoder";
import {
  readAccountLocation,
  writeAccountLocation,
  clearAccountLocation,
} from "./account-store";
import {
  parseSavedLocation,
  makeManualCityLocation,
  type SavedLocation,
} from "./types";

export interface SaveLocationResult {
  readonly ok: boolean;
  readonly reason: string | null;
}

/** Persist a saved location on the viewer's own account. Anonymous
 *  visitors get `{ ok: false, reason: "anonymous" }` · they persist to
 *  localStorage client-side instead. */
export async function saveUserLocationToAccountAction(
  incoming: SavedLocation,
): Promise<SaveLocationResult> {
  const parsed = parseSavedLocation(incoming);
  if (parsed === null) return { ok: false, reason: "invalid-shape" };

  const session = await resolveNexAppSessionFromContext();
  if (session?.account?.id === undefined || session.account.id === null) {
    return { ok: false, reason: "anonymous" };
  }
  const result = await writeAccountLocation(session.account.id, parsed);
  if (result.ok) return { ok: true, reason: null };
  return { ok: false, reason: result.reason };
}

/** Clear the viewer's server-side saved location. */
export async function clearUserLocationFromAccountAction(): Promise<SaveLocationResult> {
  const session = await resolveNexAppSessionFromContext();
  if (session?.account?.id === undefined || session.account.id === null) {
    return { ok: false, reason: "anonymous" };
  }
  const result = await clearAccountLocation(session.account.id);
  if (result.ok) return { ok: true, reason: null };
  return { ok: false, reason: result.reason };
}

/** Read the viewer's own saved server-side location. Returns null for
 *  anonymous visitors or when nothing is stored. */
export async function readUserLocationFromAccount(): Promise<SavedLocation | null> {
  const session = await resolveNexAppSessionFromContext();
  if (session?.account?.id === undefined || session.account.id === null) {
    return null;
  }
  return readAccountLocation(session.account.id);
}

export interface ResolveManualCityResult {
  readonly ok: boolean;
  readonly candidate: SavedLocation | null;
  /** How many businesses in the corpus support this centroid · higher
   *  = more trustworthy. Null when the resolver returned no match. */
  readonly supportRows: number | null;
  readonly reason: string | null;
}

/** Resolve a user-typed city string to a candidate SavedLocation
 *  (manual_city source). Does NOT persist · the client previews the
 *  candidate and then calls save with the user's confirmation. */
export async function resolveManualCityAction(
  query: string,
): Promise<ResolveManualCityResult> {
  if (typeof query !== "string") {
    return { ok: false, candidate: null, supportRows: null, reason: "invalid-input" };
  }
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return { ok: false, candidate: null, supportRows: null, reason: "empty" };
  }
  const centroid = await geocodeCityToCentroid(trimmed);
  if (centroid === null) {
    return { ok: false, candidate: null, supportRows: null, reason: "not-found" };
  }
  const candidate = makeManualCityLocation({
    lat: centroid.lat,
    lng: centroid.lng,
    cityLabel: centroid.cityLabel,
    countryIso: centroid.countryIso,
  });
  if (candidate === null) {
    return { ok: false, candidate: null, supportRows: null, reason: "invalid-shape" };
  }
  return {
    ok: true,
    candidate,
    supportRows: centroid.supportRows,
    reason: null,
  };
}
