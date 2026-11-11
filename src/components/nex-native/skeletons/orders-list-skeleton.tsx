// src/components/nex-native/skeletons/orders-list-skeleton.tsx
//
// Cycle 23 Priority 5 · shape-matching skeleton for /nex-native/orders.
// Header + filter chip row + 5 order-card placeholders (status pill,
// product strip, meta, action row).

import type * as React from "react";
import { SkeletonShell, SkeletonBlock, SkeletonCircle } from "./_shared";

export function OrdersListSkeleton(): React.JSX.Element {
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <SkeletonBlock width={140} height={18} radius={6} />
          <SkeletonCircle size={36} />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <SkeletonBlock width={72} height={28} radius={14} />
          <SkeletonBlock width={88} height={28} radius={14} />
          <SkeletonBlock width={64} height={28} radius={14} />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: 12,
              borderRadius: 14,
              background:
                "color-mix(in srgb, var(--nex-world-surface, #FFFFFF) 70%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--nex-world-text-primary, #2A1F0F) 5%, transparent)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <SkeletonBlock width={120} height={14} radius={6} />
              <SkeletonBlock width={70} height={20} radius={10} />
            </div>
            <SkeletonBlock width="55%" height={10} radius={5} />
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <SkeletonBlock width={56} height={56} radius={8} />
              <SkeletonBlock width={56} height={56} radius={8} />
              <SkeletonBlock width={56} height={56} radius={8} />
            </div>
            <SkeletonBlock width="100%" height={36} radius={10} marginTop={6} />
          </div>
        ))}
      </div>
    </SkeletonShell>
  );
}
