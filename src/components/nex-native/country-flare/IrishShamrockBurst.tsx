"use client";

// src/components/nex-native/country-flare/IrishShamrockBurst.tsx
//
// Owner-authorised 2026-10-30 · hollywood-grade shamrock fall for
// Irish-owner interactions. Fires when a viewer saves or follows an
// Irish-attributed track / profile / live broadcast. Scoped to
// Ireland-only per sealed owner decision 2026-10-30 ("hard-coded for
// Phase 1").
//
// Design notes:
//   - Pure client component · no server actions · no DB.
//   - Parent controls firing via a `trigger: number` prop that
//     monotonically increments. Each new value spawns a fresh burst
//     of 22 falling shamrocks. Multiple bursts can overlap gracefully.
//   - Each shamrock is sampled from the 6×4 sprite sheet at
//     /nex-ireland/shamrock-sticker-sheet.png (1536×1024 · 256×256
//     per cell · 24 unique angle variants). Randomised sprite picks
//     mean no two falling leaves look identical within a burst.
//   - Fall physics: cubic-bezier eased translateY from above the
//     viewport to 110vh, horizontal drift (−60..+60 px) for natural
//     sway, randomised 180°..720° rotation, varied size (24..60px)
//     for depth. Opacity fades in at 8% and out at 70% of the
//     animation.
//   - Soft radial mask hides the sticker sheet's dark vignette edges
//     so each sprite reads as an isolated leaf.
//   - position: fixed · pointer-events: none · zIndex 999 so the
//     overlay never blocks interaction with the underlying surface.
//   - Auto-cleanup after fall duration + 500 ms safety tolerance.
//
// Honest limitation: this is a client-only CSS-animation primitive.
// There is no server component or SSR path · leaves do not appear
// in SSR snapshots or screenshot tests. If an E2E suite needs to
// detect the burst, it should wait for the `data-nex-shamrock-burst`
// attribute on the overlay container.

import * as React from "react";

const SHEET_URL = "/nex-ireland/shamrock-sticker-sheet.png";
const COLS = 6;
const ROWS = 4;
const CELL_COUNT = COLS * ROWS; // 24
const BURST_COUNT = 22;         // shamrocks per burst
const FALL_DURATION_FLOOR_MS = 2800;
const FALL_DURATION_SPAN_MS = 1800;

export interface IrishShamrockBurstProps {
  /** Monotonically-increasing trigger. Each new value spawns a
   *  burst. A `trigger` of 0 is treated as "idle" and renders
   *  nothing. */
  readonly trigger: number;
}

interface Leaf {
  readonly id: string;
  readonly leftPct: number;
  readonly delay: number;
  readonly duration: number;
  readonly size: number;
  readonly spriteCol: number;
  readonly spriteRow: number;
  readonly driftPx: number;
  readonly initialRotation: number;
  readonly spin: number;
}

function spawnBurst(trigger: number): readonly Leaf[] {
  const leaves: Leaf[] = [];
  for (let i = 0; i < BURST_COUNT; i++) {
    const spriteIdx = Math.floor(Math.random() * CELL_COUNT);
    leaves.push({
      id: `${trigger}-${i}`,
      leftPct: Math.random() * 100,
      delay: Math.random() * 400,
      duration: FALL_DURATION_FLOOR_MS + Math.random() * FALL_DURATION_SPAN_MS,
      size: 24 + Math.random() * 36,
      spriteCol: spriteIdx % COLS,
      spriteRow: Math.floor(spriteIdx / COLS),
      driftPx: (Math.random() - 0.5) * 120,
      initialRotation: Math.random() * 360,
      spin: 180 + Math.random() * 540,
    });
  }
  return leaves;
}

export function IrishShamrockBurst(
  props: IrishShamrockBurstProps,
): React.JSX.Element | null {
  const [bursts, setBursts] = React.useState<Record<number, readonly Leaf[]>>(
    {},
  );

  React.useEffect(() => {
    if (props.trigger === 0) return;
    const key = props.trigger;
    const leaves = spawnBurst(key);
    setBursts((prev) => ({ ...prev, [key]: leaves }));
    const cleanupMs =
      FALL_DURATION_FLOOR_MS + FALL_DURATION_SPAN_MS + 500;
    const t = window.setTimeout(() => {
      setBursts((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, cleanupMs);
    return () => window.clearTimeout(t);
  }, [props.trigger]);

  const allLeaves: Leaf[] = [];
  for (const burst of Object.values(bursts)) {
    for (const leaf of burst) allLeaves.push(leaf);
  }
  if (allLeaves.length === 0) return null;

  return (
    <>
      <style>{SHAMROCK_KEYFRAMES_CSS}</style>
      <div
        data-nex-shamrock-burst
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 999,
          overflow: "hidden",
        }}
      >
        {allLeaves.map((leaf) => (
          <div
            key={leaf.id}
            style={{
              position: "absolute",
              top: -80,
              left: `${leaf.leftPct}%`,
              width: leaf.size,
              height: leaf.size,
              backgroundImage: `url("${SHEET_URL}")`,
              backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
              backgroundPosition: `${(leaf.spriteCol / (COLS - 1)) * 100}% ${(leaf.spriteRow / (ROWS - 1)) * 100}%`,
              backgroundRepeat: "no-repeat",
              transform: `translate(0, -80px) rotate(${leaf.initialRotation}deg)`,
              animation: `nex-shamrock-fall ${leaf.duration}ms cubic-bezier(0.33, 0.1, 0.67, 1) ${leaf.delay}ms both`,
              WebkitMaskImage:
                "radial-gradient(circle, black 60%, transparent 100%)",
              maskImage:
                "radial-gradient(circle, black 60%, transparent 100%)",
              willChange: "transform, opacity",
              filter: "drop-shadow(0 2px 6px rgba(0, 60, 20, 0.5))",
              ["--nex-shamrock-drift" as string]: `${leaf.driftPx}px`,
              ["--nex-shamrock-spin" as string]: `${leaf.spin}deg`,
            } as React.CSSProperties}
          />
        ))}
      </div>
    </>
  );
}

const SHAMROCK_KEYFRAMES_CSS = `
@keyframes nex-shamrock-fall {
  0% {
    transform: translate(0, -80px) rotate(0deg);
    opacity: 0;
  }
  8% {
    opacity: 1;
  }
  70% {
    opacity: 1;
  }
  100% {
    transform: translate(var(--nex-shamrock-drift, 0px), 110vh)
               rotate(var(--nex-shamrock-spin, 360deg));
    opacity: 0;
  }
}
`;
