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
import { HeaderSearch } from "@/components/nex-native/chat-chrome/header-search";

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
}: FreeChatHeaderProps): React.JSX.Element {
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
        style={{ position: "relative", width: 48, height: 48, flexShrink: 0 }}
      >
        <NexPingBadge
          size={48}
          accent={pingBadgeAccent}
          dataTestId="free-chat-nex"
        />
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
          gap: 2,
          flexShrink: 0,
        }}
      >
        {notificationsSlot}
        <HeaderSearch />
        <div style={{ display: "inline-flex" }}>
          <ControlDrawer
            session={drawerSession}
            triggerIcon="plus"
            /* Owner directive 2026-11-05 · the "+" trigger reads as a
               round button matching the page-header styling · gold
               circle · dark emerald glyph. Consistent across every
               chat surface that mounts FreeChatHeader (prototype +
               Chat Header 99901). */
            triggerStyle={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--nex-world-secondary, #C6A15B)",
              color: "var(--nex-world-drawer-bg, #123D2B)",
              boxShadow: "0 2px 8px rgba(10, 31, 21, 0.35)",
              border: "none",
            }}
          />
        </div>
      </nav>
    </header>
  );
}
