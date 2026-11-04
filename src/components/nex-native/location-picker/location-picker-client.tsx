"use client";

// src/components/nex-native/location-picker/location-picker-client.tsx
//
// NEX Location Sharing · Phase 1A · picker modal.
// Owner-authorised 2026-11-05.
// -----------------------------------------------------------------------------
// Sealed privacy-first flow:
//   1. Picker opens with NO map and NO GPS acquired yet.
//   2. User chooses precision tier (Exact / Nearby / Area-only) first.
//   3. GPS is requested only after a tier is chosen.
//   4. Tile requests fire ONLY for the resolved (fuzzed) coordinates
//      per the chosen tier · Exact loads tiles at exact GPS, Nearby
//      loads tiles at the 250 m cell centre, Area loads NO tiles.
//
// This flow directly implements owner correction 1 (no map or GPS
// before precision choice) and correction 2 (captured_at immutable,
// broadcast_at per-attempt).

import * as React from "react";
import {
  fuzzToCell,
  generateJitterSeed,
  generateSessionSalt,
  nearbyRateLimit,
  type SessionSalt,
} from "@/lib/nex-native/location/fuzz";
import {
  isFixtureDataset,
  resolveArea,
  type AreaDataset,
} from "@/lib/nex-native/location/area-resolver";
import type { LocationPayload } from "@/lib/nex-native/location/payload";
import { LocationMapPreview } from "../location-bubble/location-map-preview";
import { AreaChip } from "../location-bubble/area-chip";

const CYAN = "var(--nex-world-secondary, #00AFFF)";
const TEXT = "var(--nex-world-primary-ink, #F2F5F8)";
const MUTED = "var(--nex-world-muted-ink, #7D9BC0)";
const PANEL = "var(--nex-world-drawer-bg, #0A1526)";
const PANEL_BORDER =
  "color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 18%, transparent)";

export type PrecisionTier = "exact" | "nearby" | "area";

export interface LocationPickerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly peerDisplayName: string;
  readonly conversationId: string;
  readonly selfAccountId: string;
  /** Called with a ready-to-encrypt payload · the parent handles key
   *  fetch + encryption + broadcast + outbox. */
  readonly onSend: (payload: LocationPayload) => void | Promise<void>;
  /** Called to resolve the session salt for the (self, conversation)
   *  pair · parent pulls from IDB via outbox.getSessionSalt + putSessionSalt. */
  readonly getSessionSalt: () => Promise<SessionSalt>;
  /** Called when a Nearby share succeeds · parent updates the last-share
   *  timestamp used by the rate limiter. */
  readonly markNearbyShared: () => Promise<void>;
  /** Last Nearby share timestamp in ms · parent reads from IDB or memory. */
  readonly lastNearbyShareAtMs: number | null;
  /** Area dataset for the user's country · parent picks which to load
   *  based on NEX_APP_IDENTITY · null when no dataset bundled. */
  readonly areaDataset: AreaDataset | null;
  /** Whether to allow fixture data in production builds · defaults to
   *  false · production surfaces leave this unset so Area-only disables
   *  until a real dataset ships. */
  readonly allowFixtureAreaData?: boolean;
}

type PhaseState =
  | { readonly phase: "choose-tier" }
  | { readonly phase: "requesting"; readonly tier: PrecisionTier }
  | {
      readonly phase: "ready";
      readonly tier: PrecisionTier;
      readonly gps: GeolocationPosition;
      readonly fuzzed:
        | { readonly kind: "exact"; readonly lat: number; readonly lng: number; readonly accuracy: number }
        | { readonly kind: "nearby"; readonly cellLat: number; readonly cellLng: number }
        | { readonly kind: "area"; readonly label: string; readonly code: string; readonly countryIso: string }
        | { readonly kind: "area-unavailable" }
        | { readonly kind: "nearby-rate-limited"; readonly retryAfterMs: number };
    }
  | { readonly phase: "error"; readonly reason: "denied" | "unavailable" | "timeout" };

export function LocationPicker(
  props: LocationPickerProps,
): React.JSX.Element | null {
  const [state, setState] = React.useState<PhaseState>({ phase: "choose-tier" });
  const [sending, setSending] = React.useState(false);

  // Reset state when picker reopens.
  React.useEffect(() => {
    if (props.open) setState({ phase: "choose-tier" });
  }, [props.open]);

  const chooseTier = React.useCallback(
    (tier: PrecisionTier) => {
      if (
        typeof navigator === "undefined" ||
        typeof navigator.geolocation === "undefined"
      ) {
        setState({ phase: "error", reason: "unavailable" });
        return;
      }
      setState({ phase: "requesting", tier });
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await handleGpsAcquired(pos, tier, props, setState);
          } catch {
            setState({ phase: "error", reason: "unavailable" });
          }
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setState({ phase: "error", reason: "denied" });
          } else if (err.code === err.TIMEOUT) {
            setState({ phase: "error", reason: "timeout" });
          } else {
            setState({ phase: "error", reason: "unavailable" });
          }
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
      );
    },
    [props],
  );

  const handleSend = React.useCallback(async () => {
    if (state.phase !== "ready") return;
    if (sending) return;
    const now = new Date().toISOString();
    let payload: LocationPayload | null = null;

    if (state.fuzzed.kind === "exact") {
      payload = {
        kind: "exact",
        lat: state.fuzzed.lat,
        lng: state.fuzzed.lng,
        accuracy_m: state.fuzzed.accuracy,
        captured_at: now,
        v: 1,
      };
    } else if (state.fuzzed.kind === "nearby") {
      payload = {
        kind: "nearby",
        cell_center_lat: state.fuzzed.cellLat,
        cell_center_lng: state.fuzzed.cellLng,
        cell_size_m: 250,
        jitter_applied: true,
        captured_at: now,
        v: 1,
      };
    } else if (state.fuzzed.kind === "area") {
      payload = {
        kind: "area",
        area_code: state.fuzzed.code,
        area_label: state.fuzzed.label,
        country_iso: state.fuzzed.countryIso,
        captured_at: now,
        v: 1,
      };
    }
    if (!payload) return;

    setSending(true);
    try {
      await props.onSend(payload);
      if (payload.kind === "nearby") {
        await props.markNearbyShared();
      }
      props.onClose();
    } catch {
      /* parent displays its own error · keep picker open */
    } finally {
      setSending(false);
    }
  }, [state, sending, props]);

  if (!props.open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share your location"
      data-nex-location-picker
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <button
        type="button"
        aria-label="Cancel"
        onClick={props.onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      />
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 420,
          maxHeight: "92%",
          overflowY: "auto",
          background: PANEL,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTop: `1.5px solid ${PANEL_BORDER}`,
          padding: "14px 16px calc(env(safe-area-inset-bottom, 0px) + 20px) 16px",
          color: TEXT,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: TEXT }}>
            Share your location
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={props.onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "transparent",
              border: `1px solid ${PANEL_BORDER}`,
              color: TEXT,
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </header>

        <p style={{ margin: "0 0 12px 0", fontSize: 12, color: MUTED }}>
          Choose how you want to share with{" "}
          <span style={{ color: TEXT }}>{props.peerDisplayName}</span>. We'll
          only ask your browser for GPS AFTER you pick a privacy level.
        </p>

        {state.phase === "choose-tier" ? (
          <TierList onChoose={chooseTier} areaAvailable={areaIsAvailable(props)} />
        ) : state.phase === "requesting" ? (
          <RequestingState tier={state.tier} />
        ) : state.phase === "error" ? (
          <ErrorState reason={state.reason} onRetry={() => setState({ phase: "choose-tier" })} />
        ) : (
          <ReadyState
            state={state}
            peerName={props.peerDisplayName}
            onBack={() => setState({ phase: "choose-tier" })}
            onSend={handleSend}
            sending={sending}
          />
        )}
      </div>
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────

function TierList({
  onChoose,
  areaAvailable,
}: {
  readonly onChoose: (t: PrecisionTier) => void;
  readonly areaAvailable: boolean;
}): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <TierButton
        tier="exact"
        title="Exact location"
        body={`Your pin · recipient sees where you are. Map tiles for your area are loaded from the map provider during this view.`}
        onClick={() => onChoose("exact")}
      />
      <TierButton
        tier="nearby"
        title="Nearby · 250 m area"
        body="Blurred to a 250 m area · recipient sees approximately where you are. Your exact GPS never leaves your device."
        onClick={() => onChoose("nearby")}
      />
      <TierButton
        tier="area"
        title="Area only"
        body={
          areaAvailable
            ? "Just the area name · no map, no coordinates."
            : "Area labels aren't available yet in this build · choose Exact or Nearby, or send a text instead."
        }
        onClick={() => onChoose("area")}
        disabled={!areaAvailable}
      />
    </div>
  );
}

function TierButton({
  tier,
  title,
  body,
  onClick,
  disabled,
}: {
  readonly tier: PrecisionTier;
  readonly title: string;
  readonly body: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-nex-location-tier={tier}
      style={{
        textAlign: "left",
        padding: "12px 14px",
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${PANEL_BORDER}`,
        borderRadius: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        color: disabled ? MUTED : TEXT,
        opacity: disabled ? 0.55 : 1,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 14 }}>{title}</span>
      <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.35 }}>
        {body}
      </span>
    </button>
  );
}

function RequestingState({ tier }: { readonly tier: PrecisionTier }): React.JSX.Element {
  return (
    <div
      style={{
        padding: 24,
        textAlign: "center",
        fontSize: 13,
        color: MUTED,
      }}
    >
      Asking your browser for location… ({tier})
    </div>
  );
}

function ErrorState({
  reason,
  onRetry,
}: {
  readonly reason: "denied" | "unavailable" | "timeout";
  readonly onRetry: () => void;
}): React.JSX.Element {
  const title =
    reason === "denied"
      ? "Location access is off"
      : reason === "timeout"
        ? "Couldn't get your location in time"
        : "Couldn't get your location";
  const body =
    reason === "denied"
      ? "To share your location, open your browser's site settings and allow location for NEX. Or send a text message instead."
      : "Try again in a moment, or send a text message instead.";
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{title}</span>
      <span style={{ fontSize: 12, color: MUTED }}>{body}</span>
      <button
        type="button"
        onClick={onRetry}
        style={{
          marginTop: 6,
          padding: "10px 14px",
          borderRadius: 10,
          background: CYAN,
          color: "#0a0608",
          border: "none",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}

function ReadyState({
  state,
  peerName,
  onBack,
  onSend,
  sending,
}: {
  readonly state: Extract<PhaseState, { phase: "ready" }>;
  readonly peerName: string;
  readonly onBack: () => void;
  readonly onSend: () => void;
  readonly sending: boolean;
}): React.JSX.Element {
  const f = state.fuzzed;
  if (f.kind === "area-unavailable") {
    return (
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>
          Area label not available here
        </span>
        <span style={{ fontSize: 12, color: MUTED }}>
          Try Exact or Nearby, or send a text instead.
        </span>
        <button type="button" onClick={onBack} style={backButton}>
          ← Back
        </button>
      </div>
    );
  }
  if (f.kind === "nearby-rate-limited") {
    const mins = Math.max(1, Math.ceil(f.retryAfterMs / 60_000));
    return (
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>
          You shared Nearby recently
        </span>
        <span style={{ fontSize: 12, color: MUTED }}>
          Nearby rotates its privacy area so repeated sends can't reveal your
          exact spot. Try again in {mins} min, or share Exact.
        </span>
        <button type="button" onClick={onBack} style={backButton}>
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {f.kind === "area" ? (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <AreaChip
            areaLabel={f.label}
            countryIso={f.countryIso}
            senderName="You"
            relativeTime="now"
          />
        </div>
      ) : (
        <LocationMapPreview
          centerLat={f.kind === "exact" ? f.lat : f.cellLat}
          centerLng={f.kind === "exact" ? f.lng : f.cellLng}
          zoom={f.kind === "exact" ? 15 : 13}
          radiusM={
            f.kind === "nearby"
              ? 250
              : f.accuracy > 0
                ? f.accuracy
                : null
          }
          showPin={f.kind === "exact"}
          height={160}
        />
      )}
      <span style={{ fontSize: 12, color: MUTED, textAlign: "center" }}>
        Preview · this is what {peerName} will see.
      </span>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button type="button" onClick={onBack} style={{ ...backButton, flex: 1 }}>
          ← Back
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={sending}
          style={{
            flex: 2,
            padding: "12px 14px",
            borderRadius: 12,
            background: CYAN,
            color: "#0a0608",
            border: "none",
            fontWeight: 800,
            cursor: sending ? "default" : "pointer",
            opacity: sending ? 0.6 : 1,
          }}
        >
          {sending ? "Sending…" : "Share location"}
        </button>
      </div>
    </div>
  );
}

const backButton: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  background: "transparent",
  border: `1px solid ${PANEL_BORDER}`,
  color: TEXT,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};

// ─── Helpers ────────────────────────────────────────────────────────

function areaIsAvailable(props: LocationPickerProps): boolean {
  if (!props.areaDataset) return false;
  if (isFixtureDataset(props.areaDataset) && !props.allowFixtureAreaData) {
    return false;
  }
  return true;
}

async function handleGpsAcquired(
  pos: GeolocationPosition,
  tier: PrecisionTier,
  props: LocationPickerProps,
  setState: React.Dispatch<React.SetStateAction<PhaseState>>,
): Promise<void> {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  const accuracy = pos.coords.accuracy;

  if (tier === "exact") {
    setState({
      phase: "ready",
      tier,
      gps: pos,
      fuzzed: { kind: "exact", lat, lng, accuracy },
    });
    return;
  }

  if (tier === "nearby") {
    const rate = nearbyRateLimit({
      lastShareAtMs: props.lastNearbyShareAtMs,
      nowMs: Date.now(),
    });
    if (!rate.allowed) {
      setState({
        phase: "ready",
        tier,
        gps: pos,
        fuzzed: { kind: "nearby-rate-limited", retryAfterMs: rate.retryAfterMs },
      });
      return;
    }
    const salt = await props.getSessionSalt();
    const out = fuzzToCell({ lat, lng, salt, jitterSeed: generateJitterSeed() });
    setState({
      phase: "ready",
      tier,
      gps: pos,
      fuzzed: {
        kind: "nearby",
        cellLat: out.cellCenterLat,
        cellLng: out.cellCenterLng,
      },
    });
    return;
  }

  // Area
  if (!props.areaDataset) {
    setState({ phase: "ready", tier, gps: pos, fuzzed: { kind: "area-unavailable" } });
    return;
  }
  const match = resolveArea(lat, lng, props.areaDataset, {
    allowFixture: props.allowFixtureAreaData,
  });
  if (!match) {
    setState({ phase: "ready", tier, gps: pos, fuzzed: { kind: "area-unavailable" } });
    return;
  }
  setState({
    phase: "ready",
    tier,
    gps: pos,
    fuzzed: {
      kind: "area",
      label: match.area_label,
      code: match.area_code,
      countryIso: match.country_iso,
    },
  });
}

// Keep SessionSalt import only in types for the component file surface.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _TypeKeep = SessionSalt;

// Re-export generateSessionSalt so page.tsx can pre-provision the salt
// when first opening the picker · keeps IDB writes server-free.
export { generateSessionSalt };
