"use client";

// src/components/nex-native/creator/CreatorBadgeStrip.tsx
//
// Owner-authorised 2026-10-31 · NEX Creator Programme · Stage 2.1.
// Tappable Creator-badge strip for the profile IdentityHero.
// Replaces the static server-rendered strip with a client component
// that opens the universal CreatorSupportSheet on tap.
//
// Privacy posture (sealed · do not weaken):
//   · This component receives the creator's SUPPORT SETTINGS only
//     when the creator has set `enabled = true`. The server-side
//     resolver returns `null` for private / disabled rows so a
//     visitor can never see another creator's draft settings via
//     this component's props.
//   · If `settings === null` the sheet still opens, but shows the
//     friendly "support not available" empty state (never fabricated
//     QR / payment data).

import * as React from "react";
import { NexYellowChip } from "@/components/nex-native/badge/NexYellowChip";
import type { SectionProgress } from "@/lib/nex-native/creator/creator-badges";
import { sectionBadgeLabel } from "@/lib/nex-native/creator/creator-badges";
import type { CreatorSupportSettings } from "@/lib/nex-native/creator/creator-support-service";
import { CreatorSupportSheet } from "./CreatorSupportSheet";

export interface CreatorBadgeStripProps {
  readonly earnedBadges: readonly SectionProgress[];
  readonly creatorName: string;
  readonly creatorAvatarUrl: string | null;
  readonly creatorNexHandle: string | null;
  /** Null when the creator has not enabled Support publicly. The
   *  sheet opens anyway but shows the empty-state copy. */
  readonly supportSettings: CreatorSupportSettings | null;
}

export function CreatorBadgeStrip(
  props: CreatorBadgeStripProps,
): React.JSX.Element | null {
  const [open, setOpen] = React.useState(false);
  if (props.earnedBadges.length === 0) return null;

  return (
    <>
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
          <button
            key={b.section}
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`${sectionBadgeLabel(b.section)} · tap to support`}
            style={{
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            <NexYellowChip
              label={sectionBadgeLabel(b.section)}
              position="inline"
              dataAttrs={{ "data-creator-section": b.section }}
            />
          </button>
        ))}
      </div>

      <CreatorSupportSheet
        open={open}
        onClose={() => setOpen(false)}
        creatorName={props.creatorName}
        creatorAvatarUrl={props.creatorAvatarUrl}
        creatorNexHandle={props.creatorNexHandle}
        earnedBadges={props.earnedBadges}
        settings={props.supportSettings}
      />
    </>
  );
}
