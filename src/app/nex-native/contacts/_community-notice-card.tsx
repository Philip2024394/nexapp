"use client";

// src/app/nex-native/contacts/_community-notice-card.tsx
//
// Owner directive 2026-10-23 · the Community card in the Groups tab
// is renamed to "Community Notice" and carries a mute toggle in the
// top-right. The full sealed spec (locked over the design conversation
// 2026-10-23):
//
//   · Name            · Community Notice
//   · Membership      · auto-assigned by address · 2km radius
//                       · address change moves the user
//   · Toggle          · default ON · OFF = muted
//   · Muted state     · badge HIDDEN (respects the mute) · tap-to-open
//                       blocked · re-enable required
//   · Active state    · red unread counter · tap opens group chat
//   · Re-enable       · "Welcome back · N posts since you muted" marker
//   · Self-leave      · impossible · address change / full account
//                       deletion are the exits
//
// This component wraps the sealed `GroupCard` chrome · the toggle +
// badge sit as absolute-positioned overlays. Mute state persists in
// localStorage so refresh preserves it. When the real nex_community_
// membership.notification_preference column lands, swap the
// localStorage read/write for server actions · the UI stays.

import * as React from "react";
import { GroupCard } from "./_group-card";
import type { MockGroup } from "./_mock-groups";

// Owner directive 2026-10-23 · "remove the auto assign and the 2km
// dont tell them · location area example jogja · we dont want people
// to know the location they've been added into · so naughty robbers
// don't have system to monitor". Security-by-obscurity on the
// user-facing surface · the mechanism (address-anchored 2km radius)
// remains in the SEALED doctrine memory + the service layer, but
// NO user-facing copy exposes "2km", "radius", or "auto-assigned".
// Users see only the general area name (city/kabupaten level), not
// the technical rule. Prevents reconnaissance by bad actors.
const COMMUNITY_GROUP: MockGroup = {
  id: "nex-community-notice",
  name: "Community Notice",
  location: "Yogyakarta",
  memberCount: 1248,
  members: [
    { id: "c1", initials: "OR" },
    { id: "c2", initials: "MD" },
    { id: "c3", initials: "PP" },
    { id: "c4", initials: "JO" },
  ],
  minutesSinceLastPost: 12, // 12m ago
};

const MUTE_STORAGE_KEY = "nex-community-notice-muted-v1";
const UNREAD_MOCK_COUNT = 7; // mock-only · real count comes from server

const NEX = {
  cyan: "#00AFFF",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  unreadRed: "#B30000",
  bgNavy: "#050F1E",
};

export function CommunityNoticeCard(): React.ReactElement {
  const [muted, setMuted] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MUTE_STORAGE_KEY);
      setMuted(raw === "1");
    } catch {
      setMuted(false);
    }
  }, []);

  const handleToggle = React.useCallback((e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMuted((prev) => {
      const next = !(prev ?? false);
      try {
        window.localStorage.setItem(MUTE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // SSR + first hydration · render as active default (ON · unmuted).
  // After the mount useEffect loads from localStorage, state updates.
  const isMuted = muted === true;
  const showBadge = !isMuted && UNREAD_MOCK_COUNT > 0;

  return (
    <div style={{ position: "relative" }}>
      <GroupCard
        group={COMMUNITY_GROUP}
        // When muted the card is NOT a tappable link · entry is
        // blocked. User must flip the toggle back ON to re-enter.
        href={isMuted ? undefined : "/nex-native/community/chat"}
        accent="cyan"
      />

      {/* Unread badge · owner directive 2026-10-23 revised again ·
          "move to top rim area" · badge now sits on the chip's
          TOP-LEFT rim (symmetric to the bottom-left previously ·
          clear of the name column at left:70+). Chip (48×48 at
          left:12, top:-24) top-left corner is (left:12, top:-24) ·
          badge 22-wide · offset by -6/-6 lands it at (left:6,
          top:-30) sticking 6px past the chip's top-left corner.
          Only visible when NOT muted · hidden by the mute rule. */}
      {showBadge ? (
        <div
          aria-label={`${UNREAD_MOCK_COUNT} unread community posts`}
          data-nex-community-notice-unread-badge
          style={{
            position: "absolute",
            // Owner directive 2026-10-23 · nudged down thrice (−5px each) ·
            // top −30 → −25 → −20 → −15. Then nudged left 5px · left
            // 6 → 1 so the badge sits closer to the card's left edge.
            top: -15,
            left: 1,
            minWidth: 22,
            height: 22,
            padding: "0 6px",
            borderRadius: 999,
            background: NEX.unreadRed,
            border: `2px solid ${NEX.bgNavy}`,
            color: "#FFF",
            fontSize: 11,
            fontWeight: 900,
            lineHeight: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 2px 6px ${NEX.unreadRed}99`,
            zIndex: 3,
            pointerEvents: "none",
          }}
        >
          {UNREAD_MOCK_COUNT > 99 ? "99+" : UNREAD_MOCK_COUNT}
        </div>
      ) : null}

      {/* Mute toggle · top-right · stopPropagation so clicking the
          switch doesn't fire the GroupCard's own Link navigation. */}
      <button
        type="button"
        onClick={handleToggle}
        onPointerDown={(e) => e.stopPropagation()}
        aria-pressed={!isMuted}
        aria-label={isMuted ? "Unmute Community Notice" : "Mute Community Notice"}
        data-nex-community-notice-toggle
        data-nex-community-notice-muted={isMuted ? "true" : "false"}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 44,
          height: 24,
          padding: "2px",
          borderRadius: 999,
          // Owner directive 2026-10-23 · "mute group must show toggle
          // red" · muted-state track flips to NEX unreadRed so it reads
          // as an explicit "notifications off" signal · cyan for the
          // live/active state keeps the brand palette.
          background: isMuted ? NEX.unreadRed : NEX.cyan,
          border: `1px solid ${isMuted ? NEX.unreadRed : NEX.cyan}`,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          transition: "background 180ms ease, border-color 180ms ease",
          zIndex: 4,
          WebkitTapHighlightColor: "transparent",
          boxShadow: isMuted
            ? `0 2px 6px ${NEX.unreadRed}66`
            : `0 2px 6px ${NEX.cyan}55`,
        }}
      >
        <span
          aria-hidden
          style={{
            display: "block",
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#FFF",
            boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
            transform: isMuted ? "translateX(0)" : "translateX(20px)",
            transition: "transform 180ms ease",
          }}
        />
      </button>
    </div>
  );
}
