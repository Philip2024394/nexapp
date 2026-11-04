"use client";

// src/components/nex-native/location-bubble/location-bubble.tsx
//
// NEX Location · chat-bubble renderer for inbound location rows.
// Lives in the chat message list · reads an already-decoded
// LocationPayload. Does not do any crypto itself.

import * as React from "react";
import type { LocationPayload } from "@/lib/nex-native/location/payload";
import { LocationMapPreview } from "./location-map-preview";
import { AreaChip } from "./area-chip";

const CYAN = "var(--nex-world-secondary, #00AFFF)";
const TEXT = "var(--nex-world-primary-ink, #F2F5F8)";
const MUTED = "var(--nex-world-muted-ink, #7D9BC0)";
const PANEL_BORDER =
  "color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 18%, transparent)";

export interface LocationBubbleProps {
  readonly payload: LocationPayload;
  readonly senderName: string;
  readonly countryLabel?: string;
}

export function LocationBubble(
  props: LocationBubbleProps,
): React.JSX.Element {
  const { payload } = props;
  const relative = formatRelative(payload.captured_at);
  const stale = isStale(payload.captured_at);

  if (payload.kind === "area") {
    return (
      <AreaChip
        areaLabel={payload.area_label}
        countryIso={payload.country_iso}
        countryLabel={props.countryLabel}
        senderName={props.senderName}
        relativeTime={relative}
        staleNote={stale ? "Captured earlier · may no longer be accurate" : null}
      />
    );
  }

  const centerLat =
    payload.kind === "exact" ? payload.lat : payload.cell_center_lat;
  const centerLng =
    payload.kind === "exact" ? payload.lng : payload.cell_center_lng;
  const zoom = payload.kind === "exact" ? 15 : 13;
  const radiusM =
    payload.kind === "nearby"
      ? payload.cell_size_m
      : payload.accuracy_m > 0
        ? payload.accuracy_m
        : null;

  const kindLabel = payload.kind === "exact" ? "Exact location" : "Nearby · 250 m area";

  return (
    <div
      data-nex-location-bubble
      data-nex-location-bubble-kind={payload.kind}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 8,
        borderRadius: 14,
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${PANEL_BORDER}`,
        maxWidth: 300,
      }}
    >
      <LocationMapPreview
        centerLat={centerLat}
        centerLng={centerLng}
        zoom={zoom}
        radiusM={radiusM}
        showPin={payload.kind === "exact"}
        height={160}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: "2px 4px",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>
          {kindLabel}
        </span>
        <span style={{ fontSize: 11, color: MUTED }}>
          {props.senderName} · {relative}
        </span>
        {payload.kind === "exact" ? (
          <span style={{ fontSize: 10, color: MUTED }}>
            Reported accuracy {Math.round(payload.accuracy_m)} m
          </span>
        ) : null}
        {stale ? (
          <span style={{ fontSize: 11, color: CYAN, marginTop: 2 }}>
            Shared earlier · may no longer be accurate
          </span>
        ) : null}
      </div>
    </div>
  );
}

function formatRelative(iso: string, nowMs: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  return iso.slice(0, 10);
}

/** Older than 30 minutes · recipient bubble adds a caveat. */
function isStale(iso: string, nowMs: number = Date.now()): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return nowMs - t > 30 * 60 * 1000;
}
