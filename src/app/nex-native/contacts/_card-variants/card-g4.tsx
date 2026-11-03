// src/app/nex-native/contacts/_card-variants/card-g4.tsx
//
// CARD G4 · "Emerald Dense"
// -----------------------------------------------------------------------
// Design intent: compact Emerald rows · 36px avatar · single-line
// summary with middle-dot separators · hair-thin gold divider between
// cards instead of individual card shadows · maximum rows per screen.
// Target: 7-8 contacts above the fold on mobile.

import type * as React from "react";
import Link from "next/link";
import type { ContactRowDisplay } from "../_contacts-list";
import { AvatarWithRim, VerifiedPill, skillOnly } from "./_shared";

interface Props {
  readonly row: ContactRowDisplay;
  readonly accentHex: string;
  readonly isLast?: boolean;
}

export function CardG4({ row, accentHex }: Props): React.JSX.Element {
  const summary = buildSummary(row);
  return (
    <Link
      href={row.chatHref}
      aria-label={`Open chat with ${row.displayName}`}
      data-nex-card-variant="g4"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        minHeight: 56,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        // Owner directive 2026-11-03 · dense green card with gold rim ·
        // 8px shell gap gives touch-safe separation · no divider border
        // needed.
        // Owner directive 2026-11-03 · "cards inner color change to the
        // plus button color" · Gold interior, Emerald rim, dark text.
        background: "var(--nex-world-secondary, #C6A15B)",
        border: `1px solid var(--nex-world-drawer-bg, #123D2B)`,
        borderRadius: 10,
        boxShadow: "0 4px 12px rgba(10,31,21,0.3)",
        textDecoration: "none",
        color: "var(--nex-world-drawer-bg, #123D2B)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <AvatarWithRim
        row={row}
        size={36}
        accentHex={accentHex}
        fallbackBg={`linear-gradient(135deg, ${accentHex}cc 0%, #0A1F15 100%)`}
      />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          maxWidth: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              lineHeight: 1.2,
              // Dark Emerald for contrast on Gold interior.
              color: "var(--nex-world-drawer-bg, #123D2B)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {row.displayName}
          </span>
          {row.isVerified ? <VerifiedPill /> : null}
        </div>
        {summary ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              lineHeight: 1.3,
              color: "var(--nex-world-drawer-bg, #123D2B)",
              opacity: 0.75,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {summary}
          </span>
        ) : null}
      </div>
      {row.unreadCount && row.unreadCount > 0 ? (
        <span
          aria-label={`${row.unreadCount} unread`}
          style={{
            minWidth: 18,
            height: 18,
            padding: "0 6px",
            borderRadius: 999,
            background: "#B30000",
            color: "#FFF",
            fontSize: 10,
            fontWeight: 900,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {row.unreadCount > 99 ? "99+" : row.unreadCount}
        </span>
      ) : row.hasShop ? (
        <span aria-hidden style={{ fontSize: 16, flexShrink: 0 }}>
          🛒
        </span>
      ) : null}
    </Link>
  );
}

function buildSummary(row: ContactRowDisplay): string | null {
  // Owner directive 2026-11-03 · "the skill set should be 1 word - location"
  // · dense summary = skill token + location, headline dropped.
  const parts: string[] = [];
  const skill = skillOnly(row.professionLine);
  if (skill) parts.push(skill);
  if (row.city) parts.push(row.city);
  return parts.length === 0 ? null : parts.join(" · ");
}
