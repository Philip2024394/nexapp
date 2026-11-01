"use client";

// src/components/nex-native/nex-feed/_world-globe-spin.tsx
//
// Owner-authorised 2026-11-01 · NEX World Feed entry effect.
// --------------------------------------------------------------------
// The Worldwide-feed counterpart to IrishShamrockBurst. Fires when the
// viewer enters the Worldwide feed (globe icon). A single cyan-tinted
// globe wireframe scales + spins once (720°) while 10 radial light
// rays sweep outward from centre.
//
// Design mirrors the shamrock-burst primitive:
//   · Pure client · no server · no DB.
//   · Parent controls firing via `trigger: number` monotonic prop.
//     `trigger === 0` renders nothing.
//   · position: fixed · pointer-events: none · zIndex 999.
//   · Auto-cleanup after animation + safety tolerance.

import * as React from "react";

const SPIN_DURATION_MS = 1600;
const CLEANUP_SAFETY_MS = 400;
const RAY_COUNT = 10;

export interface WorldGlobeSpinProps {
  readonly trigger: number;
}

export function WorldGlobeSpin(
  props: WorldGlobeSpinProps,
): React.JSX.Element | null {
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    if (props.trigger === 0) return;
    const key = props.trigger;
    setActive(key);
    const t = window.setTimeout(() => {
      setActive((prev) => (prev === key ? 0 : prev));
    }, SPIN_DURATION_MS + CLEANUP_SAFETY_MS);
    return () => window.clearTimeout(t);
  }, [props.trigger]);

  if (active === 0) return null;

  const rays = Array.from({ length: RAY_COUNT }, (_, i) => i);

  return (
    <>
      <style>{WORLD_GLOBE_KEYFRAMES_CSS}</style>
      <div
        data-nex-world-globe-spin
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 180,
            height: 180,
            marginTop: -90,
            marginLeft: -90,
          }}
        >
          {rays.map((i) => (
            <div
              key={`ray-${active}-${i}`}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 2,
                height: 180,
                marginTop: -90,
                marginLeft: -1,
                background:
                  "linear-gradient(to top, rgba(0, 175, 255, 0) 0%, rgba(0, 175, 255, 0.75) 55%, rgba(0, 175, 255, 0) 100%)",
                transformOrigin: "center center",
                transform: `rotate(${(i * 360) / RAY_COUNT}deg) scaleY(0)`,
                animation: `nex-world-ray ${SPIN_DURATION_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1) both`,
                animationDelay: `${i * 30}ms`,
                willChange: "transform, opacity",
              }}
            />
          ))}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00AFFF"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              transformOrigin: "center center",
              animation: `nex-world-globe-spin ${SPIN_DURATION_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1) both`,
              filter: "drop-shadow(0 0 24px rgba(0, 175, 255, 0.6))",
              willChange: "transform, opacity",
            }}
            aria-hidden
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            <path d="M4.5 7h15" />
            <path d="M4.5 17h15" />
          </svg>
        </div>
      </div>
    </>
  );
}

const WORLD_GLOBE_KEYFRAMES_CSS = `
@keyframes nex-world-globe-spin {
  0%   { transform: scale(0.3) rotate(0deg);   opacity: 0; }
  18%  { transform: scale(1.08) rotate(220deg); opacity: 1; }
  70%  { transform: scale(1) rotate(720deg);   opacity: 1; }
  100% { transform: scale(1.4) rotate(760deg); opacity: 0; }
}
@keyframes nex-world-ray {
  0%   { transform: rotate(var(--nex-ray-rot, 0deg)) scaleY(0); opacity: 0; }
  25%  { opacity: 1; }
  60%  { transform: rotate(var(--nex-ray-rot, 0deg)) scaleY(1); opacity: 0.9; }
  100% { transform: rotate(var(--nex-ray-rot, 0deg)) scaleY(1.3); opacity: 0; }
}
`;
