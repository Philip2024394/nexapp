"use client";

// src/app/nex-native/contacts/_pinned-emergency-card.tsx
//
// NEX Emergency Help · pinned top-of-Contacts card. Owner directive
// 2026-10-25 · "show me the pinned card for emergency on top of the
// contacts page". Visual-only prototype stub · no persistence, no
// client store, no DB. Clicking opens the Emergency Group page.
//
// Honest status: the real build will materialise this row only when
// (a) the viewer has committed as a responder (incident_recipient
// status = 'accepted') AND (b) the incident is within its 24h
// user-facing lifetime. Until that wiring lands, this card sits at
// the top of /nex-native/contacts for every viewer as an illustrative
// demo of what "pinned to Contacts for 24h" looks like.

import * as React from "react";
import Link from "next/link";
import { useGroupCountdown } from "@/lib/nex-native/emergency/_group-countdown";

const DEMO_INCIDENT_ID = "11111111-1111-4111-8111-111111111111";

const NEX = {
  surface: "rgba(255, 51, 85, 0.10)",
  text: "#F2F5F8",
  textDim: "#C8D4E8",
  textMuted: "#8EA0B8",
  red: "#FF3355",
  green: "#2BD47F",
  gold: "#FFC24B",
  borderRed: "rgba(255, 51, 85, 0.45)",
} as const;

export function PinnedEmergencyCard(): React.JSX.Element {
  // Owner directive 2026-10-25 · shared 24h clock · pinned card + the
  // group page + the drawer all tick off the same session anchor.
  const { label: remainingLabel } = useGroupCountdown();

  return (
    <Link
      href={`/nex-native/emergency-help/group/${DEMO_INCIDENT_ID}?action=help`}
      data-testid="nex-contacts-pinned-emergency-card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 14,
        background: NEX.surface,
        border: `1px solid ${NEX.borderRed}`,
        color: NEX.text,
        textDecoration: "none",
        boxShadow: "0 10px 24px -14px rgba(255, 51, 85, 0.45)",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes nexContactsEmergencyPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 51, 85, 0.5); }
          50%      { box-shadow: 0 0 0 10px rgba(255, 51, 85, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-contacts-pinned-emergency-dot] { animation: none !important; }
        }
      `}</style>

      {/* Pulsing red dot · signals the active-emergency state */}
      <div
        data-nex-contacts-pinned-emergency-dot
        aria-hidden
        style={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          background:
            "linear-gradient(135deg, rgba(255, 51, 85, 0.4), rgba(139, 26, 26, 0.7))",
          border: `2px solid ${NEX.red}`,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          color: "#FFFFFF",
          animation: "nexContactsEmergencyPulse 1800ms ease-in-out infinite",
        }}
      >
        <PersonIcon size={22} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 2,
          }}
        >
          <span
            data-testid="nex-contacts-pinned-emergency-title"
            style={{
              // Owner directive 2026-10-25 · "Emergency Group" is the
              // card's header line · bumped from a tiny eyebrow (10px
              // uppercase) to a legible header (16px/900 title-case)
              // so it reads as a group heading rather than a label.
              fontSize: 16,
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: "0.01em",
              color: NEX.red,
              textShadow: "0 1px 6px rgba(255, 51, 85, 0.4)",
            }}
          >
            Emergency Group
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "1px 6px",
              borderRadius: 999,
              background: "rgba(43, 212, 127, 0.14)",
              border: `1px solid rgba(43, 212, 127, 0.5)`,
              color: NEX.green,
              letterSpacing: "0.04em",
              fontFamily:
                "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
            }}
          >
            {remainingLabel}
          </span>
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "#FFFFFF",
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          Member&apos;s Name
        </div>
        <div
          style={{
            fontSize: 11,
            color: NEX.textDim,
            marginTop: 2,
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Needs help · Jl. Malioboro, Yogyakarta
        </div>
      </div>

      {/* Owner directive 2026-10-25 · right column shows a person icon
          with the current group size directly beneath · signals at a
          glance how many helpers have already committed. The 3 is the
          same mock population the group page renders (You + Rina +
          Agus). The real build will read incident_recipient.count
          where status = 'accepted'. */}
      <div
        aria-label="Helpers in group"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          flexShrink: 0,
          color: NEX.textDim,
        }}
      >
        <GroupPeopleIcon size={18} />
        <span
          data-testid="nex-contacts-pinned-emergency-count"
          style={{
            fontSize: 12,
            fontWeight: 800,
            lineHeight: 1,
            color: "#FFFFFF",
            fontFamily:
              "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
          }}
        >
          3
        </span>
      </div>
    </Link>
  );
}

function GroupPeopleIcon({ size = 18 }: { readonly size?: number }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M7 21v-2a4 4 0 0 1 3-3.87" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PersonIcon({ size = 22 }: { readonly size?: number }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
