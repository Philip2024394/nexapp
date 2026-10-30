"use client";

// src/components/nex-native/music/MusicWaveform.tsx
//
// Owner-authorised 2026-10-29 · the animated audio waveform shown
// in the music-player overlay. CSS-only animation when the player
// is playing · pauses in-place when the player is paused.
//
// Honest limitation: this is a DECORATIVE waveform synced to the
// playing/paused state only · it is not a real-time spectrogram
// driven by the AudioContext AnalyserNode. A future enhancement can
// bind the bar heights to live FFT output; v1 keeps it simple and
// cheap so a slow device never drops the Live surface.

import * as React from "react";

// Owner-authorised 2026-10-29 (compact equaliser) · one section of
// 6 bars instead of a 28-bar full-row spread. Bars are a tight
// left-aligned group with a fixed width · looks like a classic
// equaliser block, not a full-width waveform.
const BAR_COUNT = 6;

// Owner-authorised 2026-10-29 (beat-responsive EQ) · when the host
// passes real `levels` from an AudioContext AnalyserNode (6 values,
// each 0..1 representing a frequency bucket), each bar renders the
// matching height instantly. When `levels` is absent, the component
// falls back to the deterministic pseudo-random CSS animation (which
// is paused when `isPlaying` is false).
export const MusicWaveform = React.memo(function MusicWaveform(props: {
  readonly isPlaying: boolean;
  readonly accent: string;
  readonly height?: number;
  readonly levels?: readonly number[] | null;
}): React.JSX.Element {
  const h = props.height ?? 32;
  // Stable pseudo-random seeds per bar · deterministic across renders.
  const seeds = React.useMemo(
    () => Array.from({ length: BAR_COUNT }, (_, i) => (Math.sin(i * 1.618) + 1) / 2),
    [],
  );
  const hasRealLevels =
    Array.isArray(props.levels) && props.levels.length === BAR_COUNT;

  return (
    <div
      aria-hidden
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 5,
        height: h,
        width: "auto",
      }}
    >
      {seeds.map((s, i) => {
        const realLevel = hasRealLevels ? props.levels![i] ?? 0 : null;
        // Owner-authorised 2026-10-30 · "tallest bar in the center of
        // the animation." The real-level path receives already-peaked
        // levels from the overlay (see NexMusicPlayerOverlay stepAnalyser).
        // The fallback path (no analyser) builds a mountain profile
        // directly here: centre bars peak taller, edges stay subdued.
        const centerDistance = Math.abs(i - (BAR_COUNT - 1) / 2);
        const centerBias = 1 - centerDistance / ((BAR_COUNT - 1) / 2);
        const fallbackPaused = Math.max(14, 14 + centerBias * 55 + s * 10);
        const heightPct =
          realLevel !== null
            ? Math.max(10, Math.min(100, realLevel * 100))
            : fallbackPaused;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              // Owner-authorised 2026-10-30 · wider bar style. 4→8px
              // bar width + 3→5px gap (parent) gives a chunkier,
              // more presentational equaliser read.
              width: 8,
              borderRadius: 3,
              background: props.accent,
              boxShadow: `0 0 8px ${props.accent}`,
              height: `${heightPct}%`,
              // Real-level mode skips the CSS keyframe · the JS loop
              // is already updating `heightPct` 60× per second.
              animation:
                props.isPlaying && !hasRealLevels
                  ? `nex-music-wave-${i} 900ms ease-in-out ${(s * 400).toFixed(0)}ms infinite alternate`
                  : "none",
              opacity: props.isPlaying ? 1 : 0.42,
              // Short transition softens frame-to-frame jitter when
              // the real analyser spike is sharp.
              transition: hasRealLevels
                ? "height 70ms linear, opacity 240ms ease-out"
                : "opacity 240ms ease-out",
            }}
          />
        );
      })}
      <style>{keyframes}</style>
    </div>
  );
});

// Owner-authorised 2026-10-30 · centre bars peak taller, outer bars
// stay subdued. Each bar's low → high range scales with its proximity
// to the horizontal centre so the animated mountain profile is always
// readable, regardless of random seed phase.
const keyframes = Array.from({ length: BAR_COUNT }, (_, i) => {
  const centerDistance = Math.abs(i - (BAR_COUNT - 1) / 2);
  const centerBias = 1 - centerDistance / ((BAR_COUNT - 1) / 2);
  const low = Math.round(14 + centerBias * 20);
  const high = Math.round(45 + centerBias * 50);
  return `@keyframes nex-music-wave-${i} { 0% { height: ${low}%; } 100% { height: ${high}%; } }`;
}).join("\n");
