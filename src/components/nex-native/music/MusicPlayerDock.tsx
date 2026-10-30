"use client";

// src/components/nex-native/music/MusicPlayerDock.tsx
//
// Owner-authorised 2026-10-29 · minimised NEX Music overlay dock.
// Small cyan-rimmed glass chip pinned to the right rail; one tap
// re-opens the overlay. Progress fringe wraps the chip.

import * as React from "react";

const CYAN = "#4FC3FF";

export function MusicPlayerDock(props: {
  readonly coverUrl: string | null;
  readonly title: string;
  readonly progress: number; // 0..1
  readonly isPlaying: boolean;
  readonly onOpen: () => void;
}): React.JSX.Element {
  const circumference = 2 * Math.PI * 20; // radius 20
  const offset = circumference * (1 - Math.max(0, Math.min(1, props.progress)));
  return (
    <button
      type="button"
      aria-label={`Open NEX Music · ${props.title}`}
      onClick={props.onOpen}
      style={{
        position: "relative",
        width: 48,
        height: 48,
        borderRadius: 999,
        border: "none",
        padding: 0,
        background: "rgba(10, 27, 51, 0.55)",
        boxShadow: `0 0 0 1px ${CYAN}, 0 0 14px rgba(79,195,255,0.55)`,
        cursor: "pointer",
        overflow: "visible",
      }}
    >
      <svg
        viewBox="0 0 48 48"
        width={48}
        height={48}
        style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
      >
        <circle cx={24} cy={24} r={20} fill="none" stroke="rgba(79,195,255,0.2)" strokeWidth={2} />
        <circle
          cx={24}
          cy={24}
          r={20}
          fill="none"
          stroke={CYAN}
          strokeWidth={2}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 300ms ease-out" }}
        />
      </svg>
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 6,
          borderRadius: 999,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, #152646, #1E3A6E)`,
          color: "#FFFFFF",
          fontSize: 16,
          fontWeight: 800,
        }}
      >
        {props.coverUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={props.coverUrl}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: props.isPlaying ? 1 : 0.72,
            }}
          />
        ) : (
          <span>♪</span>
        )}
      </span>
    </button>
  );
}
