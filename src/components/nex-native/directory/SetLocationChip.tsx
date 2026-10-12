// src/components/nex-native/directory/SetLocationChip.tsx
//
// Persistent header affordance for the hybrid location system.
//
// Two visual states:
//   · set     · "Searching near <City> · Change" — the full label +
//               Change action. Tapping Change re-opens LocationSetup.
//   · unset   · "Set location" — compact chip that opens
//               LocationSetup when tapped.
//
// A separate "Clear" affordance lives inside the overlay (not here)
// so the chip stays compact in the header strip.

"use client";

import type { SavedLocation } from "@/lib/nex-native/user-location/types";

const PALETTE = {
  cyan: "#00AFFF",
  cyanFaint: "rgba(0,175,255,0.08)",
  textDim: "#B5C3D6",
  textSoft: "#7D9BC0",
  surfaceHi: "#182540",
  borderSoft: "rgba(255,255,255,0.08)",
} as const;

export interface SetLocationChipProps {
  readonly location: SavedLocation | null;
  readonly onOpenSetup: () => void;
  /** When true, the chip shows a "clearing…" state while the server
   *  action resolves. Prevents double-taps during async writes. */
  readonly busy?: boolean;
}

export function SetLocationChip(props: SetLocationChipProps): React.JSX.Element {
  const { location, onOpenSetup, busy } = props;

  if (location === null) {
    return (
      <button
        type="button"
        onClick={onOpenSetup}
        disabled={busy}
        data-nex-set-location-chip
        data-nex-set-location-chip-state="unset"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: 999,
          background: PALETTE.cyanFaint,
          color: PALETTE.cyan,
          border: `1px solid ${PALETTE.cyan}`,
          fontSize: 12.5,
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        <PinGlyph />
        Set location
      </button>
    );
  }

  const label = location.cityLabel ?? labelFromCoords(location.lat, location.lng);
  const sourceLabel = location.source === "gps" ? "GPS" : "City";

  return (
    <div
      data-nex-set-location-chip
      data-nex-set-location-chip-state="set"
      data-nex-set-location-chip-source={location.source}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 12px",
        borderRadius: 999,
        background: PALETTE.surfaceHi,
        border: `1px solid ${PALETTE.borderSoft}`,
        fontSize: 12.5,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: PALETTE.textDim,
        }}
      >
        <PinGlyph />
        Searching near{" "}
        <span
          style={{ fontWeight: 600, color: PALETTE.textDim }}
          data-nex-set-location-chip-label
        >
          {label}
        </span>
        <span style={{ color: PALETTE.textSoft }}>· {sourceLabel}</span>
      </span>
      <button
        type="button"
        onClick={onOpenSetup}
        disabled={busy}
        data-nex-set-location-chip-change
        style={{
          background: "transparent",
          color: PALETTE.cyan,
          border: "none",
          cursor: busy ? "default" : "pointer",
          fontSize: 12.5,
          fontWeight: 600,
          padding: 0,
          opacity: busy ? 0.6 : 1,
        }}
      >
        Change
      </button>
    </div>
  );
}

function labelFromCoords(lat: number, lng: number): string {
  // GPS-sourced location without a city label · show rounded coords.
  // Honest: this is NOT fabrication · it's the actual coordinate the
  // user accepted when they granted GPS.
  return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
}

function PinGlyph(): React.JSX.Element {
  return (
    <svg
      width={11}
      height={11}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s7-7.58 7-13a7 7 0 10-14 0c0 5.42 7 13 7 13z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
