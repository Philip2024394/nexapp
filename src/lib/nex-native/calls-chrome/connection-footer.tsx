// src/lib/nex-native/calls-chrome/connection-footer.tsx
//
// NEX Calls Chrome · master footer · voice waveform + connection quality.
// Owner-authorised 2026-10-19 (Phase 1 UI shell).
// -----------------------------------------------------------------------------
// Per the sealed owner spec (2026-10-19 full feature guide, section
// 5): "The bottom Good Connection indicator should be based on real
// connection measurements. If NEX cannot determine the quality, it
// should display a neutral status instead of claiming that the
// connection is good."
//
// This primitive honours that invariant · the quality label is
// driven ENTIRELY by the `quality` prop which the caller resolves
// from the real peer-call stats. When quality is unknown, caller
// passes `null` and we render "Measuring…" (neutral · honest).
//
// Server Component · zero client state. The waveform is a decorative
// SVG · it does NOT animate from fake audio data today (future
// enhancement when the sealed voice-activity signal from the engine
// is routed up).

import type { CSSProperties } from "react";
import type { CallsConnectionQuality, CallsThemeSkin } from "./types";

const NEX = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  green: "#2ED37A",
  amber: "#FFB454",
  red: "#E13A4A",
};

export interface ConnectionFooterProps extends CallsThemeSkin {
  /** Real quality from the WebRTC stats layer. Null when the stats
   *  pipeline hasn't produced a reading yet · caller must pass null
   *  rather than defaulting to "good" (honest invariant). */
  readonly quality: CallsConnectionQuality | null;
}

export function ConnectionFooter({ quality, themeAccent }: ConnectionFooterProps) {
  const accent = themeAccent ?? NEX.cyan;
  const resolved = resolveQuality(quality);
  return (
    <footer
      data-nex-connection-footer
      data-nex-connection-quality={quality ?? "unknown"}
      style={footerStyle}
    >
      {/* Left · decorative audio waveform · 7 bars */}
      <WaveformGlyph accent={accent} />

      {/* Right · signal bars + label · colour reflects quality */}
      <div style={rightClusterStyle}>
        <SignalBars quality={quality} fallback={accent} />
        <span
          style={{
            ...labelStyle,
            color: resolved.colour,
          }}
        >
          {resolved.label}
        </span>
      </div>
    </footer>
  );
}

function resolveQuality(
  quality: CallsConnectionQuality | null,
): { readonly label: string; readonly colour: string } {
  switch (quality) {
    case "good":
      return { label: "Good Connection", colour: NEX.green };
    case "fair":
      return { label: "Fair Connection", colour: NEX.amber };
    case "poor":
      return { label: "Poor Connection", colour: NEX.red };
    case "reconnecting":
      return { label: "Reconnecting…", colour: NEX.amber };
    case null:
    default:
      // Honest neutral · no stats yet · do NOT lie that connection
      // is good. Owner's sealed invariant.
      return { label: "Measuring…", colour: NEX.textMute };
  }
}

function WaveformGlyph({ accent }: { accent: string }) {
  // Static 7-bar waveform · decorative. Heights are deterministic
  // (not random) so SSR + hydration match.
  const heights = [8, 14, 20, 26, 20, 14, 8];
  return (
    <svg
      width="60"
      height="26"
      viewBox="0 0 60 26"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i * 8 + 1}
          y={(26 - h) / 2}
          width={5}
          height={h}
          rx={2}
          ry={2}
          fill={accent}
          opacity={0.55 + i * 0.05}
        />
      ))}
    </svg>
  );
}

function SignalBars({
  quality,
  fallback,
}: {
  quality: CallsConnectionQuality | null;
  fallback: string;
}) {
  // 4-bar signal icon · fills based on quality tier.
  const filled =
    quality === "good"
      ? 4
      : quality === "fair"
        ? 3
        : quality === "poor"
          ? 1
          : quality === "reconnecting"
            ? 2
            : 0;
  const dimColour = "rgba(125, 155, 192, 0.4)";
  return (
    <svg
      width="18"
      height="14"
      viewBox="0 0 18 14"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={i * 5}
          y={14 - (i + 1) * 3 - 1}
          width={3}
          height={(i + 1) * 3 + 1}
          rx={1}
          fill={i < filled ? fallback : dimColour}
        />
      ))}
    </svg>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const footerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "6px 14px calc(env(safe-area-inset-bottom, 0px) + 6px)",
  background: "rgba(2, 9, 20, 0.9)",
  borderTop: "1px solid rgba(0, 175, 255, 0.12)",
  flexShrink: 0,
};
const rightClusterStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};
const labelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.2,
};
