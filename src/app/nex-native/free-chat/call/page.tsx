// src/app/nex-native/free-chat/call/page.tsx
//
// NEX · Free Chat · Call screen (voice call in progress).
// Owner-authorised 2026-10-21 (iteration 42 · design-matched build).
// -----------------------------------------------------------------------------
// Built to match the owner-supplied design reference at
// /public/nex-native/free-chat-call-reference.png — "Futuristic NEX
// Call Interface". Elements:
//   · Status / header row: NEX wordmark + End-to-End Encrypted
//     indicator (left) · Ni (Intelligence) shield badge (right).
//   · Hero: large circular avatar with concentric amber audio-
//     reactive rings.
//   · Peer identity: "Maria Santos" + ringing status line.
//   · 2×3 call controls grid: Mute · Speaker · Keypad on top row ·
//     Add · Record · End (red) on bottom row.
//
// Scope boundaries:
//   · Guest-safe · no DB connection · no WebRTC wiring (visual).
//   · Does NOT reuse sealed Chat Master Layout chrome.
//   · Does NOT change /nex-native/call/voice-preview (sealed · for
//     the signed-in call engine).
//   · Call Center "Voice call" row rewired to this new destination.

import type * as React from "react";
import Link from "next/link";
import { FreeChatCallEndClient } from "./_end-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const C = {
  bg: "#020914",
  wallpaper:
    "radial-gradient(1200px 800px at 50% -10%, rgba(0, 175, 255, 0.08), transparent 60%), radial-gradient(900px 700px at 50% 40%, rgba(255, 138, 42, 0.08), transparent 60%), #020914",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  amber: "#FF8A2A",
  amberSoft: "rgba(255, 138, 42, 0.55)",
  amberFaint: "rgba(255, 138, 42, 0.18)",
  danger: "#F23A4F",
  dangerDeep: "#C21F32",
  btnBg: "rgba(5, 15, 28, 0.72)",
  btnBorder: "rgba(0, 175, 255, 0.22)",
  btnIcon: "#E9EEF3",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default function FreeChatCallPage(): React.ReactElement {
  return (
    <>
      <style>{`
        html, body { background: ${C.bg} !important; }
        @keyframes nex-call-ring-pulse-slow {
          0%   { transform: scale(1);    opacity: 0.55; }
          100% { transform: scale(1.22); opacity: 0;    }
        }
        @keyframes nex-call-ring-pulse-fast {
          0%   { transform: scale(1);    opacity: 0.9;  }
          100% { transform: scale(1.35); opacity: 0;    }
        }
        @keyframes nex-call-ring-breathe {
          0%, 100% { transform: scale(1);     opacity: 0.95; }
          50%      { transform: scale(1.015); opacity: 1;    }
        }
      `}</style>
      <main
        data-nex-free-chat-call-root
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
        {/* ─── Header · NEX wordmark + encrypted + Ni badge ─── */}
        <header
          data-nex-free-chat-call-header
          style={{
            padding:
              "calc(env(safe-area-inset-top, 0px) + 14px) 16px 10px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: "0.12em",
                color: C.text,
                lineHeight: 1,
              }}
            >
              NEX
            </div>
            <div
              style={{
                marginTop: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 9,
                letterSpacing: "0.1em",
                color: C.cyan,
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              <LockIcon size={10} /> End-to-End Encrypted
            </div>
          </div>
          <div
            data-nex-free-chat-call-ni-badge
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 8px 4px 6px",
              background: "rgba(0, 175, 255, 0.08)",
              border: `1px solid ${C.cyanSoft}`,
              borderRadius: 10,
            }}
          >
            <ShieldIcon size={16} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: C.text }}>
                NEX Ni
              </span>
              <span style={{ fontSize: 8, color: C.textMute, letterSpacing: "0.04em" }}>
                Intelligence you can trust
              </span>
            </div>
          </div>
        </header>

        {/* ─── Hero · avatar + amber rings ─── */}
        <section
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "6px 20px 0",
          }}
        >
          <div
            data-nex-free-chat-call-avatar-rings
            style={{
              position: "relative",
              width: 184,
              height: 184,
            }}
          >
            {/* Outer slow pulse */}
            {[0, 900, 1800].map((delay) => (
              <div
                key={delay}
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: `1.5px solid ${C.amberSoft}`,
                  animation: `nex-call-ring-pulse-slow 2700ms cubic-bezier(0.4, 0, 0.2, 1) infinite`,
                  animationDelay: `${delay}ms`,
                }}
              />
            ))}
            {/* Static breathing rim */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 2,
                borderRadius: "50%",
                border: `2px solid ${C.amber}`,
                boxShadow:
                  "0 0 24px rgba(255,138,42,0.65), inset 0 0 12px rgba(255,138,42,0.4)",
                animation: "nex-call-ring-breathe 2200ms ease-in-out infinite",
              }}
            />
            {/* Avatar inner (placeholder gradient — real avatar lands here) */}
            <div
              aria-label="Maria Santos avatar"
              data-nex-free-chat-call-avatar
              style={{
                position: "absolute",
                inset: 10,
                borderRadius: "50%",
                background:
                  "linear-gradient(140deg, #4A1F2E 0%, #8B2D3F 45%, #D9405B 100%)",
                boxShadow: "0 10px 36px rgba(0, 0, 0, 0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFE8EA",
                fontSize: 44,
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              MS
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 8 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 700,
                color: C.text,
                letterSpacing: "-0.01em",
              }}
            >
              Maria Santos
            </h1>
            <div
              style={{
                marginTop: 8,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: C.textDim,
              }}
            >
              <span style={{ color: C.amber }}>
                <PhoneGlyph size={13} />
              </span>
              Ringing…
            </div>
          </div>
        </section>

        {/* ─── Controls · 2 × 3 grid ─── */}
        <section
          data-nex-free-chat-call-controls
          style={{
            padding: "0 24px calc(env(safe-area-inset-bottom, 0px) + 28px)",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gridTemplateRows: "repeat(2, auto)",
            gap: "18px 16px",
            flexShrink: 0,
          }}
        >
          <CallButton kind="mute" label="Mute" icon={<MicIcon />} />
          <CallButton kind="speaker" label="Speaker" icon={<SpeakerIcon />} />
          <CallButton kind="keypad" label="Keypad" icon={<KeypadGridIcon />} href="/nex-native/call/dial" />
          <CallButton kind="add" label="Add" icon={<PersonPlusIcon />} />
          <CallButton kind="record" label="Record" icon={<RecordIcon />} />
          {/* End · wrapped in a small client component so tap routes
              back to the free chat (ending the call). */}
          <FreeChatCallEndClient>
            <CallButton kind="end" label="End" icon={<PhoneDownIcon />} isDanger />
          </FreeChatCallEndClient>
        </section>
      </main>
    </>
  );
}

// ─── Reusable call button ────────────────────────────────────────

function CallButton({
  label,
  icon,
  isDanger,
  href,
}: {
  kind: string;
  label: string;
  icon: React.ReactNode;
  isDanger?: boolean;
  href?: string;
}): React.ReactElement {
  const base: React.CSSProperties = {
    width: 60,
    height: 60,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: isDanger
      ? `radial-gradient(circle at 32% 28%, ${C.danger} 0%, ${C.dangerDeep} 100%)`
      : C.btnBg,
    border: isDanger ? "none" : `1px solid ${C.btnBorder}`,
    color: isDanger ? "#FFFFFF" : C.btnIcon,
    cursor: "pointer",
    boxShadow: isDanger
      ? `0 10px 24px -8px ${C.danger}, inset 0 2px 6px rgba(255, 255, 255, 0.3)`
      : "0 6px 18px -10px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
    textDecoration: "none",
    WebkitTapHighlightColor: "transparent",
  };
  const Content = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      {href ? (
        <Link
          href={href}
          aria-label={label}
          data-nex-free-chat-call-btn={label.toLowerCase()}
          style={base}
        >
          {icon}
        </Link>
      ) : (
        <button
          type="button"
          aria-label={label}
          data-nex-free-chat-call-btn={label.toLowerCase()}
          style={{ ...base, padding: 0 }}
        >
          {icon}
        </button>
      )}
      <span
        style={{
          fontSize: 11,
          color: isDanger ? C.text : C.textDim,
          fontWeight: 600,
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </span>
    </div>
  );
  return Content;
}

// ─── Icons (inline SVG · no external deps) ───────────────────────

function LockIcon({ size = 12 }: { size?: number }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
function ShieldIcon({ size = 16 }: { size?: number }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.cyan} strokeWidth={1.8} strokeLinejoin="round" aria-hidden>
      <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeWidth={2} />
    </svg>
  );
}
function PhoneGlyph({ size = 14 }: { size?: number }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1 1 0 0 0-1.02.24l-2.2 2.2a15.15 15.15 0 0 1-6.59-6.59l2.2-2.2a1 1 0 0 0 .24-1.02A11.7 11.7 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z" />
    </svg>
  );
}
function MicIcon(): React.ReactElement {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}
function SpeakerIcon(): React.ReactElement {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="4,9 8,9 13,5 13,19 8,15 4,15" />
      <path d="M16 9a5 5 0 0 1 0 6" />
      <path d="M19 7a9 9 0 0 1 0 10" />
    </svg>
  );
}
function KeypadGridIcon(): React.ReactElement {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      {[0, 1, 2].flatMap((row) =>
        [0, 1, 2].map((col) => (
          <circle
            key={`${row}-${col}`}
            cx={6 + col * 6}
            cy={6 + row * 6}
            r={1.4}
          />
        )),
      )}
    </svg>
  );
}
function PersonPlusIcon(): React.ReactElement {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.5 2.9-6.3 6.5-6.3S15.5 16.5 15.5 20" />
      <line x1="19" y1="7" x2="19" y2="13" />
      <line x1="16" y1="10" x2="22" y2="10" />
    </svg>
  );
}
function RecordIcon(): React.ReactElement {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth={1.6} />
      <circle cx="12" cy="12" r="3.5" fill="#F23A4F" />
    </svg>
  );
}
function PhoneDownIcon(): React.ReactElement {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor" aria-hidden transform="rotate(135)">
      <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1 1 0 0 0-1.02.24l-2.2 2.2a15.15 15.15 0 0 1-6.59-6.59l2.2-2.2a1 1 0 0 0 .24-1.02A11.7 11.7 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z" />
    </svg>
  );
}
