// src/components/nex-native/directory/LocationGate.tsx
//
// LocationGate · the soft entry gate for /nex-native/directory and
// /nex-native/search. Owns the SetLocationChip + LocationSetup
// overlay interaction. Exposes the resolved saved location to
// descendants via `onLocationResolved` so the page can thread it
// into distance-aware components (DirectoryResults).
//
// Soft-gate rules (per user-decided spec):
//   · First visit without saved location → overlay opens
//     automatically (after client hydration).
//   · User can dismiss ("Continue without setting a location") →
//     overlay closes; the chip stays visible so they can Set it
//     later from the same spot. We do NOT redirect to home.
//   · User can re-open the overlay any time via the chip's Change
//     action, which also handles the already-set case.
//
// NEVER:
//   · Auto-prompts navigator.geolocation. The chip's "Use my current
//     location" button is user-initiated.
//   · Blocks rendering of the page content. The gate is an overlay,
//     not a route redirect. Deep links to /nex-native/directory/[id]
//     bypass this component entirely (that route doesn't mount it).

"use client";

import { useCallback, useEffect, useState } from "react";
import { LocationSetup } from "./LocationSetup";
import { SetLocationChip } from "./SetLocationChip";
import { useUserLocationContext } from "@/lib/nex-native/user-location/user-location-provider";
import type { SavedLocation } from "@/lib/nex-native/user-location/types";

export interface LocationGateProps {
  /** Consumed via context; props-free so routes can keep the gate
   *  pure-presentational and the provider owns the state. */
  readonly _marker?: never;
}

export function LocationGate(_props: LocationGateProps = {}): React.JSX.Element {
  const { location, isHydrated, setLocation } = useUserLocationContext();

  // Open-state and dismiss-state are session-scoped (NOT persisted).
  // The gate opens automatically on first entry when no location is
  // resolved; after a dismiss it stays closed until the chip is
  // tapped. A fresh page load gets a fresh gate (the saved location
  // state determines whether it still appears).
  const [open, setOpen] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (!isHydrated) return;
    if (location !== null) {
      setOpen(false);
      return;
    }
    if (dismissed) return;
    setOpen(true);
  }, [isHydrated, location, dismissed]);

  const handleLocationChosen = useCallback(
    async (loc: SavedLocation) => {
      await setLocation(loc);
      setOpen(false);
      setDismissed(false);
    },
    [setLocation],
  );

  const handleDismiss = useCallback(() => {
    setOpen(false);
    setDismissed(true);
  }, []);

  const handleOpenFromChip = useCallback(() => {
    setOpen(true);
    setDismissed(false);
  }, []);

  return (
    <div data-nex-location-gate data-nex-location-gate-has={location !== null ? "true" : "false"}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          marginTop: 12,
          marginBottom: 6,
        }}
      >
        <SetLocationChip
          location={location}
          onOpenSetup={handleOpenFromChip}
        />
      </div>
      <LocationSetup
        open={open}
        onLocationChosen={handleLocationChosen}
        onDismiss={handleDismiss}
      />
    </div>
  );
}
