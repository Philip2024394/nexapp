"use client";

// src/components/nex-native/location-bubble/area-chip.tsx
//
// NEX Location · Area-only chip renderer. No map, no coordinates.

import * as React from "react";

const CYAN = "var(--nex-world-secondary, #00AFFF)";
const TEXT = "var(--nex-world-primary-ink, #F2F5F8)";
const MUTED = "var(--nex-world-muted-ink, #7D9BC0)";
const PANEL_BORDER =
  "color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 18%, transparent)";

export interface AreaChipProps {
  readonly areaLabel: string;
  readonly countryIso: string;
  readonly countryLabel?: string;
  readonly senderName: string;
  readonly relativeTime: string;
  readonly staleNote?: string | null;
}

export function AreaChip(props: AreaChipProps): React.JSX.Element {
  return (
    <div
      data-nex-location-area-chip
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 4,
        padding: "10px 12px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${PANEL_BORDER}`,
        maxWidth: 260,
      }}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span aria-hidden style={{ fontSize: 16 }}>
          {flagEmoji(props.countryIso)}
        </span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: TEXT,
            lineHeight: 1.2,
          }}
        >
          {props.areaLabel}
        </span>
      </div>
      <span
        style={{
          fontSize: 11,
          color: MUTED,
          letterSpacing: "0.02em",
        }}
      >
        {props.countryLabel ?? props.countryIso} · {props.senderName} ·{" "}
        {props.relativeTime}
      </span>
      {props.staleNote ? (
        <span style={{ fontSize: 11, color: CYAN, marginTop: 2 }}>
          {props.staleNote}
        </span>
      ) : null}
    </div>
  );
}

function flagEmoji(iso: string): string {
  if (iso.length !== 2) return "📍";
  const A = 0x1f1e6;
  const code = iso.toUpperCase();
  return String.fromCodePoint(
    code.charCodeAt(0) - 65 + A,
    code.charCodeAt(1) - 65 + A,
  );
}
