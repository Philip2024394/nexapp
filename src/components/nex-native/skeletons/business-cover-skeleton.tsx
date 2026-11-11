// src/components/nex-native/skeletons/business-cover-skeleton.tsx
//
// Cycle 23 Priority 5 · shape-matching skeleton for
// /nex-native/[businessSlug] (shop cover). Cover hero + name/tagline
// + product-grid tile placeholders.

import type * as React from "react";
import { SkeletonShell, SkeletonBlock, SkeletonCircle } from "./_shared";

export function BusinessCoverSkeleton(): React.JSX.Element {
  return (
    <SkeletonShell>
      <div
        style={{
          padding: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Full-bleed cover hero */}
        <SkeletonBlock width="100%" height={200} radius={0} />

        {/* Avatar overlapping cover + action buttons */}
        <div
          style={{
            padding: "0 16px",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginTop: -36,
            marginBottom: 12,
          }}
        >
          <SkeletonCircle
            size={88}
            style={{
              border: "4px solid var(--nex-world-background-base, #F5EDD3)",
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <SkeletonBlock width={76} height={32} radius={16} />
            <SkeletonBlock width={76} height={32} radius={16} />
          </div>
        </div>

        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          <SkeletonBlock width="70%" height={20} radius={6} />
          <SkeletonBlock width="50%" height={12} radius={6} marginTop={4} />
          <SkeletonBlock width="85%" height={10} radius={5} marginTop={10} />
          <SkeletonBlock width="60%" height={10} radius={5} />

          {/* Category tab row */}
          <div style={{ display: "flex", gap: 8, marginTop: 16, marginBottom: 8 }}>
            <SkeletonBlock width={76} height={32} radius={16} />
            <SkeletonBlock width={88} height={32} radius={16} />
            <SkeletonBlock width={64} height={32} radius={16} />
          </div>

          {/* Product grid · 2 cols · 6 tiles */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 10,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  padding: 8,
                  borderRadius: 12,
                  background:
                    "color-mix(in srgb, var(--nex-world-surface, #FFFFFF) 70%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--nex-world-text-primary, #2A1F0F) 5%, transparent)",
                }}
              >
                <SkeletonBlock width="100%" height={110} radius={8} />
                <SkeletonBlock width="80%" height={11} radius={5} marginTop={2} />
                <SkeletonBlock width="45%" height={10} radius={5} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonShell>
  );
}
