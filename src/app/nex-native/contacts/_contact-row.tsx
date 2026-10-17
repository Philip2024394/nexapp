// src/app/nex-native/contacts/_contact-row.tsx
//
// Single contact row · matches the template proportions:
//   · 40px round avatar left (initials fallback if no avatarUrl)
//   · Name + handle (grey) middle
//   · 3 round action icons right · chat (wired) + call + video
//     (both shown but disabled per D3)
//
// Decisions sealed here:
//   · D1 · no city displayed · last_known_city_label never surfaced
//   · D2 · no presence dot · nex_presence does not exist
//   · D3 · chat enabled · call+video rendered as disabled affordances
//          (aria-disabled, grey style, no href) · never a 404 tap
//
// Server Component · each row is a Link to the chat destination.

import type * as React from "react";
import Link from "next/link";
import type { ContactRowDisplay } from "./_contacts-list";

const NEX = {
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.30)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  textPrimary: "#F2F5F8",
  textMuted: "#7D9BC0",
  panel: "rgba(3, 16, 29, 0.72)",
  disabledFg: "rgba(125, 155, 192, 0.45)",
  disabledBorder: "rgba(125, 155, 192, 0.20)",
};

interface ContactRowProps {
  readonly row: ContactRowDisplay;
}

export function ContactRow({ row }: ContactRowProps) {
  const initials = initialsFromName(row.displayName);
  return (
    <div
      data-nex-contacts-row
      data-nex-contacts-row-kind={row.kind}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 12,
        background: NEX.panel,
        border: `1px solid ${NEX.cyanSoft}`,
      }}
    >
      {/* Avatar · 40px round · image or initials fallback. */}
      <Avatar avatarUrl={row.avatarUrl} initials={initials} />

      {/* Name + handle · no city (D1) · no status (D2). */}
      <Link
        href={row.chatHref}
        data-nex-contacts-row-name-link
        style={{
          flex: 1,
          minWidth: 0,
          textDecoration: "none",
          color: "inherit",
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: NEX.textPrimary,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {row.displayName}
        </div>
        {row.handle ? (
          <div
            style={{
              fontSize: 11,
              color: NEX.textMuted,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {row.kind === "friend" ? `@${row.handle}` : row.handle}
          </div>
        ) : null}
      </Link>

      {/* Three action icons · chat + voice + video all wired to the
          sealed existing peer-chat call stack (owner-authorised
          2026-10-17 · "connected to our video and call software").
          The target page `/chat/peer/[accountId]` has a sealed
          _call-launcher that honours ?start_call=voice|video on
          mount and triggers startVoiceCall / startVideoCall on
          the proven RTCPeerConnection + Supabase Realtime stack.
          Only friend-kind rows get calls · business conversations
          don't carry a `peer accountId` the call stack can address. */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <ActionIcon
          href={row.chatHref}
          ariaLabel="Open chat"
          dataAttr="chat"
          icon={<ChatIcon />}
          enabled
        />
        <ActionIcon
          href={row.kind === "friend" ? `/nex-native/chat/peer/${row.id}?start_call=voice` : undefined}
          ariaLabel={row.kind === "friend" ? `Voice call ${row.displayName}` : "Voice call not available on business contacts"}
          dataAttr="call"
          icon={<PhoneIcon />}
          enabled={row.kind === "friend"}
        />
        <ActionIcon
          href={row.kind === "friend" ? `/nex-native/chat/peer/${row.id}?start_call=video` : undefined}
          ariaLabel={row.kind === "friend" ? `Video call ${row.displayName}` : "Video call not available on business contacts"}
          dataAttr="video"
          icon={<VideoIcon />}
          enabled={row.kind === "friend"}
        />
      </div>
    </div>
  );
}

function Avatar({ avatarUrl, initials }: { readonly avatarUrl: string | null; readonly initials: string }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        aria-hidden
        data-nex-contacts-row-avatar
        style={{
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: "50%",
          objectFit: "cover",
          border: `1px solid ${NEX.cyanSoft}`,
          background: NEX.cyanFaint,
        }}
      />
    );
  }
  return (
    <div
      aria-hidden
      data-nex-contacts-row-avatar-initials
      style={{
        flexShrink: 0,
        width: 40,
        height: 40,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        border: `1px solid ${NEX.cyanSoft}`,
        background: NEX.cyanFaint,
        color: NEX.cyan,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.04em",
      }}
    >
      {initials}
    </div>
  );
}

interface ActionIconProps {
  readonly href?: string;
  readonly ariaLabel: string;
  readonly dataAttr: string;
  readonly icon: React.ReactElement;
  readonly enabled: boolean;
}

function ActionIcon({ href, ariaLabel, dataAttr, icon, enabled }: ActionIconProps) {
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: "50%",
    textDecoration: "none",
    border: `1px solid ${enabled ? NEX.cyanSoft : NEX.disabledBorder}`,
    background: enabled ? NEX.cyanFaint : "transparent",
    color: enabled ? NEX.cyan : NEX.disabledFg,
    cursor: enabled ? "pointer" : "not-allowed",
  };
  if (enabled && href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel}
        data-nex-contacts-row-action={dataAttr}
        data-nex-contacts-row-action-state="enabled"
        style={style}
      >
        {icon}
      </Link>
    );
  }
  return (
    <span
      aria-label={ariaLabel}
      aria-disabled="true"
      role="button"
      title={ariaLabel}
      data-nex-contacts-row-action={dataAttr}
      data-nex-contacts-row-action-state="disabled"
      style={style}
    >
      {icon}
    </span>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}
