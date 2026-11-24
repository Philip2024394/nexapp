// src/app/nex-native/_splash-decision-screen.tsx
//
// NEX splash page · SOS decision screen · owner-sealed 2026-11-23.
//
// Rendered server-side when the viewer has configured Emergency Help
// with at least one enabled trusted-contact recipient (authoritative
// check via `getContactsSetupStatusAction` → `enabledContacts >= 1`).
//
// Owner's 12-directive brief, applied directly:
//   · No auto-divert · no meta refresh · no JS timer.
//     The user must deliberately pick between Enter NEX and SOS.
//   · Enter NEX is a REAL anchor link to the G-2-resolved destination
//     so it works without JavaScript.
//   · SOS is a REAL anchor link to /nex-native/emergency-help. Hair-
//     trigger activation happens at tap, with no confirmation dialog
//     and no second press. The existing emergency-help surface owns
//     the honest-status / cancellation / live-mode-gate behaviour.
//   · Both buttons have clearly-bounded large touch targets. The
//     surrounding screen does NOT trigger SOS — only the SOS button
//     itself does. A generous vertical gap separates the two.
//   · Rendered directly in SSR HTML (no client-only gates) so finger
//     presses work on first paint, including in no-JS environments.
//
// This component does NOT:
//   · Deliver any message to any contact (live-mode gate OFF).
//   · Write any incident record or location coordinate.
//   · Claim an alarm has been delivered.
//   · Divert the user automatically.
//
// It presents the decision. Everything downstream lives on the existing
// /nex-native/emergency-help surface.

import Image from "next/image";

const EMERGENCY_HREF = "/nex-native/emergency-help";

const PALETTE = {
  canvasBg: "#061021",
  sosRed: "#C21515",
  sosRedDark: "#8B0000",
  sosRedRing: "rgba(255, 77, 79, 0.65)",
  enterOrange: "#FF7200",
  enterOrangeDark: "#C85A00",
  ink: "#FFFFFF",
  overlayShadow:
    "0 10px 32px rgba(194,21,21,0.55), 0 2px 8px rgba(0,0,0,0.45)",
  enterShadow:
    "0 6px 22px rgba(255,114,0,0.48), 0 2px 8px rgba(0,0,0,0.40)",
};

interface SplashDecisionScreenProps {
  /** The G-2 three-way destination resolved server-side in page.tsx. */
  readonly destination: string;
}

export function SplashDecisionScreen({
  destination,
}: SplashDecisionScreenProps): React.JSX.Element {
  return (
    <main
      aria-label="NEX splash page · decide to enter NEX or activate SOS"
      style={{
        position: "fixed",
        inset: 0,
        margin: 0,
        padding: 0,
        background: PALETTE.canvasBg,
        display: "grid",
        gridTemplateRows: "1fr auto 1fr",
        overflow: "hidden",
        zIndex: 1000,
      }}
    >
      {/* Branded background · letterboxed centred, same as the normal
          splash. Non-interactive · buttons are the only tap targets. */}
      <Image
        src="/nex-splash.png"
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="100vw"
        style={{
          objectFit: "contain",
          objectPosition: "center",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 1,
        }}
      />

      {/* Decision stack · vertically centred in the middle row.
          Generous padding and a 32px gap between the two buttons so
          a fingertip near SOS cannot land on Enter NEX and vice-versa. */}
      <div
        data-nex-splash-decision-stack
        style={{
          gridRow: "2 / 3",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
          padding: "24px 20px",
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* SOS button · large bounded target · hair-trigger activation.
            NO confirm dialog · NO second press · tap on the button
            itself navigates straight to the emergency-help surface.
            Anchor so it works without JavaScript. */}
        <a
          href={EMERGENCY_HREF}
          data-nex-splash-sos-button
          aria-label="SOS Emergency · activate help immediately"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            width: "min(84vw, 320px)",
            minHeight: 128,
            padding: "22px 28px",
            borderRadius: 24,
            background: PALETTE.sosRed,
            border: `3px solid ${PALETTE.sosRedRing}`,
            color: PALETTE.ink,
            textDecoration: "none",
            fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
            boxShadow: PALETTE.overlayShadow,
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <SosIcon />
          <span
            style={{
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            SOS
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              opacity: 0.92,
            }}
          >
            Emergency
          </span>
        </a>

        {/* Enter NEX · real anchor link · no JavaScript required.
            Destination is resolved server-side from the G-2 three-way
            branch and injected into the href. */}
        <a
          href={destination}
          data-nex-splash-enter-nex-button
          aria-label="Enter NEX normally"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "min(70vw, 240px)",
            minHeight: 56,
            padding: "14px 32px",
            borderRadius: 999,
            background: PALETTE.enterOrange,
            border: `2px solid ${PALETTE.enterOrangeDark}`,
            color: PALETTE.ink,
            textDecoration: "none",
            fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
            fontSize: 15,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            boxShadow: PALETTE.enterShadow,
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Enter NEX →
        </a>
      </div>
    </main>
  );
}

function SosIcon({ size = 34 }: { readonly size?: number }): React.JSX.Element {
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
      focusable="false"
    >
      <path d="M12 3 L22 20 L2 20 Z" />
      <path d="M12 9 L12 14" />
      <circle cx="12" cy="17.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
