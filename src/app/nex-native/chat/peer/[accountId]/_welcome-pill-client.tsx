"use client";

// src/app/nex-native/chat/peer/[accountId]/_welcome-pill-client.tsx
//
// Fresh-conversation welcome pill · owner-authored 2026-11-05.
// Rendered on the production peer-chat page only when
// messages.length === 0 · styled as a chat-bubble with time + delivery
// ticks + peer presence dot so the surface feels like a real
// conversation surface rather than a dead empty state.
//
// Delivery/read dot (owner directive 2026-11-05):
//   The dot on the lower-right confirms whether the peer has seen the
//   welcome state · it is NOT presence. Semantic:
//     · red   — peer has not opened this conversation yet (unseen)
//     · green — peer has opened this conversation (seen)
//   Proxy signal: the welcome pill is not a real message row in the
//   DB, so "seen" maps to "peer appears in the sealed per-conversation
//   presence roster at least once." Once PeerPresenceClient dispatches
//   a roster containing the peer, we flip red → green and keep it
//   green for the lifetime of the mount. Real message bubbles will
//   use `peer_message.read_at` directly when this pattern is extended
//   to the bubble footer.

import * as React from "react";
import type { PresenceKind } from "@/lib/nex-native/realtime/presence";

const PRESENCE_EVENT = "nex-peer-presence";

export interface WelcomePillClientProps {
  readonly peerFirstName: string;
  readonly peerAccountId: string;
  /** ISO timestamp used to render the pill's "time" chip. Pass the
   *  conversation's created_at so both viewers see a stable value. */
  readonly conversationCreatedAt: string;
}

export function WelcomePillClient({
  peerFirstName,
  peerAccountId,
  conversationCreatedAt,
}: WelcomePillClientProps): React.JSX.Element {
  // Owner directive 2026-11-05 · the dot tracks delivery/seen status ·
  // red = peer has not opened this conversation yet · green = peer has
  // opened it (we observe them in the presence roster). Once green, we
  // keep it green for the lifetime of the mount so the signal doesn't
  // flicker if the peer backgrounds the tab.
  const [peerSeen, setPeerSeen] = React.useState<boolean>(false);

  React.useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{
        roster?: Array<{ accountId: string; kind: PresenceKind }>;
      }>;
      const roster = custom.detail?.roster;
      if (!Array.isArray(roster)) return;
      if (roster.some((r) => r.accountId === peerAccountId)) {
        setPeerSeen(true);
      }
    };
    window.addEventListener(PRESENCE_EVENT, handler as EventListener);
    return () =>
      window.removeEventListener(PRESENCE_EVENT, handler as EventListener);
  }, [peerAccountId]);

  const dotColor = peerSeen ? "#16D66B" : "#A60000";

  return (
    <div
      aria-hidden
      data-nex-peer-chat-prototype-empty-state
      data-nex-peer-chat-prototype-empty-seen={peerSeen ? "true" : "false"}
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 5,
        padding: "12px 18px 10px 18px",
        maxWidth: 340,
        borderRadius: 18,
        background: "rgba(0, 0, 0, 0.42)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        border: "1px solid rgba(255, 255, 255, 0.14)",
        boxShadow:
          "0 10px 28px rgba(0,0,0,0.55), inset 0 0 0 1px color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 20%, transparent)",
        color: "var(--nex-world-primary-ink, #F2F5F8)",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        pointerEvents: "none",
        textAlign: "left",
      }}
    >
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          lineHeight: 1.3,
          letterSpacing: "-0.005em",
        }}
      >
        You and {peerFirstName} are connected
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 12,
          fontWeight: 500,
          color: "var(--nex-world-muted-ink, #B5C3D6)",
        }}
      >
        Say hi 👋
      </div>
      {/* Owner directive 2026-11-05 · lower-right time + delivery/seen
          dot · reads exactly like a chat-bubble footer. Dot is RED when
          the peer has not yet opened the conversation and flips GREEN
          once observed in the presence roster (seen). */}
      <div
        style={{
          marginTop: 10,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 6,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.02em",
          color: "rgba(255,255,255,0.65)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>{formatHM(conversationCreatedAt)}</span>
        <span
          aria-hidden
          data-nex-peer-chat-prototype-empty-dot={peerSeen ? "seen" : "unseen"}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dotColor,
            boxShadow: peerSeen
              ? "0 0 6px rgba(22,214,107,0.55)"
              : "0 0 6px rgba(166,0,0,0.45)",
            transition: "background 220ms ease-out, box-shadow 220ms ease-out",
          }}
        />
      </div>
    </div>
  );
}

function formatHM(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
