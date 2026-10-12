// src/lib/nex-native/user-location/user-location-provider.tsx
//
// Shared client context for the hybrid saved-location state. One
// provider per route · wraps all descendants that need to see the
// resolved location (LocationGate · DirectoryResults · future
// distance-aware components).
//
// Single source of truth. Avoids duplicate hook instances that would
// each hold their own copy of state and drift when one is updated.

"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useResolvedUserLocation } from "./use-resolved-user-location";
import type { SavedLocation } from "./types";

export interface UserLocationContextValue {
  readonly location: SavedLocation | null;
  readonly isHydrated: boolean;
  readonly setLocation: (loc: SavedLocation) => Promise<void>;
  readonly clearLocation: () => Promise<void>;
}

const UserLocationContext = createContext<UserLocationContextValue | null>(
  null,
);

export interface UserLocationProviderProps {
  readonly initialServerLocation: SavedLocation | null;
  readonly children: ReactNode;
}

export function UserLocationProvider(
  props: UserLocationProviderProps,
): React.JSX.Element {
  const resolved = useResolvedUserLocation({
    initialServerLocation: props.initialServerLocation,
  });
  const value = useMemo<UserLocationContextValue>(
    () => ({
      location: resolved.location,
      isHydrated: resolved.isHydrated,
      setLocation: resolved.setLocation,
      clearLocation: resolved.clearLocation,
    }),
    [
      resolved.location,
      resolved.isHydrated,
      resolved.setLocation,
      resolved.clearLocation,
    ],
  );
  return (
    <UserLocationContext.Provider value={value}>
      {props.children}
    </UserLocationContext.Provider>
  );
}

/** Consume the shared saved-location context. Returns a safe
 *  "no-location, no-op" value when called outside a provider · lets
 *  descendants render honestly without crashing when the gate is
 *  absent (e.g. a page that doesn't mount the provider). */
export function useUserLocationContext(): UserLocationContextValue {
  const ctx = useContext(UserLocationContext);
  if (ctx !== null) return ctx;
  return NO_LOCATION_FALLBACK;
}

const NO_LOCATION_FALLBACK: UserLocationContextValue = {
  location: null,
  isHydrated: false,
  setLocation: async () => undefined,
  clearLocation: async () => undefined,
};
