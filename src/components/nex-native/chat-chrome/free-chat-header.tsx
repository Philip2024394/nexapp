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
// Owner directive 2026-11-05 iter 22 · magnifier added to the header
// right-nav · opens a search dropdown that submits to /nex-feed?q=.
import { NexLiveSearchButton } from "@/components/nex-native/chat-chrome/nex-live-search-button";

/** Owner directive 2026-11-06 · when the peer owns a shop the header
 *  renders a small 🏪 badge inline with their chat name · tap opens
 *  the shop. Callers thread a ready-rendered ShopBadge component
 *  (variant="inline" or "pill") so this chrome stays presentational. */
export interface FreeChatHeaderProps {
  /** Wordmark line · "NEX" for guests, display_name for signed-in,
   *  peer.display_name for peer chats. */
  readonly displayName: string;
  /** Optional inline badge rendered after the display name · typically
   *  the peer's shop 🏪 pill (owner directive 2026-11-06). Null = no
   *  badge. */
  readonly nameBadge?: React.ReactNode;
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
  /** Owner directive 2026-11-05 later-same-day iter 8 · when set, the
   *  inline ControlDrawer surfaces a "Shared media" row routed to this
   *  href. Peer chat passes `/nex-native/chat/peer/<id>/media`. */
  readonly peerSharedMediaHref?: string;
  /** Owner directive 2026-11-05 iter 24 · hides the NEX Live magnifier
   *  search button. Non-feed surfaces (peer chat · free-chat home)
   *  pass `true` so the magnifier is live ONLY on feed surfaces. */
  readonly hideMagnifier?: boolean;
  /** Owner directive 2026-11-05 iter 26 · forwarded to the inline
   *  ControlDrawer so Discovery can self-hide on "live" and future
   *  surfaces can apply their own tiny context tweaks. Chat surfaces
   *  pass "chat" · live surfaces pass "live" via their own ControlDrawer
   *  mount, not through this header. */
  readonly currentSurface?: "live" | "chat" | "profile" | null;
  /** Owner directive 2026-11-05 iter 27 · commit 3 · forwarded to the
   *  inline ControlDrawer so the IdentityBar can render the visitor's
   *  provisional nex-id when the viewer isn't signed in but has a
   *  valid nex_session cookie. */
  readonly drawerVisitor?: {
    readonly accountId: string;
    readonly nexHandle: string;
    readonly displayName: string;
  } | null;
}

// Owner directive 2026-11-11 · chat header ping is GREEN across every
// theme · matches the sealed presence-online colour used in contacts
// and the preview-modal theme pings. Overrides the per-world accent
// so the ping is a consistent presence signal, not a theme accent.
const DEFAULT_PING_ACCENT = "#16D66B";
const DEFAULT_TEXT = "#F2F5F8";
const DEFAULT_SUBTITLE = "#B5C3D6";

export function FreeChatHeader({
  displayName,
  nameBadge,
  subtitle,
  avatarUrl,
  drawerSession,
  pingBadgeAccent = DEFAULT_PING_ACCENT,
  textColor = DEFAULT_TEXT,
  subtitleColor = DEFAULT_SUBTITLE,
  notificationsSlot,
  peerAccountId,
  peerSharedMediaHref,
  hideMagnifier,
  currentSurface,
  drawerVisitor,
}: FreeChatHeaderProps): React.JSX.Element {
  // Owner directive 2026-11-05 later-same-day iter 5 · sealed
  // NexPingBadge is restored on peer chat · colored rim retired. The
  // only presence signal is a PULSE animation on the sealed rim when
  // the peer is online. Offline / busy / unknown → no pulse, static
  // rim. Subscription to `nex-peer-presence` kept for the pulse gate.
  const [peerOnline, setPeerOnline] = React.useState<boolean>(false);
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
      setPeerOnline(peer?.kind === "online");
    };
    window.addEventListener("nex-peer-presence", handler as EventListener);
    return () =>
      window.removeEventListener("nex-peer-presence", handler as EventListener);
  }, [peerAccountId]);
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
        data-nex-free-chat-header-peer-online={
          peerAccountId ? (peerOnline ? "true" : "false") : undefined
        }
        style={{ position: "relative", width: 48, height: 48, flexShrink: 0 }}
      >
        {/* Owner directive 2026-11-05 later-same-day iter 5 · sealed
            NexPingBadge always renders · colored rim retired. */}
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
        {/* Owner directive 2026-11-05 later-same-day iter 5 · when the
            peer is online, a single pulse ring expands outward from
            the sealed rim using its own accent colour so the ping
            visually belongs to the NexPingBadge. Offline / busy /
            unknown → no pulse (static sealed rim only). */}
        {peerAccountId && peerOnline ? (
          <>
            <div
              aria-hidden
              data-nex-free-chat-header-peer-online-pulse
              style={{
                position: "absolute",
                top: -2,
                left: -2,
                width: 52,
                height: 52,
                borderRadius: "50%",
                border: `2px solid ${pingBadgeAccent}`,
                animation:
                  "nex-free-chat-header-peer-online-pulse 1200ms cubic-bezier(0.4,0,0.2,1) infinite",
                pointerEvents: "none",
              }}
            />
            <style>{`
              @keyframes nex-free-chat-header-peer-online-pulse {
                0% { transform: scale(1); opacity: 0.85; }
                100% { transform: scale(1.35); opacity: 0; }
              }
            `}</style>
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
            // Owner directive 2026-11-13 · pre-line honours the `\n`
            // in shop display names ("Handbags\ndirect") so 2-word
            // shop names stack above the subtitle instead of
            // truncating to one line. Names without `\n` behave
            // identically to the retired `nowrap` for all non-shop
            // chat surfaces.
            whiteSpace: "pre-line",
            display: "block",
          }}
        >
          {displayName}
        </span>
        {nameBadge ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              marginTop: 2,
              marginBottom: 2,
            }}
          >
            {nameBadge}
          </span>
        ) : null}
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
        {hideMagnifier ? null : <NexLiveSearchButton />}
        <div style={{ display: "inline-flex" }}>
          <ControlDrawer
            session={drawerSession}
            triggerIcon="plus"
            peerSharedMediaHref={peerSharedMediaHref}
            currentSurface={currentSurface}
            drawerVisitor={drawerVisitor}
            /* Owner directive 2026-11-12 · side-drawer trigger "+"
               flipped to BLACK with WHITE icon globally. Matches the
               sealed TRIGGER_STYLE in _page-header-drawer-button-client
               so Settings / Directory / Contacts / Chat / Free Chat
               all carry the same drawer button treatment. Previous
               2026-11-10 iter 3 orange is retired. */
            triggerStyle={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#000000",
              border: "none",
              color: "#FFFFFF",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.45)",
            }}
          />
        </div>
      </nav>
    </header>
  );
}
