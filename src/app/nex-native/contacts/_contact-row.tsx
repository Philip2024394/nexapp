// src/app/nex-native/contacts/_contact-row.tsx
//
// NEX contact-card identity layout · owner-sealed 2026-10-17.
// ----------------------------------------------------------------
// Standard identity-card structure for every contact row:
//
//   [avatar]  Contact Name                [Call] [Video] [Message]
//             NEX-324234
//             Electrician · Electrical Services
//
// Rules (owner-sealed verbatim):
//   · Name: the person's chosen display_name.
//   · NEX ID: prominent, uppercase "NEX-NNNNN" format · uses the
//     real nex_handle · uppercase prefix is a display transform
//     (storage stays lowercase per the sealed normaliseHandle
//     contract) · same transform used in ControlDrawer identity bar.
//   · Skill / employment: directly under the NEX ID · composed as
//     "profession · headline" with the NEX middle-dot · data comes
//     from nex_account_profile · NEVER fabricated · omitted entirely
//     when the person hasn't supplied a profession.
//   · Call + Video call: wired to the sealed peer-chat call stack
//     (/chat/peer/[accountId]?start_call=voice|video · _call-launcher
//     honours the query param · RTCPeerConnection + Supabase
//     Realtime signalling).
//   · Message: wired to the chat destination (chatHref). The
//     earlier "whole-card tap opens chat" behaviour is retired ·
//     owner directive 2026-10-17 (reversed) · the dedicated Message
//     button is the sole chat trigger now · one dedicated target per
//     action · no ambiguous click zones.
//
// Business rows carry professionLine=null today · a business-specific
// identity line (category · city) is a future pass. Call + Video
// icons stay disabled for business rows (business conversations don't
// carry a peer account the WebRTC stack can address). The Message
// button stays enabled for business rows (goes to the business
// conversation surface).
//
// Server Component.

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
  // Owner-sealed uppercase NEX ID transform · "nex-00042" → "NEX-00042".
  // Same transform as ControlDrawer identity bar. Storage stays
  // lowercase per the normaliseHandle contract.
  const nexId = row.handle ? row.handle.replace(/^nex-/i, "NEX-") : null;

  return (
    <div
      data-nex-contacts-row
      data-nex-contacts-row-kind={row.kind}
      style={{
        // Owner directive 2026-10-17 · "cards must fit mobile
        // screen width" · the 3 inline action buttons on the right
        // were squeezing the identity block to ~144px, truncating
        // the profession line with ellipsis. New structure stacks
        // the identity ROW (avatar + name/NEX-ID/profession) on
        // top of the actions ROW (Call · Video · Message) so each
        // row gets the full card width. Matches the owner's mock
        // from the identity-card spec.
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 12,
        background: NEX.panel,
        border: `1px solid ${NEX.cyanSoft}`,
      }}
    >
      {/* Row 1 · avatar + identity stack · full card width. */}
      <div
        data-nex-contacts-row-identity-row
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          minWidth: 0,
        }}
      >
        <Avatar avatarUrl={row.avatarUrl} initials={initials} />
        <div
          data-nex-contacts-row-identity
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          <div
            data-nex-contacts-row-name
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
          {nexId ? (
            <div
              data-nex-contacts-row-nex-id
              style={{
                // Owner directive 2026-10-17 · "NEX-00042 must be
                // bigger size" · 16px so the NEX ID is the hero
                // identifier (dominates the 14px name above).
                fontSize: 16,
                fontWeight: 700,
                lineHeight: 1.15,
                color: NEX.cyan,
                letterSpacing: 0.3,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, "Courier New", monospace',
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {nexId}
            </div>
          ) : null}
          {row.professionLine ? (
            <div
              data-nex-contacts-row-profession
              style={{
                fontSize: 11,
                color: NEX.textMuted,
                lineHeight: 1.3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {row.professionLine}
            </div>
          ) : null}
        </div>
      </div>

      {/* Row 2 · action icons · right-aligned on their own line so the
          identity block above gets the full card width. Call + Video
          wired to the sealed WebRTC stack for friend rows (business
          rows disable both · no peer account the stack can address).
          Message always wired to chatHref. */}
      <div
        data-nex-contacts-row-actions-row
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
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
        <ActionIcon
          href={row.chatHref}
          ariaLabel={`Message ${row.displayName}`}
          dataAttr="message"
          icon={<MessageIcon />}
          enabled
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

function MessageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
