"use client";

// src/app/nex-native/free-chat/_call-center-drawer-client.tsx
//
// NEX · Free Chat · Call Center floating 3-dots trigger + left-slide panel.
// Owner-authorised 2026-10-21 (iteration 38 · wired through iteration 40).
// -----------------------------------------------------------------------------
// Floating 3-dots button pinned to the bottom-right of the chat frame.
// On tap, slides a Call Center panel in from the LEFT edge. Panel
// contains voice/video/dial-pad/recent/contacts entry rows · all
// visual placeholders today (no actual call engine wiring).
//
// Positioning rationale:
//   · `position: absolute` on both the FAB and the panel so they stay
//     INSIDE the global phone frame on desktop (never escape to the
//     browser viewport, per nex-native.css:148).
//   · FAB sits above the composer (bottom: 72px) so it doesn't overlap
//     the composer input / send button.
//   · Panel + backdrop sit above everything else (zIndex 500) so they
//     render over the composer + guest CTA.

import * as React from "react";
import Link from "next/link";

const C = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.42)",
  orange: "#FF7200",
  green: "#16D66B",
  // Owner directive 2026-10-21 (iteration 43) · Joker-chrome parity ·
  // panel background matches the sealed ControlDrawer `BG` exactly so
  // the Call Center drawer reads as the same drawer system.
  navy: "var(--nex-world-background-base, #020914)",
  panel: "rgba(5, 15, 28, 0.96)",
  // Owner directive 2026-10-21 (iteration 43) · `panelBorder` tightened
  // to the sealed ControlDrawer `PANEL_BORDER` value (rgba(0,175,255,0.18))
  // instead of the previous 0.28 so the border reads at the same weight
  // as every other NEX drawer edge.
  panelBorder: "rgba(0, 175, 255, 0.18)",
  divider: "rgba(255, 255, 255, 0.06)",
};

interface CallCenterRow {
  readonly id: string;
  readonly label: string;
  readonly glyph: string;
  readonly accent: string;
  readonly sub: string;
  /** Owner directive 2026-10-21 (iteration 40, re-wired iteration 42) · every row routes to
   *  a real, verified page:
   *    voice    → /nex-native/free-chat/call      (NEW · design-matched · HTTP 200)
   *    video    → /nex-native/call/preview        (HTTP 200 for guests)
   *    dial     → /nex-native/call/dial           (HTTP 200)
   *    recent   → /nex-native/calls               (HTTP 307 · guest → /sign-in)
   *    contacts → /nex-native/contacts            (HTTP 307 · guest → /sign-in)
   *  No row dead-ends on a 404 anymore. */
  readonly href: string;
}

const ROWS: readonly CallCenterRow[] = [
  { id: "voice", label: "Voice call", glyph: "📞", accent: C.green, sub: "Start a 1:1 or group voice call", href: "/nex-native/free-chat/call" },
  { id: "video", label: "Video call", glyph: "📹", accent: C.cyan, sub: "Camera on · HD when connection allows", href: "/nex-native/call/preview" },
  { id: "dial", label: "Dial pad", glyph: "⌨️", accent: C.cyan, sub: "Dial a NEX handle or phone number", href: "/nex-native/call/dial" },
  { id: "recent", label: "Recent calls", glyph: "📋", accent: C.textDim, sub: "Review your call history", href: "/nex-native/calls" },
  { id: "contacts", label: "Contacts", glyph: "👥", accent: C.textDim, sub: "Pick a contact to call", href: "/nex-native/contacts" },
];

export function FreeChatCallCenterDrawerClient(): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  // Esc closes · keyboard-accessible dismiss.
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      {/* Floating 3-dots trigger · bottom-right · pinned above composer
          Owner directive 2026-10-21 (iteration 39) · matched to the
          sealed header ControlDrawer trigger:
            · 36×36 button (same as header trigger size)
            · chromeless default · subtle semi-transparent navy halo
              only so the glyph stays discoverable over chat bubbles
            · vertical 3-dot SVG · identical geometry to the sealed
              ThreeDotIcon (22×22 · cy=5/12/19 · r=1.6)
            · text/color accent via NEX.text to match the header
              glyph tone. */}
      <button
        type="button"
        aria-label="Open call center"
        aria-expanded={open}
        aria-controls="nex-free-chat-call-center-panel"
        onClick={() => setOpen(true)}
        data-nex-free-chat-call-center-trigger
        data-nex-free-chat-call-center-trigger-open={open ? "true" : "false"}
        style={{
          position: "absolute",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)",
          right: 10,
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: open
            ? "rgba(0, 175, 255, 0.14)"
            : "rgba(2, 9, 20, 0.55)",
          color: open ? C.cyan : C.text,
          border: "none",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
          padding: 0,
          zIndex: 400,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          transition: "background 180ms ease, color 180ms ease",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <ThreeDotsIcon color={open ? C.cyan : C.text} />
      </button>

      {/* Backdrop · same shape as the sealed ControlDrawer backdrop ·
          dim 0.55 black · 200ms fade · dismiss on tap. Owner directive
          2026-10-21 (iteration 43) · Joker-chrome parity. */}
      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        data-nex-free-chat-call-center-backdrop
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.55)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 200ms ease-out",
          zIndex: 500,
          cursor: "pointer",
        }}
      />

      {/* Left-slide panel · owner directive 2026-10-21 (iteration 43) ·
          now matches the sealed ControlDrawer chrome from Joker /
          every other NEX surface:
            · width `min(320px, 85%)` max 360 (was 72% / max 260)
            · panel BG `#020914` NEX navy (was translucent navy)
            · border on the visible edge (right-side of this left
              panel) uses the same cyan-tinted PANEL_BORDER as Joker
            · header + "Close" blue chip identical to Joker
            · section-group rows (text label + subtitle) · no circular
              icon badges, no row-level accents
            · "CALL CENTER" uppercase section title above rows
            · 200ms ease-out transition. */}
      <aside
        id="nex-free-chat-call-center-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Call Center"
        aria-hidden={!open}
        data-nex-free-chat-call-center-panel
        data-nex-free-chat-call-center-panel-open={open ? "true" : "false"}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          height: "100%",
          maxHeight: "100%",
          width: "min(320px, 85%)",
          maxWidth: 360,
          background: C.navy,
          borderRight: `1.5px solid ${C.panelBorder}`,
          boxShadow: "8px 0 32px rgba(0, 0, 0, 0.6)",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 200ms ease-out",
          willChange: "transform",
          display: "flex",
          flexDirection: "column",
          overflowX: "hidden",
          overflowY: "auto",
          zIndex: 600,
          color: C.text,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        {/* Panel header · matches sealed ControlDrawer DrawerHeader
            exactly · "Call Center" title + small blue "Close" chip. */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px 10px 16px",
            borderBottom: `1px solid ${C.panelBorder}`,
          }}
        >
          <h2
            style={{
              margin: 0,
              color: C.text,
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: 0.3,
            }}
          >
            Call Center
          </h2>
          <button
            type="button"
            aria-label="Close call center"
            onClick={() => setOpen(false)}
            data-nex-free-chat-call-center-close
            style={{
              minHeight: 26,
              padding: "3px 10px",
              // Owner directive 2026-11-03 · unified NEX Orange close
              // buttons across every modal / sheet / drawer. Rule
              // applies here too even though the Call Center drawer
              // was sealed earlier · the orange directive post-dates
              // the Call Center cyan close.
              background: "#FF7200",
              border: "1px solid rgba(0, 0, 0, 0.35)",
              color: "#1a0a00",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.4,
              lineHeight: 1,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 6,
              fontFamily: "inherit",
              boxShadow: "0 2px 6px rgba(255, 114, 0, 0.45)",
            }}
          >
            Close
          </button>
        </header>

        {/* Body · section group ("CALL CENTER" title + rows) · same
            layout as Joker's SectionGroup. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "12px 12px 24px 12px",
          }}
        >
          <section
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              marginTop: 10,
            }}
          >
            <h3
              style={{
                margin: "0 0 4px 12px",
                color: C.textMute,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 1.1,
                textTransform: "uppercase",
              }}
            >
              CALL CENTER
            </h3>
            <ul
              data-nex-free-chat-call-center-rows
              aria-label="Call center actions"
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              {ROWS.map((row) => (
                <li key={row.id} style={{ margin: 0, padding: 0 }}>
                  <Link
                    href={row.href}
                    data-nex-free-chat-call-center-row={row.id}
                    data-nex-free-chat-call-center-row-href={row.href}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      padding: "10px 12px",
                      borderRadius: 10,
                      textDecoration: "none",
                      background: "transparent",
                      color: C.text,
                    }}
                  >
                    <span
                      style={{
                        color: C.text,
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {row.label}
                    </span>
                    <span
                      style={{
                        color: C.textMute,
                        fontSize: 11,
                        lineHeight: 1.3,
                      }}
                    >
                      {row.sub}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>

      {/* prefers-reduced-motion override + desktop phone-frame bezel
          clip · mirrored copy of the sealed ControlDrawer <style>
          block so the left-side drawer traces the frame's rounded
          left edge cleanly on desktop. */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          [data-nex-free-chat-call-center-panel],
          [data-nex-free-chat-call-center-backdrop] {
            transition: none !important;
          }
        }
        @media (min-width: 500px) {
          [data-nex-free-chat-call-center-panel] {
            border-radius: 44px 0 0 44px;
          }
          [data-nex-free-chat-call-center-backdrop] {
            border-radius: 44px;
          }
        }
      `}</style>
    </>
  );
}

function ThreeDotsIcon({ color }: { color: string }): React.JSX.Element {
  // Owner directive 2026-10-21 (iteration 39) · exact geometry match
  // to the sealed ControlDrawer `ThreeDotIcon` so the free-chat FAB
  // reads as the same primitive as the header 3-dots:
  //   · 22×22 outer · viewBox 0 0 24 24
  //   · 3 VERTICAL dots at cx=12, cy=5/12/19, r=1.6
  //   · fill = passed-in text/accent colour.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx={12} cy={5} r={1.6} fill={color} />
      <circle cx={12} cy={12} r={1.6} fill={color} />
      <circle cx={12} cy={19} r={1.6} fill={color} />
    </svg>
  );
}
