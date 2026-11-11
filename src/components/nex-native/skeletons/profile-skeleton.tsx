// src/components/nex-native/skeletons/profile-skeleton.tsx
//
// Cycle 22 Priority 4 · shape-matching skeleton for /nex-native/profile/*.
// Renders cover image, avatar, name block, bio, pill rows. No fake copy.

import type * as React from "react";
import { SkeletonShell, SkeletonBlock, SkeletonCircle } from "./_shared";

export function ProfileSkeleton(): React.JSX.Element {
  return (
    <SkeletonShell>
      <div
        style={{
          padding: "calc(env(safe-area-inset-top, 0px) + 0px) 0 24px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Cover image band · full-bleed */}
        <SkeletonBlock width="100%" height={140} radius={0} />

        {/* Avatar overlapping the cover + action chip */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            padding: "0 16px",
            marginTop: -36,
            marginBottom: 12,
          }}
        >
          <SkeletonCircle size={88} style={{ border: "4px solid var(--nex-world-background-base, #F5EDD3)" }} />
          <SkeletonBlock width={88} height={32} radius={16} />
        </div>

        {/* Name + handle + profession */}
        <div style={{ padding: "0 16px" }}>
          <SkeletonBlock width="60%" height={20} radius={6} />
          <SkeletonBlock width="35%" height={12} radius={6} marginTop={8} />
          <SkeletonBlock width="50%" height={12} radius={6} marginTop={6} />

          {/* Bio · two lines */}
          <SkeletonBlock width="100%" height={10} radius={5} marginTop={16} />
          <SkeletonBlock width="85%" height={10} radius={5} marginTop={6} />

          {/* Pill row · interests */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
            <SkeletonBlock width={70} height={22} radius={11} />
            <SkeletonBlock width={88} height={22} radius={11} />
            <SkeletonBlock width={62} height={22} radius={11} />
            <SkeletonBlock width={76} height={22} radius={11} />
          </div>

          {/* Section header */}
          <SkeletonBlock width={120} height={14} radius={6} marginTop={24} />
          <SkeletonBlock width="100%" height={64} radius={10} marginTop={10} />
          <SkeletonBlock width="100%" height={64} radius={10} marginTop={8} />
        </div>
      </div>
    </SkeletonShell>
  );
}
