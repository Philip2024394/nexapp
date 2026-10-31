// src/app/nex-native/search/_hard-location-gate.tsx
//
// Hard location gate for NEX Discover (replaces nex directory).
// -------------------------------------------------------------
// On entry, if the viewer has NO saved location:
//   1. Show an overlay with a single primary CTA · "Use my location"
//   2. Tap → navigator.geolocation.getCurrentPosition
//      · success → saveUserLocationToAccountAction (or local store for
//        anon) + close overlay + the surface re-renders with the
//        resolved coords on the URL
//      · deny / fail → router.push("/nex-native/home") per founder
//        directive 2026-10-13 ("if they opp no to set location they
//        divert back to home page")
//   3. "Not now" button → router.push("/nex-native/home")
//
// When a saved location already exists, this component renders
// nothing (feed takes over immediately).

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  USER_LOCATION_LOCAL_STORAGE_KEY,
  makeGpsLocation,
  parseSavedLocation,
  isLocationFresh,
  type SavedLocation,
} from "@/lib/nex-native/user-location/types";
import { saveUserLocationToAccountAction } from "@/lib/nex-native/user-location/actions";
import { reverseGeocode } from "@/lib/nex-native/user-location/reverse-geocode";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "#07152A",
  text: "#F2F5F8",
  textDim: "#8BA9D1",
  orange: "#FF7200",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.35)",
  border: "rgba(255,255,255,0.1)",
};

export interface HardLocationGateProps {
  /** Server-resolved location passed in from the page. When present
   *  this component renders nothing. */
  readonly initialLocation: SavedLocation | null;
  /** Whether the viewer is signed-in · drives whether we persist via
   *  server action or localStorage. */
  readonly isSignedIn: boolean;
}

export function HardLocationGate({
  initialLocation,
  isSignedIn,
}: HardLocationGateProps): React.JSX.Element | null {
  const router = useRouter();
  const [stage, setStage] = useState<"idle" | "requesting" | "denied">("idle");
  const [hydratedLocation, setHydratedLocation] = useState<SavedLocation | null>(
    initialLocation,
  );
  const [hasChecked, setHasChecked] = useState<boolean>(initialLocation !== null);

  // Hydrate from localStorage for anonymous visitors · the server has
  // no access to localStorage so we re-check on the client.
  useEffect(() => {
    if (initialLocation !== null) return;
    try {
      const raw = window.localStorage.getItem(USER_LOCATION_LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = parseSavedLocation(JSON.parse(raw));
        if (parsed && isLocationFresh(parsed, new Date())) {
          setHydratedLocation(parsed);
        }
      }
    } catch {
      // Ignore malformed localStorage · we'll re-prompt.
    } finally {
      setHasChecked(true);
    }
  }, [initialLocation]);

  const persistLocation = useCallback(
    async (loc: SavedLocation) => {
      try {
        window.localStorage.setItem(
          USER_LOCATION_LOCAL_STORAGE_KEY,
          JSON.stringify(loc),
        );
      } catch {
        // Non-fatal · we still try the server-side write.
      }
      if (isSignedIn) {
        try {
          await saveUserLocationToAccountAction(loc);
        } catch {
          // Non-fatal · localStorage copy is the fallback.
        }
      }
    },
    [isSignedIn],
  );

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStage("denied");
      return;
    }
    setStage("requesting");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const base = makeGpsLocation(pos.coords.latitude, pos.coords.longitude);
        if (!base) {
          setStage("denied");
          return;
        }
        // Enrich with city + country ISO via server-side reverse
        // geocode. If it fails (timeout, offline), we still proceed
        // with the raw coords · the surface shows coords without a
        // city label and the flag is hidden.
        let enriched: SavedLocation = base;
        try {
          const geo = await reverseGeocode(base.lat, base.lng);
          if (geo) {
            const next = parseSavedLocation({
              ...base,
              cityLabel: geo.cityLabel,
              countryIso: geo.countryIso,
            });
            if (next) enriched = next;
          }
        } catch {
          // Non-fatal.
        }
        await persistLocation(enriched);
        setHydratedLocation(enriched);
        // Soft reload so the server-rendered feed picks up the new
        // location via the URL params (added by setting ?lat / ?lng /
        // ?city / ?country).
        const u = new URL(window.location.href);
        u.searchParams.set("lat", String(enriched.lat));
        u.searchParams.set("lng", String(enriched.lng));
        if (enriched.cityLabel) u.searchParams.set("city", enriched.cityLabel);
        if (enriched.countryIso) u.searchParams.set("country", enriched.countryIso);
        router.replace(`${u.pathname}?${u.searchParams.toString()}`);
        router.refresh();
      },
      () => {
        setStage("denied");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, [persistLocation, router]);

  // Hard-redirect to home when user declines.
  const bounceHome = useCallback(() => {
    router.push("/nex-native/home");
  }, [router]);

  // Not yet mounted · hide while we check localStorage.
  if (!hasChecked) return null;
  // Have a usable location · gate is a no-op.
  if (hydratedLocation !== null) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nex-discover-gate-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(2,9,20,0.92)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: NEX.panel,
          border: `1px solid ${NEX.cyanSoft}`,
          borderRadius: 20,
          padding: 24,
          color: NEX.text,
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            background: `linear-gradient(145deg, ${NEX.orange}, #C85600)`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: `0 10px 30px ${NEX.orange}44`,
          }}
        >
          <PinIcon />
        </div>
        <h2
          id="nex-discover-gate-title"
          style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-0.015em" }}
        >
          Set your location
        </h2>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 14,
            color: NEX.textDim,
            lineHeight: 1.55,
          }}
        >
          NEX Discover shows shops and menus close to you.
          <br />
          We only use your location on this device.
        </p>

        {stage === "denied" ? (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              background: "rgba(255,114,0,0.12)",
              border: `1px solid ${NEX.orange}66`,
              borderRadius: 10,
              fontSize: 12,
              color: NEX.text,
              lineHeight: 1.55,
              textAlign: "left",
            }}
          >
            <strong style={{ color: NEX.orange, fontWeight: 700 }}>
              Location is blocked.
            </strong>{" "}
            NEX Discover needs your real location to show shops near you.
            Please either:
            <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
              <li>Unblock location permission for this site in your browser settings, OR</li>
              <li>If you're on a VPN or private browser, switch to a normal browser and try again.</li>
            </ul>
          </div>
        ) : null}

        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            onClick={requestLocation}
            disabled={stage === "requesting"}
            style={{
              width: "100%",
              padding: "13px 16px",
              borderRadius: 12,
              border: "none",
              background: NEX.orange,
              color: "#FFFFFF",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "0.01em",
              cursor: stage === "requesting" ? "wait" : "pointer",
              boxShadow: `0 10px 24px ${NEX.orange}55`,
            }}
          >
            {stage === "requesting" ? "Checking location…" : "Use my location"}
          </button>
          <button
            type="button"
            onClick={bounceHome}
            style={{
              width: "100%",
              padding: "11px 16px",
              borderRadius: 12,
              border: `1px solid ${NEX.border}`,
              background: "transparent",
              color: NEX.textDim,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Not now · back to home
          </button>
        </div>
      </div>
    </div>
  );
}

function PinIcon(): React.JSX.Element {
  return (
    <svg
      width={28}
      height={28}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 21s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
