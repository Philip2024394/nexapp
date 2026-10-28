// src/app/nex-native/contacts/_group-card.tsx
//
// Owner directive 2026-10-23 · "same card design for groups but for
// groups the card will show small profile images round and total
// members in group last circle with count · under the group location
// · and same for community group".
//
// Mirrors the ContactRow visual language (chip-overlap · accent rim
// · name on the top rim) but swaps the identity line for a mini
// profile-image stack + member count:
//
//   [name]
//   [member chip 1][member chip 2][member chip 3][member chip 4][+38]
//   [location text with map pin]
//
// Server Component · no hooks.

import type * as React from "react";
import Link from "next/link";
import type { MockGroup } from "./_mock-groups";
import { formatMinutesAgo } from "./_mock-groups";

const NEX = {
  bgPanel: "rgba(2,9,20,0.92)",
  pink: "#FF4FD7",
  cyan: "#00AFFF",
  orange: "#FF7200",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  unreadRed: "#B30000",
};

interface GroupCardProps {
  readonly group: MockGroup;
  readonly href?: string;
  /**
   * Owner directive 2026-10-23 · "same for community group" · the
   * NEX Community card re-uses this component with accent="orange"
   * and headline="EXPLORE" / name="NEX Community" so it reads as
   * part of the same group vocabulary.
   */
  readonly accent?: "pink" | "cyan" | "orange";
  readonly eyebrow?: string;
}

export function GroupCard({
  group,
  href,
  // Owner directive 2026-10-23 · "the groups cards should also be
  // the same color as contacts cards" · default accent flipped from
  // pink → cyan so mock groups match the My Contacts row chrome.
  // Community card still overrides via accent="orange" explicitly.
  accent = "cyan",
  eyebrow,
}: GroupCardProps) {
  const accentHex =
    accent === "pink" ? NEX.pink : accent === "cyan" ? NEX.cyan : NEX.orange;

  // Owner directive 2026-10-23 · count pill shows TOTAL memberCount
  // now that it's standalone under the chip · the earlier `+N remaining`
  // helper is retired.

  const content = (
    <>
      {/* Chip · overlapping top-left · round · accent gradient ·
          generic "group" glyph (small people icon) inside. */}
      <div
        aria-hidden
        data-nex-group-card-chip
        style={{
          position: "absolute",
          top: -24,
          left: 12,
          width: 48,
          height: 48,
          zIndex: 2,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `2px solid ${accentHex}`,
            overflow: "hidden",
            background: `linear-gradient(135deg, ${accentHex}cc 0%, #180012 65%, #050F1E 100%)`,
            display: "grid",
            placeItems: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          <GroupIcon color="#FFF" />
        </div>
      </div>

      {/* Owner directive 2026-10-23 revised · "remove the badge from
          the group members count and center the numbers" · pill
          chrome retired (no border, no background, no shadow) · pure
          numeric glyph in the accent colour · still absolute-positioned
          directly under the chip and centred in the 48px chip column. */}
      <div
        aria-label={`${group.memberCount} total members`}
        data-nex-group-card-count
        style={{
          position: "absolute",
          // Owner directive 2026-10-23 · "move down center" · bumped
          // 30 → 38 so the number sits further below the chip bottom
          // (chip bottom = y:24 · 38 = 14px gap) · horizontally
          // centred under the chip column via left:12 + width:48 +
          // textAlign:center · chip itself is left:12 width:48 so the
          // number is exactly below the chip's visual centre.
          top: 38,
          left: 12,
          width: 48,
          textAlign: "center",
          fontSize: 14,
          fontWeight: 900,
          color: accentHex,
          letterSpacing: 0.3,
          lineHeight: 1,
          zIndex: 3,
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        {/* Owner directive 2026-10-23 · hydration-safe number format
            · `.toLocaleString()` without a locale arg uses the runtime's
            default (Node locale on server · browser locale on client)
            → produces "1.248" vs "1,248" mismatches. Pinning to en-US
            gives stable `1,248` output on both sides. Swap for the
            user's chosen NEX locale when a locale system is wired. */}
        {group.memberCount.toLocaleString("en-US")}
      </div>

      {/* Identity text · translateY lifts the block above the rim ·
          same picker-sheet treatment as ContactRow. flex:1 + minWidth:0
          so the column absorbs available width in the parent flex row
          (matches ContactRow identity column). */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          transform: "translateY(-12px)",
          position: "relative",
          zIndex: 1,
        }}
      >
        {eyebrow ? (
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 0.8,
              color: accentHex,
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <div
          data-nex-group-card-name
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: NEX.text,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            textShadow: `0 0 8px ${accentHex}99`,
          }}
        >
          {group.name}
        </div>
        {/* Owner directive 2026-10-23 · "count pill move under the
            group profile image" · the count element is now a pill
            absolute-positioned directly beneath the chip (left:12,
            same column as the chip, 48px wide to match the chip's
            footprint). The inline member stack keeps only the small
            round initials chips · no trailing count circle. */}
        <div
          data-nex-group-card-members
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: 2,
          }}
        >
          {group.members.map((m, i) => (
            <div
              key={m.id}
              aria-hidden
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                border: `2px solid #050F1E`,
                background: `linear-gradient(135deg, ${accentHex}cc, #180012)`,
                display: "grid",
                placeItems: "center",
                fontSize: 9,
                fontWeight: 900,
                color: "#FFF",
                letterSpacing: 0.3,
                marginLeft: i === 0 ? 0 : -8,
                boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
                zIndex: group.members.length - i,
                position: "relative",
              }}
            >
              {m.initials}
            </div>
          ))}
        </div>
        {/* Location · under the member stack · red map pin + text */}
        <div
          data-nex-group-card-location
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginTop: 2,
          }}
        >
          <MapPinIcon color={NEX.unreadRed} />
          <span>{group.location}</span>
        </div>
      </div>

      {/* Owner directive 2026-10-23 · "group cards on the right side
          lower corner time last post by user" · tiny muted timestamp
          in the card's bottom-right · stable "Nm ago" / "Nh ago" /
          "Nd ago" format from the sealed `formatMinutesAgo` helper ·
          hydration-safe (no clock reads on render). Omitted when
          `minutesSinceLastPost` is undefined so cards without a
          last-post signal (new groups) stay clean. */}
      {typeof group.minutesSinceLastPost === "number" ? (
        <div
          data-nex-group-card-last-post
          style={{
            position: "absolute",
            right: 10,
            bottom: 8,
            fontSize: 10,
            fontWeight: 700,
            color: NEX.textMute,
            letterSpacing: 0.2,
            pointerEvents: "none",
            zIndex: 1,
            whiteSpace: "nowrap",
          }}
        >
          {formatMinutesAgo(group.minutesSinceLastPost)}
        </div>
      ) : null}
    </>
  );

  // Owner directive 2026-10-23 · "why the group name is not displaying
  // on the line" · GroupCard layout now mirrors ContactRow byte-for-
  // byte (flex row · items-center · padding "2px 14px 2px 70px") so
  // the identity text column (lifted via translateY(-12)) sits on
  // the top rim identically to accepted-contact rows. Previously
  // display:block + padding 6/10 pushed content below the rim.
  const style: React.CSSProperties = {
    position: "relative",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: "2px 14px 2px 70px",
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 10,
    background: NEX.bgPanel,
    border: `1.5px solid ${accentHex}`,
    boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
    textDecoration: "none",
    color: NEX.text,
    overflow: "visible",
    WebkitTapHighlightColor: "transparent",
    marginTop: 14,
  };

  if (href) {
    return (
      <Link
        href={href}
        aria-label={`Open ${group.name}`}
        data-nex-group-card
        style={style}
      >
        {content}
      </Link>
    );
  }
  return (
    <div data-nex-group-card style={style}>
      {content}
    </div>
  );
}

function GroupIcon({ color }: { readonly color: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function MapPinIcon({ color }: { readonly color: string }) {
  return (
    <svg
      aria-hidden
      width={10}
      height={10}
      viewBox="0 0 24 24"
      style={{ flexShrink: 0, display: "block" }}
    >
      <path
        fill={color}
        d="M12 2c-4.418 0-8 3.582-8 8 0 5.25 7 12 7.4 12.3a1 1 0 0 0 1.2 0C13 22 20 15.25 20 10c0-4.418-3.582-8-8-8zm0 10.75a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5z"
      />
    </svg>
  );
}
