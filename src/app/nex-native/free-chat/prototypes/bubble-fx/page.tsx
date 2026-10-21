// src/app/nex-native/free-chat/prototypes/bubble-fx/page.tsx
// P2 · Bubble FX · iMessage-style effects. Owner-authorised 2026-10-21.

import type * as React from "react";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const C = {
  bg: "#000",
  wallpaper: "linear-gradient(180deg, #000 0%, #0A0A14 100%)",
  peerBubble: "#262628",
  selfBubble: "linear-gradient(180deg, #007AFF 0%, #0062CC 100%)",
  text: "#F5F5F7",
  textDim: "#9A9AA0",
  textMute: "#6E6E73",
  blue: "#007AFF",
};

const SANS =
  "'SF Pro Display', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

interface Msg {
  readonly id: string;
  readonly from: "peer" | "self";
  readonly text: string;
  readonly tapback?: string;
  readonly fx?: "slam" | "gentle" | "loud";
  readonly replies?: readonly { id: string; from: "peer" | "self"; text: string }[];
}

const MESSAGES: readonly Msg[] = [
  { id: "m1", from: "peer", text: "This feels like a real iMessage" },
  { id: "m2", from: "self", text: "That's the Tapback coming", tapback: "❤️" },
  {
    id: "m3",
    from: "self",
    text: "SLAM 💥",
    fx: "slam",
    replies: [
      { id: "r1", from: "peer", text: "the bounce physics are 👌" },
    ],
  },
  { id: "m4", from: "peer", text: "Show me a gentle one" },
  { id: "m5", from: "self", text: "very gentle", fx: "gentle" },
];

export default function BubbleFxPrototype(): React.ReactElement {
  return (
    <>
      <style>{`
        html, body { background: ${C.bg} !important; }
        @keyframes nex-slam-pop {
          0% { transform: scale(3) translateY(-20px); opacity: 0; }
          40% { transform: scale(1.15) translateY(0); opacity: 1; }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        @keyframes nex-gentle-float {
          0% { transform: scale(0.4) translateY(10px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes nex-loud-shake {
          0%, 100% { transform: translate(0,0); }
          20% { transform: translate(-6px, 2px); }
          40% { transform: translate(6px, -2px); }
          60% { transform: translate(-4px, 2px); }
          80% { transform: translate(4px, -1px); }
        }
      `}</style>
      <main
        data-nex-proto-bubble-fx
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
        {/* Header · iMessage-minimalist */}
        <header
          style={{
            padding: "calc(env(safe-area-inset-top, 0px) + 10px) 10px 8px",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Link href="/nex-native/free-chat/prototypes" aria-label="Back" style={{ color: C.blue, textDecoration: "none", fontSize: 20 }}>
            ‹
          </Link>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #FF6B6B 0%, #C06AF0 100%)",
                margin: "0 auto",
              }}
            />
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 2, fontWeight: 500 }}>
              Jamie
            </div>
          </div>
          <button
            aria-label="FaceTime"
            style={{ color: C.blue, background: "transparent", border: "none", fontSize: 18, cursor: "pointer" }}
          >
            🎥
          </button>
        </header>

        {/* Canvas */}
        <section
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "20px 10px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {MESSAGES.map((m, i) => {
            const prev = MESSAGES[i - 1];
            const first = !prev || prev.from !== m.from;
            return <FxBubble key={m.id} m={m} first={first} />;
          })}
        </section>

        {/* Composer · pill with inline send */}
        <div
          style={{
            padding: "6px 8px calc(env(safe-area-inset-bottom, 0px) + 8px)",
            display: "flex",
            alignItems: "flex-end",
            gap: 6,
          }}
        >
          <button
            aria-label="Apps"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#262628",
              color: C.textDim,
              border: "none",
              fontSize: 16,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            +
          </button>
          <div
            style={{
              flex: 1,
              background: "#1C1C1E",
              border: "1px solid #38383A",
              borderRadius: 20,
              padding: "8px 12px",
              fontSize: 15,
              color: C.textMute,
            }}
          >
            iMessage
          </div>
          <button
            aria-label="Dictate"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "transparent",
              color: C.textMute,
              border: "none",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            🎙
          </button>
        </div>
      </main>
    </>
  );
}

function FxBubble({ m, first }: { m: Msg; first: boolean }): React.ReactElement {
  const isSelf = m.from === "self";
  const anim =
    m.fx === "slam"
      ? "nex-slam-pop 650ms cubic-bezier(0.68, -0.55, 0.27, 1.55)"
      : m.fx === "gentle"
      ? "nex-gentle-float 900ms cubic-bezier(0.4, 0, 0.2, 1)"
      : m.fx === "loud"
      ? "nex-loud-shake 480ms cubic-bezier(0.36, 0.07, 0.19, 0.97) both"
      : undefined;
  const fontSize = m.fx === "slam" ? 20 : m.fx === "loud" ? 18 : m.fx === "gentle" ? 11 : 15;
  const fontWeight = m.fx === "slam" || m.fx === "loud" ? 800 : 400;

  return (
    <div
      data-nex-proto-fx-bubble={m.id}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isSelf ? "flex-end" : "flex-start",
        marginTop: first ? 10 : 2,
      }}
    >
      <div
        style={{
          position: "relative",
          maxWidth: "76%",
          padding: "8px 14px",
          background: isSelf ? C.selfBubble : C.peerBubble,
          color: isSelf ? "#fff" : C.text,
          borderRadius: 20,
          borderBottomLeftRadius: !isSelf ? 4 : 20,
          borderBottomRightRadius: isSelf ? 4 : 20,
          fontSize,
          fontWeight,
          lineHeight: 1.3,
          animation: anim,
          transformOrigin: "center bottom",
        }}
      >
        {m.text}
        {m.tapback && (
          <span
            style={{
              position: "absolute",
              top: -10,
              left: isSelf ? "auto" : -8,
              right: isSelf ? -8 : "auto",
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "#262628",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              border: "2px solid #000",
            }}
          >
            {m.tapback}
          </span>
        )}
      </div>
      {m.replies && m.replies.length > 0 && (
        <div
          style={{
            marginTop: 4,
            paddingLeft: isSelf ? 0 : 16,
            paddingRight: isSelf ? 16 : 0,
            display: "flex",
            flexDirection: "column",
            alignItems: isSelf ? "flex-end" : "flex-start",
            gap: 2,
            borderLeft: !isSelf ? `2px solid ${C.textMute}` : "none",
            borderRight: isSelf ? `2px solid ${C.textMute}` : "none",
          }}
        >
          {m.replies.map((r) => (
            <div
              key={r.id}
              style={{
                padding: "6px 12px",
                background: r.from === "self" ? C.selfBubble : C.peerBubble,
                color: r.from === "self" ? "#fff" : C.text,
                borderRadius: 16,
                fontSize: 13,
                maxWidth: "70%",
              }}
            >
              {r.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
