// src/components/nex-native/directory/LocationSetup.tsx
//
// LocationSetup · a soft-gate overlay shown on first entry to
// /nex-native/directory and /nex-native/search when the viewer has no
// saved location.
//
// Honest UX rules (per Safety Constitution + user decision set):
//   · "Use my current location" calls navigator.geolocation.getCurrentPosition
//     ONLY when the viewer explicitly taps it. No auto-prompt.
//   · "Enter city or area" calls `resolveManualCityAction` (local
//     food_business centroid resolver · no third-party geocoder).
//     Returns null for weak matches; UI shows "we couldn't find that
//     area · try another spelling" and does NOT fabricate.
//   · "Continue without location" dismisses the overlay. Directory
//     keeps rendering · distance stays "Location Unconfirmed" (the
//     existing honest fallback).
//   · GPS deny / unsupported fall through to the manual-entry panel
//     automatically · never bounce to home.
//   · A `source="manual_city"` SavedLocation IS a legitimate location
//     for the hybrid system, but the UI label (`Searching near X`)
//     makes it clear it is a city-level anchor, not a GPS pin.

"use client";

import { useCallback, useState, useTransition } from "react";
import { resolveManualCityAction } from "@/lib/nex-native/user-location/actions";
import { makeGpsLocation, type SavedLocation } from "@/lib/nex-native/user-location/types";

const PALETTE = {
  bg: "rgba(2, 9, 20, 0.92)",
  surface: "#0E1526",
  surfaceHi: "#182540",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textSoft: "#7D9BC0",
  orange: "#FF7200",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0,175,255,0.08)",
  borderSoft: "rgba(255,255,255,0.08)",
  success: "#1F7F4A",
} as const;

export interface LocationSetupProps {
  readonly open: boolean;
  readonly onLocationChosen: (loc: SavedLocation) => void | Promise<void>;
  readonly onDismiss: () => void;
}

type Panel = "root" | "manual" | "gps-pending" | "gps-denied" | "preview";
type GpsSupport = "unknown" | "unsupported";

export function LocationSetup(props: LocationSetupProps): React.JSX.Element | null {
  const { open, onLocationChosen, onDismiss } = props;
  const [panel, setPanel] = useState<Panel>("root");
  const [gpsSupport, setGpsSupport] = useState<GpsSupport>("unknown");
  const [manualQuery, setManualQuery] = useState<string>("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [previewCandidate, setPreviewCandidate] = useState<{
    readonly location: SavedLocation;
    readonly supportRows: number;
  } | null>(null);
  const [, startTransition] = useTransition();
  const [resolving, setResolving] = useState<boolean>(false);

  const handleGps = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsSupport("unsupported");
      setPanel("manual");
      return;
    }
    setPanel("gps-pending");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = makeGpsLocation(pos.coords.latitude, pos.coords.longitude);
        if (loc === null) {
          setPanel("gps-denied"); // invalid-coords edge case · reuse the deny flow
          return;
        }
        startTransition(() => {
          void onLocationChosen(loc);
        });
      },
      () => {
        setPanel("gps-denied");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, [onLocationChosen]);

  const handleResolveManual = useCallback(async () => {
    const q = manualQuery.trim();
    if (q.length === 0) {
      setManualError("Please enter a city or area name.");
      return;
    }
    setManualError(null);
    setResolving(true);
    try {
      const result = await resolveManualCityAction(q);
      if (!result.ok || result.candidate === null || result.supportRows === null) {
        setManualError(
          "We couldn't find that area. Try the nearest city name (e.g. Yogyakarta, Denpasar).",
        );
        setPreviewCandidate(null);
        return;
      }
      setPreviewCandidate({ location: result.candidate, supportRows: result.supportRows });
      setPanel("preview");
    } finally {
      setResolving(false);
    }
  }, [manualQuery]);

  const handleConfirmPreview = useCallback(() => {
    if (previewCandidate === null) return;
    startTransition(() => {
      void onLocationChosen(previewCandidate.location);
    });
  }, [previewCandidate, onLocationChosen]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set your location for NEX Search"
      data-nex-location-setup
      data-nex-location-setup-panel={panel}
      style={{
        position: "fixed",
        inset: 0,
        background: PALETTE.bg,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: PALETTE.surface,
          border: `1px solid ${PALETTE.borderSoft}`,
          borderRadius: 20,
          padding: 20,
          color: PALETTE.text,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {panel === "root" ? (
          <RootPanel
            onGps={handleGps}
            onManual={() => setPanel("manual")}
            onDismiss={onDismiss}
          />
        ) : null}

        {panel === "manual" ? (
          <ManualPanel
            query={manualQuery}
            onQueryChange={setManualQuery}
            onResolve={handleResolveManual}
            onBack={() => setPanel("root")}
            onDismiss={onDismiss}
            resolving={resolving}
            errorMessage={manualError}
            gpsSupport={gpsSupport}
          />
        ) : null}

        {panel === "gps-pending" ? (
          <GpsPendingPanel onCancel={() => setPanel("root")} />
        ) : null}

        {panel === "gps-denied" ? (
          <GpsDeniedPanel
            onManual={() => setPanel("manual")}
            onDismiss={onDismiss}
          />
        ) : null}

        {panel === "preview" && previewCandidate !== null ? (
          <PreviewPanel
            candidate={previewCandidate.location}
            supportRows={previewCandidate.supportRows}
            onConfirm={handleConfirmPreview}
            onBack={() => {
              setPanel("manual");
              setPreviewCandidate(null);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

// ─── Panels ──────────────────────────────────────────────────────────

function RootPanel(props: {
  readonly onGps: () => void;
  readonly onManual: () => void;
  readonly onDismiss: () => void;
}): React.JSX.Element {
  return (
    <>
      <h2
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 700,
          color: PALETTE.text,
          letterSpacing: "-0.01em",
        }}
      >
        Find businesses near you
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 13.5,
          lineHeight: 1.5,
          color: PALETTE.textDim,
        }}
      >
        Discover food, shops and services around your chosen location.
        NEX never shares your coordinates with businesses or other users.
      </p>
      <PrimaryButton onClick={props.onGps} data-nex-location-setup-cta="gps">
        Use my current location
      </PrimaryButton>
      <SecondaryButton
        onClick={props.onManual}
        data-nex-location-setup-cta="manual"
      >
        Enter city or area
      </SecondaryButton>
      <DismissButton onClick={props.onDismiss}>
        Continue without setting a location
      </DismissButton>
    </>
  );
}

function ManualPanel(props: {
  readonly query: string;
  readonly onQueryChange: (v: string) => void;
  readonly onResolve: () => void;
  readonly onBack: () => void;
  readonly onDismiss: () => void;
  readonly resolving: boolean;
  readonly errorMessage: string | null;
  readonly gpsSupport: GpsSupport;
}): React.JSX.Element {
  return (
    <>
      <h2
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          color: PALETTE.text,
          letterSpacing: "-0.01em",
        }}
      >
        {props.gpsSupport === "unsupported"
          ? "Your browser doesn't support location"
          : "Enter your city or area"}
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.5,
          color: PALETTE.textDim,
        }}
      >
        Type the city or neighbourhood where you'd like to search (for
        example, Yogyakarta or Denpasar).
      </p>
      <input
        type="text"
        value={props.query}
        onChange={(e) => props.onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            props.onResolve();
          }
        }}
        maxLength={80}
        placeholder="City or area"
        aria-label="City or area"
        data-nex-location-setup-manual-input
        style={{
          padding: "12px 14px",
          borderRadius: 10,
          border: `1px solid ${PALETTE.borderSoft}`,
          background: PALETTE.surfaceHi,
          color: PALETTE.text,
          fontSize: 15,
          outline: "none",
        }}
      />
      {props.errorMessage !== null ? (
        <p
          data-nex-location-setup-error
          style={{
            margin: 0,
            fontSize: 12.5,
            color: PALETTE.orange,
            lineHeight: 1.4,
          }}
        >
          {props.errorMessage}
        </p>
      ) : null}
      <PrimaryButton
        onClick={props.onResolve}
        disabled={props.resolving}
        data-nex-location-setup-cta="resolve"
      >
        {props.resolving ? "Searching…" : "Set this location"}
      </PrimaryButton>
      <SecondaryButton onClick={props.onBack}>Back</SecondaryButton>
      <DismissButton onClick={props.onDismiss}>
        Continue without setting a location
      </DismissButton>
    </>
  );
}

function GpsPendingPanel(props: {
  readonly onCancel: () => void;
}): React.JSX.Element {
  return (
    <>
      <h2
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          color: PALETTE.text,
        }}
      >
        Waiting for your location…
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.5,
          color: PALETTE.textDim,
        }}
      >
        Your browser is asking you to confirm location access. Please
        accept or deny the prompt.
      </p>
      <SecondaryButton onClick={props.onCancel}>Cancel</SecondaryButton>
    </>
  );
}

function GpsDeniedPanel(props: {
  readonly onManual: () => void;
  readonly onDismiss: () => void;
}): React.JSX.Element {
  return (
    <>
      <h2
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          color: PALETTE.text,
        }}
      >
        No location shared
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.5,
          color: PALETTE.textDim,
        }}
      >
        That's fine — you can type your city or area instead, or continue
        without a location. NEX will keep working either way.
      </p>
      <PrimaryButton onClick={props.onManual}>Enter city or area</PrimaryButton>
      <DismissButton onClick={props.onDismiss}>
        Continue without setting a location
      </DismissButton>
    </>
  );
}

function PreviewPanel(props: {
  readonly candidate: SavedLocation;
  readonly supportRows: number;
  readonly onConfirm: () => void;
  readonly onBack: () => void;
}): React.JSX.Element {
  return (
    <>
      <h2
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          color: PALETTE.text,
        }}
      >
        Confirm this area
      </h2>
      <div
        style={{
          padding: "12px 14px",
          background: PALETTE.cyanFaint,
          border: `1px solid ${PALETTE.cyan}`,
          borderRadius: 10,
          color: PALETTE.text,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600 }}>
          {props.candidate.cityLabel}
        </div>
        <div style={{ marginTop: 4, fontSize: 11.5, color: PALETTE.textSoft }}>
          {props.supportRows} verified businesses in this area · city-level
          anchor, not a precise pin
        </div>
      </div>
      <PrimaryButton
        onClick={props.onConfirm}
        data-nex-location-setup-cta="confirm"
      >
        Use this location
      </PrimaryButton>
      <SecondaryButton onClick={props.onBack}>Try another area</SecondaryButton>
    </>
  );
}

// ─── Buttons ─────────────────────────────────────────────────────────

function PrimaryButton(props: {
  readonly children: React.ReactNode;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly "data-nex-location-setup-cta"?: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      data-nex-location-setup-cta={props["data-nex-location-setup-cta"]}
      style={{
        padding: "12px 16px",
        borderRadius: 999,
        background: PALETTE.orange,
        color: "#1A1300",
        fontSize: 15,
        fontWeight: 700,
        border: "none",
        cursor: props.disabled ? "default" : "pointer",
        opacity: props.disabled ? 0.6 : 1,
      }}
    >
      {props.children}
    </button>
  );
}

function SecondaryButton(props: {
  readonly children: React.ReactNode;
  readonly onClick: () => void;
  readonly "data-nex-location-setup-cta"?: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={props.onClick}
      data-nex-location-setup-cta={props["data-nex-location-setup-cta"]}
      style={{
        padding: "12px 16px",
        borderRadius: 999,
        background: "transparent",
        color: PALETTE.cyan,
        fontSize: 14.5,
        fontWeight: 600,
        border: `1px solid ${PALETTE.cyan}`,
        cursor: "pointer",
      }}
    >
      {props.children}
    </button>
  );
}

function DismissButton(props: {
  readonly children: React.ReactNode;
  readonly onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={props.onClick}
      data-nex-location-setup-cta="dismiss"
      style={{
        padding: "6px 10px",
        background: "transparent",
        color: PALETTE.textSoft,
        fontSize: 12.5,
        border: "none",
        cursor: "pointer",
        textAlign: "center",
      }}
    >
      {props.children}
    </button>
  );
}
