"use client";

// src/app/nex-native/settings/profile/edit/_address-with-location.tsx
//
// Address textarea + "Set my location" button, co-located.
// Owner directive 2026-11-04 · "button orange color turns to green
// with tick when set".
// --------------------------------------------------------
// Client component so we can:
//   · own the textarea value (so a successful geocode can fill it)
//   · request the browser's current GPS via navigator.geolocation
//   · call the reverse-geocode server action
//   · toggle the button between orange (idle/error) and green+tick
//     (set) states
//
// The textarea keeps `name="address"` so the parent server form
// (saveProfileFieldsAction) picks it up unchanged.

import { useState } from "react";
import { reverseGeocodeAddressAction } from "./_reverse-geocode-address";

const ORANGE = "#FF7200";
const GREEN = "#16D66B";
const EMERALD = "#123D2B";
const WHITE_INK = "#F2F5F8";

type Status = "idle" | "locating" | "resolving" | "set" | "error";

interface Props {
  readonly defaultValue: string;
}

export function AddressWithLocation({ defaultValue }: Props): React.ReactElement {
  const [value, setValue] = useState(defaultValue);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleClick() {
    if (status === "locating" || status === "resolving") return;
    setErrorMsg(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error");
      setErrorMsg("Location not supported on this device.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setStatus("resolving");
        try {
          const res = await reverseGeocodeAddressAction(
            pos.coords.latitude,
            pos.coords.longitude,
          );
          if (res && res.formatted) {
            setValue(res.formatted);
            setStatus("set");
            setErrorMsg(null);
          } else {
            setStatus("error");
            setErrorMsg("Couldn't find an address for your location.");
          }
        } catch {
          setStatus("error");
          setErrorMsg("Address lookup failed. Try again.");
        }
      },
      (err) => {
        setStatus("error");
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMsg("Location permission denied.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setErrorMsg("Location unavailable right now.");
        } else if (err.code === err.TIMEOUT) {
          setErrorMsg("Location request timed out.");
        } else {
          setErrorMsg("Couldn't get your location.");
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  const isBusy = status === "locating" || status === "resolving";
  const isSet = status === "set";
  const bg = isSet ? GREEN : ORANGE;
  const ink = isSet ? EMERALD : WHITE_INK;

  const label = (() => {
    switch (status) {
      case "locating":
        return "Locating…";
      case "resolving":
        return "Fetching address…";
      case "set":
        return "Location set";
      default:
        return "Set my location";
    }
  })();

  return (
    <>
      <textarea
        name="address"
        value={value}
        onChange={(e) => {
          setValue(e.target.value.slice(0, 300));
          if (status === "set") setStatus("idle");
        }}
        maxLength={300}
        rows={3}
        placeholder="Type your full address"
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          flexWrap: "wrap",
          marginTop: 6,
        }}
      >
        <button
          type="button"
          onClick={handleClick}
          disabled={isBusy}
          aria-live="polite"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 14px",
            borderRadius: 999,
            background: bg,
            color: ink,
            border: "none",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            cursor: isBusy ? "wait" : "pointer",
            opacity: isBusy ? 0.75 : 1,
            boxShadow: `0 4px 14px ${bg}33`,
            transition: "background 180ms ease, color 180ms ease",
          }}
        >
          {isSet ? <CheckIcon /> : <PinIcon />}
          <span>{label}</span>
        </button>
        {errorMsg ? (
          <span style={{ fontSize: 12, color: "#FDA4AF" }}>{errorMsg}</span>
        ) : null}
      </div>
    </>
  );
}

function PinIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s-7-7.58-7-13a7 7 0 1 1 14 0c0 5.42-7 13-7 13z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="4 12 10 18 20 6" />
    </svg>
  );
}
