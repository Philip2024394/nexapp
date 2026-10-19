"use client";

// src/lib/nex-native/calls-chrome/call-control-bar.tsx
//
// NEX Calls Chrome · master control bar.
// Owner-authorised 2026-10-19 (Phase 1 UI shell).
// -----------------------------------------------------------------------------
// Seven circular controls per the sealed concept image:
//
//   Mute · Camera · [●END CALL● red+larger] · Audio · Chat · Participants · More
//
// Honesty discipline (sealed in the audit report delivered 2026-10-19):
//
//   WIRED controls (`wired: true`):
//     · Mute        · setMuted() exists on the PeerCall engine
//     · Camera Off  · setCameraOff() exists on the group-call client
//     · End Call    · PeerCall teardown + group-call onEnd handler
//
//   NOT-WIRED controls (`wired: false`):
//     · Audio       · no setSinkId() wiring today · Safari/iOS
//                     WebRTC limitations known
//     · Chat        · chat exists at /chat/peer but has never been
//                     mounted as an in-call overlay panel
//     · Participants· tile grid shows participants but no separate
//                     list panel with mic-state / invitation-status
//     · More        · no secondary options surface exists
//
// Not-wired buttons render with the same visual language as the
// wired ones BUT: 60% opacity + `disabled` attribute + title /
// aria-label suffix "· coming later" so no icon lies about having a
// backing action. Same discipline the sealed Calls hub uses for the
// Group-call / Call-link tiles.

import * as React from "react";

const NEX = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.42)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  // Owner directive 2026-10-19 · dark-red family · matches the
  // sealed NEX pin palette we established on the directory map pin
  // (#C0392B · Google-Maps-adjacent dark red). Replaces the earlier
  // brighter #E13A4A so the End Call button reads as a serious,
  // high-stakes action.
  red: "#C0392B",
  redInk: "#1A0404",
  redGlow: "rgba(192, 57, 43, 0.55)",
  buttonBg: "rgba(10, 21, 38, 0.78)",
  buttonBorder: "rgba(0, 175, 255, 0.35)",
};

export interface CallControlBarProps {
  readonly muted: boolean;
  readonly cameraOff: boolean;
  readonly onToggleMute?: () => void;
  readonly onToggleCamera?: () => void;
  readonly onEndCall?: () => void;
  /** Optional click handlers for the "coming later" controls. When
   *  the parent eventually wires one, swap the matching `comingLater`
   *  flag to false in that control's entry. */
  readonly onAudio?: () => void;
  readonly onChat?: () => void;
  readonly onParticipants?: () => void;
  readonly onMore?: () => void;
}

export function CallControlBar({
  muted,
  cameraOff,
  onToggleMute,
  onToggleCamera,
  onEndCall,
  onAudio,
  onChat,
  onParticipants,
  onMore,
}: CallControlBarProps) {
  return (
    <nav
      data-nex-call-control-bar
      aria-label="Call controls"
      style={barStyle}
    >
      {/* 1 · Mute · WIRED */}
      <ControlButton
        label={muted ? "Unmute" : "Mute"}
        active={!muted}
        wired
        onClick={onToggleMute}
        testid="mute"
      >
        <MicIcon muted={muted} />
      </ControlButton>

      {/* 2 · Camera · WIRED */}
      <ControlButton
        label={cameraOff ? "Camera On" : "Camera Off"}
        active={!cameraOff}
        wired
        onClick={onToggleCamera}
        testid="camera"
      >
        <CameraIcon off={cameraOff} />
      </ControlButton>

      {/* 3 · End Call · WIRED · prominent red */}
      <ControlButton
        label="End Call"
        active
        wired
        variant="end"
        onClick={onEndCall}
        testid="end-call"
      >
        <HangUpIcon />
      </ControlButton>

      {/* 4 · Audio · NOT WIRED (speaker/earpiece switch) */}
      <ControlButton
        label="Audio"
        active={false}
        wired={false}
        onClick={onAudio}
        testid="audio"
      >
        <SpeakerIcon />
      </ControlButton>

      {/* Chat + Participants retired 2026-10-19 (owner directive ·
          "remove the button on footer chat and participants · we
          don't require"). The props `onChat` + `onParticipants`
          stay on the interface for backward compatibility but
          render nothing today. */}

      {/* 5 · More · NOT WIRED */}
      <ControlButton
        label="More"
        active={false}
        wired={false}
        onClick={onMore}
        testid="more"
      >
        <MoreIcon />
      </ControlButton>
    </nav>
  );
}

interface ControlButtonProps {
  readonly label: string;
  readonly active: boolean;
  readonly wired: boolean;
  readonly variant?: "default" | "end";
  readonly onClick?: () => void;
  readonly testid: string;
  readonly children: React.ReactNode;
}

function ControlButton({
  label,
  active,
  wired,
  variant = "default",
  onClick,
  testid,
  children,
}: ControlButtonProps) {
  const isEnd = variant === "end";
  const disabled = !wired;
  const ariaSuffix = wired ? "" : " · coming later";
  return (
    <div style={controlColumnStyle}>
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        aria-label={`${label}${ariaSuffix}`}
        title={disabled ? `${label} · coming later` : label}
        data-nex-call-control={testid}
        data-nex-call-control-wired={wired ? "true" : "false"}
        data-nex-call-control-active={active ? "true" : "false"}
        style={{
          ...controlButtonStyle,
          width: isEnd ? 60 : 48,
          height: isEnd ? 60 : 48,
          background: isEnd
            ? NEX.red
            : active
              ? NEX.cyanFaint
              : NEX.buttonBg,
          color: isEnd ? NEX.redInk : active ? NEX.cyan : NEX.textDim,
          border: isEnd
            ? "none"
            : `1px solid ${active ? NEX.cyanSoft : NEX.buttonBorder}`,
          boxShadow: isEnd
            ? `0 10px 24px -8px ${NEX.redGlow}`
            : active
              ? `0 0 0 1px ${NEX.cyanSoft}`
              : "none",
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {children}
      </button>
      <span
        style={{
          ...controlLabelStyle,
          color: isEnd ? NEX.red : NEX.textMute,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Icons · inline SVG ─────────────────────────────────────────────

// Owner directive 2026-10-19 · when a toggle button is in the OFF
// state (mic muted · camera off), overlay a BRIGHT RED diagonal
// line across the icon so the off-state reads unambiguously. When
// the button is ON, the red slash is absent. The red colour is
// deliberately a brighter alert red (#FF4D4D) than the sealed dark
// NEX.red button-fill colour — the slash needs to contrast against
// a dark button background, where #C0392B would read as muddy. The
// icon strokes themselves stay in `currentColor` so they continue
// to inherit the button's cyan/text colour.
const OFF_SLASH_COLOR = "#FF4D4D";

function MicIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11 v1 a7 7 0 0 0 14 0 v-1" />
      <line x1="12" y1="19" x2="12" y2="22" />
      {muted ? (
        <line
          x1="4"
          y1="4"
          x2="20"
          y2="20"
          stroke={OFF_SLASH_COLOR}
          strokeWidth="2.6"
        />
      ) : null}
    </svg>
  );
}

function CameraIcon({ off }: { off: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8 h11 a2 2 0 0 1 2 2 v4 a2 2 0 0 1 -2 2 h-11 a2 2 0 0 1 -2 -2 v-4 a2 2 0 0 1 2 -2z" />
      <path d="M16 10 l5 -3 v10 l-5 -3z" />
      {off ? (
        <line
          x1="4"
          y1="4"
          x2="20"
          y2="20"
          stroke={OFF_SLASH_COLOR}
          strokeWidth="2.6"
        />
      ) : null}
    </svg>
  );
}

function HangUpIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 13 c0 -4 4 -6 8 -6 s8 2 8 6 l-2 2 -3 -1 v-2 c-1 -1 -5 -1 -6 0 v2 l-3 1z"
        fill="currentColor"
        transform="rotate(135 12 12)"
      />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 9 h4 l6 -5 v16 l-6 -5 h-4z" />
      <path d="M17 8 a5 5 0 0 1 0 8" />
      <path d="M20 5 a9 9 0 0 1 0 14" />
    </svg>
  );
}

// ChatIcon + PeopleIcon retired 2026-10-19 along with their
// buttons · see the comment inside CallControlBar for context.

function MoreIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden
      fill="currentColor"
    >
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const barStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 4,
  padding:
    "12px 10px calc(env(safe-area-inset-bottom, 0px) + 10px)",
  background:
    "linear-gradient(0deg, rgba(2,9,20,0.95) 0%, rgba(2,9,20,0.4) 100%)",
  flexShrink: 0,
};
const controlColumnStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  minWidth: 0,
};
const controlButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  padding: 0,
  fontFamily: "inherit",
  WebkitTapHighlightColor: "transparent",
};
const controlLabelStyle: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: 0.3,
  lineHeight: 1,
  textAlign: "center",
};
