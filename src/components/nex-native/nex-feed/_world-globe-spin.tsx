"use client";

// src/components/nex-native/nex-feed/_world-globe-spin.tsx
//
// Owner-authorised 2026-11-01 · NEX World Feed entry effect.
// --------------------------------------------------------------------
// The Worldwide-feed counterpart to IrishShamrockBurst. Fires when the
// viewer selects the Worldwide feed (globe icon).
//
// Owner-authorised 2026-11-01 (follow-up · asset supplied):
// The Worldwide burst now uses the sealed brand asset
// `/nex-brand/nex-world-orbital-globe.png` (Futuristic NEX Earth
// Orbital Logo) · a photoreal Earth with cyan orbital rings + chrome
// NEX wordmark baked into the image. Scales + rotates once (720°)
// with a cyan drop-shadow glow. The previous SVG wireframe + 10
// radial light rays are retired — the asset carries both the globe
// and the orbital-light composition in one layer.
//
// Design mirrors the IrishShamrockBurst primitive:
//   · Pure client · no server · no DB.
//   · Parent controls firing via `trigger: number` monotonic prop.
//     `trigger === 0` renders nothing.
//   · position: fixed · pointer-events: none · zIndex 999.
//   · Auto-cleanup after animation + safety tolerance.

import * as React from "react";

const SPIN_DURATION_MS = 1600;
const CLEANUP_SAFETY_MS = 400;
const GLOBE_SIZE_PX = 240;

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={`globe-${active}`}
          src="/nex-brand/nex-world-orbital-globe.png"
          alt=""
          aria-hidden
          decoding="async"
          style={{
            width: GLOBE_SIZE_PX,
            height: GLOBE_SIZE_PX,
            display: "block",
            transformOrigin: "center center",
            animation: `nex-world-globe-spin ${SPIN_DURATION_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1) both`,
            // Soft cyan halo matching the asset's own orbital glow ·
            // smaller blur than the previous wireframe version so the
            // halo accents the image rather than smearing it.
            filter: "drop-shadow(0 0 18px rgba(0, 175, 255, 0.55))",
            willChange: "transform, opacity",
          }}
        />
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
`;
