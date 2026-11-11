// src/components/nex-native/skeletons/community-skeleton.tsx
//
// Cycle 23 Priority 5 · shape-matching skeleton for /nex-native/
// community/* routes (select + notices). Header + county-grid tile
// placeholders.

import type * as React from "react";
import { SkeletonShell, SkeletonBlock } from "./_shared";

export function CommunitySkeleton(): React.JSX.Element {
  return (
    <SkeletonShell>
      <div
        style={{
          padding: "calc(env(safe-area-inset-top, 0px) + 20px) 14px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <SkeletonBlock width={160} height={20} radius={6} />
        <SkeletonBlock width="80%" height={12} radius={6} marginTop={4} />
        <SkeletonBlock width="100%" height={40} radius={999} marginTop={4} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 10,
            marginTop: 8,
          }}
        >
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: 12,
                borderRadius: 12,
                background:
                  "color-mix(in srgb, var(--nex-world-surface, #FFFFFF) 70%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--nex-world-text-primary, #2A1F0F) 5%, transparent)",
                minHeight: 100,
              }}
            >
              <SkeletonBlock width="70%" height={14} radius={6} />
              <SkeletonBlock width="55%" height={10} radius={5} />
              <SkeletonBlock width="40%" height={10} radius={5} />
            </div>
          ))}
        </div>
      </div>
    </SkeletonShell>
  );
}
