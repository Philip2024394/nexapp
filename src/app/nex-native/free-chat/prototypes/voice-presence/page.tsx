// src/app/nex-native/free-chat/prototypes/voice-presence/page.tsx
// P3 · Voice Presence · audio-reactive ring + push-to-talk. 2026-10-21.

import type * as React from "react";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const C = {
  bg: "#09051F",
  wallpaper:
    "radial-gradient(600px 400px at 50% 25%, rgba(155, 109, 255, 0.35), transparent 70%), radial-gradient(500px 400px at 50% 80%, rgba(0, 175, 255, 0.18), transparent 70%), #09051F",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  violet: "#9B6DFF",
  cyan: "#00AFFF",
  orange: "#FF7200",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

interface VoiceNote {
  readonly id: string;
  readonly from: "peer" | "self";
  readonly duration: string;
  readonly waveform: readonly number[];
  readonly played?: boolean;
}

const NOTES: readonly VoiceNote[] = [
  {
    id: "v1",
    from: "peer",
    duration: "0:12",
    waveform: [0.3, 0.6, 0.4, 0.8, 0.5, 0.9, 0.6, 0.4, 0.7, 0.3, 0.5, 0.8, 0.4, 0.6, 0.3],
    played: true,
  },
  {
    id: "v2",
    from: "self",
    duration: "0:08",
    waveform: [0.5, 0.4, 0.7, 0.9, 0.6, 0.3, 0.5, 0.8, 0.4, 0.6, 0.7, 0.5, 0.3, 0.4],
    played: true,
  },
  {
    id: "v3",
    from: "peer",
    duration: "0:21",
    waveform: [0.2, 0.5, 0.8, 0.6, 0.4, 0.9, 0.7, 0.3, 0.5, 0.8, 0.6, 0.4, 0.9, 0.5, 0.3, 0.7, 0.6],
    played: false,
  },
];

export default function VoicePresencePrototype(): React.ReactElement {
  return (
    <>
      <style>{`
        html, body { background: ${C.bg} !important; }
        @keyframes nex-ring-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes nex-ring-pulse-fast {
          0% { transform: scale(1); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
      <main
        data-nex-proto-voice-presence
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
        {/* Minimal header · back + name */}
        <header
          style={{
            padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 8px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Link href="/nex-native/free-chat/prototypes" aria-label="Back" style={{ color: C.text, textDecoration: "none", fontSize: 20 }}>
            ←
          </Link>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>Taylor</div>
          <div style={{ fontSize: 11, color: C.violet, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>
            Live
          </div>
        </header>

        {/* Hero · big avatar with audio-reactive ring */}
        <section
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 0 16px",
          }}
        >
          <div
            data-nex-proto-voice-ring
            style={{
              position: "relative",
              width: 180,
              height: 180,
              borderRadius: "50%",
            }}
          >
            {/* Three pulsing rings */}
            {[0, 400, 800].map((delay) => (
              <div
                key={delay}
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: `2px solid ${C.violet}`,
                  animation: `nex-ring-pulse 1800ms cubic-bezier(0.4, 0, 0.2, 1) infinite`,
                  animationDelay: `${delay}ms`,
                }}
              />
            ))}
            {/* Avatar */}
            <div
              style={{
                position: "absolute",
                inset: 10,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #9B6DFF 0%, #4A1D96 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 60,
                boxShadow: `0 0 40px rgba(155, 109, 255, 0.5)`,
              }}
            >
              🎤
            </div>
          </div>
        </section>

        <div style={{ textAlign: "center", fontSize: 13, color: C.textDim, padding: "0 20px 16px" }}>
          Taylor is speaking…
        </div>

        {/* Voice-note stream · compact cards */}
        <section
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "0 14px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {NOTES.map((n) => (
            <VoiceNoteRow key={n.id} note={n} />
          ))}
        </section>

        {/* Push-to-talk primary */}
        <div
          style={{
            padding: "16px 16px calc(env(safe-area-inset-bottom, 0px) + 20px)",
            display: "flex",
            justifyContent: "center",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <button
            type="button"
            aria-label="Hold to talk"
            style={{
              position: "relative",
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: `radial-gradient(circle at 30% 30%, ${C.orange} 0%, #A33E00 100%)`,
              color: "#1A0808",
              border: "none",
              cursor: "pointer",
              fontSize: 36,
              fontWeight: 900,
              boxShadow: `0 10px 30px -8px ${C.orange}, inset 0 2px 6px rgba(255,255,255,0.3)`,
            }}
          >
            🎙
          </button>
          <div style={{ fontSize: 11, color: C.textMute, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Hold to talk
          </div>
        </div>
      </main>
    </>
  );
}

function VoiceNoteRow({ note }: { note: VoiceNote }): React.ReactElement {
  const isSelf = note.from === "self";
  const accent = note.played ? "rgba(155,109,255,0.5)" : C.violet;
  return (
    <div
      data-nex-proto-voice-note={note.id}
      style={{
        display: "flex",
        justifyContent: isSelf ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px",
          background: isSelf ? "rgba(255, 114, 0, 0.15)" : "rgba(155, 109, 255, 0.14)",
          border: `1px solid ${isSelf ? "rgba(255,114,0,0.4)" : "rgba(155,109,255,0.4)"}`,
          borderRadius: 999,
          maxWidth: "72%",
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: isSelf ? C.orange : accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: isSelf ? "#1A0808" : "#fff",
            fontSize: 11,
          }}
        >
          ▶
        </span>
        <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 24 }}>
          {note.waveform.map((h, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: `${Math.max(h * 20, 4)}px`,
                background: isSelf ? C.orange : accent,
                borderRadius: 2,
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: 11, color: C.textDim, fontVariantNumeric: "tabular-nums" }}>
          {note.duration}
        </span>
      </div>
    </div>
  );
}
