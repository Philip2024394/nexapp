// src/app/nex-native/home/_first-visit-invitation.tsx
//
// First-visit invitation component · 2026-10-14.
//
// Renders a compact theme-discovery tile on /nex-native/home when the
// signed-in account has zero peer conversations. Clicking the tile
// opens the three-destination first-visit experience built in the
// previous bounded task:
//
//   /nex-native/chat/first-visit
//     ├─ Chat Themes      (live library)
//     ├─ Chat Themes Shop (honest Phase 2 browse-only preview)
//     └─ Personalized     (honest "preview the idea" page)
//
// Reliability contract:
//   · This component NEVER renders while a conversation query is
//     unresolved. The RSC caller awaits the count before deciding.
//   · This component NEVER renders when the count query errored. The
//     caller catches the error and passes `null`, which this file
//     treats as "unknown · don't show".
//   · This component NEVER mutates state. No cookie set. No DB write.
//     The user visits the destination route by tap.
//
// This file is a SERVER-RENDER-ONLY module (no "use client") so the
// component can live inside the sealed home layout without a client
// bundle. The sealed `<Link>` from next/link handles navigation.

import * as React from "react";
import Link from "next/link";

export const FIRST_VISIT_DESTINATION = "/nex-native/chat/first-visit";

/**
 * Pure predicate that decides whether the first-visit invitation
 * should render. The ONLY truthy case is a reliably-loaded conversation
 * count of exactly zero. Any other input value (null for error / not-
 * yet-queried · undefined · a positive integer · an adversarial type)
 * returns false.
 *
 * Rationale:
 *   · `null` → signifies the count could not be resolved; fail-safe
 *     posture is "don't invite".
 *   · positive numbers → user already has conversations; irrelevant to
 *     this invitation.
 *   · unexpected types / negative / NaN → never classify as "new".
 */
export function shouldShowFirstVisitInvitation(
  conversationCount: number | null | undefined,
): boolean {
  if (conversationCount === null || conversationCount === undefined) return false;
  if (typeof conversationCount !== "number") return false;
  if (!Number.isFinite(conversationCount)) return false;
  if (!Number.isInteger(conversationCount)) return false;
  if (conversationCount < 0) return false;
  return conversationCount === 0;
}

interface FirstVisitInvitationProps {
  /** Hex colour to accent the invitation · defaults to NEX cyan. */
  readonly accent?: string;
}

/**
 * Compact theme-discovery tile. Visually integrated with the existing
 * NEX home palette (navy panel · cyan accent · orange chip). Mobile-
 * first: fits inside the sealed 420-px home content column, 44-px tap
 * target, no horizontal overflow.
 *
 * Does NOT change any state. The destination route handles the user
 * tour and remains honest about what each theme destination can do.
 */
export function FirstVisitInvitation({
  accent = "#00AFFF",
}: FirstVisitInvitationProps): React.ReactElement {
  return (
    <Link
      href={FIRST_VISIT_DESTINATION}
      aria-label="Take a quick tour of NEX themes · three destinations"
      data-nex-home-first-visit-invitation
      style={{
        display: "block",
        marginTop: 20,
        padding: "16px 16px 14px",
        background: "rgba(6, 15, 28, 0.72)",
        border: `1px solid ${accent}55`,
        borderRadius: 14,
        textDecoration: "none",
        color: "#F2F5F8",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Accent band · subtle hue line at the top */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${accent}cc 0%, transparent 90%)`,
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: accent,
              marginBottom: 6,
            }}
          >
            First look · 3 destinations
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              lineHeight: 1.25,
              color: "#F2F5F8",
              fontFamily:
                "'Cormorant Garamond', 'EB Garamond', Georgia, serif",
              letterSpacing: "-0.01em",
            }}
          >
            Make NEX yours
          </h3>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 13,
              lineHeight: 1.45,
              color: "#7D9BC0",
            }}
          >
            A quick tour of chat themes · shop preview · and personalization.
          </p>
        </div>

        {/* Compact preview · three accent dots representing the three cards */}
        <div
          aria-hidden
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            alignItems: "flex-end",
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <AccentDot colour={accent} />
          <AccentDot colour="#FF7200" />
          <AccentDot colour="#9B6DFF" />
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: "#7D9BC0",
          }}
        >
          Take the tour
        </span>
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: `${accent}22`,
            border: `1px solid ${accent}66`,
            color: accent,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          →
        </span>
      </div>
    </Link>
  );
}

function AccentDot({ colour }: { colour: string }): React.ReactElement {
  return (
    <span
      aria-hidden
      style={{
        display: "block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: colour,
        boxShadow: `0 0 10px ${colour}aa`,
      }}
    />
  );
}
