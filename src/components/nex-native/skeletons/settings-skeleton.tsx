// src/components/nex-native/skeletons/settings-skeleton.tsx
//
// Cycle 23 Priority 5 · shape-matching skeleton for /nex-native/settings
// + its sub-routes. Header + 3 section headers each with 3-4 rows.

import type * as React from "react";
import { SkeletonShell, SkeletonBlock, SkeletonCircle } from "./_shared";

function SettingsSection(): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 14,
        borderRadius: 14,
        background:
          "color-mix(in srgb, var(--nex-world-surface, #FFFFFF) 70%, transparent)",
        border:
          "1px solid color-mix(in srgb, var(--nex-world-text-primary, #2A1F0F) 5%, transparent)",
      }}
    >
      <SkeletonBlock width={100} height={12} radius={6} />
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            paddingTop: 6,
            paddingBottom: 6,
          }}
        >
          <SkeletonCircle size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <SkeletonBlock width="55%" height={13} radius={5} />
            <SkeletonBlock width="30%" height={9} radius={4} marginTop={6} />
          </div>
          <SkeletonBlock width={20} height={16} radius={4} />
        </div>
      ))}
    </div>
  );
}

export function SettingsSkeleton(): React.JSX.Element {
  return (
    <SkeletonShell>
      <div
        style={{
          padding: "calc(env(safe-area-inset-top, 0px) + 20px) 14px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <SkeletonBlock width={160} height={22} radius={6} />
        <SettingsSection />
        <SettingsSection />
        <SettingsSection />
      </div>
    </SkeletonShell>
  );
}
