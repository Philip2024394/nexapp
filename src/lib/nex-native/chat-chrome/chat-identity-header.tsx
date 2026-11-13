"use client";

// src/lib/nex-native/chat-chrome/chat-identity-header.tsx
//
// Shared chat-identity header primitive · the one place the "Joker look"
// (sealed PortraitBloomShell header, 2026-09-27 / bumped 2026-10-01) is
// defined. Every chat surface that wants the canonical header renders
// this component — authenticated peer chat, guest chat, theme viewers.
//
// Owns: avatar (56px with heartbeat presence ring), name (26px white
//       with soft text-shadow), optional subtitle (13px neutral grey),
//       optional NEX-verified pill.
// Does NOT own: outer <header> wrapper, safe-area padding, right-side
//               action cluster. Callers wrap and position this however
//               their surface needs.

import * as React from "react";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

export type ChatIdentityPresenceKind = "online" | "away" | "offline" | "none";

export interface ChatIdentityHeaderProps {
  /** Avatar image URL · null falls back to initials from displayName. */
  avatarUrl: string | null;
  /** Business or peer name · rendered as the 26px title line. */
  displayName: string;
  /** Second line beneath the name — "Chatting as guest", role, "typing…".
   *  Accepts ReactNode so callers can embed small icons if needed. */
  subtitle?: React.ReactNode;
  /** Presence state · drives the ring colour + heartbeat. Default online. */
  presenceKind?: ChatIdentityPresenceKind;
  /** Override the heartbeat ring colour (e.g. Joker's acid green). */
  heartbeatColor?: string;
  /** Override the solid presence rim colour · when supplied this
   *  wins over the presence-kind-derived default (universal green
   *  for online). Owner directive 2026-10-18 · chat theme previews
   *  tint the full rim to match the theme accent so the avatar
   *  visibly reads as "this theme on your chat". Real chat routes
   *  omit this prop and keep the universal green rim. */
  avatarRimColor?: string;
  /** When true renders the NEX cyan verified pill after the name. */
  isOfficial?: boolean;
  /** Right-side padding on the identity column so the title ellipses
   *  before colliding with an absolutely-positioned action cluster.
   *  Pass 150 when the shell has a HeaderRightCluster, 0 when it doesn't. */
  rightReserveWidth?: number;
  /** Tap handler · fired when the identity row is pressed. */
  onPress?: () => void;
  /** Optional href that turns the avatar into a link (e.g. Standard
   *  Experience routes avatar taps to a status viewer). Takes
   *  precedence over onPress on the avatar sub-element. */
  avatarHref?: string;
  /** Optional decorative node rendered at the bottom-right of the
   *  avatar (e.g. Theme-1 BlueCamera, Pink Dream PinkHeart). Themes
   *  may supply approved decorative charms via this slot without
   *  altering the sealed avatar chrome. */
  avatarDecoration?: React.ReactNode;
  /** Max line count for the display name · default 2 preserves the
   *  sealed 2-line wrap for user-chosen display names (migration
   *  204). Owner directive 2026-10-18 · chat theme previews pass 1
   *  so overlong theme names ellipsis cleanly instead of wrapping to
   *  a second line. */
  maxNameLines?: 1 | 2;
  /** Owner directive 2026-10-19 · optional override for the sealed
   *  26px name size. Preview surfaces pass 20 so overlong theme
   *  names (e.g. "Crispy Chicken") don't visually crowd the
   *  absolute-positioned side-drawer dots at the top-right. Real
   *  chat routes omit this prop and keep the sealed 26px. */
  nameFontSize?: number;
}

const NEX = {
  cyan: "#00AFFF",
  cyanDeep: "#063B67",
  green: "#16D66B",
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || parts[0].length === 0) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ChatIdentityHeader(
  props: ChatIdentityHeaderProps,
): React.JSX.Element {
  const presenceKind: ChatIdentityPresenceKind = props.presenceKind ?? "online";
  const heartbeatColor = props.heartbeatColor ?? NEX.green;
  const rightReserve = props.rightReserveWidth ?? 0;

  const presenceLabel =
    presenceKind === "online"
      ? "Online"
      : presenceKind === "away"
        ? "Away"
        : presenceKind === "offline"
          ? "Offline"
          : "";

  /* Owner directive 2026-10-18 · caller-supplied avatarRimColor wins
     over the presence-derived default. Preview surfaces pass the
     theme accent · real chat routes omit it and keep the sealed
     universal rim colours (green/amber/dim). */
  const ringColor =
    props.avatarRimColor ??
    (presenceKind === "online"
      ? NEX.green
      : presenceKind === "away"
        ? "#F59E0B"
        : presenceKind === "offline"
          ? "rgba(139,169,209,0.5)"
          : "rgba(139,169,209,0.3)");

  return (
    <>
      <style>{`
        @keyframes nex-chat-identity-heartbeat {
          0% { transform: scale(1); opacity: 0.9; }
          75% { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
      <div
        data-nex-chat-identity-header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
        }}
      >
      {/* 56×56 avatar · heartbeat ring + solid presence rim + image/initials.
          Rendered via a tiny helper so the sealed inner structure stays
          the same whether the caller wraps it in an <a> or a <div>. */}
      <AvatarShell
        avatarHref={props.avatarHref}
        onPress={props.onPress}
        presenceLabel={presenceLabel}
      >
        {presenceKind === "online" && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: -2,
              borderRadius: "50%",
              border: `2px solid ${heartbeatColor}`,
              animation:
                "nex-chat-identity-heartbeat 1200ms cubic-bezier(0.4, 0, 0.2, 1) infinite",
              pointerEvents: "none",
              willChange: "transform, opacity",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            overflow: "hidden",
            border: `2px solid ${ringColor}`,
            /* Owner directive 2026-10-18 · the outer glow halo tints
               to the same ringColor as the rim · preview surfaces
               passing avatarRimColor get a theme-coloured halo too
               (not just the inner rim). 22 (~13%) alpha keeps the
               glow subtle. */
            boxShadow:
              presenceKind === "online"
                ? `0 0 0 3px ${ringColor}22, 0 4px 14px rgba(0,0,0,0.6)`
                : "0 4px 14px rgba(0,0,0,0.6)",
            backgroundImage: props.avatarUrl
              ? `url(${props.avatarUrl})`
              : `linear-gradient(135deg, ${NEX.cyanDeep} 0%, #05101f 100%)`,
            backgroundSize: "cover",
            backgroundPosition: "center 22%",
            transition: "border-color 500ms ease, box-shadow 500ms ease",
          }}
        >
          {!props.avatarUrl && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                color: NEX.cyan,
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "0.06em",
                opacity: 0.9,
              }}
            >
              {initialsFromName(props.displayName)}
            </div>
          )}
        </div>
        {props.avatarDecoration && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              bottom: -4,
              right: -4,
              zIndex: 3,
              lineHeight: 0,
              pointerEvents: "none",
            }}
          >
            {props.avatarDecoration}
          </span>
        )}
      </AvatarShell>

      {/* Right column · name over subtitle · reserved width so action
          clusters at the absolute edge don't force the name to overflow.
          Owner directive 2026-11-13 · explicit flex column so the
          subtitle ("Shop · tap to open") always stacks UNDER the name
          regardless of name length, avoiding any browser default-block
          quirks where the subtitle could land flush next to a short
          name on certain scales. */}
      <div
        style={{
          minWidth: 0,
          flex: 1,
          paddingRight: rightReserve,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <div
            data-nex-chat-identity-name
            style={{
              // Owner directive 2026-10-19 · explicitly apply the sealed
              // NEX_FONT_SANS stack here. Without this the name inherited
              // from <body> which has no fontFamily rule in layout.tsx ·
              // Windows browsers fell back to a default serif that
              // rendered fontWeight:700 as thin-looking. Pointing at
              // Inter/system-ui restores the sealed "bold" appearance.
              fontFamily: NEX_FONT_SANS,
              fontSize: props.nameFontSize ?? 26,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
              color: "#FFFFFF",
              textShadow: "0 1px 3px rgba(0,0,0,0.65)",
              minWidth: 0,
              // 2026-10-17 · owner-authorised 2-line wrap for user-
              // chosen display names (migration 204). All other sealed
              // chat-identity properties unchanged. See memory
              // feedback_nex_chat_master_layout_rule.md for the
              // sealed primitive doctrine addendum.
              // 2026-10-18 · owner directive · preview surfaces pass
              // maxNameLines=1 so overlong theme names ellipsis
              // instead of wrapping ("Crispy Chicken" is the
              // reference max · ~14 chars).
              // Owner directive 2026-11-13 · pre-line honours explicit
              // `\n` in displayName (shop-face 2-word names pass
              // "Handbags\ndirect" so the second word sits under the
              // first instead of truncating to "Handbags dir…").
              // Existing names without `\n` behave the same as the
              // retired `normal` value · word-boundary line breaks
              // still work naturally.
              whiteSpace: (props.maxNameLines ?? 2) === 1 ? "nowrap" : "pre-line",
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: props.maxNameLines ?? 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              flexShrink: 1,
            }}
          >
            {props.displayName}
          </div>
          {props.isOfficial && <OfficialBadge />}
        </div>
        {props.subtitle && (
          <div
            data-nex-chat-identity-subtitle
            style={{
              fontFamily: NEX_FONT_SANS,
              marginTop: 2,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: "#B4BAC3",
              textShadow:
                "0 0 2px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.5)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {props.subtitle}
          </div>
        )}
      </div>
      </div>
    </>
  );
}

function AvatarShell({
  avatarHref,
  onPress,
  presenceLabel,
  children,
}: {
  avatarHref?: string;
  onPress?: () => void;
  presenceLabel: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const style: React.CSSProperties = {
    position: "relative",
    flexShrink: 0,
    width: 56,
    height: 56,
    cursor: avatarHref || onPress ? "pointer" : undefined,
    display: "block",
    textDecoration: "none",
  };
  if (avatarHref) {
    return (
      <a
        href={avatarHref}
        aria-label={presenceLabel || undefined}
        title={presenceLabel || undefined}
        style={style}
      >
        {children}
      </a>
    );
  }
  return (
    <div
      aria-label={presenceLabel || undefined}
      title={presenceLabel || undefined}
      onClick={onPress}
      style={style}
    >
      {children}
    </div>
  );
}

function OfficialBadge(): React.JSX.Element {
  return (
    <span
      aria-label="Official NEX support account"
      title="Official NEX · verified"
      style={{
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 999,
        background: NEX.cyan,
        color: "#0B0F1A",
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        lineHeight: 1,
      }}
    >
      <svg
        width="9"
        height="9"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M5 12 L10 17 L20 6" />
      </svg>
      NEX
    </span>
  );
}
