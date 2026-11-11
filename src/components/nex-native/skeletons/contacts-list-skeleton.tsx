// src/components/nex-native/skeletons/contacts-list-skeleton.tsx
//
// Cycle 22 Priority 4 · shape-matching skeleton for /nex-native/contacts.
// Renders the contacts header + 6 placeholder contact rows. No fake
// names or avatars · empty shimmer shapes only.

import type * as React from "react";
import { SkeletonShell, SkeletonBlock, SkeletonCircle } from "./_shared";

export function ContactsListSkeleton(): React.JSX.Element {
  return (
    <SkeletonShell>
      <div
        style={{
          padding: "calc(env(safe-area-inset-top, 0px) + 20px) 14px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxWidth: 480,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Header · title + action buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <SkeletonBlock width={160} height={18} radius={6} />
            <SkeletonBlock width={110} height={10} radius={5} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <SkeletonCircle size={36} />
            <SkeletonCircle size={36} />
          </div>
        </div>

        {/* Search bar */}
        <SkeletonBlock width="100%" height={40} radius={999} marginBottom={4} />

        {/* Filter pill row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <SkeletonBlock width={56} height={28} radius={14} />
          <SkeletonBlock width={72} height={28} radius={14} />
          <SkeletonBlock width={80} height={28} radius={14} />
          <SkeletonBlock width={64} height={28} radius={14} />
        </div>

        {/* 6 contact rows · avatar + name + subtitle · chat chevron */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              minHeight: 90,
              borderRadius: 14,
              background: "color-mix(in srgb, var(--nex-world-surface, #FFFFFF) 70%, transparent)",
              border: "1px solid color-mix(in srgb, var(--nex-world-text-primary, #2A1F0F) 5%, transparent)",
            }}
          >
            <SkeletonCircle size={60} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <SkeletonBlock width="55%" height={14} radius={6} />
              <SkeletonBlock width="40%" height={10} radius={5} marginTop={8} />
              <SkeletonBlock width="25%" height={9} radius={5} marginTop={6} />
            </div>
            <SkeletonCircle size={28} />
          </div>
        ))}
      </div>
    </SkeletonShell>
  );
}
