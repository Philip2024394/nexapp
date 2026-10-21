// src/app/nex-native/free-chat/prototypes/ai-canvas/page.tsx
// P5 · AI Canvas · artifact bottom-sheet. 2026-10-21.

import type * as React from "react";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const C = {
  bg: "#0A0F1C",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  gold: "#F5B544",
  cyan: "#00AFFF",
  panel: "#111826",
  border: "rgba(245, 181, 68, 0.26)",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

interface Msg {
  readonly id: string;
  readonly from: "peer" | "self";
  readonly text: string;
  readonly artifact?: {
    readonly title: string;
    readonly type: string;
  };
}

const MESSAGES: readonly Msg[] = [
  { id: "m1", from: "self", text: "Draft a product card for my villa" },
  { id: "m2", from: "peer", text: "I generated a draft. Open the panel to edit.", artifact: { title: "Villa Mango · Product Card", type: "card" } },
  { id: "m3", from: "self", text: "Make the hero image warmer" },
  { id: "m4", from: "peer", text: "Updated the gradient. Preview below.", artifact: { title: "Hero · warm sunset", type: "image" } },
];

export default function AiCanvasPrototype(): React.ReactElement {
  return (
    <>
      <style>{`html, body { background: ${C.bg} !important; }`}</style>
      <main
        data-nex-proto-ai-canvas
        style={{
          position: "absolute",
          inset: 0,
          background: C.bg,
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
            padding: "calc(env(safe-area-inset-top, 0px) + 12px) 14px 10px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <Link href="/nex-native/free-chat/prototypes" aria-label="Back" style={{ color: C.text, textDecoration: "none", fontSize: 20 }}>
            ←
          </Link>
          <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>
            ✨
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>NEX Studio</div>
            <div style={{ fontSize: 10, color: C.gold, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>
              Co-creating · artifact mode
            </div>
          </div>
        </header>

        {/* Chat (top ~50%) */}
        <section
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "14px 12px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {MESSAGES.map((m) => (
            <article
              key={m.id}
              data-nex-proto-aic-bubble={m.id}
              style={{
                maxWidth: "88%",
                alignSelf: m.from === "self" ? "flex-end" : "flex-start",
                padding: "9px 14px",
                background: m.from === "self" ? C.gold : C.panel,
                color: m.from === "self" ? "#1F1300" : C.text,
                border: m.from === "self" ? "none" : `1px solid rgba(245,181,68,0.14)`,
                borderRadius: 14,
                fontSize: 13.5,
                lineHeight: 1.4,
              }}
            >
              {m.text}
              {m.artifact && (
                <div
                  data-nex-proto-aic-artifact-chip
                  style={{
                    marginTop: 8,
                    padding: "8px 10px",
                    background: m.from === "self" ? "rgba(0,0,0,0.14)" : "rgba(245,181,68,0.1)",
                    border: `1px solid ${m.from === "self" ? "rgba(0,0,0,0.2)" : "rgba(245,181,68,0.3)"}`,
                    borderRadius: 10,
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 14 }} aria-hidden>
                    {m.artifact.type === "image" ? "🎨" : "📇"}
                  </span>
                  <span style={{ fontWeight: 700 }}>{m.artifact.title}</span>
                  <span style={{ marginLeft: "auto", opacity: 0.7 }}>Open ↓</span>
                </div>
              )}
            </article>
          ))}
        </section>

        {/* Artifact bottom-sheet · pinned 40% */}
        <section
          data-nex-proto-aic-artifact-sheet
          style={{
            flex: "0 0 36%",
            background: C.panel,
            borderTop: `1px solid ${C.border}`,
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: C.gold, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800 }}>
              Current artifact
            </span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: C.textMute }}>v2 · auto-saved</span>
          </div>
          {/* Faux card preview */}
          <div
            style={{
              padding: 12,
              background: "linear-gradient(180deg, #2A1F0F 0%, #0F0A05 100%)",
              borderRadius: 12,
              border: "1px solid rgba(245,181,68,0.3)",
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 8,
                background: "linear-gradient(135deg, #F5B544 0%, #FF4D5E 100%)",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Villa Mango</div>
              <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                3 bedrooms · pool · breakfast · Ubud
              </div>
              <div style={{ fontSize: 11, color: C.gold, marginTop: 4, fontWeight: 700 }}>
                From Rp 1,200,000 / night
              </div>
            </div>
          </div>
          {/* Follow-up chips */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["Change hero", "Add gallery", "Tweak price", "Draft description"].map((chip) => (
              <button
                key={chip}
                style={{
                  padding: "6px 10px",
                  background: "transparent",
                  border: `1px solid ${C.border}`,
                  borderRadius: 999,
                  color: C.gold,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        </section>

        {/* Composer */}
        <div
          style={{
            padding: "8px 10px calc(env(safe-area-inset-bottom, 0px) + 10px)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: C.bg,
            borderTop: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              flex: 1,
              padding: "10px 14px",
              background: "#0F1623",
              border: `1px solid ${C.border}`,
              borderRadius: 999,
              color: C.textMute,
              fontSize: 14,
            }}
          >
            Describe the next change…
          </div>
          <button
            aria-label="Generate"
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: C.gold,
              color: "#1F1300",
              border: "none",
              fontSize: 18,
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            ✨
          </button>
        </div>
      </main>
    </>
  );
}
