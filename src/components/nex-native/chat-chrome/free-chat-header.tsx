"use client";

// src/components/nex-native/chat-chrome/free-chat-header.tsx
//
// Shared Chat 9001 header primitive. Owner-authorised 2026-11-04
// later-same-day · Option B refactor · "ONE shared implementation,
// not duplicated headers and footers".
// -----------------------------------------------------------------------------
// This component carries the EXACT inline header JSX that previously
// lived at /nex-native/free-chat/page.tsx (lines 325-416). Purely
// mechanical extraction · zero visual or behavioural change to Chat
// 9001. Peer chats also mount this component so every NEX chat
// surface renders from one source of truth.
//
// Owner safeguards honoured (2026-11-04):
//   · NexPingBadge · avatar overlay · wordmark · subtitle · HeaderSearch
//     · ControlDrawer all preserved exactly as the original inline JSX.
//   · Same data-attributes (data-nex-free-chat-header*) so sealed test
//     selectors and CSS continue to resolve.
//   · All existing props flow through (session · displayName · subtitle
//     · avatar · accent).
//   · FreeChatCallCenterDrawerClient is NOT part of this component ·
//     it stays mounted separately by the caller (outside the header
//     element) so free-chat and peer-chat both keep the 3-dot FAB.

import * as React from "react";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import {
  ControlDrawer,
  type ControlDrawerSession,
} from "@/components/nex-native/control-drawer/control-drawer-client";
// Owner directive 2026-11-05 · HeaderSearch (Discovery icon) retired
// from the chat header right-nav. Discovery destination moved into the
// right-side ControlDrawer (YOUR_NEX_ROWS) so the header runs cleaner
// with just [ bell · + ].

export interface FreeChatHeaderProps {
  /** Wordmark line · "NEX" for guests, display_name for signed-in,
   *  peer.display_name for peer chats. */
  readonly displayName: string;
  /** Subtitle line · "NEX - Guest" for guests, nex-handle for signed-in,
   *  profession or presence for peer chats. */
  readonly subtitle: string;
  /** Avatar overlay URL · optional · null → ping badge shows alone. */
  readonly avatarUrl: string | null;
  /** Drawer session passed to ControlDrawer · null → drawer shows the
   *  sealed sign-in prompt. */
  readonly drawerSession: ControlDrawerSession | null;
  /** NEX ping badge accent · matches the surface's theme. Defaults to
   *  the Ireland world's secondary (gold) with cyan fallback. */
  readonly pingBadgeAccent?: string;
  /** Primary text colour. Defaults to the sealed free-chat #F2F5F8 ink. */
  readonly textColor?: string;
  /** Subtitle text colour. Defaults to the sealed free-chat #B5C3D6 dim. */
  readonly subtitleColor?: string;
  /** Owner-authored 2026-11-05 · optional slot rendered FIRST in the
   *  right-nav cluster (before HeaderSearch and the "+" ControlDrawer)
   *  so chat surfaces can attach a NotificationsDrawer bell inline
   *  rather than as a standalone absolute-positioned overlay that
   *  clashes with the ping-badge avatar. Pass an inline-friendly
   *  element (e.g. `<NotificationsDrawer inline />`). */
  readonly notificationsSlot?: React.ReactNode;
  /** Owner directive 2026-11-05 later-same-day · when set to a peer
   *  account id, the avatar renders the sealed presence rim (green
   *  pulse = online · orange pulse = busy · dark red static = offline)
   *  by subscribing to the `nex-peer-presence` window event already
   *  dispatched by PeerPresenceClient. Non-peer surfaces (free-chat
   *  home) omit this prop and keep the plain avatar. */
  readonly peerAccountId?: string;
}

const DEFAULT_PING_ACCENT = "var(--nex-world-secondary, #00AFFF)";
const DEFAULT_TEXT = "#F2F5F8";
const DEFAULT_SUBTITLE = "#B5C3D6";

export function FreeChatHeader({
  displayName,
  subtitle,
  avatarUrl,
  drawerSession,
  pingBadgeAccent = DEFAULT_PING_ACCENT,
  textColor = DEFAULT_TEXT,
  subtitleColor = DEFAULT_SUBTITLE,
  notificationsSlot,
  peerAccountId,
}: FreeChatHeaderProps): React.JSX.Element {
  // Owner directive 2026-11-05 later-same-day · sealed presence rim on
  // the peer avatar · subscribes to the `nex-peer-presence` window
  // event dispatched by PeerPresenceClient. States follow the sealed
  // avatar-rim doctrine (feedback_nex_avatar_presence_rim_not_dot.md):
  //   online  → #16D66B green rim + 1200ms heartbeat pulse
  //   busy    → #FF7200 orange rim + 1200ms heartbeat pulse
  //   offline → #A60000 dark-red static rim
  //   unknown → honest neutral white rim
  const [peerKind, setPeerKind] = React.useState<
    "online" | "busy" | "offline" | "unknown"
  >("unknown");
  React.useEffect(() => {
    if (!peerAccountId) return;
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{
        roster?: Array<{
          accountId: string;
          kind: "online" | "busy" | "offline";
        }>;
      }>;
      const roster = custom.detail?.roster;
      if (!Array.isArray(roster)) return;
      const peer = roster.find((r) => r.accountId === peerAccountId);
      setPeerKind(peer ? peer.kind : "offline");
    };
    window.addEventListener("nex-peer-presence", handler as EventListener);
    return () =>
      window.removeEventListener("nex-peer-presence", handler as EventListener);
  }, [peerAccountId]);
  const rimColor =
    peerKind === "online"
      ? "#16D66B"
      : peerKind === "busy"
        ? "#FF7200"
        : peerKind === "offline"
          ? "#A60000"
          // Owner directive 2026-11-05 later-same-day iter 3 · "unknown"
          // = no presence signal received yet · transparent rim so the
          // avatar reads clean until the roster arrives, rather than
          // showing a cream semi-transparent ring that competes with
          // the Ireland palette.
          : "transparent";
  const hasRimPulse = peerKind === "online" || peerKind === "busy";
  return (
    <header
      data-nex-free-chat-header
      style={{
        padding:
          "calc(env(safe-area-inset-top, 0px) + 20px) 12px 14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
      }}
    >
      <div
        data-nex-free-chat-header-avatar-slot
        data-nex-free-chat-header-peer-kind={peerAccountId ? peerKind : undefined}
        style={{ position: "relative", width: 48, height: 48, flexShrink: 0 }}
      >
        {/* Owner directive 2026-11-05 later-same-day iter 3 · on peer
            chat surfaces the avatar represents the peer, not NEX, so
            the NexPingBadge brand mark steps aside and the sealed
            presence rim (green/orange/dark-red) owns the avatar
            decoration. Non-peer surfaces (free-chat home where the
            avatar IS NEX) keep the ping badge. */}
        {peerAccountId ? null : (
          <NexPingBadge
            size={48}
            accent={pingBadgeAccent}
            dataTestId="free-chat-nex"
          />
        )}
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={displayName}
            data-nex-free-chat-header-avatar
            style={{
              position: "absolute",
              top: 3,
              left: 3,
              width: 42,
              height: 42,
              borderRadius: "50%",
              objectFit: "cover",
              pointerEvents: "none",
            }}
          />
        ) : null}
        {peerAccountId ? (
          <>
            {/* Sealed presence rim · owner directive 2026-11-05 ·
                sits just outside the avatar circle. Static for offline,
                heartbeat pulse for online/busy. */}
            <div
              aria-hidden
              data-nex-free-chat-header-peer-rim
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 48,
                height: 48,
                borderRadius: "50%",
                // Owner directive 2026-11-05 later-same-day iter 4 ·
                // rim thickness bumped 2px → 3px so the presence
                // signal reads more deliberately against the dark
                // Ireland chat palette.
                border: `3px solid ${rimColor}`,
                pointerEvents: "none",
              }}
            />
            {hasRimPulse ? (
              <>
                <div
                  aria-hidden
                  data-nex-free-chat-header-peer-rim-pulse
                  style={{
                    position: "absolute",
                    top: -3,
                    left: -3,
                    width: 54,
                    height: 54,
                    borderRadius: "50%",
                    border: `3px solid ${rimColor}`,
                    animation:
                      "nex-free-chat-header-peer-rim-pulse 1200ms cubic-bezier(0.4,0,0.2,1) infinite",
                    pointerEvents: "none",
                  }}
                />
                <style>{`
                  @keyframes nex-free-chat-header-peer-rim-pulse {
                    0% { transform: scale(1); opacity: 0.9; }
                    100% { transform: scale(1.35); opacity: 0; }
                  }
                `}</style>
              </>
            ) : null}
          </>
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minWidth: 0,
          flex: 1,
        }}
      >
        <span
          data-nex-free-chat-header-wordmark
          style={{
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: "-0.005em",
            color: textColor,
            lineHeight: 1.1,
            textShadow: "0 1px 3px rgba(0,0,0,0.5)",
            overflow: "hidden",
            whiteSpace: "nowrap",
            display: "block",
          }}
        >
          {displayName}
        </span>
        <span
          data-nex-free-chat-header-subtitle
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: subtitleColor,
            lineHeight: 1.2,
            textShadow: "0 1px 2px rgba(0,0,0,0.45)",
            overflow: "hidden",
            whiteSpace: "nowrap",
            display: "block",
          }}
        >
          {subtitle}
        </span>
      </div>
      <nav
        data-nex-free-chat-header-drawers
        aria-label="Chat header actions"
        style={{
          display: "inline-flex",
          alignItems: "center",
          // Owner directive 2026-11-05 · breathing room between the
          // gold notifications pill and the gold "+" pill so they read
          // as two deliberate buttons, not a single stuck-together
          // chip. Bumped from 2 → 10.
          gap: 10,
          flexShrink: 0,
        }}
      >
        {notificationsSlot}
        <div style={{ display: "inline-flex" }}>
          <ControlDrawer
            session={drawerSession}
            triggerIcon="plus"
            /* Owner directive 2026-11-05 later-same-day iter 2 ·
               header buttons go SOLID BLACK (no translucency, no
               blur). Hairline white border + gold inner ring kept
               for definition against the chat wallpaper. */
            triggerStyle={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#000000",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              color: "#FFFFFF",
              boxShadow:
                "0 6px 18px rgba(0,0,0,0.55), inset 0 0 0 1px color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 24%, transparent)",
            }}
          />
        </div>
      </nav>
    </header>
  );
}
