"use client";

// src/app/nex-native/chat-standard/_universal-chrome-overlay.tsx
//
// UNIVERSAL THEME CHROME OVERLAY · sealed 2026-10-05.
//
// Mounts the two universal chrome affordances on any theme route
// without touching that theme's shell / composer / viewer:
//
//   - Floating + button (lower-left) → opens the centered + menu
//     with the four sealed actions: Contacts · Product · Animation ·
//     Settings.
//   - Floating 3-dots (lower-right · raised when a theme already
//     has its own 3-dots at the normal position) → reveals Call /
//     Video Call / Mic icons sliding in from the right.
//
// Why this exists · the Standard Experience shell carries these
// chrome rules natively (R7 and R9). Legacy theme shells
// (PortraitBloomShell, hand-coded theme-1/pink-dream/cyber-grid
// pages, the Haunted Hotel prototype) don't. Rather than modify
// each sealed shell, this overlay is dropped on top of them.
//
// Theme-neutral defaults · NEX cyan (`#00AFFF`). Callers may pass
// an `accent` prop to tint the overlay to the theme's identity
// colour.
//
// Props:
//   accent · optional CSS colour · defaults to NEX cyan
//   deep   · optional dark base for buttons/menu · defaults to NEX
//            deep blue
//
// Sealed 2026-10-05 refinement · "one + button, one 3-dots button":
//   - Floating + button + its menu REMOVED · now owned by the
//     UniversalComposerFooter mounted alongside this overlay.
//   - The 3-dots sits at its standard lower-right position on every
//     theme. zIndex 60 visually covers any native theme-specific
//     3-dots behind it, so every live theme shows exactly one.
//
// Sealed 2026-10-06 (Universal Theme Controls Rule) · the chrome
// buttons derive their surface treatment from the shared control
// resolver so they stay solid and visible on every wallpaper (the
// sealed-away semi-transparent `${deep}d9` pattern is still mostly
// solid but the resolver gives us the SAME shape as the shell's
// native buttons · one source of truth).

import * as React from "react";
import { resolveControlsTreatment } from "./_engine/control-resolver";
import { JokerMotionOverlay } from "../themes/[id]/_joker-motion";
import {
  JOKER_MOTION_INDEX,
  type JokerMotionVariant,
} from "../themes/[id]/_joker-motion-data";

const NEX_CYAN = "#00AFFF";
const NEX_SECONDARY = "#4FC3DC";
const NEX_DEEP = "var(--nex-world-background-base, #020914)";
const NEX_HIGHLIGHT = "#F4F7FC";

export interface UniversalChromeOverlayProps {
  accent?: string;
  deep?: string;
  /** Theme highlight · drives icon colour. Defaults to NEX highlight. */
  highlight?: string;
  /** Theme secondary · echoed to the resolver for consistency. */
  secondary?: string;
}

export function UniversalChromeOverlay({
  accent: _accent = NEX_CYAN,
  deep: _deep = NEX_DEEP,
  highlight: _highlight = NEX_HIGHLIGHT,
  secondary: _secondary = NEX_SECONDARY,
}: UniversalChromeOverlayProps): React.JSX.Element | null {
  // Sealed 2026-10-11 (final) · PortraitBloomShell carries
  // `UniversalChatControls` internally with its OWN 3-dot + call
  // actions. Mounting a duplicate `FloatingCallActions` here
  // produced TWO 3-dot buttons on Joker (and every other theme
  // using PortraitBloomShell). The animation column + 3-dot combo
  // reveal have been migrated to the shell's `UniversalChatControls`
  // so there is exactly ONE 3-dot. This overlay now renders null ·
  // the export is preserved so existing imports don't break.
  return null;
}

// ─── Floating + button (lower-left) ─────────────────────────────────

function FloatingPlusButton({
  accent,
  deep,
  open,
  onToggle,
}: {
  accent: string;
  deep: string;
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const activeStyle: React.CSSProperties = open
    ? {
        background: `linear-gradient(180deg, ${accent}cc, ${accent}f0)`,
        border: `1px solid ${accent}`,
      }
    : {
        background: `linear-gradient(180deg, ${deep}d9, ${deep}f2)`,
        border: `1px solid ${accent}99`,
      };
  return (
    <button
      type="button"
      aria-label={open ? "Close menu" : "Add to this chat"}
      aria-pressed={open}
      onClick={onToggle}
      data-nex-universal-plus-toggle={open ? "open" : "closed"}
      style={{
        position: "fixed",
        left: 14,
        bottom: "calc(env(safe-area-inset-bottom, 0) + 76px)",
        zIndex: 60,
        width: 44,
        height: 44,
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        color: NEX_HIGHLIGHT,
        cursor: "pointer",
        padding: 0,
        boxShadow: `0 6px 16px rgba(0,0,0,0.5), 0 0 0 1px ${accent}33`,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        transition: "background 180ms ease-out, border 180ms ease-out",
        ...activeStyle,
      }}
    >
      <PlusIcon />
    </button>
  );
}

// ─── Floating 3-dots call actions (lower-right) ─────────────────────

function FloatingCallActions({
  accent,
  deep,
  highlight,
  secondary,
  open,
  onToggle,
}: {
  accent: string;
  deep: string;
  highlight: string;
  secondary: string;
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  // Universal Theme Controls Rule · sealed 2026-10-06 · chrome
  // buttons use the SAME solid-themed treatment as the header R1
  // buttons via the shared resolver. 40×40 instead of 32×32 so the
  // floating group has enough tap-target weight.
  const controls = resolveControlsTreatment({
    primary: accent,
    secondary,
    highlight,
    deep,
  });
  const circle: React.CSSProperties = {
    ...controls.headerButton,
    width: 40,
    height: 40,
    boxShadow: `0 6px 16px ${deep}66, 0 0 0 1px ${accent}55`,
  };
  const toggleActive: React.CSSProperties = open
    ? {
        background: controls.headerButtonActive.background,
        color: controls.headerButtonActive.color,
        border: controls.headerButtonActive.border,
      }
    : {
        background: circle.background,
        color: circle.color,
        border: circle.border,
      };
  const actionWrap: React.CSSProperties = {
    display: "flex",
    gap: 8,
    alignItems: "center",
    opacity: open ? 1 : 0,
    transform: `translateX(${open ? 0 : 20}px)`,
    transition:
      "opacity 220ms ease-out, transform 300ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
    pointerEvents: open ? "auto" : "none",
  };
  // Owner directive 2026-10-18 (clarified) · "move the 3-dot button
  // back OVER the plus button · inline vertical". The 3-dot now
  // stacks DIRECTLY ABOVE the + button at the same horizontal X.
  // The + button sits at approx right: 10 inside the composer row ·
  // bottom: 72 lifts the 3-dot one button-height + gap above it.
  const bottomOffset = 72;
  const rightOffset = 10;
  return (
    <div
      data-nex-universal-call-actions={open ? "open" : "closed"}
      style={{
        position: "fixed",
        right: rightOffset,
        bottom: `calc(env(safe-area-inset-bottom, 0) + ${bottomOffset}px)`,
        zIndex: 60,
        display: "flex",
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
      }}
    >
      <div style={actionWrap}>
        <a
          href="/nex-native/dev/status-viewer-v1"
          aria-label="Status"
          data-nex-universal-call-action="status"
          style={{ ...circle, textDecoration: "none" }}
        >
          <StatusIcon />
        </a>
        <button
          type="button"
          aria-label="Mic"
          data-nex-universal-call-action="mic"
          style={circle}
        >
          <MicIcon />
        </button>
        <button
          type="button"
          aria-label="Video call"
          data-nex-universal-call-action="video"
          style={circle}
        >
          <VideoCallIcon />
        </button>
        <button
          type="button"
          aria-label="Call"
          data-nex-universal-call-action="call"
          style={circle}
        >
          <CallIcon />
        </button>
      </div>
      <button
        type="button"
        aria-label={open ? "Close actions" : "Open actions"}
        aria-pressed={open}
        onClick={onToggle}
        data-nex-universal-call-actions-toggle={open ? "open" : "closed"}
        style={{
          ...circle,
          ...toggleActive,
          transition: "background 180ms ease-out, border 180ms ease-out",
        }}
      >
        <DotsVerticalIcon />
      </button>
    </div>
  );
}

// ─── Floating animation column (lower-right · slides UP) ─────────────
//
// Sealed 2026-10-11 · "3-dot combo reveal" pattern · the vertical
// stack of ambient-family toggles that appears above the 3-dot when
// the user opens the chat chrome controls. Six buttons · one per
// family · ON state is theme-primary gradient · OFF is near-black
// glass · green/dim bottom-right dot indicator mirrors TikTok's
// count-slot convention.
//
// State: scoped to this component for now (per-session) · a future
// commit can hoist state up to a per-account preference row keyed
// by theme id. The visual pattern is final; the persistence layer
// is swappable without touching rendering.
//
// Note: these toggles do NOT yet affect the live chat rendering ·
// they emit `data-nex-animation-family-{id}="on|off"` on each
// button so a future chat shell can read the current state and
// gate its ambient rendering. Prototype acknowledgement intentional.

// Glyph map · one emoji per sealed JokerMotionVariant. Keyed off
// the variant id so adding a new variant to `JOKER_MOTION_INDEX`
// requires adding a glyph here (otherwise it falls back to •).
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
};

function FloatingAnimationColumn({
  accent,
  deep,
  highlight,
  open,
  enabled,
  onToggle,
}: {
  accent: string;
  deep: string;
  highlight: string;
  open: boolean;
  enabled: Set<JokerMotionVariant>;
  onToggle: (variant: JokerMotionVariant) => void;
}): React.JSX.Element {
  const circle: React.CSSProperties = {
    position: "relative",
    width: 40,
    height: 40,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    fontFamily: "inherit",
    padding: 0,
    fontSize: 18,
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    transition: "background 160ms ease, border-color 160ms ease",
  };
  // Sealed 2026-10-11 · 3-dot now anchors at `right: 58, bottom: 10`
  // (inline with composer's + button). The animation column stacks
  // vertically ABOVE the 3-dot, so its bottom = 10 + 40 + 8 = 58
  // and its right matches the 3-dot's `right: 58`. Previously
  // 76+40+8=124 which left a big gap above the composer.
  const bottomOffset = 10 + 40 + 8;
  const rightOffset = 58;
  return (
    <div
      data-nex-universal-animation-column={open ? "open" : "closed"}
      style={{
        position: "fixed",
        right: rightOffset,
        bottom: `calc(env(safe-area-inset-bottom, 0) + ${bottomOffset}px)`,
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "center",
        opacity: open ? 1 : 0,
        transform: open ? "translateY(0)" : "translateY(16px)",
        pointerEvents: open ? "auto" : "none",
        transition:
          "opacity 220ms ease-out, transform 300ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
      }}
    >
      {JOKER_MOTION_INDEX.map((motion) => {
        const isOn = enabled.has(motion.variant);
        const glyph = MOTION_GLYPH[motion.variant] ?? "•";
        return (
          <button
            key={motion.variant}
            type="button"
            aria-label={`${motion.label} ${isOn ? "on" : "off"}`}
            aria-pressed={isOn}
            data-nex-animation-variant={motion.variant}
            data-nex-animation-variant-state={isOn ? "on" : "off"}
            onClick={() => onToggle(motion.variant)}
            style={{
              ...circle,
              background: isOn
                ? `linear-gradient(180deg, ${accent}, ${hexToRgba(accent, 0.8)})`
                : "rgba(2,9,20,0.72)",
              border: `1px solid ${isOn ? accent : hexToRgba(highlight, 0.2)}`,
              color: isOn ? deep : highlight,
              boxShadow: isOn
                ? `0 4px 14px -4px ${hexToRgba(accent, 0.6)}`
                : `0 4px 10px -4px rgba(0,0,0,0.6)`,
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
                background: isOn ? "#22C55E" : hexToRgba(highlight, 0.25),
                border: `2px solid ${deep}`,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Convert a hex colour (#RGB · #RRGGBB) to an rgba() string. Local
 *  helper so this file remains self-contained (overlays are the
 *  universal chrome · no engine import). */
function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex ?? "").replace(/^#/, "");
  if (clean.length !== 3 && clean.length !== 6) return `rgba(0,175,255,${alpha})`;
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean;
  const n = parseInt(full, 16);
  if (!Number.isFinite(n)) return `rgba(0,175,255,${alpha})`;
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── + menu (centered dialog) ───────────────────────────────────────

function FloatingPlusMenu({
  accent,
  deep,
  open,
  onClose,
}: {
  accent: string;
  deep: string;
  open: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const option: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    padding: "10px 4px",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    borderRadius: 14,
    border: `1px solid ${accent}66`,
    background: `${accent}1a`,
    color: NEX_HIGHLIGHT,
    cursor: "pointer",
    textAlign: "center",
    fontFamily: "inherit",
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.1,
    overflow: "hidden",
    transition: "background 160ms ease-out, transform 160ms ease-out",
  };
  const iconCircle: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: `linear-gradient(135deg, ${accent}, ${accent}aa)`,
    color: NEX_HIGHLIGHT,
    boxShadow: `0 2px 6px ${accent}55`,
    flex: "none",
  };
  return (
    <div
      aria-hidden={!open}
      data-nex-universal-plus-menu={open ? "open" : "closed"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: open ? "auto" : "none",
        opacity: open ? 1 : 0,
        transition: "opacity 200ms ease-out",
      }}
    >
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />
      <div
        role="dialog"
        aria-label="Chat actions"
        style={{
          position: "relative",
          padding: 18,
          borderRadius: 22,
          background: `linear-gradient(180deg, ${deep}e6, ${deep}f5)`,
          border: `1px solid ${accent}99`,
          boxShadow: `0 20px 50px rgba(0,0,0,0.55), 0 0 0 1px ${accent}22`,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          width: "min(360px, 92vw)",
          boxSizing: "border-box",
          transform: `scale(${open ? 1 : 0.9})`,
          transition:
            "transform 240ms cubic-bezier(0.2, 0.9, 0.3, 1.1), opacity 220ms ease-out",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: NEX_HIGHLIGHT,
            letterSpacing: "0.02em",
            textAlign: "center",
          }}
        >
          Add to this chat
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
            justifyItems: "center",
          }}
        >
          <button
            type="button"
            data-nex-universal-plus-action="contacts"
            aria-label="Add contact to chat"
            style={option}
          >
            <span aria-hidden style={iconCircle}>
              <ContactsIcon />
            </span>
            <span>Contacts</span>
          </button>
          <button
            type="button"
            data-nex-universal-plus-action="product"
            aria-label="Add, edit, delete or turn off a product"
            style={option}
          >
            <span aria-hidden style={iconCircle}>
              <ProductIcon />
            </span>
            <span>Product</span>
          </button>
          <button
            type="button"
            data-nex-universal-plus-action="animation"
            aria-label="Open all theme animations"
            style={option}
          >
            <span aria-hidden style={iconCircle}>
              <AnimationIcon />
            </span>
            <span>Animation</span>
          </button>
          <button
            type="button"
            data-nex-universal-plus-action="settings"
            aria-label="Open settings page"
            style={option}
          >
            <span aria-hidden style={iconCircle}>
              <SettingsIcon />
            </span>
            <span>Settings</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            alignSelf: "center",
            marginTop: 2,
            padding: "6px 14px",
            borderRadius: 999,
            border: `1px solid ${NEX_HIGHLIGHT}33`,
            background: "transparent",
            color: NEX_HIGHLIGHT,
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Icons (self-contained · no engine dependency) ──────────────────

function PlusIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function DotsVerticalIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"
      aria-hidden>
      <circle cx="12" cy="5" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="12" cy="19" r="1.9" />
    </svg>
  );
}

function CallIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6A2 2 0 0 1 22 16.9z" />
    </svg>
  );
}

function VideoCallIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="6" width="13" height="12" rx="2" />
      <path d="M22 7.5 15.5 12 22 16.5v-9z" />
    </svg>
  );
}

// R12 entry point 1 · sealed 2026-10-05 · Status icon in the 3-dots
// stack · routes to the full-screen status viewer.
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

function MicIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

function ContactsIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="7" r="2.5" />
      <path d="M15 14c3 0 6 1.5 6 5" />
    </svg>
  );
}

function ProductIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <path d="M3 7.5 12 3l9 4.5v9L12 21 3 16.5v-9z" />
      <path d="M3 7.5 12 12l9-4.5" />
      <path d="M12 12v9" />
    </svg>
  );
}

function AnimationIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <path d="M12 2 l1.6 4.4 L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6z" />
      <path d="M18 15l0.8 2.2L21 18l-2.2 0.8L18 21l-0.8-2.2L15 18l2.2-0.8z" />
      <path d="M6 15l0.6 1.8L8 17.4l-1.4 0.6L6 19.8l-0.6-1.8L4 17.4l1.4-0.6z" />
    </svg>
  );
}

function SettingsIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .4 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.4 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .4-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.4-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.4H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.4 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </svg>
  );
}
