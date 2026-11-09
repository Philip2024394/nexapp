// src/app/nex-native/contacts/_contact-row.tsx
//
// NEX contact card · owner-directive layout rewrite 2026-11-03.
// -----------------------------------------------------------------------
// Owner directive 2026-11-03 (exact):
//   "I want the user's profile image positioned at the far-left edge
//    of the contact card, as the leading element.
//    Layout order:
//      1. Profile image at the far left.
//      2. Contact name and relevant details immediately to the right.
//      3. Any existing action icons or buttons remain on the right-hand side.
//    Design requirements:
//      - Vertically centre the profile image within the card.
//      - Use a consistent image size across all contact cards.
//      - Keep the image neatly cropped using object-fit: cover.
//      - Use a clean circular or softly rounded-square image frame.
//      - Keep consistent spacing between the image and contact information.
//      - Ensure the layout works on mobile and desktop.
//      - Do not move the profile image to the right or place it after
//        the contact details.
//      - Preserve existing contact-card functionality, data, actions
//        and styling."
//
// Preserved from the prior-sealed revisions:
//   · Sealed presence-RIM pattern (2026-10-29) · green/orange/dark-red
//     ring on the AVATAR, heartbeat animation when online or away,
//     static when offline, honest neutral when null. Never dots or
//     corner lamps or badges elsewhere.
//   · Shop marker 🛒 shown on the right side when hasShop === true.
//   · Unread badge (red pill) · now attached to the avatar's top-right
//     corner so it still reads at a glance without competing with the
//     right-side action area.
//   · Verified pill inline with the name.
//   · Profession + city with map pin, honest absence (omit when null).
//   · Last-online label when presence is non-online and timestamp known.
//   · Theme styling: Emerald card bg, Gold rim via accentHex prop,
//     orange name text, Sage secondary ink.
//   · `data-nex-contacts-row*` markers for analytics / tests.
//
// Supersedes:
//   · The 2026-10-23 "chip-overlapping-the-rim · translate-Y onto rim"
//     treatment · retired in favour of the owner's explicit "image on
//     the far-left · vertically centred" directive. The sealed presence
//     rim is preserved; only the chip's POSITION changes.

import type * as React from "react";
import Link from "next/link";
import type { ContactRowDisplay } from "./_contacts-list";

/** Sealed presence vocabulary · universal across worlds · 2026-10-29. */
const PRESENCE = {
  online: "#16D66B",
  busy: "#FF7200",
  offline: "#A60000",
} as const;

const NEX = {
  text: "#F2F5F8",
  textMute: "var(--nex-world-text-muted, #7D9BC0)",
  unreadRed: "#B30000",
};

/** Avatar visual sizing · consistent across every row.
 *  Owner directive 2026-11-03 · "enlarge the profile image 25%" ·
 *  base 48 × 1.25 = 60. Card min-height bumped from 76 → 90 so the
 *  larger avatar has room without crowding the metadata rows. */
const AVATAR_SIZE = 60;
const CARD_PADDING_Y = 12;
const CARD_PADDING_X = 14;
const CARD_GAP = 12;
const CARD_MIN_HEIGHT = 90;

interface ContactRowProps {
  readonly row: ContactRowDisplay;
  /** Owner directive 2026-10-23 · chat-theme accent · passed from the
   *  caller (chat-wallpaper cookie on production, Irish Gold in Ireland
   *  prototypes). Drives the card rim, verified-pill ring and avatar
   *  initials gradient so the row reads as part of the same chat
   *  vocabulary. */
  readonly accentHex: string;
}

export function ContactRow({ row, accentHex }: ContactRowProps): React.JSX.Element {
  const initials =
    row.initials && row.initials.trim().length > 0
      ? row.initials.toUpperCase()
      : initialsFromName(row.displayName);
  const presence = row.presence ?? null;
  const rimColor = resolveRimColor(presence);
  const neutralRim = "rgba(255,255,255,0.55)";
  const hasHeartbeat = presence === "online" || presence === "away";
  const hasShop = row.hasShop === true;
  const lastOnlineLabel = presenceLabel(row);

  return (
    <Link
      href={row.chatHref}
      aria-label={`Open chat with ${row.displayName}`}
      data-nex-contacts-row
      data-nex-contacts-row-kind={row.kind}
      data-nex-contacts-row-pending={row.pending ? "true" : undefined}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: CARD_GAP,
        padding: `${CARD_PADDING_Y}px ${CARD_PADDING_X}px`,
        minHeight: CARD_MIN_HEIGHT,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        background: row.pending
          ? "color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 10%, var(--nex-world-drawer-bg, rgba(2,9,20,0.92)))"
          : "var(--nex-world-drawer-bg, rgba(2,9,20,0.92))",
        border: `1.5px solid ${row.pending ? "var(--nex-world-secondary, #C6A15B)" : accentHex}`,
        borderRadius: 12,
        boxShadow: row.pending
          ? "0 4px 12px rgba(198,161,91,0.25)"
          : "0 4px 12px rgba(0,0,0,0.35)",
        textDecoration: "none",
        color: NEX.text,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {row.pending ? (
        <span
          aria-hidden
          data-nex-contacts-row-invited-chip
          style={{
            position: "absolute",
            top: 6,
            right: 10,
            padding: "2px 8px",
            borderRadius: 999,
            background: "var(--nex-world-secondary, #C6A15B)",
            color: "var(--nex-world-drawer-bg, #0A1526)",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          Invited · waiting
        </span>
      ) : null}
      {/* ===== AVATAR · far-left, vertically centred, consistent 48px ===== */}
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
            border: `2px solid ${rimColor ?? neutralRim}`,
            overflow: "hidden",
            background: `linear-gradient(135deg, ${accentHex}cc 0%, var(--nex-world-drawer-bg, #180012) 65%, var(--nex-world-drawer-bg, #050F1E) 100%)`,
            display: "grid",
            placeItems: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {row.avatarUrl ? (
            <img
              src={row.avatarUrl}
              alt=""
              width={AVATAR_SIZE}
              height={AVATAR_SIZE}
              loading="lazy"
              decoding="async"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <span
              style={{
                color: "#FFF",
                fontSize: 15,
                fontWeight: 900,
                letterSpacing: "0.04em",
                textShadow: "0 1px 3px rgba(0,0,0,0.6)",
              }}
            >
              {initials}
            </span>
          )}
        </div>

        {/* Sealed heartbeat ring · identical to the 2026-10-29 master. */}
        {hasHeartbeat ? (
          <div
            style={{
              position: "absolute",
              inset: -3,
              borderRadius: "50%",
              border: `2px solid ${rimColor ?? neutralRim}`,
              animation:
                "nex-contact-row-heartbeat 1200ms cubic-bezier(0.4,0,0.2,1) infinite",
              pointerEvents: "none",
            }}
          />
        ) : null}

        {/* Unread badge · top-right corner of the avatar. */}
        {row.unreadCount && row.unreadCount > 0 ? (
          <div
            aria-label={`${row.unreadCount} unread`}
            data-nex-contacts-row-unread-badge
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
            {row.unreadCount > 99 ? "99+" : row.unreadCount}
          </div>
        ) : null}
      </div>

      {/* ===== IDENTITY TEXT · immediately to the right of avatar ===== */}
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
        {/* Name + verified pill */}
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
            {row.displayName}
          </span>
          {row.isVerified ? (
            <span
              aria-label="Verified"
              title="Verified NEX account"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "var(--nex-world-secondary, #FFD700)",
                color: "var(--nex-world-drawer-bg, #050F1E)",
                fontSize: 9,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              ✓
            </span>
          ) : null}
        </div>

        {/* Profession on its own line · owner directive 2026-11-03 ·
            "the skill for user is just 1 word" · we strip the headline
            (everything after the middle-dot separator) and show only
            the leading profession token. Honest absence when null. */}
        {skillOnly(row.professionLine) ? (
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
            {skillOnly(row.professionLine)}
          </div>
        ) : null}

        {/* Owner directive 2026-11-09 · city gets its own full-width
            row so the locality name (e.g. "Wexford") reads clearly.
            Previous same-row layout squeezed it against the time. */}
        {row.city ? (
          <div
            data-nex-contacts-row-location
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              fontWeight: 700,
              color: NEX.text,
              lineHeight: 1.2,
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <MapPinIcon color={NEX.unreadRed} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {row.city}
            </span>
          </div>
        ) : null}

        {/* Owner directive 2026-11-09 · last-online label moves to
            lower-right of the card. Separate row, justify-end, so
            "Active 12m" sits below the location in the bottom-right
            corner of the text column. */}
        {lastOnlineLabel ? (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 2,
            }}
          >
            <span
              data-nex-contacts-row-last-online
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.2,
                whiteSpace: "nowrap",
                color: NEX.textMute,
              }}
            >
              {lastOnlineLabel}
            </span>
          </div>
        ) : null}
      </div>

      {/* ===== RIGHT-HAND ACTIONS · shop marker only (last-online
            lives in the location row per the owner's directive). ===== */}
      {hasShop ? (
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: AVATAR_SIZE,
          }}
        >
          <span
            aria-label={`Has shop · ${row.displayName}`}
            data-nex-contacts-row-shop-marker
            style={{
              fontSize: 22,
              lineHeight: 1,
              filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.6))`,
            }}
          >
            🛒
          </span>
        </div>
      ) : null}

    </Link>
  );
}

/** P0 engineering pass 2026-11-03 · hoist the heartbeat keyframes out
 *  of each row so a list of N contacts emits ONE style block, not N.
 *  Mounted once by `_contacts-shell.tsx` at the top of the content
 *  column; the `.contactRow` ref markers above resolve to this single
 *  shared keyframe definition. Visual behaviour is unchanged (same
 *  1200ms cubic-bezier timing · same scale/opacity curve). */
export const CONTACT_ROW_HEARTBEAT_KEYFRAMES = `
  @keyframes nex-contact-row-heartbeat {
    0% { transform: scale(1); opacity: 0.9; }
    75% { transform: scale(1.35); opacity: 0; }
    100% { transform: scale(1.35); opacity: 0; }
  }
`;

function resolveRimColor(
  presence: ContactRowDisplay["presence"] | null,
): string | null {
  if (presence === "online") return PRESENCE.online;
  if (presence === "away") return PRESENCE.busy;
  if (presence === "offline") return PRESENCE.offline;
  return null;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Owner directive 2026-11-03 · "the skill for user is just 1 word" ·
 *  extract the profession token (everything before the middle-dot
 *  separator) from a composed professionLine like "Electrician ·
 *  Residential rewires". Returns null when input is null/empty. */
function skillOnly(line: string | null | undefined): string | null {
  if (!line) return null;
  const [first] = line.split(/\s*·\s*/);
  const trimmed = (first ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Mirrors formatContactPresenceLabel from _contact-picker-data · null
 *  means "nothing honest to show" (online · unknown · no timestamp).
 *  Owner directive 2026-11-03 · "remove the ago" · labels are now
 *  tight: `23m` / `3h` / `Offline · 3m` / `Offline · 2d`. */
function presenceLabel(row: ContactRowDisplay): string | null {
  if (row.presence === "online") return "Active now";
  const mins = row.lastSeenMinsAgo;
  if (mins === null || mins === undefined) return null;
  // Owner directive 2026-11-09 · prefix with "Active" for away presence
  // (e.g. "Active 12m") so the lower-right label reads as a human
  // presence line, not a bare minute count.
  if (row.presence === "away") {
    if (mins < 60) return `Active ${mins}m`;
    return `Active ${Math.round(mins / 60)}h`;
  }
  if (mins < 60) return `Offline · ${mins}m`;
  if (mins < 60 * 24) return `Offline · ${Math.round(mins / 60)}h`;
  return `Offline · ${Math.round(mins / (60 * 24))}d`;
}

function MapPinIcon({ color }: { readonly color: string }): React.JSX.Element {
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
