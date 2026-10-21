// src/app/nex-native/free-chat/prototypes/living-avatar/page.tsx
// P4 · Living Avatar · mood gradient + orbiting reactions. 2026-10-21.

import type * as React from "react";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const C = {
  text: "#F8EEFF",
  textDim: "rgba(248, 238, 255, 0.72)",
  textMute: "rgba(248, 238, 255, 0.48)",
  bubbleOut: "rgba(255, 255, 255, 0.14)",
  bubbleIn: "rgba(255, 77, 157, 0.22)",
  pink: "#FF4D9D",
  cyan: "#00AFFF",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

interface Msg {
  readonly id: string;
  readonly from: "peer" | "self";
  readonly text: string;
}

const MESSAGES: readonly Msg[] = [
  { id: "m1", from: "peer", text: "the gradient literally shifts when you send" },
  { id: "m2", from: "self", text: "soul.app meets telegram" },
  { id: "m3", from: "peer", text: "and reactions orbit the avatar 🤯" },
  { id: "m4", from: "self", text: "the whole header is alive" },
];

const ORBITING = ["❤️", "✨", "🌊", "🎵"];

export default function LivingAvatarPrototype(): React.ReactElement {
  return (
    <>
      <style>{`
        html, body { background: #1a0a2e !important; }
        @keyframes nex-mood-shift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes nex-avatar-breathe {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.05); }
        }
        @keyframes nex-orbit {
          0%   { transform: rotate(0deg) translateX(80px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(80px) rotate(-360deg); }
        }
      `}</style>
      <main
        data-nex-proto-living-avatar
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, #1a0a2e 0%, #4a1d6e 25%, #8b2d8f 50%, #d6487e 75%, #ff6b6b 100%)",
          backgroundSize: "300% 300%",
          animation: "nex-mood-shift 18000ms ease infinite",
          color: C.text,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Minimal transparent header */}
        <header
          style={{
            padding: "calc(env(safe-area-inset-top, 0px) + 12px) 14px 6px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Link href="/nex-native/free-chat/prototypes" aria-label="Back" style={{ color: C.text, textDecoration: "none", fontSize: 20 }}>
            ←
          </Link>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: C.textDim, fontWeight: 700 }}>
              Soul · Playful
            </div>
          </div>
          <button
            aria-label="Menu"
            style={{ color: C.text, background: "transparent", border: "none", fontSize: 20, cursor: "pointer" }}
          >
            ⋮
          </button>
        </header>

        {/* Living avatar · orbiting reactions */}
        <section
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 220,
            flexShrink: 0,
          }}
        >
          <div style={{ position: "relative", width: 220, height: 220 }}>
            {/* Orbiting reactions */}
            {ORBITING.map((emoji, i) => (
              <div
                key={emoji}
                aria-hidden
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: 32,
                  height: 32,
                  marginLeft: -16,
                  marginTop: -16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  animation: `nex-orbit ${12 + i * 2}s linear infinite`,
                  animationDelay: `${i * -3}s`,
                }}
              >
                {emoji}
              </div>
            ))}
            {/* The living creature */}
            <div
              style={{
                position: "absolute",
                inset: 40,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle at 35% 30%, #FFCFE5 0%, #FF4D9D 45%, #8B2D8F 100%)",
                boxShadow:
                  "0 0 60px rgba(255, 77, 157, 0.55), inset 0 -10px 30px rgba(0,0,0,0.3)",
                animation: "nex-avatar-breathe 2800ms ease-in-out infinite",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 52,
              }}
            >
              🌊
            </div>
          </div>
        </section>

        <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: C.text, padding: "0 20px 8px" }}>
          Nova
        </div>
        <div style={{ textAlign: "center", fontSize: 11, color: C.textDim, padding: "0 20px 14px" }}>
          feeling · playful · open to chat
        </div>

        {/* Compact bubble stream */}
        <section
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "0 14px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {MESSAGES.map((m) => (
            <article
              key={m.id}
              data-nex-proto-la-bubble={m.id}
              style={{
                maxWidth: "80%",
                alignSelf: m.from === "self" ? "flex-end" : "flex-start",
                padding: "8px 14px",
                background: m.from === "self" ? C.bubbleOut : C.bubbleIn,
                border: `1px solid ${m.from === "self" ? "rgba(255,255,255,0.14)" : "rgba(255,77,157,0.3)"}`,
                borderRadius: 20,
                fontSize: 14,
                lineHeight: 1.4,
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
              }}
            >
              {m.text}
            </article>
          ))}
        </section>

        {/* Composer */}
        <div
          style={{
            padding: "10px 14px calc(env(safe-area-inset-bottom, 0px) + 12px)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              flex: 1,
              padding: "10px 16px",
              background: "rgba(255,255,255,0.14)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 999,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              color: C.textMute,
              fontSize: 14,
            }}
          >
            Say something to Nova…
          </div>
          <button
            aria-label="Send"
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.9)",
              color: C.pink,
              border: "none",
              fontSize: 20,
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
            }}
          >
            →
          </button>
        </div>
      </main>
    </>
  );
}
