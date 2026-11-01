// src/app/nex-native/contacts/_my-groups-card.tsx
//
// My Groups card · uses the owner-supplied "Neon Glass Group Emblem"
// PNG. Design matches the template · compact row with emblem icon
// left, title + subtitle middle, count badge right.
//
// D5 · honest placeholder in Phase 1:
//   · No `nex_group` schema exists today (confirmed in audit)
//   · Count ALWAYS displays as "0 groups · coming soon"
//   · Tapping the card routes to the Contacts page with ?tab=groups
//     which renders an honest empty state ("Groups are coming soon")
//     rather than a 404 or a stub /groups route
//
// Server Component · no state · no interactions beyond the Link.

import type * as React from "react";
import Link from "next/link";

const NEX = {
  cyan: "var(--nex-world-secondary, #00AFFF)",
  cyanSoft: "rgba(0, 175, 255, 0.30)",
  textPrimary: "#F2F5F8",
  textMuted: "#7D9BC0",
  panel: "rgba(3, 16, 29, 0.80)",
};

export function MyGroupsCard() {
  return (
    <Link
      href="/nex-native/contacts?tab=groups"
      data-nex-contacts-groups-card
      aria-label="My Groups · coming soon"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 14,
        background: NEX.panel,
        border: `1px solid ${NEX.cyanSoft}`,
        color: NEX.textPrimary,
        textDecoration: "none",
        // Owner directive 2026-10-17 (revised three times same day) ·
        // "my groups card reduce height of card 10px" → 92 → 82 ·
        // then "my groups reduce card height 8px" → 82 → 74 · then
        // "move up only the my groups card 7px while keeping the
        // invite friends card same position" → marginTop: -7 lifts
        // this card alone, overriding the shell's gap: 10, without
        // disturbing the Invite Friends card above it.
        height: 74,
        marginTop: -7,
        boxSizing: "border-box",
      }}
    >
      {/* Owner-supplied glass emblem · square 48x48 crop. */}
      <img
        src="/nex-native/contacts/groups-emblem.png"
        alt=""
        aria-hidden
        width={44}
        height={44}
        style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          objectFit: "contain",
          filter: "drop-shadow(0 2px 6px rgba(0,175,255,0.35))",
          userSelect: "none",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: NEX.textPrimary,
          }}
        >
          My Groups
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            lineHeight: 1.35,
            color: NEX.textMuted,
          }}
        >
          Join or manage your groups
        </div>
      </div>
      {/* Owner directive 2026-10-17 · remove the "COMING SOON" chip ·
          the card tap now navigates to /contacts?tab=groups which
          renders the Groups surface with placeholder group cards. */}
      <ChevronRight color={NEX.textMuted} />
    </Link>
  );
}

function ChevronRight({ color }: { readonly color: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
