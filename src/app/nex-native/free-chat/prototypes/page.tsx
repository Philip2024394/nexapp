// src/app/nex-native/free-chat/prototypes/page.tsx
//
// NEX · Free Chat · Prototype gallery.
// Owner-authorised 2026-10-21 (iteration 36 · research synthesis).
// -----------------------------------------------------------------------------
// Index of six chat-interface prototypes derived from research into:
//   · WhatsApp + iMessage baseline
//   · Modern innovators (Telegram · Discord · Signal · Snapchat · Line
//     · WeChat · Threads · Beeper)
//   · Experimental / creative patterns (spatial · audio-first · AI-
//     native · living presence · non-linear · ephemeral)
//
// Each prototype is a standalone page under /nex-native/free-chat/
// prototypes/<slug>. They're design-exploration surfaces · NOT wired
// to any backend. The goal is to pick one or two as the direction for
// the real free chat.

import type * as React from "react";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "rgba(7, 21, 37, 0.72)",
  border: "rgba(0, 175, 255, 0.22)",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.42)",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  orange: "#FF7200",
  orangeInk: "#1A0808",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

interface Prototype {
  readonly slug: string;
  readonly number: string;
  readonly title: string;
  readonly tagline: string;
  readonly inspiration: string;
  readonly glyph: string;
  readonly accent: string;
}

const PROTOTYPES: readonly Prototype[] = [
  {
    slug: "classic-polish",
    number: "P1",
    title: "Classic Polish",
    tagline: "WhatsApp-grade baseline · double-tick · reaction shelf · voice-note waveform",
    inspiration: "WhatsApp · Signal",
    glyph: "💬",
    accent: "#25D366",
  },
  {
    slug: "bubble-fx",
    number: "P2",
    title: "Bubble FX",
    tagline: "iMessage effects · Tapbacks · inline threaded replies · send animations",
    inspiration: "iMessage",
    glyph: "💥",
    accent: "#007AFF",
  },
  {
    slug: "voice-presence",
    number: "P3",
    title: "Voice Presence",
    tagline: "Big avatar · audio-reactive ring · push-to-talk primary",
    inspiration: "Clubhouse · Discord Stage",
    glyph: "🎙️",
    accent: "#9B6DFF",
  },
  {
    slug: "living-avatar",
    number: "P4",
    title: "Living Avatar",
    tagline: "Orbiting reactions · mood-shifting gradient · presence is a creature",
    inspiration: "Soul app · Telegram",
    glyph: "🌊",
    accent: "#FF4D9D",
  },
  {
    slug: "ai-canvas",
    number: "P5",
    title: "AI Canvas",
    tagline: "Artifact bottom-sheet · generative inline · chat + canvas blend",
    inspiration: "Claude Canvas · Perplexity",
    glyph: "✨",
    accent: "#F5B544",
  },
  {
    slug: "ephemeral-capsule",
    number: "P6",
    title: "Ephemeral Capsule",
    tagline: "Live-typing · time-released capsules · depleting bubble rings",
    inspiration: "Honk · Capsule · Snapchat",
    glyph: "⏳",
    accent: "#16D66B",
  },
];

export default function PrototypeGalleryPage(): React.ReactElement {
  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
        data-nex-prototype-gallery
        style={{
          position: "absolute",
          inset: 0,
          background: NEX.bg,
          color: NEX.text,
          fontFamily: SANS,
          overflowY: "auto",
          padding: "28px 16px 40px",
        }}
      >
        <nav style={{ marginBottom: 24 }}>
          <Link
            href="/nex-native/free-chat"
            style={{ color: NEX.cyan, fontSize: 13, textDecoration: "none" }}
          >
            ← Free Chat
          </Link>
        </nav>

        <header style={{ marginBottom: 24, textAlign: "center" }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            NEX · Chat Research
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: NEX.text,
            }}
          >
            Six prototype directions
          </h1>
          <p
            style={{
              margin: "8px auto 0",
              maxWidth: 360,
              fontSize: 12,
              lineHeight: 1.5,
              color: NEX.textDim,
            }}
          >
            Research synthesised from WhatsApp · iMessage · Telegram · Discord
            · Signal · Snapchat · Clubhouse · Soul · and the best creative
            chat concepts shipped so far.
          </p>
        </header>

        <section
          data-nex-prototype-grid
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 12,
            maxWidth: 420,
            margin: "0 auto",
          }}
        >
          {PROTOTYPES.map((p) => (
            <Link
              key={p.slug}
              href={`/nex-native/free-chat/prototypes/${p.slug}`}
              data-nex-prototype-card={p.slug}
              style={{
                display: "block",
                padding: "16px 18px",
                background: NEX.panel,
                border: `1px solid ${NEX.border}`,
                borderRadius: 16,
                textDecoration: "none",
                color: NEX.text,
                boxShadow: `0 10px 28px -16px ${p.accent}44`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24, lineHeight: 1 }} aria-hidden>
                    {p.glyph}
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: p.accent,
                        fontWeight: 800,
                      }}
                    >
                      {p.number} · {p.inspiration}
                    </div>
                    <h2
                      style={{
                        margin: "2px 0 0",
                        fontSize: 17,
                        fontWeight: 800,
                        color: NEX.text,
                        letterSpacing: "-0.005em",
                      }}
                    >
                      {p.title}
                    </h2>
                  </div>
                </div>
                <span aria-hidden style={{ fontSize: 18, color: p.accent }}>
                  →
                </span>
              </div>
              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  color: NEX.textDim,
                }}
              >
                {p.tagline}
              </p>
            </Link>
          ))}
        </section>
      </main>
    </>
  );
}
