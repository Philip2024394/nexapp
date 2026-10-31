"use client";

// src/app/nex-native/dev/animation-dots-combo/_client.tsx
//
// Prototype · 3-dot combo reveal · animations + call actions share
// one gesture entry point.
//
// Open state:
//   · Call-action row slides LEFT from the 3-dot (horizontal · 4 btns)
//   · Animation column slides UP from the 3-dot (vertical · 6 btns)
// Closed state:
//   · Only the 3-dot is visible
//
// Everything is absolutely positioned · zero flex-width cost on the
// chat column. Chat bubbles flow underneath regardless of state.

import * as React from "react";
import {
  miniPhoneAmbient,
  miniPhoneBubbleBackground,
  miniPhoneBubbleBorder,
  miniPhoneBubbleTextColor,
  miniPhoneComposerBackground,
  miniPhoneComposerBorder,
  miniPhoneComposerPlaceholderColor,
  miniPhoneHeaderCluster,
  miniPhoneSendBackground,
  miniPhoneSendIconColor,
  miniPhoneStageBackground,
  miniPhoneFrameRim,
  miniPhoneFrameShadow,
  miniPhoneAvatarBackground,
  miniPhoneAvatarBorder,
  miniPhoneAvatarGlow,
  hexToRgba,
  type MiniPhoneAmbientFamilyKind,
} from "../../chat-standard/_engine/preview-mini-phone";
import { MiniPhoneAmbientLayer } from "../../chat-themes-library/_mini-phone-ambient-layer";

const PALETTE = {
  primary: "#FF7200",
  secondary: "#FF9033",
  highlight: "#F2F5F8",
  glow: "rgba(255,114,0,0.45)",
  deep: "var(--nex-world-background-base, #020914)",
};

const ANIMATION_BUTTONS: readonly {
  id: MiniPhoneAmbientFamilyKind;
  glyph: string;
  label: string;
}[] = [
  { id: "bubbles-rising", glyph: "🫧", label: "Bubbles" },
  { id: "sparkles", glyph: "✨", label: "Sparkles" },
  { id: "heat-shimmer", glyph: "🔥", label: "Glow" },
  { id: "light-rays", glyph: "☀️", label: "Rays" },
  { id: "pollen-float", glyph: "🌼", label: "Pollen" },
  { id: "rain-streak", glyph: "💧", label: "Rain" },
];

const CALL_ACTIONS: readonly { id: string; glyph: string; label: string }[] = [
  { id: "status", glyph: "◉", label: "Status" },
  { id: "mic", glyph: "🎙", label: "Mic" },
  { id: "video", glyph: "📹", label: "Video" },
  { id: "call", glyph: "📞", label: "Call" },
];

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "#071525",
  panelHi: "#0A1A2D",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.35)",
  cyanFaint: "rgba(0,175,255,0.12)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
};

const DEFAULT_ON: ReadonlySet<MiniPhoneAmbientFamilyKind> = new Set([
  "bubbles-rising",
  "sparkles",
]);

export function AnimationDotsComboPrototype(): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [enabled, setEnabled] = React.useState<Set<MiniPhoneAmbientFamilyKind>>(
    () => new Set(DEFAULT_ON),
  );

  const toggle = (id: MiniPhoneAmbientFamilyKind) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enabledIds = React.useMemo(() => [...enabled], [enabled]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "24px 20px 60px",
        maxWidth: 920,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
      }}
    >
      <PageHeader open={open} />

      <div
        style={{
          position: "relative",
          width: 320,
          aspectRatio: "9 / 19",
          borderRadius: 36,
          background: miniPhoneStageBackground(PALETTE, null),
          border: `3px solid ${miniPhoneFrameRim(PALETTE)}`,
          overflow: "hidden",
          boxShadow: miniPhoneFrameShadow(PALETTE),
        }}
      >
        <Notch />
        <Header />
        <MiniPhoneAmbientLayer
          specs={miniPhoneAmbient(PALETTE, enabledIds, "medium")}
        />
        <Bubbles />
        <Composer />
        <ThreeDotCombo
          open={open}
          onToggle={() => setOpen((v) => !v)}
          enabled={enabled}
          onToggleAnimation={toggle}
        />
      </div>

      <Readout open={open} enabled={enabled} />
    </main>
  );
}

// ─── Header ────────────────────────────────────────────────────────

function PageHeader({ open }: { open: boolean }): React.JSX.Element {
  return (
    <header
      style={{
        alignSelf: "stretch",
        padding: "14px 18px",
        borderRadius: 14,
        background: `linear-gradient(180deg, ${NEX.panelHi} 0%, ${NEX.panel} 100%)`,
        border: `1px solid ${NEX.cyanSoft}`,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          letterSpacing: "0.26em",
          color: NEX.cyan,
          fontWeight: 700,
          textTransform: "uppercase",
        }}
      >
        Prototype · 3-dot combo reveal
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
        Call actions + animation stack · one gesture
      </div>
      <div style={{ fontSize: 12.5, color: NEX.textDim, marginTop: 4, lineHeight: 1.5 }}>
        Tap the ⋮ three-dot in the lower-right of the phone below.
        Call actions slide LEFT · animation stack slides UP.
        Tap again · both collapse. Chat canvas stays clutter-free.
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: NEX.textMute }}>
        State: <strong style={{ color: NEX.text }}>{open ? "OPEN · everything visible" : "CLOSED · only 3-dot visible"}</strong>
      </div>
    </header>
  );
}

// ─── Chat chrome (reused across all three prototypes) ──────────────

function Notch(): React.JSX.Element {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        width: 90,
        height: 10,
        borderRadius: 999,
        background: "rgba(0,0,0,0.65)",
        zIndex: 10,
      }}
    />
  );
}

function Header(): React.JSX.Element {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 30,
        left: 10,
        right: 10,
        display: "flex",
        alignItems: "center",
        gap: 8,
        zIndex: 4,
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          background: miniPhoneAvatarBackground(PALETTE),
          color: PALETTE.deep,
          display: "grid",
          placeItems: "center",
          fontSize: 13,
          fontWeight: 800,
          flex: "none",
          border: miniPhoneAvatarBorder(),
          boxShadow: miniPhoneAvatarGlow(),
        }}
      >
        N
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: PALETTE.highlight,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          flex: 1,
          minWidth: 0,
        }}
      >
        NEX Orange Centre
      </span>
      <span style={{ display: "inline-flex", gap: 4, flex: "none" }}>
        {miniPhoneHeaderCluster(PALETTE).map((b) => (
          <span
            key={b.key}
            style={{
              width: 20,
              height: 20,
              borderRadius: 999,
              background: b.bg,
              border: b.border,
              color: b.color,
              display: "grid",
              placeItems: "center",
              fontSize: 11,
              fontWeight: 800,
              boxShadow: b.shadow,
            }}
          >
            {b.glyph}
          </span>
        ))}
      </span>
    </div>
  );
}

function Bubbles(): React.JSX.Element {
  const messages: readonly { text: string; mine: boolean }[] = [
    { text: "hey · how's the new theme?", mine: false },
    { text: "feels really nice", mine: true },
    { text: "the orange glow is beautiful ✨", mine: false },
    { text: "want to see?", mine: true },
    { text: "yes please", mine: false },
  ];
  return (
    <div
      style={{
        position: "absolute",
        inset: "auto 10px 68px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        zIndex: 3,
      }}
    >
      {messages.map((m, i) => (
        <div
          key={i}
          style={{
            alignSelf: m.mine ? "flex-end" : "flex-start",
            padding: "6px 12px",
            borderRadius: 999,
            maxWidth: "72%",
            background: miniPhoneBubbleBackground(PALETTE, m.mine),
            border: miniPhoneBubbleBorder(PALETTE, m.mine),
            color: miniPhoneBubbleTextColor(PALETTE),
            fontSize: 10.5,
            fontWeight: 500,
            lineHeight: 1.3,
            textShadow: "0 1px 2px rgba(0,0,0,0.55)",
          }}
        >
          {m.text}
        </div>
      ))}
    </div>
  );
}

function Composer(): React.JSX.Element {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: 10,
        right: 10,
        bottom: 14,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 6px 6px 14px",
        borderRadius: 999,
        background: miniPhoneComposerBackground(PALETTE),
        border: miniPhoneComposerBorder(PALETTE),
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 4,
      }}
    >
      <span style={{ flex: 1, fontSize: 10, color: miniPhoneComposerPlaceholderColor(PALETTE), fontStyle: "italic" }}>
        Message…
      </span>
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          background: miniPhoneSendBackground(PALETTE),
          color: miniPhoneSendIconColor(PALETTE),
          display: "grid",
          placeItems: "center",
          fontSize: 10,
          fontWeight: 800,
        }}
      >
        ➤
      </span>
    </div>
  );
}

// ─── The combo · 3-dot + slide-left call actions + slide-up anims ──

function ThreeDotCombo({
  open,
  onToggle,
  enabled,
  onToggleAnimation,
}: {
  open: boolean;
  onToggle: () => void;
  enabled: Set<MiniPhoneAmbientFamilyKind>;
  onToggleAnimation: (id: MiniPhoneAmbientFamilyKind) => void;
}): React.JSX.Element {
  const bottomOffset = 70; // sit above the composer

  // Base button style identical for every circle in the combo so the
  // open/closed state is a transform/opacity transition only.
  const circle: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    fontFamily: "inherit",
    padding: 0,
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    transition: "background 160ms ease, border-color 160ms ease",
  };

  return (
    <>
      {/* Horizontal call-action row · slides LEFT from the 3-dot.
          The row's right edge aligns 48px to the LEFT of the 3-dot
          so the two never overlap. */}
      <div
        aria-hidden={!open}
        data-nex-combo-call-actions={open ? "open" : "closed"}
        style={{
          position: "absolute",
          right: 60,
          bottom: bottomOffset,
          display: "flex",
          gap: 8,
          alignItems: "center",
          zIndex: 6,
          opacity: open ? 1 : 0,
          transform: open ? "translateX(0)" : "translateX(16px)",
          pointerEvents: open ? "auto" : "none",
          transition:
            "opacity 220ms ease-out, transform 300ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
        }}
      >
        {CALL_ACTIONS.map((btn) => (
          <button
            key={btn.id}
            type="button"
            aria-label={btn.label}
            style={{
              ...circle,
              background: "rgba(2,9,20,0.72)",
              color: PALETTE.highlight,
              border: `1px solid ${hexToRgba(PALETTE.highlight, 0.2)}`,
              fontSize: 15,
              boxShadow: `0 4px 10px -4px rgba(0,0,0,0.6)`,
            }}
          >
            <span aria-hidden>{btn.glyph}</span>
          </button>
        ))}
      </div>

      {/* Vertical animation column · slides UP from the 3-dot. The
          column's bottom edge aligns 48px ABOVE the 3-dot so the
          two never overlap. */}
      <div
        aria-hidden={!open}
        data-nex-combo-animation-column={open ? "open" : "closed"}
        style={{
          position: "absolute",
          right: 10,
          bottom: bottomOffset + 48,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "center",
          zIndex: 6,
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(16px)",
          pointerEvents: open ? "auto" : "none",
          transition:
            "opacity 220ms ease-out, transform 300ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
        }}
      >
        {ANIMATION_BUTTONS.map((family) => {
          const isOn = enabled.has(family.id);
          return (
            <button
              key={family.id}
              type="button"
              aria-label={`${family.label} ${isOn ? "on" : "off"}`}
              aria-pressed={isOn}
              onClick={() => onToggleAnimation(family.id)}
              style={{
                ...circle,
                position: "relative",
                background: isOn
                  ? `linear-gradient(180deg, ${PALETTE.primary}, ${hexToRgba(PALETTE.primary, 0.8)})`
                  : "rgba(2,9,20,0.72)",
                border: `1px solid ${isOn ? PALETTE.primary : hexToRgba(PALETTE.highlight, 0.2)}`,
                color: isOn ? PALETTE.deep : PALETTE.highlight,
                fontSize: 16,
                boxShadow: isOn
                  ? `0 4px 14px -4px ${hexToRgba(PALETTE.primary, 0.6)}`
                  : `0 4px 10px -4px rgba(0,0,0,0.6)`,
              }}
            >
              <span aria-hidden>{family.glyph}</span>
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: isOn ? "#22C55E" : hexToRgba(PALETTE.highlight, 0.25),
                  border: `2px solid ${PALETTE.deep}`,
                }}
              />
            </button>
          );
        })}
      </div>

      {/* The 3-dot itself · the single entry point · pinned
          lower-right. Rotates 90° when open to signal state. */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "Close chat actions" : "Open chat actions"}
        aria-pressed={open}
        data-nex-combo-toggle={open ? "open" : "closed"}
        style={{
          ...circle,
          position: "absolute",
          right: 10,
          bottom: bottomOffset,
          background: open
            ? `linear-gradient(180deg, ${PALETTE.primary}, ${hexToRgba(PALETTE.primary, 0.85)})`
            : "rgba(2,9,20,0.75)",
          border: `1px solid ${open ? PALETTE.primary : hexToRgba(PALETTE.highlight, 0.25)}`,
          color: open ? PALETTE.deep : PALETTE.highlight,
          fontSize: 18,
          zIndex: 7,
          boxShadow: open
            ? `0 4px 14px -4px ${hexToRgba(PALETTE.primary, 0.6)}`
            : `0 4px 10px -4px rgba(0,0,0,0.6)`,
          transform: open ? "rotate(90deg)" : "rotate(0deg)",
          transition:
            "transform 240ms cubic-bezier(0.2, 0.9, 0.3, 1.1), background 160ms ease, border-color 160ms ease",
        }}
      >
        <span aria-hidden style={{ transform: "rotate(0deg)" }}>⋮</span>
      </button>
    </>
  );
}

// ─── Width + state readout ──────────────────────────────────────────

function Readout({
  open,
  enabled,
}: {
  open: boolean;
  enabled: Set<MiniPhoneAmbientFamilyKind>;
}): React.JSX.Element {
  return (
    <div
      style={{
        maxWidth: 480,
        padding: "14px 18px",
        borderRadius: 14,
        background: NEX.panel,
        border: `1px solid rgba(255,255,255,0.08)`,
        fontSize: 12,
        color: NEX.textDim,
        lineHeight: 1.6,
      }}
    >
      <div style={{ fontSize: 14, color: NEX.text, fontWeight: 700, marginBottom: 6 }}>
        State · {open ? "OPEN" : "CLOSED"}
      </div>
      <div>
        · Default (closed): <strong style={{ color: NEX.text }}>only the ⋮ button visible</strong> ·
        chat canvas has zero chrome obscuring content
      </div>
      <div>
        · Open: call actions slide left (horizontal) + animation column slides up (vertical) ·
        both anchored at the 3-dot
      </div>
      <div>
        · Flex-width cost: <strong style={{ color: NEX.text }}>zero in both states</strong> ·
        all three groups are absolutely positioned
      </div>
      <div style={{ marginTop: 8, color: NEX.textMute }}>
        Currently ON: {enabled.size === 0 ? "none" : [...enabled].join(" · ")}
      </div>
    </div>
  );
}
