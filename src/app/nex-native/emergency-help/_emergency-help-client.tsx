"use client";

// src/app/nex-native/emergency-help/_emergency-help-client.tsx
//
// Device-local emergency location share. Owner-authorised 2026-11-09.
// Pre-prompt explanation card added 2026-11-24 per NEX-023 (owner
// Option A · location permission is feature-gated with an
// explanation card BEFORE the browser prompt).
//
// Flow:
//   1. User enters a trusted contact's phone number
//   2. Taps "Enable location + prepare SMS"
//   3. (NEX-023) explanation card appears explaining why NEX needs
//      location permission · Allow Location Access + Not Now buttons
//   4. Only after Allow Location Access does the browser prompt fire
//   5. Builds an `sms:` deep link with coordinates in the body
//   6. Taps native SMS app with the pre-filled message
//   7. No server call · no stored history
//
// Fallback if geolocation denied / unavailable:
//   · SMS body falls back to "I need help · please contact me" with a
//     generic location-unknown note
//
// Sealed invariants served:
//   · I-1 compliant: no server round-trip · all location handling is
//     client-local · the `sms:` URL is handled entirely by the device
//     OS which NEX does not touch
//   · No durable location history · the `sms:` link lives for the
//     duration of the native SMS composer only

import * as React from "react";

// `explanation` added 2026-11-24 per NEX-023: user must see WHY NEX
// wants location before the browser prompt is triggered. The browser
// permission request itself only fires when the user actively
// chooses "Allow Location Access" on that card.
type ShareState =
  | "idle"
  | "explanation"
  | "requesting"
  | "ready"
  | "denied"
  | "unsupported";

const PALETTE = {
  secondary: "#C6A15B",
  drawerBg: "#123D2B",
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  danger: "#9B1C1C",
  success: "#2F7A4A",
};

export function EmergencyHelpClient(): React.ReactElement {
  const [phone, setPhone] = React.useState("");
  const [state, setState] = React.useState<ShareState>("idle");
  const [coords, setCoords] = React.useState<{
    lat: number;
    lng: number;
    accuracyMeters: number;
  } | null>(null);

  // Cheap phone validator · accepts international + or local digits ·
  // not perfect but prevents obviously-empty submits. The device's
  // SMS app does the real parsing.
  const normalisedPhone = phone.trim().replace(/[\s\-()]/g, "");
  const phoneLooksValid = /^\+?\d{6,15}$/.test(normalisedPhone);

  const smsHref = React.useMemo(() => {
    if (!phoneLooksValid) return null;
    const bodyParts: string[] = ["I need help."];
    if (coords) {
      bodyParts.push(
        `My current location: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
      );
      bodyParts.push(
        `Google Maps: https://maps.google.com/?q=${coords.lat},${coords.lng}`,
      );
      bodyParts.push(`Accuracy: ±${Math.round(coords.accuracyMeters)}m`);
    } else if (state === "denied" || state === "unsupported") {
      bodyParts.push(
        "Location sharing is unavailable. Please contact me immediately.",
      );
    }
    bodyParts.push("Sent from NEX Emergency Help.");
    const body = encodeURIComponent(bodyParts.join("\n"));
    return `sms:${normalisedPhone}?body=${body}`;
  }, [phoneLooksValid, normalisedPhone, coords, state]);

  const requestLocation = React.useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unsupported");
      return;
    }
    setState("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
        });
        setState("ready");
      },
      () => {
        setCoords(null);
        setState("denied");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, []);

  return (
    <div data-nex-emergency-share-client>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: PALETTE.secondary,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        Trusted contact phone number
      </label>
      <input
        type="tel"
        inputMode="tel"
        placeholder="+353 1 234 5678"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        aria-label="Trusted contact phone number"
        style={{
          width: "100%",
          padding: "10px 12px",
          fontSize: 15,
          color: PALETTE.textPrimary,
          background: "rgba(0,0,0,0.3)",
          border: `1px solid ${PALETTE.secondary}`,
          borderRadius: 10,
          marginBottom: 10,
          boxSizing: "border-box",
          minHeight: 44,
        }}
      />

      {state === "idle" ? (
        <button
          type="button"
          onClick={() => setState("explanation")}
          disabled={!phoneLooksValid}
          aria-label="Begin location permission flow"
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            background: phoneLooksValid ? PALETTE.secondary : "rgba(198,161,91,0.3)",
            color: PALETTE.drawerBg,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.03em",
            border: "none",
            cursor: phoneLooksValid ? "pointer" : "not-allowed",
            minHeight: 44,
          }}
        >
          Enable location + prepare SMS
        </button>
      ) : null}

      {/* NEX-023 · owner-sealed 2026-11-24. Explanation card appears
          BEFORE the browser location prompt. The owner's directive
          requires that the permission request follow a user action
          on this card (Allow Location Access) — never immediately. */}
      {state === "explanation" ? (
        <div
          role="group"
          aria-label="Location permission explanation"
          style={{
            padding: 14,
            borderRadius: 10,
            background: "rgba(0,0,0,0.3)",
            border: `1px solid ${PALETTE.secondary}`,
            lineHeight: 1.5,
          }}
        >
          <p
            style={{
              margin: "0 0 12px",
              color: PALETTE.textPrimary,
              fontSize: 13,
            }}
          >
            Allow NEX to access your location so your designated emergency
            contacts can receive your last known location if you activate
            SOS.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={requestLocation}
              aria-label="Allow NEX location access"
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                background: PALETTE.secondary,
                color: PALETTE.drawerBg,
                border: "none",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.03em",
                cursor: "pointer",
                minHeight: 40,
              }}
            >
              Allow Location Access
            </button>
            <button
              type="button"
              onClick={() => setState("idle")}
              aria-label="Decline location access for now"
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                background: "transparent",
                color: PALETTE.textPrimary,
                border: `1px solid ${PALETTE.secondary}`,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                minHeight: 40,
              }}
            >
              Not Now
            </button>
          </div>
        </div>
      ) : null}

      {state === "requesting" ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(0,0,0,0.25)",
            color: PALETTE.textMuted,
            fontSize: 13,
            textAlign: "center",
          }}
        >
          Getting your location…
        </div>
      ) : null}

      {state === "ready" && coords && smsHref ? (
        <>
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(47, 122, 74, 0.2)",
              border: `1px solid ${PALETTE.success}`,
              color: PALETTE.textPrimary,
              fontSize: 12,
              marginBottom: 10,
              lineHeight: 1.5,
            }}
          >
            Location ready · {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            {" · "}accuracy ±{Math.round(coords.accuracyMeters)}m
          </div>
          <a
            href={smsHref}
            aria-label="Open native SMS with location pre-filled"
            style={{
              display: "block",
              textAlign: "center",
              padding: "12px 16px",
              borderRadius: 10,
              background: PALETTE.secondary,
              color: PALETTE.drawerBg,
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.03em",
              textDecoration: "none",
              minHeight: 44,
            }}
          >
            📩 Send location via SMS
          </a>
        </>
      ) : null}

      {state === "denied" && smsHref ? (
        <>
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(155, 28, 28, 0.2)",
              border: `1px solid ${PALETTE.danger}`,
              color: PALETTE.textPrimary,
              fontSize: 12,
              marginBottom: 10,
              lineHeight: 1.5,
            }}
          >
            {/* NEX-023 · owner-sealed 2026-11-24 · never pretend
                location is working when it isn't. Honest denial +
                retry + settings instructions. */}
            Location permission is not enabled. NEX cannot automatically
            share your coordinates until it is enabled.
            <br />
            <br />
            To enable location: open your browser settings → Site
            settings → Location, allow NEX, then tap <strong>Try
            again</strong>. The SMS below can still be sent now without
            coordinates.
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => setState("explanation")}
              aria-label="Retry location permission"
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                background: PALETTE.secondary,
                color: PALETTE.drawerBg,
                border: "none",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.03em",
                cursor: "pointer",
                minHeight: 40,
              }}
            >
              Try again
            </button>
          </div>
          <a
            href={smsHref}
            aria-label="Open native SMS without location"
            style={{
              display: "block",
              textAlign: "center",
              padding: "12px 16px",
              borderRadius: 10,
              background: PALETTE.danger,
              color: "#FFF",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.03em",
              textDecoration: "none",
              minHeight: 44,
            }}
          >
            📩 Send SMS without location
          </a>
        </>
      ) : null}

      {state === "unsupported" ? (
        <div
          role="status"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(155, 28, 28, 0.2)",
            border: `1px solid ${PALETTE.danger}`,
            color: PALETTE.textPrimary,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          This device cannot share location. Please call emergency
          services directly using the button above.
        </div>
      ) : null}
    </div>
  );
}
