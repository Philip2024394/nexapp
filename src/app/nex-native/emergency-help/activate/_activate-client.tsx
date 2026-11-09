"use client";

// src/app/nex-native/emergency-help/activate/_activate-client.tsx
//
// Owner-authorised 2026-11-09. Consent button · writes localStorage
// flag via sealed markEmergencyActivated() · redirects to returnTo.

import * as React from "react";
import { markEmergencyActivated } from "@/lib/nex-native/emergency/emergency-activation";

interface ActivateClientProps {
  readonly returnTo: string;
}

const PALETTE = {
  drawerBg: "#123D2B",
  secondary: "#C6A15B",
  danger: "#9B1C1C",
};

export function ActivateClient({ returnTo }: ActivateClientProps): React.ReactElement {
  const [working, setWorking] = React.useState(false);

  const handleActivate = React.useCallback(() => {
    if (working) return;
    setWorking(true);
    try {
      markEmergencyActivated();
    } catch {
      // Storage disabled · activation is per-session only but we still
      // navigate to the help page so the user isn't stranded.
    }
    if (typeof window !== "undefined") {
      window.location.assign(returnTo);
    }
  }, [returnTo, working]);

  return (
    <button
      type="button"
      onClick={handleActivate}
      disabled={working}
      aria-label="Activate Emergency help"
      style={{
        width: "100%",
        padding: "14px 18px",
        borderRadius: 12,
        background: working ? "rgba(155,28,28,0.5)" : PALETTE.danger,
        color: "#FFF",
        fontSize: 15,
        fontWeight: 800,
        letterSpacing: "0.03em",
        border: "none",
        cursor: working ? "wait" : "pointer",
        boxShadow: "0 4px 14px rgba(155,28,28,0.45)",
        minHeight: 44,
      }}
    >
      {working ? "Activating…" : "I understand · activate Emergency help"}
    </button>
  );
}
