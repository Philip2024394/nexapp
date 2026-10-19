// src/lib/nex-native/calls-chrome/video-tile.tsx
//
// NEX Calls Chrome · participant video tile.
// Owner-authorised 2026-10-19 (Phase 1 UI shell).
// -----------------------------------------------------------------------------
// Reusable tile per the sealed concept image:
//   · Cyan rim + rounded corners
//   · Participant poster or honest no-video monogram fallback
//   · Name badge bottom-left · with 🎤 (mic active) or 🔊 (speaker on)
//   · Three sizes · "primary" (large hero), "medium" (grid cell),
//     "small" (self-view bottom-right)
//
// Honesty invariants:
//   · When `videoOn === false`, we render a honest monogram instead
//     of a frozen poster · never a fake "last frame".
//   · When `imageUrl === null` the monogram still renders · we do
//     NOT fabricate an avatar.
//   · The MIC indicator reflects the participant's own mic state ·
//     mute/unmute of OTHER participants is driven by their own
//     client (we never fake another user's state).

import type { CSSProperties } from "react";
import type { CallsParticipant, CallsTileSize, CallsThemeSkin } from "./types";

const NEX = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  cyan: "#00AFFF",
  cyanBright: "#5CC9FF",
  cyanSoft: "rgba(0, 175, 255, 0.42)",
  rimGlow: "rgba(0, 175, 255, 0.55)",
  tileBg: "linear-gradient(135deg, rgba(10,21,38,0.95) 0%, rgba(2,9,20,0.95) 100%)",
};

export interface VideoTileProps extends CallsThemeSkin {
  readonly participant: CallsParticipant;
  readonly size: CallsTileSize;
}

export function VideoTile({ participant, size, themeAccent }: VideoTileProps) {
  const rim = themeAccent ?? NEX.cyan;
  const nameLabel = participant.isSelf ? "You" : participant.name;
  const sizeMetrics = metricsFor(size);
  const showsVideo =
    participant.videoOn && typeof participant.imageUrl === "string";

  return (
    <div
      data-nex-video-tile
      data-nex-video-tile-size={size}
      data-nex-video-tile-mic={participant.micOn ? "on" : "off"}
      data-nex-video-tile-video={participant.videoOn ? "on" : "off"}
      style={{
        ...baseTileStyle,
        minHeight: sizeMetrics.minHeight,
        borderColor: rim,
        boxShadow: `0 0 0 1px ${rim}, 0 8px 24px -8px ${NEX.rimGlow}`,
      }}
      aria-label={`${nameLabel}${participant.micOn ? "" : " · muted"}${participant.videoOn ? "" : " · camera off"}`}
    >
      {showsVideo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={participant.imageUrl ?? ""}
          alt=""
          loading="lazy"
          style={posterStyle}
        />
      ) : (
        <NoVideoMonogram name={participant.name} rim={rim} />
      )}

      {/* Bottom-left name badge · mic/speaker icon · translucent dark */}
      <div style={nameBadgeStyle}>
        <MicGlyph on={participant.micOn} size={sizeMetrics.badgeIconSize} rim={rim} />
        <span
          style={{
            ...nameTextStyle,
            fontSize: sizeMetrics.nameFontSize,
          }}
        >
          {nameLabel}
        </span>
      </div>

      {/* Muted-mic red dot · top-right · only when the mic is OFF */}
      {!participant.micOn ? (
        <span aria-hidden style={mutedDotStyle} data-nex-video-tile-muted-dot />
      ) : null}
    </div>
  );
}

function metricsFor(size: CallsTileSize): {
  minHeight: number;
  badgeIconSize: number;
  nameFontSize: number;
} {
  switch (size) {
    case "primary":
      return { minHeight: 180, badgeIconSize: 11, nameFontSize: 12 };
    case "medium":
      return { minHeight: 108, badgeIconSize: 10, nameFontSize: 11 };
    case "small":
      return { minHeight: 86, badgeIconSize: 9, nameFontSize: 10 };
  }
}

function NoVideoMonogram({ name, rim }: { name: string; rim: string }) {
  const letter = (name.trim()[0] ?? "·").toUpperCase();
  return (
    <div
      aria-hidden
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        background: NEX.tileBg,
      }}
    >
      <span
        style={{
          color: rim,
          fontSize: 42,
          fontWeight: 800,
          letterSpacing: 1,
          opacity: 0.75,
          textShadow: `0 0 12px ${rim}80`,
        }}
      >
        {letter}
      </span>
    </div>
  );
}

function MicGlyph({ on, size, rim }: { on: boolean; size: number; rim: string }) {
  if (on) {
    // Mic active · simple mic outline (standard microphone glyph).
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden
        fill="none"
        stroke={rim}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 11 v1 a7 7 0 0 0 14 0 v-1" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    );
  }
  // Mic muted · mic with diagonal slash
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="#F85B6E"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11 v1 a7 7 0 0 0 14 0 v-1" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="4" y1="4" x2="20" y2="20" />
    </svg>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const baseTileStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  borderRadius: 14,
  overflow: "hidden",
  border: `1.5px solid transparent`,
  background: NEX.tileBg,
  display: "flex",
  alignItems: "stretch",
  justifyContent: "stretch",
};
const posterStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
  minHeight: "inherit",
};
const nameBadgeStyle: CSSProperties = {
  position: "absolute",
  left: 8,
  bottom: 8,
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(2, 9, 20, 0.78)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border: `1px solid rgba(255,255,255,0.08)`,
};
const nameTextStyle: CSSProperties = {
  color: NEX.text,
  fontWeight: 700,
  letterSpacing: "-0.005em",
  lineHeight: 1,
};
const mutedDotStyle: CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "#F85B6E",
  boxShadow: "0 0 6px rgba(248, 91, 110, 0.65)",
};
