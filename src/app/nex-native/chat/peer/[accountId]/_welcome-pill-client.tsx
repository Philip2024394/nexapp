"use client";

// src/app/nex-native/chat/peer/[accountId]/_welcome-pill-client.tsx
//
// Fresh-conversation welcome pill · owner-authored 2026-11-05.
// Rendered on the production peer-chat page only when
// messages.length === 0 · styled as a chat-bubble with time + delivery
// ticks + peer presence dot so the surface feels like a real
// conversation surface rather than a dead empty state.
//
// Presence:
//   Subscribes to the sealed `nex-peer-presence` window event already
//   dispatched by PeerPresenceClient (mounted on the same page).
//   Default state is "unknown" (grey dot) · flips to green on "online"
//   or dark-red on "offline" / "busy" (busy reads as not-available).
//
// Delivery ticks:
//   Shows two grey ticks (✓✓) by default · purely decorative since
//   the welcome pill is not a real message row · but visually matches
//   the sealed WhatsApp-style message pattern so the bubble reads as
//   part of the chat vocabulary.

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
  const [peerKind, setPeerKind] = React.useState<PresenceKind | "unknown">(
    "unknown",
  );

  React.useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{
        roster?: Array<{ accountId: string; kind: PresenceKind }>;
      }>;
      const roster = custom.detail?.roster;
      if (!Array.isArray(roster)) return;
      const peer = roster.find((r) => r.accountId === peerAccountId);
      if (!peer) {
        // Roster sync received but peer not in it · they're offline.
        setPeerKind("offline");
        return;
      }
      setPeerKind(peer.kind);
    };
    window.addEventListener(PRESENCE_EVENT, handler as EventListener);
    return () =>
      window.removeEventListener(PRESENCE_EVENT, handler as EventListener);
  }, [peerAccountId]);

  const dotColor =
    peerKind === "online"
      ? "#16D66B"
      : peerKind === "busy"
        ? "#F59E0B"
        : peerKind === "offline"
          ? "#A60000"
          : "rgba(255,255,255,0.35)";

  return (
    <div
      aria-hidden
      data-nex-peer-chat-prototype-empty-state
      data-nex-peer-chat-prototype-empty-presence={peerKind}
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
        textAlign: "center",
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
      {/* Chat-bubble meta row · time + delivery ticks + presence dot ·
          sits under the welcome copy to mimic the sealed message
          footer vocabulary. Right-aligned so the structure reads
          exactly like a sender bubble. */}
      <div
        style={{
          marginTop: 10,
          display: "inline-flex",
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
          style={{
            fontSize: 11,
            letterSpacing: "-0.08em",
            color: "rgba(255,255,255,0.6)",
            fontWeight: 800,
          }}
        >
          ✓✓
        </span>
        <span
          aria-hidden
          data-nex-peer-chat-prototype-empty-dot={peerKind}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dotColor,
            boxShadow:
              peerKind === "online"
                ? "0 0 6px rgba(22,214,107,0.55)"
                : peerKind === "offline"
                  ? "0 0 6px rgba(166,0,0,0.45)"
                  : undefined,
            transition: "background 220ms ease-out",
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
