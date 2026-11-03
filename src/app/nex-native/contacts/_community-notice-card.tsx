"use client";

// src/app/nex-native/contacts/_community-notice-card.tsx
//
// Owner directive 2026-11-03 · "design the card like it was family
// design of the contacts card design style". The Community Notice card
// now mirrors the sealed `_contact-row.tsx` chrome:
//
//   · Same 60px avatar on the far-left with Gold rim + gradient fill
//   · Same card dimensions: minHeight 90 · padding 12/14 · gap 12 ·
//     border-radius 12 · border 1.5px Gold · drawer-bg background
//     (overridden to Forest green by the scoped CSS in page.tsx when
//     the card renders inside `[data-nex-contacts-root]`)
//   · Same 3-row identity text column: name · one-line descriptor ·
//     location + last-active
//   · Same unread badge pattern: top-right of avatar · 18px red pill ·
//     hidden when muted (sealed 2026-10-23 rule)
//   · Mute toggle sits in the right-side action column where ContactRow
//     renders the shop marker · stopPropagation so clicking the toggle
//     does NOT trigger the card's navigation
//
// Preserved from the 2026-10-23 sealed Community Notice spec:
//   · Toggle default ON · OFF = muted
//   · Muted state · badge HIDDEN · tap-to-open blocked (card renders
//     as a <div> not <Link>) · re-enable required
//   · Active state · red unread counter · tap opens /community/chat
//   · Mute state persists in localStorage until the real
//     nex_community_membership.notification_preference column lands
//     (migration 149 · DRAFT · not applied)
//   · Self-leave impossible · no "Leave" button
//   · Flagger identity private · owned by the service layer not the UI
//   · Location copy shows ONLY the general area name (sealed security
//     rule: no "2km" · no "radius" · no "auto-assigned" · no "near you")

import * as React from "react";
import Link from "next/link";

// ─── Visual constants matched to _contact-row.tsx ──────────────────────
const AVATAR_SIZE = 60;
const CARD_PADDING_Y = 12;
const CARD_PADDING_X = 14;
const CARD_GAP = 12;
const CARD_MIN_HEIGHT = 90;

const NEX = {
  text: "#F2F5F8",
  textMute: "var(--nex-world-text-muted, #7D9BC0)",
  unreadRed: "#B30000",
  // Toggle active colour · falls back to brand cyan but on Ireland
  // resolves to Gold via --nex-world-secondary.
  toggleActive: "var(--nex-world-secondary, #00AFFF)",
  // Card accent · Gold on Ireland · same as ContactRow accentHex.
  accentHex: "var(--nex-world-secondary, #C6A15B)",
};

// Owner directive 2026-10-23 · "we don't want people to know the
// location they've been added into so naughty robbers don't have system
// to monitor". Security-by-obscurity on the USER-FACING surface. The
// mechanism (address-anchored 2km radius) stays in the sealed doctrine
// + the service layer. No user-facing copy exposes "2km" · "radius" ·
// "auto-assigned" · or "near you". City/kabupaten-level name only.
//
// Owner directive 2026-11-03 (B+β · full build) · zoneName + hasMembership
// props now come from server-side resolution in contacts/page.tsx.
// When the viewer has a confirmed membership, we show their REAL zone
// name (district level · city). When they do NOT, we render a "join
// your community" CTA linking to /nex-native/community/select.
const DEFAULT_LOCATION = "Yogyakarta"; // fallback only · never surfaced to a logged-in no-membership user
const DEFAULT_MEMBER_COUNT_LABEL = "1,248 members"; // mock until nex_community_membership count query ships

const MUTE_STORAGE_KEY = "nex-community-notice-muted-v1";
const UNREAD_MOCK_COUNT = 7; // mock-only · real count = unread posts since last visit

function formatLastActive(mins: number): string {
  if (mins < 60) return `Active ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Active ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Active ${days}d`;
}

interface CommunityNoticeCardProps {
  /** Server-resolved district zone name (city-level · safe copy). Null
   *  means the viewer has no confirmed membership · the card renders
   *  the "join your community" CTA state. */
  readonly zoneName?: string | null;
  /** Explicit flag so a logged-in-but-no-membership user is never
   *  mistaken for a "unknown zone" render. */
  readonly hasMembership?: boolean;
}

export function CommunityNoticeCard({
  zoneName = null,
  hasMembership = false,
}: CommunityNoticeCardProps = {}): React.ReactElement {
  const [muted, setMuted] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MUTE_STORAGE_KEY);
      setMuted(raw === "1");
    } catch {
      setMuted(false);
    }
  }, []);

  const handleToggle = React.useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
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
    },
    [],
  );

  // SSR + first hydration · render as active (ON · unmuted) default.
  // After mount useEffect loads from localStorage.
  const isMuted = muted === true;
  // Owner directive 2026-11-03 (B+β) · unread badge + mute toggle only
  // apply when the user actually HAS a membership. Pre-membership CTA
  // state hides both.
  const showBadge = hasMembership && !isMuted && UNREAD_MOCK_COUNT > 0;
  const showMuteToggle = hasMembership;
  const navigateHref = hasMembership
    ? "/nex-native/community/chat"
    : "/nex-native/community/select";
  // Owner directive 2026-11-03 (B+β) · live props displace the mock
  // COMMUNITY_GROUP singleton. When hasMembership=false, the card
  // flips to "join your community" CTA state (navigates to
  // /community/select instead of /community/chat, mute toggle hidden,
  // unread badge hidden).
  const displayName = hasMembership ? "Community Notice" : "Join Community Notice";
  const displayLocation = hasMembership
    ? (zoneName ?? DEFAULT_LOCATION)
    : "Set your area to join";
  const displayMemberCount = hasMembership ? DEFAULT_MEMBER_COUNT_LABEL : "Local noticeboard";
  const minutesSinceLastPost = 12; // mock · last-active value replaced with real server data when ready
  const lastActiveLabel = hasMembership ? formatLastActive(minutesSinceLastPost) : "Tap to set up";

  // ─── Shared card contents · identical to ContactRow structure ──────
  const cardContents = (
    <>
      {/* ===== AVATAR · far-left · vertically centred · same 60px as ContactRow ===== */}
      <div
        aria-hidden
        data-nex-contacts-row-chip
        style={{
          position: "relative",
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `2px solid ${NEX.accentHex}`,
            overflow: "hidden",
            background: `linear-gradient(135deg, var(--nex-world-secondary, #C6A15B)cc 0%, var(--nex-world-drawer-bg, #180012) 65%, var(--nex-world-drawer-bg, #050F1E) 100%)`,
            display: "grid",
            placeItems: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          <span
            style={{
              color: "#FFF",
              fontSize: 15,
              fontWeight: 900,
              letterSpacing: "0.04em",
              textShadow: "0 1px 3px rgba(0,0,0,0.6)",
            }}
          >
            CN
          </span>
        </div>

        {/* Unread badge · top-right of avatar · matches ContactRow pattern
            exactly · hidden when muted per sealed 2026-10-23 rule. */}
        {showBadge ? (
          <div
            aria-label={`${UNREAD_MOCK_COUNT} unread community posts`}
            data-nex-community-notice-unread-badge
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 999,
              background: NEX.unreadRed,
              border: `2px solid var(--nex-world-drawer-bg, #050F1E)`,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              color: "#FFFFFF",
              fontWeight: 900,
              lineHeight: 1,
              boxShadow: `0 2px 6px ${NEX.unreadRed}99`,
            }}
          >
            {UNREAD_MOCK_COUNT > 99 ? "99+" : UNREAD_MOCK_COUNT}
          </div>
        ) : null}
      </div>

      {/* ===== IDENTITY TEXT · 3-row structure matching ContactRow ===== */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          maxWidth: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        {/* Row 1 · Name · orange text matches ContactRow name slot. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
          }}
        >
          <span
            data-nex-contacts-row-name
            style={{
              fontSize: 15,
              fontWeight: 800,
              lineHeight: 1.2,
              color: "#F5A623",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {displayName}
          </span>
        </div>

        {/* Row 2 · One-line descriptor (member count) · profession slot. */}
        <div
          data-nex-contacts-row-profession
          style={{
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {displayMemberCount}
        </div>

        {/* Row 3 · Location (left) + last-active (right) · same row. */}
        <div
          data-nex-contacts-row-location
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.2,
            minWidth: 0,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <MapPinIcon color={NEX.unreadRed} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {displayLocation}
            </span>
          </span>
          <span
            data-nex-contacts-row-last-online
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.2,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {lastActiveLabel}
          </span>
        </div>
      </div>

      {/* ===== RIGHT-SIDE ACTION · mute toggle (hasMembership only) OR
            chevron CTA (no membership · points at /community/select) ===== */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: AVATAR_SIZE,
        }}
      >
        {showMuteToggle ? (
          <button
            type="button"
            onClick={handleToggle}
            onPointerDown={(e) => e.stopPropagation()}
            aria-pressed={!isMuted}
            aria-label={
              isMuted ? "Unmute Community Notice" : "Mute Community Notice"
            }
            data-nex-community-notice-toggle
            data-nex-community-notice-muted={isMuted ? "true" : "false"}
            style={{
              width: 44,
              height: 24,
              padding: "2px",
              borderRadius: 999,
              background: isMuted ? NEX.unreadRed : NEX.toggleActive,
              border: `1px solid ${isMuted ? NEX.unreadRed : NEX.toggleActive}`,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              transition: "background 180ms ease, border-color 180ms ease",
              WebkitTapHighlightColor: "transparent",
              boxShadow: isMuted
                ? `0 2px 6px ${NEX.unreadRed}66`
                : `0 2px 6px rgba(198,161,91,0.4)`,
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
        ) : (
          // Pre-membership state · right-side action is a visual chevron
          // (not a button · the parent Link navigates on tap).
          <span
            aria-hidden
            data-nex-community-notice-cta-chevron
            style={{
              fontSize: 22,
              lineHeight: 1,
              fontWeight: 900,
              color: NEX.toggleActive,
            }}
          >
            ›
          </span>
        )}
      </div>
    </>
  );

  // Card chrome · matches ContactRow exactly. When this card renders
  // inside `[data-nex-contacts-root]` on `/nex-native/contacts`, the
  // scoped CSS override in page.tsx swaps the drawer-bg for Forest
  // green `--nex-world-primary` so the Community card picks up the
  // tab's green card body automatically.
  const cardStyle: React.CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: CARD_GAP,
    padding: `${CARD_PADDING_Y}px ${CARD_PADDING_X}px`,
    minHeight: CARD_MIN_HEIGHT,
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    background: "var(--nex-world-drawer-bg, rgba(2,9,20,0.92))",
    border: `1.5px solid ${NEX.accentHex}`,
    borderRadius: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
    textDecoration: "none",
    color: NEX.text,
    WebkitTapHighlightColor: "transparent",
  };

  // Mute discipline · when the viewer has a membership AND the card is
  // muted, the card is NOT a tappable link (toggle still works via its
  // own onClick + stopPropagation). Owner must flip the toggle back ON
  // to re-enter /community/chat. The muted-non-interactive rule only
  // applies to members · the pre-membership CTA state is ALWAYS a Link
  // (points at /community/select so the user can finish setup).
  if (hasMembership && isMuted) {
    return (
      <div
        data-nex-contacts-row
        data-nex-contacts-row-kind="community"
        aria-label="Community Notice · muted · unmute to open"
        style={cardStyle}
      >
        {cardContents}
      </div>
    );
  }

  return (
    <Link
      href={navigateHref}
      data-nex-contacts-row
      data-nex-contacts-row-kind="community"
      aria-label="Open Community Notice chat"
      style={cardStyle}
    >
      {cardContents}
    </Link>
  );
}

// Local copy of ContactRow's MapPinIcon · same SVG · keeps this card
// self-contained without crossing the sealed component boundary.
function MapPinIcon({ color }: { readonly color: string }): React.ReactElement {
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
