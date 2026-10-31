"use client";

// src/components/nex-native/creator/CreatorWelcomePanel.tsx
//
// Owner-authorised 2026-10-31 · NEX Creator Programme · Stage 1.
// Congratulations panel shown to owners who have earned a Creator
// badge but have not yet configured Support. Dismissible.
//
// Owner directive verbatim: "dewi sari now has been granted the
// creator and she show see notification with congratulations and
// explaining to dewi that creators need qr or qrs code and can
// upload in side drawer for support from your fans and followers
// lets get your flow rocking."

import * as React from "react";
import Link from "next/link";
import { NexYellowChip } from "@/components/nex-native/badge/NexYellowChip";
import type { SectionProgress } from "@/lib/nex-native/creator/creator-badges-common";
import { sectionBadgeLabel } from "@/lib/nex-native/creator/creator-badges-common";

const INK = "#102033";
const INK_DIM = "#4A6080";
const ACCENT = "#00AFFF";

export interface CreatorWelcomePanelProps {
  readonly earnedBadges: readonly SectionProgress[];
  readonly firstName: string;
}

export function CreatorWelcomePanel(
  props: CreatorWelcomePanelProps,
): React.JSX.Element | null {
  const [dismissed, setDismissed] = React.useState(false);
  if (dismissed || props.earnedBadges.length === 0) return null;

  const firstBadgeLabel = sectionBadgeLabel(props.earnedBadges[0]!.section);

  return (
    <div
      data-nex-creator-welcome-panel
      style={{
        margin: "12px 14px",
        padding: 16,
        borderRadius: 16,
        background: "linear-gradient(135deg, #FFF9DB 0%, #FFF2A8 100%)",
        border: "1.5px solid #F5D97A",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        fontFamily: "Inter, system-ui, sans-serif",
        color: INK,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 24 }}>🎉</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#5A4300" }}>
            Congratulations, {props.firstName}!
          </div>
          <div style={{ fontSize: 12, color: "#7A5F00", lineHeight: 1.4 }}>
            You&rsquo;ve earned your first NEX Creator badge.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          style={{
            padding: 6,
            borderRadius: 999,
            border: "none",
            background: "transparent",
            color: "#7A5F00",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {props.earnedBadges.map((b) => (
          <NexYellowChip
            key={b.section}
            label={sectionBadgeLabel(b.section)}
            position="inline"
          />
        ))}
      </div>

      <p style={{ fontSize: 13, color: "#5A4300", lineHeight: 1.5, margin: 0 }}>
        To let your fans and followers support your work, add your QR
        code or payment link in <strong>Creator Support</strong>. You
        can find it in the side drawer or tap the button below.{" "}
        <strong>Let&rsquo;s get your flow rocking.</strong>
      </p>

      <Link
        href="/nex-native/settings/creator"
        style={{
          alignSelf: "flex-start",
          padding: "9px 16px",
          borderRadius: 999,
          background: ACCENT,
          color: "#fff",
          textDecoration: "none",
          fontWeight: 800,
          fontSize: 13,
        }}
      >
        Set up Creator Support →
      </Link>

      <p
        style={{
          fontSize: 11,
          color: INK_DIM,
          lineHeight: 1.5,
          margin: 0,
          fontStyle: "italic",
        }}
      >
        NEX never handles money — your supporters pay you directly through
        your QR code or payment link. You&rsquo;re the only one who sets
        what you earn, and how.
      </p>
    </div>
  );
}
