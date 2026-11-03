// src/app/nex-native/free-chat/bubble-customize/_color-drawer.tsx
//
// NEX · Free Chat · colour-picker overlay.
// Owner-authorised 2026-11-02 (revision 2 · glass-backdrop pattern).
// -----------------------------------------------------------------------------
// Tapping a colour-choice pill on the bubble-customize page opens this
// full-screen glass overlay. Pattern is byte-identical to the sealed
// magnifying-glass "Live categories" overlay (_header-search.tsx):
//
//   · backdrop · rgba(0,0,0,0.35) + blur(24px) saturate(140%)
//   · no inner panel · just the glass + floating round swatches
//   · close × in the top-right corner
//   · esc + backdrop tap dismiss
//
// Layout contract · the entire palette (29 swatches) MUST fit the
// viewport without scrolling. Swatch size + grid gap are tuned so the
// 7-column auto-fit flow lays 29 items in ~5 rows that fit a 667px
// phone with safe-area insets.
//
// Taps NEVER close the overlay by themselves · the parent commits the
// pick + closes. Pattern lets the parent run contrast-ink pre-checks
// before applying.

"use client";

import * as React from "react";
import { BUBBLE_PALETTE } from "../_types";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTE = "#7D9BC0";
const RING_ACTIVE = "var(--nex-world-secondary, #C6A15B)";
const CLOSE_RIM =
  "color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 40%, transparent)";

export interface ColorDrawerProps {
  readonly open: boolean;
  readonly title: string;
  readonly activeHex: string;
  readonly onPick: (hex: string) => void;
  readonly onClose: () => void;
  /** When true the drawer exposes a 2-page carousel · page 1 is the
   *  colour grid · page 2 is the pattern grid (placeholder until the
   *  owner ships designs). Only the Page Background button opens the
   *  drawer with this flag · peer / self stay single-page. */
  readonly showPatterns?: boolean;
}

type DrawerPage = "colors" | "patterns";

export function ColorDrawer({
  open,
  title,
  activeHex,
  onPick,
  onClose,
  showPatterns = false,
}: ColorDrawerProps): React.JSX.Element | null {
  const [page, setPage] = React.useState<DrawerPage>("colors");

  // Reset to the colours page every time the drawer re-opens so the
  // user always sees the colour grid first.
  React.useEffect(() => {
    if (open) setPage("colors");
  }, [open]);

  // Esc dismisses · arrow keys page when patterns are enabled.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
      if (showPatterns && e.key === "ArrowRight") setPage("patterns");
      if (showPatterns && e.key === "ArrowLeft") setPage("colors");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, showPatterns]);

  // Lock body scroll while the overlay is open.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-nex-color-drawer-root
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
      }}
    >
      {/* Faded glass backdrop · magnifying-glass overlay look.
          Owner report 2026-11-02 · the previous 35% dark + blur let
          the Ireland emerald wrapper bleed through on the empty edges
          of the customize page (narrower content column than the chat
          surface the glass was first tuned against). Opacity bumped
          to 72% so the glass reads as a true dark panel at every
          viewport width, with the 24px blur still softening whatever
          content sits behind it. Tapping dismisses. */}
      <button
        type="button"
        aria-label="Close color picker"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, rgba(2, 9, 20, 0.72) 0%, rgba(2, 9, 20, 0.92) 100%)",
          backdropFilter: "blur(24px) saturate(140%)",
          WebkitBackdropFilter: "blur(24px) saturate(140%)",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      />

      {/* Close × · top-right · universal exit, same corner as the
          magnifying-glass overlay. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + 16px)",
          right: 16,
          width: 40,
          height: 40,
          borderRadius: "50%",
          // Owner directive 2026-11-03 · solid NEX Orange close
          // button · unified across every modal / sheet.
          background: "#FF7200",
          border: "1px solid rgba(0, 0, 0, 0.35)",
          color: "#1a0a00",
          cursor: "pointer",
          fontSize: 22,
          fontWeight: 800,
          lineHeight: 1,
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 10px rgba(255, 114, 0, 0.5)",
          zIndex: 2,
        }}
      >
        ×
      </button>

      {/* Centered content · title + swatch grid · no inner container ·
          just floating on the glass. Fits viewport without scrolling. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding:
            "calc(env(safe-area-inset-top, 0px) + 70px) 16px calc(env(safe-area-inset-bottom, 0px) + 20px)",
          gap: 20,
          color: INK,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          overflow: "hidden",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: INK_MUTE,
            }}
          >
            {page === "colors" ? "Choose a colour" : "Choose a pattern"}
          </p>
          <h2
            style={{
              margin: "6px 0 0",
              fontSize: 18,
              fontWeight: 700,
              color: INK,
              textShadow: "0 2px 10px rgba(0, 0, 0, 0.6)",
            }}
          >
            {title}
          </h2>
        </div>

        {page === "colors" ? (
          <ul
            data-nex-color-drawer-grid
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(52px, 60px))",
              gap: "10px 10px",
              justifyContent: "center",
              maxWidth: "min(96vw, 520px)",
            }}
          >
            {BUBBLE_PALETTE.map((p) => {
              const isActive = p.hex.toUpperCase() === activeHex.toUpperCase();
              return (
                <li
                  key={p.hex}
                  style={{ display: "flex", justifyContent: "center" }}
                >
                  <button
                    type="button"
                    onClick={() => onPick(p.hex)}
                    aria-label={`${p.label} · ${p.hex}`}
                    aria-pressed={isActive}
                    data-nex-color-drawer-swatch={p.hex}
                    data-nex-color-drawer-swatch-active={
                      isActive ? "true" : "false"
                    }
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      padding: 0,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: INK_DIM,
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <span
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: "50%",
                        background: p.hex,
                        border: isActive
                          ? `3px solid ${RING_ACTIVE}`
                          : `2px solid rgba(255, 255, 255, 0.18)`,
                        boxShadow: isActive
                          ? `0 0 14px color-mix(in srgb, ${RING_ACTIVE} 45%, transparent)`
                          : "0 2px 6px rgba(0, 0, 0, 0.4)",
                        display: "block",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 9,
                        lineHeight: 1.1,
                        textAlign: "center",
                        color: INK_DIM,
                        textShadow: "0 1px 2px rgba(0, 0, 0, 0.7)",
                        maxWidth: 60,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          // Patterns placeholder · awaiting owner designs. Keeps the
          // layout stable + the arrow footer wired so the carousel is
          // ready to drop pattern tiles in when designs land.
          <div
            data-nex-color-drawer-patterns-placeholder
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              minHeight: 180,
              padding: "20px 24px",
              textAlign: "center",
              color: INK_DIM,
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.7)",
            }}
          >
            <span
              aria-hidden
              style={{
                fontSize: 32,
                lineHeight: 1,
                color: INK,
              }}
            >
              ◇
            </span>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: INK }}>
              Patterns coming soon
            </p>
            <p style={{ margin: 0, fontSize: 12, maxWidth: 320 }}>
              Pattern tiles will land here once the owner ships the
              designs. Swipe back to pick a colour in the meantime.
            </p>
          </div>
        )}

        {/* Prev / next footer · ONLY visible when the Background drawer
            is open (showPatterns=true). Peer / self stay single-page. */}
        {showPatterns ? (
          <nav
            aria-label="Drawer pages"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
              marginTop: 4,
            }}
          >
            <button
              type="button"
              onClick={() => setPage("colors")}
              aria-label="Previous page · colours"
              disabled={page === "colors"}
              data-nex-color-drawer-prev
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(0, 0, 0, 0.4)",
                border: `1px solid ${CLOSE_RIM}`,
                color: INK,
                cursor: page === "colors" ? "not-allowed" : "pointer",
                opacity: page === "colors" ? 0.3 : 1,
                fontSize: 20,
                lineHeight: 1,
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
              }}
            >
              ‹
            </button>
            <span
              style={{
                fontSize: 11,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                color: INK_MUTE,
                minWidth: 76,
                textAlign: "center",
              }}
            >
              {page === "colors" ? "1 / 2 · Colours" : "2 / 2 · Patterns"}
            </span>
            <button
              type="button"
              onClick={() => setPage("patterns")}
              aria-label="Next page · patterns"
              disabled={page === "patterns"}
              data-nex-color-drawer-next
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(0, 0, 0, 0.4)",
                border: `1px solid ${CLOSE_RIM}`,
                color: INK,
                cursor: page === "patterns" ? "not-allowed" : "pointer",
                opacity: page === "patterns" ? 0.3 : 1,
                fontSize: 20,
                lineHeight: 1,
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
              }}
            >
              ›
            </button>
          </nav>
        ) : null}

        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: INK_DIM,
            textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)",
          }}
        >
          Tap outside or press Esc to close
        </p>
      </div>
    </div>
  );
}
