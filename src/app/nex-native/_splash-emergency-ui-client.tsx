"use client";

// src/app/nex-native/_splash-emergency-ui-client.tsx
//
// Owner directive 2026-11-09 · Emergency Help UX moved from drawer to
// splash. Shown ONLY to users who have activated Emergency Help (per
// device-local hasActivatedEmergency() flag). Non-activated users
// never see this component · they auto-divert off the splash.
//
// Shape:
//   · Round red "HELP" button top-right of splash (56x56)
//   · Press → full-screen dim overlay with a big red square "Activate
//     Help" button + countdown timer (10 → 0)
//   · Tap the square = activate immediately → /emergency-help
//   · Tap outside / Cancel = cancel countdown, close overlay
//   · Countdown reaches 0 → auto-navigate to /emergency-help
//   · Bottom "Enter NEX" button lets the user proceed to their normal
//     destination (/contacts if signed-in · /free-chat if signed-out)
//
// Sealed invariants served:
//   · No server call · all device-local
//   · No location captured here (location-share lives on the full
//     emergency-help page one step down · same discipline as before)
//   · Modal is dismissable · 10s countdown gives a safety window to
//     cancel (sealed _group-countdown.ts pattern · 10s)

import * as React from "react";
import { useRouter } from "next/navigation";

const COUNTDOWN_SECONDS = 10;
const EMERGENCY_URL = "/nex-native/emergency-help";

const PALETTE = {
  red: "#C21515",
  redDark: "#8B0000",
  redRing: "rgba(255, 77, 79, 0.65)",
  white: "#FFF",
  black: "#000",
  shadow: "0 6px 22px rgba(194,21,21,0.55)",
};

interface SplashEmergencyUIProps {
  readonly destination: string;
}

export function SplashEmergencyUI({
  destination,
}: SplashEmergencyUIProps): React.ReactElement {
  const router = useRouter();
  const [showCountdown, setShowCountdown] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(COUNTDOWN_SECONDS);

  // Countdown effect. Resets each time the overlay opens.
  React.useEffect(() => {
    if (!showCountdown) {
      setSecondsLeft(COUNTDOWN_SECONDS);
      return undefined;
    }
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          // Defer navigation so React finishes the current render
          // before the route change fires.
          window.setTimeout(() => {
            router.replace(EMERGENCY_URL);
          }, 50);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [showCountdown, router]);

  const openCountdown = React.useCallback(() => {
    setShowCountdown(true);
  }, []);

  const cancelCountdown = React.useCallback(() => {
    setShowCountdown(false);
  }, []);

  const activateNow = React.useCallback(() => {
    router.replace(EMERGENCY_URL);
  }, [router]);

  const enterNex = React.useCallback(() => {
    router.replace(destination);
  }, [destination, router]);

  return (
    <>
      {/* Round HELP button · top-right */}
      <button
        type="button"
        onClick={openCountdown}
        aria-label="Emergency Help · open activation countdown"
        data-nex-splash-emergency-help-button
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + 16px)",
          right: "calc(env(safe-area-inset-right, 0px) + 16px)",
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: PALETTE.red,
          border: `2px solid ${PALETTE.redRing}`,
          color: PALETTE.white,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "0.1em",
          cursor: "pointer",
          boxShadow: PALETTE.shadow,
          zIndex: 1010,
          padding: 0,
          lineHeight: 1,
        }}
      >
        <HelpIcon />
        <span style={{ fontSize: 9, marginTop: 2 }}>HELP</span>
      </button>

      {/* Enter NEX button · bottom centre · lets activated users
          proceed to their normal destination without auto-divert. */}
      <button
        type="button"
        onClick={enterNex}
        aria-label="Enter NEX"
        data-nex-splash-enter-nex-button
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 6vh)",
          margin: "0 auto",
          width: "auto",
          maxWidth: 240,
          padding: "14px 28px",
          borderRadius: 999,
          background: "#FF7200",
          color: PALETTE.white,
          textAlign: "center",
          textDecoration: "none",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          fontSize: 14,
          fontWeight: 900,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          border: "none",
          cursor: "pointer",
          boxShadow:
            "0 6px 18px rgba(255, 114, 0, 0.42), 0 2px 6px rgba(0, 0, 0, 0.4)",
          zIndex: 1010,
        }}
      >
        Enter NEX →
      </button>

      {/* Full-screen overlay with big "Activate Help" square + countdown */}
      {showCountdown ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="nex-activate-help-title"
          data-nex-splash-emergency-countdown
          onClick={cancelCountdown}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.78)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1050,
            padding: 24,
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              activateNow();
            }}
            aria-label={`Activate Help now · ${secondsLeft} seconds remaining`}
            data-nex-splash-emergency-countdown-button
            style={{
              width: "min(80vw, 280px)",
              aspectRatio: "1 / 1",
              borderRadius: 24,
              background: PALETTE.red,
              border: `3px solid ${PALETTE.redRing}`,
              color: PALETTE.white,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
              cursor: "pointer",
              boxShadow: PALETTE.shadow,
              padding: 24,
            }}
          >
            <HelpIcon size={44} />
            <span
              id="nex-activate-help-title"
              style={{
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Activate Help
            </span>
            <span
              style={{
                fontSize: 64,
                fontWeight: 900,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                background: PALETTE.redDark,
                padding: "8px 24px",
                borderRadius: 16,
              }}
              aria-live="polite"
            >
              {secondsLeft}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                opacity: 0.9,
                textAlign: "center",
                maxWidth: 220,
                lineHeight: 1.4,
              }}
            >
              Tap to activate now · tap outside to cancel
            </span>
          </button>
        </div>
      ) : null}
    </>
  );
}

function HelpIcon({ size = 20 }: { readonly size?: number }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 L22 20 L2 20 Z" />
      <path d="M12 9 L12 14" />
      <circle cx="12" cy="17.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
