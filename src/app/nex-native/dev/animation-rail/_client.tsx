"use client";

// src/app/nex-native/dev/animation-rail/_client.tsx
//
// Prototype client · floating TikTok-style right rail for animations.
// -------------------------------------------------------------------
// Mini-phone preview (centred) with a floating right-pinned vertical
// column of toggles. Each toggle maps to one ambient family.
// Absolute positioning means the chat column keeps its full width ·
// bubbles flow under the rail just like Instagram DMs flow under
// their timestamp cluster.
//
// Visual pattern:
//   · 48×48 circular button per family
//   · brand-tinted glass background when ON
//   · dim near-black background when OFF
//   · bottom-anchored indicator dot shows ON/OFF
//   · 6 button vertical stack = 320px tall · fits comfortably
//     between the header bottom (~56px) and composer top (~56px)

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

const RAIL_FAMILIES: readonly {
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

export function AnimationRailPrototype(): React.JSX.Element {
  const [enabled, setEnabled] = React.useState<Set<MiniPhoneAmbientFamilyKind>>(
    () => new Set(DEFAULT_ON),
  );
  const [railVisible, setRailVisible] = React.useState(true);

  const toggle = (id: MiniPhoneAmbientFamilyKind) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enabledIds = React.useMemo(
    () => [...enabled],
    [enabled],
  );

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
          Prototype · Floating animation rail
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
          TikTok-style right rail · toggle animations on the chat canvas
        </div>
        <div style={{ fontSize: 12.5, color: NEX.textDim, marginTop: 4, lineHeight: 1.5 }}>
          The rail is absolutely positioned on top of the chat · zero flex-width cost ·
          bubbles flow under it. Rail width = 56px · chat column keeps full width.
          Tap <code style={{ color: NEX.text }}>Hide rail</code> below to A/B visually.
        </div>
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={() => setRailVisible((v) => !v)}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              background: railVisible ? NEX.cyanFaint : NEX.panelHi,
              color: NEX.text,
              border: `1px solid ${NEX.cyanSoft}`,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {railVisible ? "Hide rail" : "Show rail"}
          </button>
        </div>
      </header>

      {/* Phone frame · full mobile-ish dimensions so proportions
          match a real 390px viewport. The rail renders inside the
          phone's absolute stacking context so the pattern reads
          exactly as it would on a real device. */}
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
        {/* Notch */}
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

        {/* Header */}
        <ChatHeader />

        {/* Ambient */}
        <MiniPhoneAmbientLayer
          specs={miniPhoneAmbient(PALETTE, enabledIds, "medium")}
        />

        {/* Chat bubbles · full column width (minus 8px per side) */}
        <ChatBubbles />

        {/* Composer */}
        <ChatComposer />

        {/* The floating animation rail · absolutely positioned ·
            doesn't take flex width from chat. */}
        {railVisible && <AnimationRail enabled={enabled} onToggle={toggle} />}
      </div>

      <WidthReadout railVisible={railVisible} enabled={enabled} />
    </main>
  );
}

// ─── Chat chrome ─────────────────────────────────────────────────────

function ChatHeader(): React.JSX.Element {
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

function ChatBubbles(): React.JSX.Element {
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

function ChatComposer(): React.JSX.Element {
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
      <span
        style={{
          flex: 1,
          fontSize: 10,
          color: miniPhoneComposerPlaceholderColor(PALETTE),
          fontStyle: "italic",
        }}
      >
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

// ─── Floating animation rail (the actual prototype) ──────────────────

function AnimationRail({
  enabled,
  onToggle,
}: {
  enabled: Set<MiniPhoneAmbientFamilyKind>;
  onToggle: (id: MiniPhoneAmbientFamilyKind) => void;
}): React.JSX.Element {
  return (
    <div
      data-nex-animation-rail
      style={{
        position: "absolute",
        right: 8,
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        zIndex: 5,
        pointerEvents: "auto",
      }}
    >
      {RAIL_FAMILIES.map((family) => {
        const isOn = enabled.has(family.id);
        return (
          <button
            key={family.id}
            type="button"
            onClick={() => onToggle(family.id)}
            aria-label={`${family.label} ${isOn ? "on" : "off"}`}
            aria-pressed={isOn}
            style={{
              position: "relative",
              width: 44,
              height: 44,
              borderRadius: 999,
              background: isOn
                ? `linear-gradient(180deg, ${PALETTE.primary}, ${hexToRgba(PALETTE.primary, 0.8)})`
                : "rgba(2,9,20,0.72)",
              border: `1px solid ${isOn ? PALETTE.primary : hexToRgba(PALETTE.highlight, 0.2)}`,
              color: isOn ? PALETTE.deep : PALETTE.highlight,
              display: "grid",
              placeItems: "center",
              fontSize: 18,
              cursor: "pointer",
              fontFamily: "inherit",
              padding: 0,
              transition:
                "background 160ms ease, border-color 160ms ease, transform 160ms ease",
              boxShadow: isOn
                ? `0 4px 14px -4px ${hexToRgba(PALETTE.primary, 0.6)}, 0 0 0 1px ${hexToRgba(PALETTE.primary, 0.3)}`
                : "0 4px 10px -4px rgba(0,0,0,0.6)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
          >
            <span aria-hidden>{family.glyph}</span>
            {/* ON/OFF dot indicator · bottom-right · green when ON,
                dim when OFF. Mirrors TikTok's count-indicator slot
                but with ON/OFF semantics. */}
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
  );
}

// ─── Width readout · shows the real cost ────────────────────────────

function WidthReadout({
  railVisible,
  enabled,
}: {
  railVisible: boolean;
  enabled: Set<MiniPhoneAmbientFamilyKind>;
}): React.JSX.Element {
  const chatBubbleMaxCss = "72%";
  const chatBubbleActualPx = Math.round((320 - 20) * 0.72); // 320 phone - 10 each side padding, 72% of that
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
        Width reading · {railVisible ? "rail visible" : "rail hidden"}
      </div>
      <div>
        · Chat column flex-width:{" "}
        <strong style={{ color: NEX.text }}>unchanged</strong> (rail is absolutely positioned)
      </div>
      <div>
        · Bubble maxWidth:{" "}
        <strong style={{ color: NEX.text }}>{chatBubbleMaxCss}</strong> ≈ {chatBubbleActualPx}px at
        this preview size
      </div>
      <div>
        · Rail footprint when visible:{" "}
        <strong style={{ color: NEX.text }}>44px wide + 8px right-edge gap</strong>
      </div>
      <div>
        · Rail obscures:{" "}
        <strong style={{ color: NEX.text }}>
          {railVisible ? "~16% of the rightmost column" : "0%"}
        </strong>{" "}
        · mine bubbles pin right at 72% max so the rail does hover over the
        right edge of mine bubbles. On a real device the rail can be swiped
        away or auto-hide after a few seconds of inactivity.
      </div>
      <div style={{ marginTop: 8, color: NEX.textMute }}>
        Currently ON: {enabled.size === 0 ? "none" : [...enabled].join(" · ")}
      </div>
    </div>
  );
}
