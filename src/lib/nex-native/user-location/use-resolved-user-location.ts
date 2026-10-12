// src/lib/nex-native/user-location/use-resolved-user-location.ts
//
// Client-only hook that produces the viewer's effective saved location.
//
// Sources, in order of preference:
//   1. SSR hint from the account store (signed-in users · passed as
//      prop by the server component)
//   2. localStorage (anonymous visitors · hydrated after mount)
//
// Writes go to BOTH stores (localStorage always · account store via
// server action when signed in · action no-ops for anonymous).
// Stale-write prevention is enforced server-side in account-store.ts.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  readLocalLocation,
  writeLocalLocation,
  clearLocalLocation,
} from "./local-store";
import {
  saveUserLocationToAccountAction,
  clearUserLocationFromAccountAction,
} from "./actions";
import { isUsableLocation, type SavedLocation } from "./types";

export interface UseResolvedUserLocationArgs {
  /** Server-rendered initial value from `readUserLocationFromAccount()`.
   *  Null for anonymous visitors or when nothing is stored server-side. */
  readonly initialServerLocation: SavedLocation | null;
}

export interface UseResolvedUserLocationResult {
  /** The resolved location, if any. Null when no fresh value exists in
   *  any store. */
  readonly location: SavedLocation | null;
  /** True after the client has read localStorage. Server-rendered
   *  components see false on first render; client remount flips it. */
  readonly isHydrated: boolean;
  /** Persist a new location. Writes localStorage synchronously, then
   *  asynchronously updates the account store if signed in. */
  readonly setLocation: (loc: SavedLocation) => Promise<void>;
  /** Clear the saved location in both stores. */
  readonly clearLocation: () => Promise<void>;
}

export function useResolvedUserLocation(
  args: UseResolvedUserLocationArgs,
): UseResolvedUserLocationResult {
  const { initialServerLocation } = args;

  const [clientLocation, setClientLocation] = useState<SavedLocation | null>(
    initialServerLocation,
  );
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Hydrate from localStorage on mount. The server hint takes
  // precedence (fresher auth); fall back to local when server is null.
  useEffect(() => {
    const now = new Date();
    const local = readLocalLocation(now);
    if (initialServerLocation !== null && isUsableLocation(initialServerLocation, now)) {
      setClientLocation(initialServerLocation);
    } else if (local !== null) {
      setClientLocation(local);
    } else {
      setClientLocation(null);
    }
    setIsHydrated(true);
  }, [initialServerLocation]);

  const setLocation = useCallback(async (loc: SavedLocation) => {
    writeLocalLocation(loc);
    setClientLocation(loc);
    try {
      await saveUserLocationToAccountAction(loc);
    } catch {
      // best-effort server sync · localStorage is the source of truth
      // for anonymous visitors anyway
    }
  }, []);

  const clearLocation = useCallback(async () => {
    clearLocalLocation();
    setClientLocation(null);
    try {
      await clearUserLocationFromAccountAction();
    } catch {
      // best-effort · localStorage already cleared
    }
  }, []);

  return useMemo(
    () => ({
      location: clientLocation,
      isHydrated,
      setLocation,
      clearLocation,
    }),
    [clientLocation, isHydrated, setLocation, clearLocation],
  );
}
