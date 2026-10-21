// src/app/nex-native/free-chat/prototypes/classic-polish/page.tsx
// P1 · Classic Polish · WhatsApp-grade baseline. Owner-authorised 2026-10-21.

import type * as React from "react";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const C = {
  bg: "#0A1420",
  wallpaper:
    "radial-gradient(1200px 600px at 50% -10%, rgba(37, 211, 102, 0.15), transparent 55%), linear-gradient(180deg, #0A1420 0%, #050C14 100%)",
  peerBubble: "#1F2C3A",
  selfBubble: "#005C4B",
  selfBubbleGrad: "linear-gradient(180deg, #005C4B 0%, #004B3E 100%)",
  text: "#E9EEF3",
  textDim: "#A5B3C1",
  textMute: "#7D8B99",
  cyan: "#25D366",
  cyanReadTick: "#53BDEB",
  panel: "rgba(13, 21, 31, 0.9)",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

interface Msg {
  readonly id: string;
  readonly from: "peer" | "self";
  readonly text: string;
  readonly time: string;
  readonly tick?: "sent" | "delivered" | "read";
  readonly reactions?: readonly string[];
}

const MESSAGES: readonly Msg[] = [
  { id: "m1", from: "peer", text: "Hey — your work on NEX is wild", time: "10:14" },
  { id: "m2", from: "peer", text: "The themes feel like a different app each time", time: "10:14" },
  { id: "m3", from: "self", text: "Thanks! That's the whole point — your look, your chat.", time: "10:15", tick: "read", reactions: ["❤️"] },
  { id: "m4", from: "peer", text: "Does it work on the web too?", time: "10:16" },
  { id: "m5", from: "self", text: "Yeah, phone-frame on desktop, full-screen on mobile.", time: "10:16", tick: "delivered" },
];

export default function ClassicPolishPrototype(): React.ReactElement {
  return (
    <>
      <style>{`html, body { background: ${C.bg} !important; }`}</style>
      <main
        data-nex-proto-classic-polish
        style={{
          position: "absolute",
          inset: 0,
          background: C.wallpaper,
          color: C.text,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: "calc(env(safe-area-inset-top, 0px) + 14px) 14px 10px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: C.panel,
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <Link
            href="/nex-native/free-chat/prototypes"
            aria-label="Back"
            style={{ color: C.text, textDecoration: "none", fontSize: 20, lineHeight: 1 }}
          >
            ←
          </Link>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              fontWeight: 800,
            }}
          >
            A
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.15 }}>
              Alex Rivera
            </div>
            <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.2 }}>
              online · typing…
            </div>
          </div>
          <HeaderIcon label="Video call">📹</HeaderIcon>
          <HeaderIcon label="Voice call">📞</HeaderIcon>
          <HeaderIcon label="Menu">⋮</HeaderIcon>
        </header>

        {/* Canvas */}
        <section
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "16px 10px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {MESSAGES.map((m, i) => {
            const prev = MESSAGES[i - 1];
            const next = MESSAGES[i + 1];
            const first = !prev || prev.from !== m.from;
            const last = !next || next.from !== m.from;
            return <Bubble key={m.id} m={m} first={first} last={last} />;
          })}
        </section>

        {/* Composer */}
        <div
          style={{
            padding:
              "8px 10px calc(env(safe-area-inset-bottom, 0px) + 10px)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: C.panel,
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              padding: "0 10px 0 14px",
              background: "#1F2C3A",
              borderRadius: 999,
              minHeight: 40,
              gap: 6,
            }}
          >
            <span aria-hidden style={{ fontSize: 16, color: C.textMute }}>
              😊
            </span>
            <span
              style={{
                flex: 1,
                color: C.textMute,
                fontSize: 14,
                paddingLeft: 2,
              }}
            >
              Message
            </span>
            <span aria-hidden style={{ fontSize: 16, color: C.textMute }}>
              📎
            </span>
            <span aria-hidden style={{ fontSize: 16, color: C.textMute }}>
              📷
            </span>
          </div>
          <button
            type="button"
            aria-label="Record voice note"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: C.cyan,
              color: "#0A1420",
              fontSize: 18,
              border: "none",
              cursor: "pointer",
            }}
          >
            🎤
          </button>
        </div>
      </main>
    </>
  );
}

function HeaderIcon({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      style={{
        width: 32,
        height: 32,
        padding: 0,
        background: "transparent",
        border: "none",
        color: C.text,
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Bubble({
  m,
  first,
  last,
}: {
  m: Msg;
  first: boolean;
  last: boolean;
}): React.ReactElement {
  const isSelf = m.from === "self";
  return (
    <div
      data-nex-proto-bubble={m.id}
      data-nex-proto-bubble-from={m.from}
      style={{
        display: "flex",
        justifyContent: isSelf ? "flex-end" : "flex-start",
        marginTop: first ? 8 : 2,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "relative",
          maxWidth: "78%",
          padding: "7px 10px 5px",
          background: isSelf ? C.selfBubbleGrad : C.peerBubble,
          color: C.text,
          borderRadius: 10,
          borderTopLeftRadius: !isSelf && first ? 2 : 10,
          borderTopRightRadius: isSelf && first ? 2 : 10,
          fontSize: 14,
          lineHeight: 1.3,
          boxShadow: "0 1px 1px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ paddingRight: 60 }}>{m.text}</div>
        <div
          style={{
            position: "absolute",
            right: 10,
            bottom: 5,
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontSize: 10,
            color: C.textDim,
            lineHeight: 1,
          }}
        >
          <span>{m.time}</span>
          {m.tick && <Tick status={m.tick} />}
        </div>
        {m.reactions && m.reactions.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: -10,
              right: isSelf ? "auto" : 8,
              left: isSelf ? 8 : "auto",
              display: "inline-flex",
              gap: 3,
              padding: "2px 6px",
              background: "#0A1420",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 999,
              fontSize: 11,
            }}
          >
            {m.reactions.map((r) => (
              <span key={r}>{r}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Tick({ status }: { status: "sent" | "delivered" | "read" }): React.ReactElement {
  const color = status === "read" ? C.cyanReadTick : C.textDim;
  const double = status !== "sent";
  return (
    <svg width={16} height={10} viewBox="0 0 16 10" fill="none" stroke={color} strokeWidth={1.4} aria-label={status}>
      <polyline points="1,5 4,8 9,2" strokeLinecap="round" strokeLinejoin="round" />
      {double && <polyline points="5,5 8,8 13,2" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
