"use client";

// src/components/nex-native/creator/CreatorBadgeStrip.tsx
//
// Owner-sealed 2026-11-10 · Creator Support feature deleted.
// The badge strip itself (earned Creator badges on the profile
// IdentityHero) stays · the tap-to-open CreatorSupportSheet behaviour
// was removed. Badges are now visual chips; no sheet opens on tap.
//
// The `supportSettings` prop remains in the signature to preserve
// backward-compat for the callers that still pass it (profile +
// contacts). It is ignored.

import * as React from "react";
import { NexYellowChip } from "@/components/nex-native/badge/NexYellowChip";
import type { SectionProgress } from "@/lib/nex-native/creator/creator-badges-common";
import { sectionBadgeLabel } from "@/lib/nex-native/creator/creator-badges-common";

export interface CreatorBadgeStripProps {
  readonly earnedBadges: readonly SectionProgress[];
  readonly creatorName: string;
  readonly creatorAvatarUrl: string | null;
  readonly creatorNexHandle: string | null;
  /** Preserved for backward-compat · ignored after Creator Support
   *  was deleted 2026-11-10. */
  readonly supportSettings?: unknown;
}

export function CreatorBadgeStrip(
  props: CreatorBadgeStripProps,
): React.JSX.Element | null {
  void props.supportSettings;
  void props.creatorName;
  void props.creatorAvatarUrl;
  void props.creatorNexHandle;
  if (props.earnedBadges.length === 0) return null;

  return (
    <div
      data-nex-profile-creator-badges
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 6,
        marginTop: 2,
      }}
    >
      {props.earnedBadges.map((b) => (
        <NexYellowChip
          key={b.section}
          label={sectionBadgeLabel(b.section)}
          position="inline"
          dataAttrs={{ "data-creator-section": b.section }}
        />
      ))}
    </div>
  );
}
