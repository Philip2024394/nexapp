"use client";

// src/lib/nex-native/planet-fly-through-client.tsx
//
// NEX · Planet Fly-Through ambient overlay · 2026-10-15.
// -----------------------------------------------------------------------------
// Decorative animation layer for NEX-brand themes. Lanes drift across
// the viewport (one leaving as another enters) and swap in at
// staggered start times. Each lane is pure CSS keyframes · zero
// runtime JS cost after mount.
//
// 2026-10-15 · owner directive "remove the planets i will upload
// planet". The in-code cinematic-sphere designs have been removed;
// each lane now ONLY renders when its `imageSrc` points at an
// owner-supplied transparent PNG under /public/nex-native/planets/.
// Lanes without `imageSrc` render nothing (the overlay still mounts
// so the owner can drop PNG files in and see them animate without
// a code change).

import * as React from "react";

export interface PlanetLane {
  readonly id: string;
  readonly size: number;
  readonly enterFromRight: boolean;
  readonly topVh: number;
  readonly travelSec: number;
  readonly delaySec: number;
  readonly tiltDeg?: number;
  /** Owner-supplied transparent-background PNG · usually at
   *  /nex-native/planets/<name>.png. Lane renders nothing when null. */
  readonly imageSrc?: string | null;
}

/** Default lane geometry · 6 flight paths staggered so there is
 *  almost always exactly one planet mid-flight and another entering.
 *  No images are set here yet · the owner will supply PNGs and wire
 *  each lane's `imageSrc` field in a follow-up pass. */
const DEFAULT_LANES: readonly PlanetLane[] = [
  { id: "lane-1", size: 180, enterFromRight: false, topVh: 15, travelSec: 48, delaySec:  0, tiltDeg: -4, imageSrc: null },
  { id: "lane-2", size: 110, enterFromRight: true,  topVh: 38, travelSec: 40, delaySec: 10, tiltDeg:  3, imageSrc: null },
  { id: "lane-3", size:  86, enterFromRight: false, topVh: 62, travelSec: 55, delaySec: 18, tiltDeg:  2, imageSrc: null },
  { id: "lane-4", size: 165, enterFromRight: true,  topVh: 28, travelSec: 58, delaySec: 26, tiltDeg: -6, imageSrc: null },
  { id: "lane-5", size: 100, enterFromRight: false, topVh: 52, travelSec: 42, delaySec: 34, tiltDeg:  5, imageSrc: null },
  { id: "lane-6", size: 120, enterFromRight: true,  topVh: 78, travelSec: 52, delaySec: 40, tiltDeg: -2, imageSrc: null },
];

export interface PlanetFlyThroughOverlayProps {
  readonly lanes?: readonly PlanetLane[];
  readonly respectReducedMotion?: boolean;
}

export function PlanetFlyThroughOverlay({
  lanes = DEFAULT_LANES,
  respectReducedMotion = true,
}: PlanetFlyThroughOverlayProps): React.ReactElement {
  const flyKeyframes = lanes.map(flyKeyframeFor).join("\n");

  const styleBlock = `
    ${flyKeyframes}
    ${
      respectReducedMotion
        ? `
      @media (prefers-reduced-motion: reduce) {
        [data-nex-planet-lane] {
          animation-play-state: paused !important;
        }
      }`
        : ""
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styleBlock }} />
      <div
        data-nex-planet-fly-through-overlay
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 20,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {lanes.map((lane) =>
          lane.imageSrc ? <PlanetSprite key={lane.id} lane={lane} /> : null,
        )}
      </div>
    </>
  );
}

function PlanetSprite({ lane }: { lane: PlanetLane }): React.ReactElement {
  return (
    <img
      src={lane.imageSrc ?? ""}
      alt=""
      data-nex-planet-lane={lane.id}
      style={{
        position: "absolute",
        top: `${lane.topVh}vh`,
        width: lane.size,
        height: lane.size,
        willChange: "transform",
        animation: `nex-planet-${lane.id} ${lane.travelSec}s linear ${lane.delaySec}s infinite`,
        pointerEvents: "none",
        userSelect: "none",
      }}
    />
  );
}

function flyKeyframeFor(lane: PlanetLane): string {
  const extent = `calc(100vw + ${lane.size + 80}px)`;
  const bob = Math.round(lane.size * 0.08);
  const startX = lane.enterFromRight ? extent : `-${lane.size + 40}px`;
  const endX = lane.enterFromRight ? `-${lane.size + 40}px` : extent;
  const tilt = lane.tiltDeg ?? 0;
  return `
    @keyframes nex-planet-${lane.id} {
      0%   { transform: translate3d(${startX}, 0, 0) rotate(${tilt}deg); opacity: 0; }
      6%   { opacity: 1; }
      50%  { transform: translate3d(calc(${startX} + (${endX} - ${startX}) * 0.5), ${bob}px, 0) rotate(${tilt + (lane.enterFromRight ? -8 : 8)}deg); opacity: 1; }
      94%  { opacity: 1; }
      100% { transform: translate3d(${endX}, 0, 0) rotate(${tilt + (lane.enterFromRight ? -16 : 16)}deg); opacity: 0; }
    }`;
}
