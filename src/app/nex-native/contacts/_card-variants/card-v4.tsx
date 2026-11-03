// src/app/nex-native/contacts/_card-variants/card-v4.tsx
//
// CARD V4 · "Dense + Full-Height Avatar" (updated 2026-11-03)
// -----------------------------------------------------------------------
// Owner directive 2026-11-03 · "profile image contacts would be the
// left end shape of the contact card · meaning the same height as the
// card and image profile is the left side round card design".
//
// Design shift: the avatar is no longer a floating 36px circle. It's a
// full-card-height rectangular container (64×64) at the LEFT END of
// the card, whose rounded-left corners inherit from the card's own
// border-radius via `overflow: hidden` on the Link.
//
// Presence vocabulary adaptation:
//   The sealed 2026-10-29 rule "presence on avatar RIM · never dots /
//   lamps / badges" is adapted to the rectangle shape: presence shows
//   as a solid colour stripe on the RIGHT edge of the avatar container
//   (the inner seam between image and text content). Same colour
//   coding (green=online, orange=busy, dark-red=offline, neutral when
//   null). The stripe is the equivalent of the circle rim for this
//   shape; no dots, no lamps, no badges elsewhere on the card.

import type * as React from "react";
import Link from "next/link";
import type { ContactRowDisplay } from "../_contacts-list";
import {
  VerifiedPill,
  resolveRimColor,
  initialsFromName,
  skillOnly,
} from "./_shared";

interface Props {
  readonly row: ContactRowDisplay;
  readonly accentHex: string;
  readonly isLast?: boolean;
}

const CARD_HEIGHT = 72;
const PRESENCE_STRIPE_WIDTH = 3;

export function CardV4({ row, accentHex }: Props): React.JSX.Element {
  const presenceColor = resolveRimColor(row.presence ?? null);
  const stripeColor = presenceColor ?? "rgba(255,255,255,0.35)";
  const summary = buildSummary(row);
  const initials =
    row.initials && row.initials.trim().length > 0
      ? row.initials.toUpperCase()
      : initialsFromName(row.displayName);

  return (
    <Link
      href={row.chatHref}
      aria-label={`Open chat with ${row.displayName}`}
      data-nex-card-variant="v4"
      style={{
        display: "flex",
        alignItems: "stretch",
        minHeight: CARD_HEIGHT,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        // Owner directive 2026-11-03 · "cards inner color change to the
        // plus button color" · card interior now reads Irish Gold (same
        // token the header + button uses · var(--nex-world-secondary))
        // on a thin Emerald border for a precious-metal plate feel.
        background: "var(--nex-world-secondary, #C6A15B)",
        border: `1px solid var(--nex-world-drawer-bg, #123D2B)`,
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: `0 4px 12px rgba(10,31,21,0.35), 0 0 0 1px rgba(10,31,21,0.1)`,
        textDecoration: "none",
        color: "var(--nex-world-drawer-bg, #123D2B)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Full-height avatar · forms the rounded-left end of the card */}
      <div
        aria-hidden
        style={{
          position: "relative",
          width: CARD_HEIGHT,
          height: "auto",
          flexShrink: 0,
          alignSelf: "stretch",
          background: row.avatarUrl
            ? "transparent"
            : `linear-gradient(135deg, ${accentHex}cc 0%, #0A1F15 100%)`,
          display: "grid",
          placeItems: "center",
          // Right-edge presence stripe — equivalent of the sealed rim
          // for this rectangular avatar shape.
          borderRight: `${PRESENCE_STRIPE_WIDTH}px solid ${stripeColor}`,
          overflow: "hidden",
        }}
      >
        {row.avatarUrl ? (
          <img
            src={row.avatarUrl}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <span
            style={{
              color: "#FFFFFF",
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: "0.04em",
              textShadow: "0 1px 2px rgba(0,0,0,0.6)",
            }}
          >
            {initials}
          </span>
        )}
      </div>

      {/* Content column */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          maxWidth: "100%",
          padding: "8px 12px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 3,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 800,
              lineHeight: 1.2,
              // Owner directive 2026-11-03 · dark Emerald text for high
              // contrast on the Gold card interior (matches the "+" button's
              // own text treatment).
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
          {row.hasShop === true ? (
            <span
              aria-label="Has shop"
              title="Has shop"
              style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}
            >
              🛒
            </span>
          ) : null}
        </div>
        {summary ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1.3,
              // Dark Emerald at reduced opacity · secondary hierarchy
              // on the Gold interior.
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

      {/* Right accent · unread badge only (shop + verified are inline) */}
      {row.unreadCount && row.unreadCount > 0 ? (
        <span
          aria-label={`${row.unreadCount} unread`}
          style={{
            alignSelf: "center",
            minWidth: 20,
            height: 20,
            padding: "0 6px",
            marginRight: 10,
            borderRadius: 999,
            background: "#B30000",
            color: "#FFF",
            fontSize: 11,
            fontWeight: 900,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {row.unreadCount > 99 ? "99+" : row.unreadCount}
        </span>
      ) : null}
    </Link>
  );
}

function buildSummary(row: ContactRowDisplay): string | null {
  // Owner directive 2026-11-03 · skill (1 word · profession token) +
  // location (county for Ireland, country for other users).
  const parts: string[] = [];
  const skill = skillOnly(row.professionLine);
  if (skill) parts.push(skill);
  if (row.city) parts.push(row.city);
  return parts.length === 0 ? null : parts.join(" · ");
}
