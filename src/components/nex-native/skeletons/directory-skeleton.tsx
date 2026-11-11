// src/components/nex-native/skeletons/directory-skeleton.tsx
//
// Cycle 22 Priority 4 · shape-matching skeleton for /nex-native/directory
// + /directory/landing. Renders search bar + 6 listing-card
// placeholders (image + title + meta row). No fake business names.

import type * as React from "react";
import { SkeletonShell, SkeletonBlock } from "./_shared";

export function DirectorySkeleton(): React.JSX.Element {
  return (
    <SkeletonShell>
      <div
        style={{
          padding: "calc(env(safe-area-inset-top, 0px) + 16px) 12px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {/* Search bar */}
        <SkeletonBlock width="100%" height={44} radius={999} />

        {/* Filter chips row */}
        <div style={{ display: "flex", gap: 8, marginTop: 4, marginBottom: 6 }}>
          <SkeletonBlock width={72} height={28} radius={14} />
          <SkeletonBlock width={88} height={28} radius={14} />
          <SkeletonBlock width={60} height={28} radius={14} />
          <SkeletonBlock width={80} height={28} radius={14} />
        </div>

        {/* 6 listing cards · hero image + title + meta */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: 10,
              borderRadius: 14,
              background: "color-mix(in srgb, var(--nex-world-surface, #FFFFFF) 65%, transparent)",
              border: "1px solid color-mix(in srgb, var(--nex-world-text-primary, #2A1F0F) 5%, transparent)",
            }}
          >
            <SkeletonBlock width="100%" height={120} radius={10} />
            <SkeletonBlock width="70%" height={14} radius={6} marginTop={4} />
            <SkeletonBlock width="45%" height={10} radius={5} marginTop={2} />
          </div>
        ))}
      </div>
    </SkeletonShell>
  );
}
