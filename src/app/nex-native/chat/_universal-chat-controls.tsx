"use client";

// src/app/nex-native/chat/_universal-chat-controls.tsx
//
// UNIVERSAL CHAT CONTROLS · Stage 1 · sealed 2026-10-05.
//
// The universal "world controls" menu that sits inside the production
// chat shell (PortraitBloomShell). Carries the sealed universal NEX
// capabilities every theme must provide:
//
//   · 3-dots floating trigger (lower-right)
//   · Call · Video Call · Mic · Status · Trust Scan · theme-slot
//
// Load-bearing architectural rules (Stage 1):
//
//   · This component is PART OF the chat shell · it is imported into
//     PortraitBloomShell and rendered inside the shell's JSX tree. It
//     is NOT a sibling-overlay patch mounted at page level · the
//     founder explicitly ruled out that pattern for Stage 1.
//   · The functional actions (Trust Scan · Call · Video · Mic · Status)
//     render for EVERY theme. There are no theme-id branches here.
//   · Theme-specific atmosphere (Joker's Rain/Bats/Lightning · Haunted
//     Hotel's FX panel) is NOT part of this component · atmosphere is
//     declarative via `chat-render/atmosphere-registry.ts` and mounts
//     separately via `ThemeAtmosphereLayer` from the page.
//   · Theming of the controls themselves (border/glow/accent) is prop-
//     driven via `accent` so each theme can tint consistent chrome
//     without changing structure.
//
// Why Trust Scan lives HERE and not in JokerController anymore:
//
//   Trust Scan is a NEX identity-verification product, not a theme
//   feature. Before Stage 1 it was only reachable via Joker's custom
//   3-dots panel · every non-Joker theme had no access path. Moving
//   it to the universal controls makes it available on every theme
//   and removes a functional parity gap. JokerController continues to
//   exist for ambient toggles (Rain/Bats/Lightning · Wise Card) which
//   ARE theme-specific atmosphere.
//
// Props:
//   accent         · theme accent colour · defaults NEX cyan
//   deep           · theme deep base · defaults NEX deep blue
//   scannedAccountId · when non-null, Trust Scan opens targeting this
//                    account. When null, the Trust Scan action is
//                    hidden (surfaces without a scannable subject,
//                    e.g. anonymous surfaces).
//   viewerAccountId · the viewer looking at the scan · drives the
//                    "your history with them" block. Null when the
//                    viewer is anonymous.

import * as React from "react";
import { TrustScan } from "@/app/nex-native/_trust-scan/TrustScan";
import { mockTrustScanProvider } from "@/app/nex-native/_trust-scan/trust-scan-mock-provider";
import { NEX_TRUST_SCAN_SKIN } from "@/app/nex-native/_trust-scan/trust-scan-skin";
import { JokerMotionOverlay } from "@/app/nex-native/themes/[id]/_joker-motion";
import {
  JOKER_MOTION_INDEX,
  type JokerMotionVariant,
} from "@/app/nex-native/themes/[id]/_joker-motion-data";

const NEX_CYAN = "#00AFFF";
const NEX_DEEP = "var(--nex-world-background-base, #020914)";
const NEX_HIGHLIGHT = "#F4F7FC";

/** Glyph map · one emoji per sealed JokerMotionVariant. Keyed off
 *  the variant id so adding a new variant to `JOKER_MOTION_INDEX`
 *  requires adding a glyph here (otherwise it falls back to •). */
const MOTION_GLYPH: Record<JokerMotionVariant, string> = {
  rain: "💧",
  sparks: "⚡",
  bat: "🦇",
  cards: "🃏",
  lightning: "🌩",
  bubbles: "🫧",
  confetti: "🎉",
  smoke: "💨",
  embers: "🔥",
  glitch: "🌀",
  kiss: "💋",
  lamp: "💡",
  congrats: "🧨",
};

export interface UniversalChatControlsProps {
  accent?: string;
  deep?: string;
  scannedAccountId: string | null;
  viewerAccountId: string | null;
}

export function UniversalChatControls({
  accent = NEX_CYAN,
  deep = NEX_DEEP,
  scannedAccountId,
  viewerAccountId,
}: UniversalChatControlsProps): React.JSX.Element {
  const [actionsOpen, setActionsOpen] = React.useState(false);
  const [trustScanOpen, setTrustScanOpen] = React.useState(false);

  // Sealed 2026-10-11 · auto-close timer · when the 3-dot opens, if
  // the user does nothing for 5 seconds, both slider groups
  // (horizontal call actions + vertical motion variants) auto-close.
  // Timer is cleared the moment the user manually closes (toggles
  // the 3-dot off) OR unmounts the chat. Simple time-based close
  // without interaction tracking · if the user is actively picking
  // animations, the toggles still work until the 5s elapses · tap
  // the 3-dot again to re-open.
  React.useEffect(() => {
    if (!actionsOpen) return;
    const id = window.setTimeout(() => setActionsOpen(false), 5000);
    return () => window.clearTimeout(id);
  }, [actionsOpen]);
  // Sealed 2026-10-11 · when the 3-dot opens, a vertical column of
  // JokerMotionVariant toggles slides UP alongside the horizontal
  // call-actions row that slides LEFT. Each button toggles ONE
  // motion variant on/off independently · the enabled Set renders
  // real `JokerMotionOverlay`s below. Same renderer the Animation
  // gallery page uses · universal across every theme that mounts
  // UniversalChatControls (every theme using PortraitBloomShell).
  const [enabledMotions, setEnabledMotions] = React.useState<
    Set<JokerMotionVariant>
  >(() => new Set());
  const toggleMotion = (v: JokerMotionVariant) =>
    setEnabledMotions((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });

  const circle: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 999,
    border: `1px solid ${accent}99`,
    background: `linear-gradient(180deg, ${deep}d9, ${deep}f2)`,
    color: NEX_HIGHLIGHT,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    padding: 0,
    boxShadow: `0 6px 16px rgba(0,0,0,0.5), 0 0 0 1px ${accent}33`,
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
  };
  const toggleActive: React.CSSProperties = actionsOpen
    ? {
        background: `linear-gradient(180deg, ${accent}cc, ${accent}f0)`,
        border: `1px solid ${accent}`,
      }
    : {};
  const actionWrap: React.CSSProperties = {
    display: "flex",
    gap: 8,
    alignItems: "center",
    opacity: actionsOpen ? 1 : 0,
    transform: `translateX(${actionsOpen ? 0 : 20}px)`,
    transition:
      "opacity 220ms ease-out, transform 300ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
    pointerEvents: actionsOpen ? "auto" : "none",
  };

  const showTrustScan = !!scannedAccountId;

  // Sealed 2026-10-11 (final) · 3-dot sits DIRECTLY ABOVE the +
  // button. The composer footer paints `[pill] [send] [+]` at
  // bottom:safe+10 with 10px right padding · the + button is at
  // right:10 · the send button is at right:58. Placing the 3-dot
  // at right:58 (my earlier mistake) covered the send button.
  // Correct position: right:10 (same horizontal as +), bottom:63
  // (10 base + 40 button + 8 gap + 5 lift · founder-sealed
  // "move up 3-dot 5px" 2026-10-11).
  const CHROME_BOTTOM = 10 + 40 + 8 + 5; // 5px above the + button gap
  const CHROME_RIGHT = 10; // same horizontal lane as +
  // The animation column stacks above the 3-dot · anchor at
  // 3-dot bottom + 3-dot height + gap.
  const COLUMN_BOTTOM = CHROME_BOTTOM + 40 + 8;

  return (
    <>
      {/* Vertical motion-variant column · slides UP from the 3-dot
          when `actionsOpen`. Each button toggles one of the 10
          sealed JOKER_MOTION_INDEX variants. Shares actionsOpen
          state with the horizontal call-actions row. */}
      <div
        aria-hidden={!actionsOpen}
        data-nex-universal-animation-column={actionsOpen ? "open" : "closed"}
        style={{
          position: "fixed",
          right: CHROME_RIGHT,
          bottom: `calc(env(safe-area-inset-bottom, 0) + ${COLUMN_BOTTOM}px)`,
          zIndex: 60,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "center",
          opacity: actionsOpen ? 1 : 0,
          transform: actionsOpen ? "translateY(0)" : "translateY(16px)",
          pointerEvents: actionsOpen ? "auto" : "none",
          transition:
            "opacity 220ms ease-out, transform 300ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
        }}
      >
        {JOKER_MOTION_INDEX.map((motion) => {
          const isOn = enabledMotions.has(motion.variant);
          const glyph = MOTION_GLYPH[motion.variant] ?? "•";
          return (
            <button
              key={motion.variant}
              type="button"
              aria-label={`${motion.label} ${isOn ? "on" : "off"}`}
              aria-pressed={isOn}
              data-nex-animation-variant={motion.variant}
              data-nex-animation-variant-state={isOn ? "on" : "off"}
              onClick={() => toggleMotion(motion.variant)}
              style={{
                position: "relative",
                width: 40,
                height: 40,
                borderRadius: 999,
                background: isOn
                  ? `linear-gradient(180deg, ${accent}, ${accent}cc)`
                  : "rgba(2,9,20,0.72)",
                border: `1px solid ${isOn ? accent : "rgba(244,247,252,0.2)"}`,
                color: isOn ? deep : NEX_HIGHLIGHT,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                fontFamily: "inherit",
                padding: 0,
                fontSize: 18,
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                boxShadow: isOn
                  ? `0 4px 14px -4px ${accent}99`
                  : `0 4px 10px -4px rgba(0,0,0,0.6)`,
                transition: "background 160ms ease, border-color 160ms ease",
              }}
            >
              <span aria-hidden>{glyph}</span>
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: isOn ? "#22C55E" : "rgba(244,247,252,0.25)",
                  border: `2px solid ${deep}`,
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Live motion overlays · one per enabled variant · each uses
          the same JokerMotionOverlay the Animation gallery renders.
          One-shot variants (kiss) receive an `onComplete` that
          removes them from the enabled set so the user returns to
          chat automatically when playback ends · ambient looping
          variants ignore the callback and stay on until the user
          toggles them off. */}
      {[...enabledMotions].map((variant) => (
        <JokerMotionOverlay
          key={variant}
          variant={variant}
          onComplete={() =>
            setEnabledMotions((prev) => {
              const next = new Set(prev);
              next.delete(variant);
              return next;
            })
          }
        />
      ))}

      <div
        data-nex-universal-chat-controls
        data-nex-universal-chat-controls-state={actionsOpen ? "open" : "closed"}
        style={{
          position: "fixed",
          right: CHROME_RIGHT,
          bottom: `calc(env(safe-area-inset-bottom, 0) + ${CHROME_BOTTOM}px)`,
          zIndex: 60,
          display: "flex",
          flexDirection: "row",
          gap: 8,
          alignItems: "center",
        }}
      >
        <div style={actionWrap}>
          {showTrustScan && (
            <button
              type="button"
              aria-label="NEX Trust Scan"
              data-nex-universal-chat-action="trust-scan"
              onClick={() => {
                setTrustScanOpen(true);
                setActionsOpen(false);
              }}
              style={circle}
            >
              <TrustIcon />
            </button>
          )}
          <a
            href="/nex-native/dev/status-viewer-v1"
            aria-label="Status"
            data-nex-universal-chat-action="status"
            style={{ ...circle, textDecoration: "none" }}
          >
            <StatusIcon />
          </a>
          <button
            type="button"
            aria-label="Mic"
            data-nex-universal-chat-action="mic"
            style={circle}
          >
            <MicIcon />
          </button>
          <button
            type="button"
            aria-label="Video call"
            data-nex-universal-chat-action="video"
            style={circle}
          >
            <VideoCallIcon />
          </button>
          <button
            type="button"
            aria-label="Call"
            data-nex-universal-chat-action="call"
            style={circle}
          >
            <CallIcon />
          </button>
        </div>
        {/* Owner directive 2026-11-13 · "turn vertical and remove the
            button but dots little bigger and flashing and move to
            right side". Dots were housed inside the standard circle
            chip (background + border). Retire the chip chrome so the
            3 vertical dots read as a bare glyph. Dots grown from 18
            → 28. Gentle pulse animation (nex-dots-flash) signals
            interactivity without a solid button. Sits at the right
            edge via the existing CHROME_RIGHT anchor · keep the 10px
            safe-area inset so it doesn't touch the frame bezel. */}
        <style>{`
          @keyframes nex-dots-flash {
            0%   { opacity: 0.55; transform: scale(1); }
            50%  { opacity: 1;    transform: scale(1.08); }
            100% { opacity: 0.55; transform: scale(1); }
          }
        `}</style>
        <button
          type="button"
          aria-label={actionsOpen ? "Close actions" : "Open actions"}
          aria-pressed={actionsOpen}
          data-nex-universal-chat-actions-toggle={actionsOpen ? "open" : "closed"}
          onClick={() => setActionsOpen((v) => !v)}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            width: 40,
            height: 40,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            color: accent,
            animation: actionsOpen
              ? "none"
              : "nex-dots-flash 1800ms ease-in-out infinite",
            transition: "color 180ms ease-out",
          }}
        >
          <DotsVerticalIcon />
        </button>
      </div>
      {trustScanOpen && scannedAccountId && (
        <TrustScan
          scannedAccountId={scannedAccountId}
          viewerAccountId={viewerAccountId}
          skin={NEX_TRUST_SCAN_SKIN}
          provider={mockTrustScanProvider}
          onDismiss={() => setTrustScanOpen(false)}
        />
      )}
    </>
  );
}

// ─── Icons · self-contained · no engine dependency ─────────────────

function DotsVerticalIcon(): React.JSX.Element {
  // Owner directive 2026-11-13 · "dots little bigger" · bumped from
  // 18 × 18 with r=1.9 to 28 × 28 with r=2.6 so the glyph reads
  // without the button chrome around it. Vertical alignment preserved
  // · still three dots on the Y axis.
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="12" cy="5" r="2.6" />
      <circle cx="12" cy="12" r="2.6" />
      <circle cx="12" cy="19" r="2.6" />
    </svg>
  );
}

function CallIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6A2 2 0 0 1 22 16.9z" />
    </svg>
  );
}

function VideoCallIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="6" width="13" height="12" rx="2" />
      <path d="M22 7.5 15.5 12 22 16.5v-9z" />
    </svg>
  );
}

function MicIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

function StatusIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" strokeDasharray="4 2.5" />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TrustIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3 4 6v6c0 4.5 3.4 8.4 8 9 4.6-.6 8-4.5 8-9V6l-8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
