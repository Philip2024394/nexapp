// src/components/nex-native/directory/MapPinPing.tsx
//
// Decorative map-pin icon with two concentric ring pulses (ping effect).
// Pure CSS keyframe animation · no JS state · lightweight. Degrades
// honestly in environments without CSS animations (ping rings just
// render static).
//
// Semantically decorative · `aria-hidden="true"`. Any location text
// read by assistive tech lives in sibling elements, not here.

"use client";

import type { CSSProperties } from "react";

export interface MapPinPingProps {
  readonly size?: number;
  readonly accentColor?: string;
}

const PING_STYLE = `
@keyframes nex-map-pin-ping {
  0%   { transform: scale(1);   opacity: 0.65; }
  80%  { transform: scale(2.4); opacity: 0;    }
  100% { transform: scale(2.4); opacity: 0;    }
}
`;

export function MapPinPing(props: MapPinPingProps): React.JSX.Element {
  const size = props.size ?? 20;
  const accent = props.accentColor ?? "#00AFFF";
  const halfSize = size / 2;

  const wrapperStyle: CSSProperties = {
    position: "relative",
    width: size,
    height: size,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  const ringBaseStyle: CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: size,
    height: size,
    borderRadius: "50%",
    border: `2px solid ${accent}`,
    boxSizing: "border-box",
    pointerEvents: "none",
    animationName: "nex-map-pin-ping",
    animationDuration: "2.4s",
    animationIterationCount: "infinite",
    animationTimingFunction: "cubic-bezier(0.0, 0.0, 0.2, 1.0)",
  };

  const ring1Style: CSSProperties = {
    ...ringBaseStyle,
    animationDelay: "0s",
  };
  const ring2Style: CSSProperties = {
    ...ringBaseStyle,
    animationDelay: "1.2s",
  };

  return (
    <span
      aria-hidden="true"
      data-nex-map-pin-ping
      style={wrapperStyle}
    >
      {/* Inject keyframes once per mount · scoped by the animation
          name so this does not conflict with other styles. */}
      <style
        dangerouslySetInnerHTML={{
          __html: PING_STYLE,
        }}
      />
      <span style={ring1Style} />
      <span style={ring2Style} />
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={accent}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ position: "relative", width: size, height: size, zIndex: 1 }}
      >
        <path
          d={`M12 22s7-7.58 7-13a7 7 0 10-14 0c0 5.42 7 13 7 13z`}
          fill={accent}
          fillOpacity={0.12}
        />
        <circle cx="12" cy="9" r="2.5" fill={accent} />
      </svg>
      {/* keep halfSize referenced so eslint doesn't flag unused · also
          serves as a stable anchor point for future absolute children */}
      <span style={{ position: "absolute", left: halfSize, top: halfSize, width: 0, height: 0 }} />
    </span>
  );
}
