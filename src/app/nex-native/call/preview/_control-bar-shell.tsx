"use client";

// src/app/nex-native/call/preview/_control-bar-shell.tsx
//
// NEX Call Center · page-local control bar.
// Owner-authorised 2026-11-08 (round 18 · themed footer).
// -----------------------------------------------------------------------------
// Replaces the sealed CallControlBar import on this preview surface
// with a page-local bar matching the emerald + gold Call Center
// chrome. The sealed primitive stays untouched so production peer-
// chat (_call-launcher.tsx) + /voice-preview keep their existing
// palette.
//
// Buttons on the bar (owner directive 2026-11-08 round 18):
//   · Mute · emerald · local toggle · when off, the tile-level
//     mic-off red-strike indicator fires too (coordinated via
//     parent's participant state in a future wire).
//   · Camera · emerald · local toggle.
//   · Flip camera · emerald · placeholder (wired=false · requires
//     the GroupCallEngine mount).
//   · More · emerald · placeholder (wired=false).
//   · End call · DARK RED · owner-exact "end call dark red".
//     Routes back to /nex-native/calls.

import * as React from "react";
import { useRouter } from "next/navigation";

const NEX = {
  emerald: "#16D66B",
  emeraldSoft: "rgba(22,214,107,0.14)",
  emeraldBorder: "rgba(22,214,107,0.45)",
  endRed: "#8B1A24",
  endRedBright: "#A6212F",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  ink: "#F2F5F8",
};

export function CallControlBarShell(): React.JSX.Element {
  const router = useRouter();
  const [muted, setMuted] = React.useState(false);
  const [cameraOff, setCameraOff] = React.useState(true);

  return (
    <div
      role="toolbar"
      aria-label="Call controls"
      data-nex-call-control-bar
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "14px 16px 20px",
        background:
          "linear-gradient(0deg, rgba(4,14,9,0.92) 0%, rgba(4,14,9,0.45) 100%)",
        flexShrink: 0,
      }}
    >
      <ControlButton
        label={muted ? "Unmute" : "Mute"}
        active={!muted}
        onClick={() => setMuted((v) => !v)}
        data-wired="local"
      >
        {muted ? <MicOffGlyph /> : <MicGlyph />}
      </ControlButton>

      <ControlButton
        label={cameraOff ? "Turn camera on" : "Turn camera off"}
        active={!cameraOff}
        onClick={() => setCameraOff((v) => !v)}
        data-wired="local"
      >
        {cameraOff ? <CameraOffGlyph /> : <CameraGlyph />}
      </ControlButton>

      <ControlButton
        label="Flip camera · coming later"
        active={false}
        disabled
        onClick={() => undefined}
        data-wired="false"
      >
        <FlipGlyph />
      </ControlButton>

      <ControlButton
        label="More · coming later"
        active={false}
        disabled
        onClick={() => undefined}
        data-wired="false"
      >
        <MoreGlyph />
      </ControlButton>

      <EndCallButton onEnd={() => router.push("/nex-native/calls")} />
    </div>
  );
}

// ─── Buttons ──────────────────────────────────────────────────────

interface ControlButtonProps {
  readonly label: string;
  readonly active: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
  readonly "data-wired"?: "local" | "false" | "engine";
}

function ControlButton({
  label,
  active,
  disabled,
  onClick,
  children,
  "data-wired": dataWired,
}: ControlButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      data-nex-call-control
      data-nex-call-control-wired={dataWired}
      data-nex-call-control-active={active ? "on" : "off"}
      style={{
        width: 48,
        height: 48,
        borderRadius: 999,
        border: `1px solid ${NEX.emeraldBorder}`,
        background: active ? NEX.emeraldSoft : "rgba(2,9,20,0.55)",
        color: active ? NEX.emerald : NEX.textDim,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition:
          "background 160ms ease, color 160ms ease, transform 120ms ease",
        fontFamily: "inherit",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </button>
  );
}

function EndCallButton({
  onEnd,
}: {
  readonly onEnd: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label="End call"
      title="End call"
      onClick={onEnd}
      data-nex-call-end
      data-nex-call-end-wired="local"
      style={{
        minWidth: 64,
        height: 48,
        padding: "0 18px",
        borderRadius: 999,
        border: `1px solid ${NEX.endRed}`,
        background:
          `linear-gradient(180deg, ${NEX.endRedBright} 0%, ${NEX.endRed} 100%)`,
        color: NEX.ink,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: "pointer",
        boxShadow: "0 2px 14px rgba(139,26,36,0.35)",
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <EndCallGlyph />
      <span>End</span>
    </button>
  );
}

// ─── Glyphs ───────────────────────────────────────────────────────

function MicGlyph(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11 v1 a7 7 0 0 0 14 0 v-1" />
      <path d="M12 19 v3" />
    </svg>
  );
}

function MicOffGlyph(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11 v1 a7 7 0 0 0 14 0 v-1" />
      <path d="M12 19 v3" />
      <line x1="4" y1="4" x2="20" y2="20" stroke="#E53945" strokeWidth="2.6" />
    </svg>
  );
}

function CameraGlyph(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10 l5 -3 v10 l-5 -3 z" />
    </svg>
  );
}

function CameraOffGlyph(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10 l5 -3 v10 l-5 -3 z" />
      <line x1="4" y1="4" x2="20" y2="20" stroke="#E53945" strokeWidth="2.6" />
    </svg>
  );
}

function FlipGlyph(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M8 10 l-2 2 l2 2" />
      <path d="M16 10 l2 2 l-2 2" />
    </svg>
  );
}

function MoreGlyph(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function EndCallGlyph(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: "rotate(135deg)" }}>
      <path d="M5 4 h3 l2 5 l-3 2 a11 11 0 0 0 6 6 l2 -3 l5 2 v3 a2 2 0 0 1 -2 2 A17 17 0 0 1 3 6 a2 2 0 0 1 2 -2z" />
    </svg>
  );
}
