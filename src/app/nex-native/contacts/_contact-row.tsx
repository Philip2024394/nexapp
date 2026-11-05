// src/app/nex-native/contacts/_contact-row.tsx
//
// Owner directive 2026-10-23 · "the contacts cards on the contact
// page should be the same cards on the contact slider same design
// style text exactly same and should follow the chat theme color
// from home page chat screen".
//
// Mirrors `/free-chat` ContactPickerSheet > ContactCard verbatim:
//   · Chip overlapping container top-left (round, accent gradient)
//   · Container accent-rim, navy fill, name on the rim (translateY)
//   · Presence heartbeat ring (online/busy only · offline is static)
//   · Unread badge · verified pill · shop 🛒 marker
//   · Profession · city with red map-pin · last-online text
//
// Differences from the picker:
//   · No hold-to-send ritual · the whole card is a <Link> to chatHref
//   · No invite/share CTAs · tap = open chat
//   · Fields are OPTIONAL on the real contact rows · the card omits
//     anything that's null (honest absence, no fabrication)
//
// Server Component · no hooks.
//
// The visual tokens below MUST stay byte-identical to the picker's
// ContactCard so the two surfaces read as one vocabulary. If the
// picker evolves, port the diff here deliberately.
//
// Data model is `ContactRowDisplay` from _contacts-list.ts.

import type * as React from "react";
import Link from "next/link";
import type { ContactRowDisplay } from "./_contacts-list";
// Phase V · P15 · 2026-11-05 · Social-to-Shop Discovery · clickable
// Shop button on the bottom-right of the avatar when the contact has
// a published shop. Honest condition: only renders when shopHref is
// resolved server-side.
import { AvatarShopBadge } from "@/components/nex-native/shop/AvatarShopBadge";

const NEX = {
  bgNavy: "var(--nex-world-drawer-bg, #050F1E)",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  // Presence vocabulary — identical palette to the picker.
  presenceOnline: "#16D66B",
  presenceBusy: "#FF7200",
  presenceOffline: "#A60000",
  unreadRed: "#B30000",
};

interface ContactRowProps {
  readonly row: ContactRowDisplay;
  /**
   * Owner directive 2026-10-23 · chat-theme accent · resolved on
   * the server from the nex-free-chat-wallpaper cookie. Applied to
   * the rim, chip gradient, name text-shadow and heartbeat ring so
   * the contacts list reads as part of the same chat vocabulary.
   */
  readonly accentHex: string;
}

export function ContactRow({ row, accentHex }: ContactRowProps) {
  const initials =
    row.initials && row.initials.trim().length > 0
      ? row.initials.toUpperCase()
      : initialsFromName(row.displayName);
  const presence = row.presence ?? null;
  const ringColor =
    presence === "online"
      ? NEX.presenceOnline
      : presence === "away"
        ? NEX.presenceBusy
        : NEX.presenceOffline;
  const hasShop = row.hasShop === true;
  const lastOnlineLabel = presenceLabel(row);

  return (
    <Link
      href={row.chatHref}
      aria-label={`Open chat with ${row.displayName}`}
      data-nex-contacts-row
      data-nex-contacts-row-kind={row.kind}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: "2px 48px 2px 70px",
        width: "100%",
        boxSizing: "border-box",
        background: "rgba(2,9,20,0.92)",
        border: `1.5px solid ${accentHex}`,
        borderRadius: 10,
        boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
        textDecoration: "none",
        color: NEX.text,
        overflow: "visible",
        WebkitTapHighlightColor: "transparent",
        marginTop: 14,
      }}
    >
      {/* Chip · overlapping top-left · round · accent gradient. */}
      <div
        aria-hidden
        data-nex-contacts-row-chip
        style={{
          position: "absolute",
          top: -24,
          left: 12,
          width: 48,
          height: 48,
          flexShrink: 0,
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
          {row.avatarUrl ? (
            <img
              src={row.avatarUrl}
              alt=""
              aria-hidden
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
        {/* Heartbeat ring — only when presence is known and non-offline.
            Picker: offline renders a static dark-red rim with no ping.
            Honest absence: when presence is null, no ring at all. */}
        {presence === "online" || presence === "away" ? (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: -3,
              borderRadius: "50%",
              border: `2px solid ${ringColor}`,
              animation:
                "nex-contact-row-heartbeat 1200ms cubic-bezier(0.4,0,0.2,1) infinite",
              pointerEvents: "none",
            }}
          />
        ) : null}
        {/* Phase V · P15 · 2026-11-05 · AvatarShopBadge · bottom-right
            of the 48×48 avatar chip. Isolated tap target · stopPropagation
            keeps the parent card <Link> (open-chat) from firing when the
            badge is tapped. Only mounts when hasShop + shopHref resolve. */}
        {hasShop && row.shopHref ? (
          <AvatarShopBadge
            shopHref={row.shopHref}
            sellerName={row.displayName}
            avatarPx={48}
            accentHex={accentHex}
          />
        ) : null}
        {/* Unread badge · top-right of chip. */}
        {row.unreadCount && row.unreadCount > 0 ? (
          <div
            aria-label={`${row.unreadCount} unread`}
            data-nex-contacts-row-unread-badge
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              minWidth: 20,
              height: 20,
              padding: "0 5px",
              borderRadius: 999,
              background: NEX.unreadRed,
              border: `2px solid ${NEX.bgNavy}`,
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

      {/* Shop 🛒 marker · same conditional positioning as the picker:
          centred vertically on online cards (no last-online text), pinned
          to the top on non-online cards (last-online text occupies the
          bottom-right). */}
      {hasShop ? (
        <span
          aria-label={`Has shop · ${row.displayName}`}
          data-nex-contacts-row-shop-marker
          data-nex-contacts-row-shop-position={
            presence === "online" ? "centre" : "top"
          }
          style={
            presence === "online"
              ? {
                  position: "absolute",
                  top: "50%",
                  right: 10,
                  transform: "translateY(-50%)",
                  width: 32,
                  height: 32,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 26,
                  lineHeight: 1,
                  zIndex: 2,
                  pointerEvents: "none",
                  filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.6))`,
                }
              : {
                  position: "absolute",
                  top: 4,
                  right: 10,
                  width: 32,
                  height: 32,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 26,
                  lineHeight: 1,
                  zIndex: 2,
                  pointerEvents: "none",
                  filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.6))`,
                }
          }
        >
          🛒
        </span>
      ) : null}

      {/* Identity text · translateY lifts the whole block up so the
          name sits visually on the container's rim · matches the picker
          sheet treatment byte-for-byte. */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          position: "relative",
          zIndex: 1,
          transform: "translateY(-12px)",
        }}
      >
        {/* Name + verified pill. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            minWidth: 0,
          }}
        >
          <div
            data-nex-contacts-row-name
            style={{
              /* Owner directive 2026-10-24 · span-mask treatment ·
                 inner <span> carries the shell-navy background so
                 the cyan rim line at the top of the card is MASKED
                 behind the name text (same pattern applied to the
                 inbound invite rows + outbound pending row). */
              fontSize: 15,
              fontWeight: 800,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <span
              style={{
                display: "inline-block",
                background: NEX.bgNavy,
                color: NEX.text,
                padding: "0 6px",
                lineHeight: 1.2,
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.displayName}
            </span>
          </div>
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
                background: "#FFD700",
                color: NEX.bgNavy,
                fontSize: 9,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              ✓
            </span>
          ) : null}
        </div>
        {/* Profession on its own line · null = omit (honest absence). */}
        {row.professionLine ? (
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
            {row.professionLine}
          </div>
        ) : null}
        {/* City row · red map-pin + text · stacks under profession. */}
        {row.city ? (
          <div
            data-nex-contacts-row-location
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
            }}
          >
            <MapPinIcon color={NEX.unreadRed} />
            <span>{row.city}</span>
          </div>
        ) : null}
      </div>

      {/* Last-online text · bottom-right · only for non-online with a
          known timestamp. Same slot as the picker. */}
      {lastOnlineLabel ? (
        <div
          data-nex-contacts-row-last-online
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
          {lastOnlineLabel}
        </div>
      ) : null}

      <style>{`
        @keyframes nex-contact-row-heartbeat {
          0% { transform: scale(1); opacity: 0.9; }
          75% { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(1.35); opacity: 0; }
        }
      `}</style>
    </Link>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Mirrors formatContactPresenceLabel from _contact-picker-data so the
 *  two surfaces say the same thing. Returns null when there's nothing
 *  honest to show (online → no label needed · presence or timestamp
 *  unknown → omit rather than fabricate). */
function presenceLabel(row: ContactRowDisplay): string | null {
  if (row.presence === "online") return null;
  const mins = row.lastSeenMinsAgo;
  if (mins === null || mins === undefined) return null;
  if (row.presence === "away") {
    if (mins < 60) return `${mins}m ago`;
    return `${Math.round(mins / 60)}h ago`;
  }
  if (mins < 60) return `Offline · ${mins}m ago`;
  if (mins < 60 * 24) return `Offline · ${Math.round(mins / 60)}h ago`;
  return `Offline · ${Math.round(mins / (60 * 24))}d ago`;
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
