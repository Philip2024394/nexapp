// src/lib/nex-native/user-location/local-store.ts
//
// Anonymous-visitor saved-location store · localStorage-backed.
// Client-only. Safe no-op in SSR / private browsing / quota failure.
//
// Returns null when:
//   · window.localStorage is unavailable (SSR / disabled)
//   · the stored value is missing / malformed
//   · the stored value is past the 30-day TTL (auto-clears)

import {
  USER_LOCATION_LOCAL_STORAGE_KEY,
  parseSavedLocation,
  isLocationFresh,
  type SavedLocation,
} from "./types";

export function readLocalLocation(now: Date = new Date()): SavedLocation | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(USER_LOCATION_LOCAL_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    try {
      window.localStorage.removeItem(USER_LOCATION_LOCAL_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }

  const parsed = parseSavedLocation(parsedJson);
  if (parsed === null) {
    try {
      window.localStorage.removeItem(USER_LOCATION_LOCAL_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }

  if (!isLocationFresh(parsed, now)) {
    try {
      window.localStorage.removeItem(USER_LOCATION_LOCAL_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }

  return parsed;
}

export function writeLocalLocation(loc: SavedLocation): void {
  if (typeof window === "undefined") return;
  const validated = parseSavedLocation(loc);
  if (validated === null) return;
  try {
    window.localStorage.setItem(
      USER_LOCATION_LOCAL_STORAGE_KEY,
      JSON.stringify(validated),
    );
  } catch {
    /* quota / private-browsing · silent no-op */
  }
}

export function clearLocalLocation(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(USER_LOCATION_LOCAL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
