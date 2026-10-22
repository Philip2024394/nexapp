"use client";

// src/app/nex-native/status/_device-presence-provider.tsx
//
// Device-level Status presence + serve-host mount. Wraps every
// `/nex-native/status/*` route via status/layout.tsx so that:
//
//   · The device announces its owner presence once per session on the
//     shared `nex:status-owners` Supabase channel · survives route
//     changes within /status/* (composer → landing → viewer etc).
//   · The device runs StatusServeHost listening on its own service
//     channel so remote viewers' `status-list-request` /
//     `status-request` events hit a live owner.
//
// Lifetime of these two primitives was previously local to the
// composer (started on mount, stopped on unmount) · that meant
// viewers only saw an owner during the ~seconds the composer was
// open. World-standard behaviour is "the device acts as a server for
// its own statuses whenever the app is open" (WhatsApp Status
// equivalent). This provider makes that true for the status subtree.
//
// Exposes a React context so children (composer, future surfaces)
// can call `refreshActivity()` after save without each surface
// instantiating its own presence manager.

import * as React from "react";
import { StatusOwnerPresence } from "@/lib/nex-native/status-p2p/presence";
import { StatusServeHost } from "@/lib/nex-native/status-p2p/serve";
import { listMyStatuses } from "@/lib/nex-native/status-storage/store";

interface StatusDeviceContextValue {
  readonly refreshActivity: () => Promise<void>;
}

const noopCtx: StatusDeviceContextValue = {
  refreshActivity: async () => {
    /* no provider mounted · callers degrade gracefully */
  },
};

const StatusDeviceContext =
  React.createContext<StatusDeviceContextValue>(noopCtx);

export function useStatusDevice(): StatusDeviceContextValue {
  return React.useContext(StatusDeviceContext);
}

export function StatusDeviceProvider({
  ownerAccountId,
  children,
}: {
  readonly ownerAccountId: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const presenceRef = React.useRef<StatusOwnerPresence | null>(null);
  const serveRef = React.useRef<StatusServeHost | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const presence = new StatusOwnerPresence({ ownerAccountId });
    presenceRef.current = presence;
    void presence.start();

    // Only start the serve host if this device actually has statuses
    // worth serving. Checking IndexedDB on mount keeps the service
    // channel quiet for devices that have never posted.
    void (async () => {
      try {
        const mine = await listMyStatuses(ownerAccountId);
        if (cancelled) return;
        if (mine.length === 0) return;
        const host = new StatusServeHost({ ownerAccountId });
        serveRef.current = host;
        await host.start();
      } catch {
        /* best-effort · IndexedDB may be unavailable (SSR hydrate etc) */
      }
    })();

    return () => {
      cancelled = true;
      const p = presenceRef.current;
      const s = serveRef.current;
      presenceRef.current = null;
      serveRef.current = null;
      if (p) void p.stop();
      if (s) void s.stop();
    };
  }, [ownerAccountId]);

  const refreshActivity = React.useCallback(async () => {
    const p = presenceRef.current;
    if (!p) return;
    try {
      await p.refreshActivity();
    } catch {
      /* best-effort · presence may not have reached subscribed yet */
    }

    // If a new status was just saved and the serve host wasn't
    // running (first-ever save), start it now so viewers can fetch.
    if (!serveRef.current) {
      try {
        const mine = await listMyStatuses(ownerAccountId);
        if (mine.length === 0) return;
        const host = new StatusServeHost({ ownerAccountId });
        serveRef.current = host;
        await host.start();
      } catch {
        /* ignore */
      }
    }
  }, [ownerAccountId]);

  const value = React.useMemo<StatusDeviceContextValue>(
    () => ({ refreshActivity }),
    [refreshActivity],
  );

  return (
    <StatusDeviceContext.Provider value={value}>
      {children}
    </StatusDeviceContext.Provider>
  );
}
