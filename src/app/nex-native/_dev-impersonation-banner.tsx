// src/app/nex-native/_dev-impersonation-banner.tsx
//
// Owner-authorised 2026-10-31 (music-upload-audit · finding #4).
//
// Dev-only banner that makes impersonation state honest. The pre-fix
// behaviour: a mistyped NEX_DEV_IMPERSONATE_HANDLE silently fell back
// to the real session with only a console.warn, so content got
// attributed to the wrong account without any visible signal — the
// exact pattern that caused the nex-99901 confusion when adding a
// song to "Sari Dewi's" library.
//
// Behaviour:
//   · NODE_ENV=production → component renders nothing (never ships)
//   · env unset           → nothing
//   · env set + resolved  → thin cyan strip "Impersonating {handle}"
//   · env set + fell back → red warning strip "Impersonation FELL BACK
//                           to real session · you are not {requested}"

import "server-only";
import * as React from "react";
import { devImpersonationStatus } from "@/lib/nex-native/app/dev-impersonation";

export async function DevImpersonationBanner(): Promise<React.JSX.Element | null> {
  if (process.env.NODE_ENV === "production") return null;
  const status = await devImpersonationStatus();
  if (status.kind === "off") return null;

  const base: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10000,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "Inter, system-ui, sans-serif",
    textAlign: "center",
    pointerEvents: "none",
    letterSpacing: "0.02em",
  };

  if (status.kind === "fallen-back") {
    return (
      <div
        style={{
          ...base,
          background: "#C8102E",
          color: "#FFFFFF",
          boxShadow: "0 2px 6px rgba(200,16,46,0.35)",
        }}
      >
        ⚠ Impersonation requested “{status.requested}” — not seeded as mock persona · you are logged in as your REAL session
      </div>
    );
  }

  return (
    <div
      style={{
        ...base,
        background: "rgba(0, 175, 255, 0.92)",
        color: "#0A1526",
      }}
    >
      Impersonating {status.nexHandle}
    </div>
  );
}
