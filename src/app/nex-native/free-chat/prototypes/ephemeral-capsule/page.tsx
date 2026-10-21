// src/app/nex-native/free-chat/prototypes/ephemeral-capsule/page.tsx
// P6 · Ephemeral Capsule · live-typing + time-released + depleting ring. 2026-10-21.

import type * as React from "react";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const C = {
  bg: "#040B08",
  text: "#E8F7EE",
  textDim: "#8FB8A0",
  textMute: "#5C8072",
  green: "#16D66B",
  greenFade: "rgba(22, 214, 107, 0.25)",
  violet: "#9B6DFF",
  amber: "#F5B544",
  panel: "rgba(10, 24, 18, 0.6)",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

type Mode = "now" | "capsule" | "live";

interface Msg {
  readonly id: string;
  readonly from: "peer" | "self";
  readonly text: string;
  readonly mode: Mode;
  /** 0-100 · how much life this bubble has left (0 = disappearing). */
  readonly life: number;
  /** For capsules · relative "arrives in" copy. */
  readonly arrivesIn?: string;
}

const MESSAGES: readonly Msg[] = [
  { id: "m1", from: "peer", text: "This one has 1 minute left", mode: "now", life: 25 },
  { id: "m2", from: "self", text: "capsule mode · scheduled", mode: "capsule", life: 100, arrivesIn: "in 2h" },
  { id: "m3", from: "peer", text: "watch me live-typ|", mode: "live", life: 100 },
  { id: "m4", from: "self", text: "fresh · 10 min", mode: "now", life: 80 },
];

export default function EphemeralCapsulePrototype(): React.ReactElement {
  return (
    <>
      <style>{`
        html, body { background: ${C.bg} !important; }
        @keyframes nex-caret-blink {
          0%, 50%   { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
      <main
        data-nex-proto-ephemeral
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(600px 400px at 50% 110%, rgba(22, 214, 107, 0.15), transparent 70%), #040B08",
          color: C.text,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Minimal header */}
        <header
          style={{
            padding: "calc(env(safe-area-inset-top, 0px) + 14px) 14px 10px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderBottom: `1px solid rgba(22, 214, 107, 0.15)`,
          }}
        >
          <Link href="/nex-native/free-chat/prototypes" aria-label="Back" style={{ color: C.text, textDecoration: "none", fontSize: 20 }}>
            ←
          </Link>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>⏳ Ephemeral</div>
            <div style={{ fontSize: 10, color: C.textDim }}>chat clears when you close</div>
          </div>
          <span style={{ fontSize: 10, color: C.green, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 800 }}>
            ● live
          </span>
        </header>

        {/* Bubble stream */}
        <section
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "16px 14px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {MESSAGES.map((m) => (
            <EphemeralBubble key={m.id} m={m} />
          ))}
        </section>

        {/* Composer with 3-mode toggle */}
        <ModeComposer />
      </main>
    </>
  );
}

function EphemeralBubble({ m }: { m: Msg }): React.ReactElement {
  const isSelf = m.from === "self";
  const accent =
    m.mode === "capsule" ? C.amber : m.mode === "live" ? C.violet : C.green;

  return (
    <div
      data-nex-proto-ephemeral-bubble={m.id}
      data-nex-proto-ephemeral-bubble-mode={m.mode}
      style={{
        display: "flex",
        justifyContent: isSelf ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          position: "relative",
          maxWidth: "76%",
          padding: "9px 14px 10px",
          background: isSelf ? "rgba(22, 214, 107, 0.14)" : C.panel,
          border: `1px solid ${isSelf ? C.greenFade : "rgba(255,255,255,0.06)"}`,
          borderRadius: 16,
          fontSize: 14,
          lineHeight: 1.4,
          color: C.text,
        }}
      >
        {/* Mode chip */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 9,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: accent,
            fontWeight: 800,
            marginBottom: 4,
          }}
        >
          {m.mode === "capsule" ? `⏱ capsule · ${m.arrivesIn}` : m.mode === "live" ? "⚡ live typing" : "● now"}
        </div>
        <div>
          {m.text}
          {m.mode === "live" && (
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 2,
                height: 14,
                background: C.violet,
                marginLeft: 2,
                verticalAlign: "text-bottom",
                animation: "nex-caret-blink 1000ms steps(2) infinite",
              }}
            />
          )}
        </div>
        {/* Depleting ring · only for "now" mode with life < 100 */}
        {m.mode === "now" && (
          <LifeRing life={m.life} color={accent} />
        )}
      </div>
    </div>
  );
}

function LifeRing({ life, color }: { life: number; color: string }): React.ReactElement {
  const r = 7;
  const circumference = 2 * Math.PI * r;
  const dash = (life / 100) * circumference;
  return (
    <div
      aria-label={`${life}% remaining`}
      style={{
        position: "absolute",
        top: -4,
        right: -4,
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: "#040B08",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden>
        <circle
          cx={10}
          cy={10}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1.5}
        />
        <circle
          cx={10}
          cy={10}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeDasharray={`${dash} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform="rotate(-90 10 10)"
        />
      </svg>
    </div>
  );
}

function ModeComposer(): React.ReactElement {
  // Visual-only · no real state wiring. Shows the 3 modes side-by-side.
  return (
    <div
      style={{
        padding: "10px 12px calc(env(safe-area-inset-bottom, 0px) + 12px)",
        borderTop: `1px solid rgba(22, 214, 107, 0.15)`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Mode pills */}
      <div style={{ display: "flex", gap: 6, alignSelf: "center" }}>
        <ModePill label="● now" color={C.green} active />
        <ModePill label="⏱ capsule" color={C.amber} active={false} />
        <ModePill label="⚡ live" color={C.violet} active={false} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            flex: 1,
            padding: "10px 14px",
            background: C.panel,
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 999,
            color: C.textMute,
            fontSize: 14,
          }}
        >
          Say something · it will clear
        </div>
        <button
          aria-label="Send"
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: C.green,
            color: "#042416",
            border: "none",
            fontSize: 18,
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: `0 8px 20px -8px ${C.green}`,
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}

function ModePill({ label, color, active }: { label: string; color: string; active: boolean }): React.ReactElement {
  return (
    <button
      type="button"
      style={{
        padding: "4px 10px",
        background: active ? `${color}22` : "transparent",
        border: `1px solid ${active ? color : "rgba(255,255,255,0.1)"}`,
        borderRadius: 999,
        color: active ? color : C.textMute,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}
