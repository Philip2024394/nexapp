// src/app/nex-native/theme-prototypes/page.tsx
//
// Theme comparison prototypes · owner-sealed 2026-11-10.
//
// Renders 5 miniaturised versions of the free-chat surface, one per
// proposed theme, so the owner can compare side-by-side on a phone.
// Each panel shows the key UI elements:
//   · header bar (title + hamburger + settings)
//   · side drawer peek (left edge sliver)
//   · chat message area (3 alternating bubbles)
//   · composer (text input + send + emoji)
//   · primary CTA button
//   · 5-colour palette swatch at the bottom
//
// This page is OUT OF SCOPE for the main NEX experience · it's a
// design-comparison route only. No sealed primitives are forked. No
// interactivity · pure server-rendered HTML.

import type * as React from "react";

export const runtime = "nodejs";
export const dynamic = "force-static";

interface Theme {
  readonly key: string;
  readonly name: string;
  readonly subtitle: string;
  readonly bg: string;
  readonly bgContainer: string;
  readonly bgElevated: string;
  readonly textPrimary: string;
  readonly textMuted: string;
  readonly textSubtle: string;
  readonly border: string;
  readonly accent: string;
  readonly buttonBg: string;
  readonly buttonText: string;
  readonly bubbleOut: string;
  readonly bubbleOutText: string;
  readonly bubbleIn: string;
  readonly bubbleInText: string;
  readonly drawerBg: string;
  readonly drawerText: string;
}

const THEMES: readonly Theme[] = [
  {
    key: "cream",
    name: "Cream Classic",
    subtitle: "Warm off-white · gold accent · near-black text",
    bg: "#FFF9E9",
    bgContainer: "#FFFFFF",
    bgElevated: "#FFFCF2",
    textPrimary: "#1A1816",
    textMuted: "#776C5E",
    textSubtle: "#ADA294",
    border: "#EBE2CB",
    accent: "#D4A24F",
    buttonBg: "#1A1816",
    buttonText: "#FFF9E9",
    bubbleOut: "#D4A24F",
    bubbleOutText: "#1A1816",
    bubbleIn: "#FFFFFF",
    bubbleInText: "#1A1816",
    drawerBg: "#F5EDD3",
    drawerText: "#1A1816",
  },
  {
    key: "light-gray",
    name: "Light Gray Minimal",
    subtitle: "iOS-style cool neutrals · blue accent · high contrast",
    bg: "#F5F5F7",
    bgContainer: "#FFFFFF",
    bgElevated: "#FBFBFD",
    textPrimary: "#1D1D1F",
    textMuted: "#86868B",
    textSubtle: "#C7C7CC",
    border: "#E3E3E7",
    accent: "#007AFF",
    buttonBg: "#1D1D1F",
    buttonText: "#FFFFFF",
    bubbleOut: "#007AFF",
    bubbleOutText: "#FFFFFF",
    bubbleIn: "#E9E9EB",
    bubbleInText: "#1D1D1F",
    drawerBg: "#EDEDEF",
    drawerText: "#1D1D1F",
  },
  {
    key: "fresh-green",
    name: "Fresh Green",
    subtitle: "Bright spring green · deep forest text · cream containers",
    bg: "#CBEE92",
    bgContainer: "#FFFEF6",
    bgElevated: "#E8F6CC",
    textPrimary: "#1F2E0A",
    textMuted: "#4F5E2E",
    textSubtle: "#8CA85C",
    border: "#A3D664",
    accent: "#4A7B1E",
    buttonBg: "#1F2E0A",
    buttonText: "#FFFEF6",
    bubbleOut: "#4A7B1E",
    bubbleOutText: "#FFFEF6",
    bubbleIn: "#FFFEF6",
    bubbleInText: "#1F2E0A",
    drawerBg: "#B8E07A",
    drawerText: "#1F2E0A",
  },
  {
    key: "pink-soft",
    name: "Pink Soft",
    subtitle: "Lavender-blush · vibrant pink accent · warm near-black",
    bg: "#FFF0F5",
    bgContainer: "#FFFFFF",
    bgElevated: "#FFF8FA",
    textPrimary: "#2D1A20",
    textMuted: "#8B6670",
    textSubtle: "#C8A5B0",
    border: "#F5D5E0",
    accent: "#D44680",
    buttonBg: "#2D1A20",
    buttonText: "#FFF0F5",
    bubbleOut: "#D44680",
    bubbleOutText: "#FFFFFF",
    bubbleIn: "#FFFFFF",
    bubbleInText: "#2D1A20",
    drawerBg: "#FFE0EB",
    drawerText: "#2D1A20",
  },
  {
    key: "emerald-current",
    name: "Dark Emerald (current)",
    subtitle: "Reference · the existing NEX palette for comparison",
    bg: "#123D2B",
    bgContainer: "#0A1C14",
    bgElevated: "#1B5138",
    textPrimary: "#F2F5F8",
    textMuted: "#AFC5B5",
    textSubtle: "#7D9BC0",
    border: "rgba(198, 161, 91, 0.35)",
    accent: "#C6A15B",
    buttonBg: "#C6A15B",
    buttonText: "#0A1C14",
    bubbleOut: "#C6A15B",
    bubbleOutText: "#0A1C14",
    bubbleIn: "#0A1C14",
    bubbleInText: "#F2F5F8",
    drawerBg: "#0D2A1D",
    drawerText: "#F2F5F8",
  },
];

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function Swatch({ label, value }: { readonly label: string; readonly value: string }): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: value,
          border: "1px solid rgba(0,0,0,0.08)",
        }}
        aria-hidden
      />
      <span style={{ fontSize: 8, color: "#888", fontFamily: "ui-monospace, Menlo, monospace" }}>{label}</span>
    </div>
  );
}

function ThemePanel({ theme }: { readonly theme: Theme }): React.JSX.Element {
  // Mock phone frame · 320×620
  const frameW = 320;
  const frameH = 620;
  const drawerW = 48; // sliver width
  const chatW = frameW - drawerW;
  return (
    <section
      data-nex-theme-prototype={theme.key}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "16px 12px",
        background: "#f8f8fa",
        borderRadius: 14,
        border: "1px solid #e3e3e7",
      }}
    >
      {/* Header above the frame */}
      <div style={{ fontFamily: SANS }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#1D1D1F" }}>{theme.name}</div>
        <div style={{ fontSize: 11, color: "#86868B", marginTop: 2 }}>{theme.subtitle}</div>
      </div>

      {/* Phone frame */}
      <div
        style={{
          position: "relative",
          width: frameW,
          height: frameH,
          borderRadius: 32,
          background: "#000",
          padding: 6,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          overflow: "hidden",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 26,
            background: theme.bg,
            overflow: "hidden",
            display: "flex",
            fontFamily: SANS,
            position: "relative",
          }}
        >
          {/* Side drawer sliver */}
          <aside
            style={{
              width: drawerW,
              background: theme.drawerBg,
              color: theme.drawerText,
              borderRight: `1px solid ${theme.border}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: 36,
              gap: 10,
            }}
          >
            {["N", "P", "A", "J", "S"].map((letter, i) => (
              <div
                key={i}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: i === 0 ? theme.accent : theme.bgContainer,
                  color: i === 0 ? theme.buttonText : theme.textPrimary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 800,
                  border: i === 0 ? "none" : `1px solid ${theme.border}`,
                }}
                aria-hidden
              >
                {letter}
              </div>
            ))}
          </aside>

          {/* Main chat column */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", width: chatW }}>
            {/* Status bar sim */}
            <div
              style={{
                height: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 12px",
                fontSize: 9,
                color: theme.textMuted,
                fontWeight: 700,
              }}
            >
              <span>09:41</span>
              <span>··  ○</span>
            </div>

            {/* Header */}
            <header
              style={{
                padding: "10px 12px 10px 10px",
                background: theme.bgElevated,
                borderBottom: `1px solid ${theme.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "6px 2px",
                  }}
                  aria-hidden
                >
                  <div style={{ height: 2, background: theme.textPrimary, borderRadius: 1 }} />
                  <div style={{ height: 2, background: theme.textPrimary, borderRadius: 1 }} />
                  <div style={{ height: 2, background: theme.textPrimary, borderRadius: 1 }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: theme.textPrimary }}>Free NEX Chat</div>
                  <div style={{ fontSize: 9, color: theme.textMuted, marginTop: 1 }}>a chat that's yours</div>
                </div>
              </div>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: theme.accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: theme.buttonText,
                  fontSize: 10,
                  fontWeight: 900,
                }}
                aria-hidden
              >
                N
              </div>
            </header>

            {/* Chat area */}
            <div
              style={{
                flex: 1,
                padding: "14px 10px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                overflowY: "hidden",
              }}
            >
              {/* Incoming bubble */}
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    maxWidth: "75%",
                    background: theme.bubbleIn,
                    color: theme.bubbleInText,
                    padding: "8px 11px",
                    borderRadius: "14px 14px 14px 4px",
                    fontSize: 12,
                    lineHeight: 1.4,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  Hey · welcome to NEX. Every friend sees your look · free themes, no ads.
                </div>
              </div>

              {/* Outgoing bubble */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div
                  style={{
                    maxWidth: "75%",
                    background: theme.bubbleOut,
                    color: theme.bubbleOutText,
                    padding: "8px 11px",
                    borderRadius: "14px 14px 4px 14px",
                    fontSize: 12,
                    lineHeight: 1.4,
                  }}
                >
                  Love the new look · feels like a real app.
                </div>
              </div>

              {/* Incoming bubble */}
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    maxWidth: "70%",
                    background: theme.bubbleIn,
                    color: theme.bubbleInText,
                    padding: "8px 11px",
                    borderRadius: "14px 14px 14px 4px",
                    fontSize: 12,
                    lineHeight: 1.4,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  Pick a theme any time · it's yours to change.
                </div>
              </div>

              {/* Timestamp */}
              <div style={{ textAlign: "center", fontSize: 9, color: theme.textSubtle, marginTop: 4 }}>
                09:42 · today
              </div>

              {/* CTA button */}
              <div style={{ marginTop: "auto", paddingBottom: 6 }}>
                <button
                  type="button"
                  disabled
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: theme.buttonBg,
                    color: theme.buttonText,
                    border: "none",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "default",
                    letterSpacing: "0.02em",
                  }}
                >
                  Create free NEX
                </button>
              </div>
            </div>

            {/* Composer */}
            <div
              style={{
                padding: "8px 10px 10px",
                background: theme.bgElevated,
                borderTop: `1px solid ${theme.border}`,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div
                style={{
                  flex: 1,
                  background: theme.bgContainer,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 20,
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  color: theme.textSubtle,
                  fontSize: 11,
                }}
              >
                <span>Type a message</span>
                <span style={{ fontSize: 14 }} aria-hidden>
                  😊
                </span>
              </div>
              <button
                type="button"
                disabled
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: theme.accent,
                  color: theme.buttonText,
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: "default",
                }}
                aria-label="Send"
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Palette swatches */}
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "center",
          flexWrap: "wrap",
          padding: "8px 0 0",
          borderTop: "1px solid #e3e3e7",
          marginTop: 2,
        }}
      >
        <Swatch label="bg" value={theme.bg} />
        <Swatch label="card" value={theme.bgContainer} />
        <Swatch label="text" value={theme.textPrimary} />
        <Swatch label="muted" value={theme.textMuted} />
        <Swatch label="accent" value={theme.accent} />
        <Swatch label="btn" value={theme.buttonBg} />
        <Swatch label="bubble out" value={theme.bubbleOut} />
      </div>
    </section>
  );
}

export default function ThemePrototypesPage(): React.JSX.Element {
  return (
    <main
      data-nex-theme-prototypes
      style={{
        minHeight: "100dvh",
        background: "#eceef2",
        padding: "24px 16px 60px",
        fontFamily: SANS,
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <header style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#1D1D1F" }}>
            Theme prototypes · free chat page
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#555", maxWidth: 680, lineHeight: 1.5 }}>
            Compare 5 colour directions side-by-side. Each phone frame renders a mock Free NEX Chat with the
            theme applied · header, side drawer peek, incoming/outgoing bubbles, composer, and primary CTA.
            The last frame is the current dark emerald for reference. Pick one · reply with the theme name
            and I'll apply it to the real free-chat surface.
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 20,
          }}
        >
          {THEMES.map((theme) => (
            <ThemePanel key={theme.key} theme={theme} />
          ))}
        </div>

        <footer style={{ marginTop: 32, textAlign: "center", fontSize: 11, color: "#999" }}>
          Theme prototypes · {new Date().toISOString().slice(0, 10)} · not sealed · for comparison only
        </footer>
      </div>
    </main>
  );
}
