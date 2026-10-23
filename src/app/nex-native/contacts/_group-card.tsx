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
  accent = "pink",
  eyebrow,
}: GroupCardProps) {
  const accentHex =
    accent === "pink" ? NEX.pink : accent === "cyan" ? NEX.cyan : NEX.orange;

  const remaining = Math.max(0, group.memberCount - group.members.length);

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

      {/* Identity text · translateY lifts the block above the rim ·
          same picker-sheet treatment as ContactRow. */}
      <div
        style={{
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
        {/* Member stack + count circle · small round chips with
            initials + a trailing "+N" circle for the remainder. */}
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
          {/* Trailing count circle · last chip in the stack · shows
              the total member count OR "+N" if there are more than
              the shown chips. */}
          <div
            aria-label={`${group.memberCount} total members`}
            data-nex-group-card-count
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: `2px solid ${accentHex}`,
              background: `rgba(2,9,20,0.95)`,
              display: "grid",
              placeItems: "center",
              fontSize: 10,
              fontWeight: 900,
              color: accentHex,
              letterSpacing: 0.3,
              marginLeft: -8,
              boxShadow: `0 2px 8px ${accentHex}55`,
              zIndex: group.members.length + 1,
              position: "relative",
            }}
          >
            {remaining > 0 ? `+${remaining}` : group.memberCount}
          </div>
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
    </>
  );

  const style: React.CSSProperties = {
    position: "relative",
    display: "block",
    padding: "6px 14px 10px 70px",
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
