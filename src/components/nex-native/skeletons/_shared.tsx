// src/components/nex-native/skeletons/_shared.tsx
//
// Shared skeleton primitives · Cycle 22 Priority 4.
//
// Owner directive 2026-11-11: loading screens should "resemble the
// actual page about to open". Each page gets its own skeleton with
// the REAL header shape + content-row placeholder shapes · no fake
// names, products, messages, or profile data. Users see empty
// shimmer blocks that match the destination layout, so the tap
// feels like the page is opening, not loading.
//
// Shared pieces live here · each page skeleton composes them.

import type * as React from "react";

/** Brand-aware colours · pulled from the Ireland light-theme palette
 *  so skeletons never flash a cyan/dark fill from pre-light-theme
 *  defaults. `--nex-world-surface-sunken` is Pale Ivory on Ireland. */
export const SKELETON = {
  /** Base surface behind the whole phone frame · same as the live
   *  page background so there's zero flash on hand-off. */
  canvas: "var(--nex-world-background-base, #F5EDD3)",
  /** Shimmer block fill · a hair darker than canvas · reads as "data
   *  not here yet" without being a full-opacity grey. */
  block: "color-mix(in srgb, var(--nex-world-text-primary, #2A1F0F) 8%, transparent)",
  /** Border hairline on cards · subtle warm. */
  border: "color-mix(in srgb, var(--nex-world-text-primary, #2A1F0F) 6%, transparent)",
} as const;

/** The single pulsing keyframe used across every skeleton · one place
 *  only so palette tweaks don't drift. Honours prefers-reduced-motion. */
export const SKELETON_KEYFRAMES = `
  @keyframes nex-skeleton-pulse {
    0%, 100% { opacity: 0.55; }
    50%      { opacity: 1; }
  }
  [data-nex-skeleton-block] {
    animation: nex-skeleton-pulse 1400ms ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    [data-nex-skeleton-block] {
      animation: none;
    }
  }
`;

/** Single shimmer block · default rounded corners + brand fill. */
export function SkeletonBlock({
  width,
  height,
  radius = 8,
  marginTop,
  marginBottom,
  style,
}: {
  readonly width?: string | number;
  readonly height: string | number;
  readonly radius?: number | string;
  readonly marginTop?: number;
  readonly marginBottom?: number;
  readonly style?: React.CSSProperties;
}): React.JSX.Element {
  return (
    <div
      data-nex-skeleton-block
      style={{
        width: width ?? "100%",
        height,
        background: SKELETON.block,
        borderRadius: radius,
        marginTop,
        marginBottom,
        ...style,
      }}
    />
  );
}

/** Circle shimmer · used for avatars. */
export function SkeletonCircle({
  size,
  style,
}: {
  readonly size: number;
  readonly style?: React.CSSProperties;
}): React.JSX.Element {
  return (
    <div
      data-nex-skeleton-block
      style={{
        width: size,
        height: size,
        background: SKELETON.block,
        borderRadius: "50%",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

/** Outer wrapper · matches the page frame interior so the skeleton
 *  fills the exact same box as the destination page. */
export function SkeletonShell({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      data-nex-page-skeleton
      style={{
        position: "absolute",
        inset: 0,
        background: SKELETON.canvas,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <style>{SKELETON_KEYFRAMES}</style>
      {children}
    </div>
  );
}
