"use client";

// src/app/nex-native/dev/animation-controls-owner/_client.tsx
//
// Prototype client surface · owner-level animation controls.
// ----------------------------------------------------------
// Two-column layout:
//   · LEFT  · live mini-phone preview that reflects every toggle in
//             real time (reuses the shared mini-phone treatment so
//             the preview is byte-identical to how the library tile
//             will paint after save).
//   · RIGHT · a stacked list of ambient families + motion effects.
//             Each row has a label, a short description, and a
//             switch. Flipping a switch regenerates the preview.
//
// Zero network · zero DB · zero auth. Pure UI exploration.

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
  type MiniPhoneAmbientFamilyKind,
} from "../../chat-standard/_engine/preview-mini-phone";
import { MiniPhoneAmbientLayer } from "../../chat-themes-library/_mini-phone-ambient-layer";

// Sample theme · Hollywood (red carpet) palette so visitors can see
// a theme-authentic rendering with the Hollywood ambient families.
const SAMPLE_THEME = {
  name: "Hollywood",
  palette: {
    primary: "#D4A542",
    secondary: "#E85E5E",
    highlight: "#FFF4D6",
    glow: "rgba(255,210,100,0.52)",
    deep: "#0D0608",
  },
  wallpaperUrl: "/nex-themes/hollywood-wallpaper.png",
  // Every family the engine supports · owner picks which actually fire.
  allFamilies: [
    { id: "light-rays", label: "Light rays", desc: "Diagonal spotlight streaks" },
    { id: "sparkles", label: "Sparkles", desc: "Scattered highlight dots" },
    { id: "bubbles-rising", label: "Rising bubbles", desc: "Particles floating up" },
    { id: "heat-shimmer", label: "Heat shimmer", desc: "Warm centre glow" },
    { id: "pollen-float", label: "Pollen drift", desc: "Secondary-tinted specks" },
    { id: "neon-flicker", label: "Neon flicker", desc: "Pulsing accent dot" },
    { id: "rain-streak", label: "Rain streaks", desc: "Diagonal vertical lines" },
    { id: "mist", label: "Mist band", desc: "Horizontal highlight band" },
  ] as const satisfies readonly {
    id: MiniPhoneAmbientFamilyKind;
    label: string;
    desc: string;
  }[],
};

const NEX = {
  bg: "#020914",
  panel: "#071525",
  panelHi: "#0A1A2D",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.35)",
  cyanFaint: "rgba(0,175,255,0.12)",
  orange: "#FF7800",
  green: "#16D66B",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
};

const DEFAULT_ENABLED: ReadonlySet<MiniPhoneAmbientFamilyKind> = new Set([
  "light-rays",
  "sparkles",
]);

export function OwnerAnimationControlsPrototype(): React.JSX.Element {
  const [enabled, setEnabled] = React.useState<Set<MiniPhoneAmbientFamilyKind>>(
    () => new Set(DEFAULT_ENABLED),
  );
  const [dirty, setDirty] = React.useState(false);

  const toggle = (id: MiniPhoneAmbientFamilyKind) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setDirty(true);
  };

  const enabledFamilies = React.useMemo(
    () => SAMPLE_THEME.allFamilies.filter((f) => enabled.has(f.id)).map((f) => f.id),
    [enabled],
  );

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "24px 20px 60px",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      <PageHeader themeName={SAMPLE_THEME.name} dirty={dirty} onSave={() => setDirty(false)} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(240px, 320px) 1fr",
          gap: 32,
          marginTop: 24,
        }}
      >
        <PreviewColumn
          palette={SAMPLE_THEME.palette}
          wallpaperUrl={SAMPLE_THEME.wallpaperUrl}
          enabledFamilies={enabledFamilies}
        />
        <ControlsColumn
          families={SAMPLE_THEME.allFamilies}
          enabled={enabled}
          onToggle={toggle}
        />
      </div>
    </main>
  );
}

// ─── Header ─────────────────────────────────────────────────────────

function PageHeader({
  themeName,
  dirty,
  onSave,
}: {
  themeName: string;
  dirty: boolean;
  onSave: () => void;
}): React.JSX.Element {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 16px",
        borderRadius: 14,
        background: `linear-gradient(180deg, ${NEX.panelHi} 0%, ${NEX.panel} 100%)`,
        border: `1px solid ${NEX.cyanSoft}`,
      }}
    >
      <a
        href="/nex-native/manage/themes"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 999,
          background: "transparent",
          border: `1px solid ${NEX.cyanSoft}`,
          color: NEX.text,
          textDecoration: "none",
          fontSize: 16,
        }}
      >
        ←
      </a>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10.5,
            letterSpacing: "0.26em",
            color: NEX.cyan,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          Animations · {themeName}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
          Pick which effects fire on your chat
        </div>
        <div
          style={{
            fontSize: 12,
            color: NEX.textDim,
            marginTop: 2,
          }}
        >
          Toggle a family · the preview on the left updates immediately. Save when you're happy.
        </div>
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty}
        style={{
          padding: "10px 20px",
          borderRadius: 999,
          background: dirty ? NEX.orange : NEX.panelHi,
          color: dirty ? "#0B0F1A" : NEX.textMute,
          border: `1px solid ${dirty ? NEX.orange : NEX.cyanSoft}`,
          fontSize: 13,
          fontWeight: 700,
          cursor: dirty ? "pointer" : "default",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
          boxShadow: dirty ? `0 6px 18px -8px ${NEX.orange}` : undefined,
        }}
      >
        {dirty ? "Save changes" : "No changes"}
      </button>
    </header>
  );
}

// ─── Left column · live mini-phone preview ─────────────────────────

function PreviewColumn({
  palette,
  wallpaperUrl,
  enabledFamilies,
}: {
  palette: {
    primary: string;
    secondary: string;
    highlight: string;
    glow: string;
    deep: string;
  };
  wallpaperUrl: string;
  enabledFamilies: readonly MiniPhoneAmbientFamilyKind[];
}): React.JSX.Element {
  const stageBg = miniPhoneStageBackground(palette, wallpaperUrl);
  const ambientSpecs = React.useMemo(
    () => miniPhoneAmbient(palette, enabledFamilies, "medium"),
    [palette, enabledFamilies],
  );
  const sampleMessages: readonly { text: string; mine: boolean }[] = [
    { text: "want to see?", mine: false },
    { text: "yes show me", mine: true },
  ];

  return (
    <section
      aria-label="Live preview"
      style={{
        padding: "20px",
        borderRadius: 20,
        background: `linear-gradient(180deg, ${NEX.panelHi} 0%, ${NEX.panel} 100%)`,
        border: `1px solid ${NEX.cyanSoft}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          letterSpacing: "0.26em",
          color: NEX.cyan,
          fontWeight: 700,
          textTransform: "uppercase",
          alignSelf: "flex-start",
          marginBottom: 14,
        }}
      >
        Live preview
      </div>

      {/* Phone silhouette */}
      <div
        style={{
          position: "relative",
          width: 200,
          aspectRatio: "9 / 18",
          borderRadius: 28,
          background: stageBg,
          border: `2px solid ${miniPhoneFrameRim(palette)}`,
          overflow: "hidden",
          boxShadow: miniPhoneFrameShadow(palette),
        }}
      >
        {/* Notch */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 8,
            left: "50%",
            transform: "translateX(-50%)",
            width: 60,
            height: 7,
            borderRadius: 999,
            background: "rgba(0,0,0,0.6)",
            zIndex: 5,
          }}
        />

        {/* Header */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 20,
            left: 8,
            right: 8,
            display: "flex",
            alignItems: "center",
            gap: 6,
            zIndex: 4,
          }}
        >
          <span
            style={{
              position: "relative",
              width: 22,
              height: 22,
              borderRadius: 999,
              background: miniPhoneAvatarBackground(palette),
              color: palette.deep,
              display: "grid",
              placeItems: "center",
              fontSize: 10,
              fontWeight: 800,
              flex: "none",
              border: miniPhoneAvatarBorder(),
              boxShadow: miniPhoneAvatarGlow(),
            }}
          >
            H
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: palette.highlight,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textShadow: "0 1px 3px rgba(0,0,0,0.65)",
              flex: 1,
              minWidth: 0,
            }}
          >
            {SAMPLE_THEME.name}
          </span>
          <span style={{ display: "inline-flex", gap: 3, flex: "none" }}>
            {miniPhoneHeaderCluster(palette).map((b) => (
              <span
                key={b.key}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  background: b.bg,
                  border: b.border,
                  color: b.color,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 9,
                  fontWeight: 800,
                  boxShadow: b.shadow,
                }}
              >
                {b.glyph}
              </span>
            ))}
          </span>
        </div>

        {/* Ambient layer */}
        <MiniPhoneAmbientLayer specs={ambientSpecs} />

        {/* Chat bubbles */}
        <div
          style={{
            position: "absolute",
            inset: "auto 8px 46px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            zIndex: 3,
          }}
        >
          {sampleMessages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.mine ? "flex-end" : "flex-start",
                padding: "4px 10px",
                borderRadius: 999,
                maxWidth: "82%",
                background: miniPhoneBubbleBackground(palette, m.mine),
                border: miniPhoneBubbleBorder(palette, m.mine),
                color: miniPhoneBubbleTextColor(palette),
                fontSize: 9,
                fontWeight: 500,
                lineHeight: 1.3,
                whiteSpace: "nowrap",
                textShadow: "0 1px 2px rgba(0,0,0,0.55)",
              }}
            >
              {m.text}
            </div>
          ))}
        </div>

        {/* Composer */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 8,
            right: 8,
            bottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 4px 4px 10px",
            borderRadius: 999,
            background: miniPhoneComposerBackground(palette),
            border: miniPhoneComposerBorder(palette),
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 4,
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: 8,
              color: miniPhoneComposerPlaceholderColor(palette),
              fontStyle: "italic",
            }}
          >
            Message…
          </span>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: miniPhoneSendBackground(palette),
              color: miniPhoneSendIconColor(palette),
              display: "grid",
              placeItems: "center",
              fontSize: 8,
              fontWeight: 800,
            }}
          >
            ➤
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: "10px 14px",
          borderRadius: 10,
          background: NEX.cyanFaint,
          border: `1px solid ${NEX.cyanSoft}`,
          fontSize: 11,
          color: NEX.textDim,
          lineHeight: 1.5,
          textAlign: "center",
        }}
      >
        {enabledFamilies.length === 0
          ? "No animations · your chat stays still"
          : `${enabledFamilies.length} family${enabledFamilies.length === 1 ? "" : " families"} active · library tile and live chat will match`}
      </div>
    </section>
  );
}

// ─── Right column · ambient family controls ────────────────────────

function ControlsColumn({
  families,
  enabled,
  onToggle,
}: {
  families: readonly {
    id: MiniPhoneAmbientFamilyKind;
    label: string;
    desc: string;
  }[];
  enabled: Set<MiniPhoneAmbientFamilyKind>;
  onToggle: (id: MiniPhoneAmbientFamilyKind) => void;
}): React.JSX.Element {
  return (
    <section aria-label="Ambient controls">
      <div
        style={{
          fontSize: 10.5,
          letterSpacing: "0.26em",
          color: NEX.cyan,
          fontWeight: 700,
          textTransform: "uppercase",
          marginBottom: 14,
        }}
      >
        Ambient effects
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 10,
        }}
      >
        {families.map((family) => {
          const isOn = enabled.has(family.id);
          return (
            <button
              key={family.id}
              type="button"
              onClick={() => onToggle(family.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 16px",
                borderRadius: 14,
                background: isOn
                  ? `linear-gradient(180deg, ${NEX.cyanFaint} 0%, ${NEX.panel} 100%)`
                  : NEX.panel,
                border: `1px solid ${isOn ? NEX.cyan : "rgba(255,255,255,0.08)"}`,
                color: NEX.text,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
                transition: "border-color 160ms ease, background 160ms ease",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: NEX.text,
                    marginBottom: 2,
                  }}
                >
                  {family.label}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: NEX.textDim,
                    lineHeight: 1.4,
                  }}
                >
                  {family.desc}
                </div>
              </div>
              <Switch isOn={isOn} />
            </button>
          );
        })}
      </div>

      {/* Secondary motion effects (bubbles / composer / stickers) ·
          same pattern · same switch component · owner can turn
          individual micro-interactions off (e.g. send-flicker,
          sparkle-on-send) without touching the ambient family set.
          Rendered as a separate group so the UX stays legible. */}
      <div
        style={{
          marginTop: 28,
          fontSize: 10.5,
          letterSpacing: "0.26em",
          color: NEX.cyan,
          fontWeight: 700,
          textTransform: "uppercase",
          marginBottom: 14,
        }}
      >
        Message effects
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 10,
        }}
      >
        {[
          {
            id: "send-flicker",
            label: "Send flicker",
            desc: "Mine bubble flashes on send",
          },
          {
            id: "receive-ripple",
            label: "Receive ripple",
            desc: "Peer bubble ripples on arrival",
          },
          {
            id: "sparkle-on-send",
            label: "Sparkle on send",
            desc: "Short sparkle burst at the composer",
          },
          {
            id: "bubble-trail",
            label: "Bubble trail",
            desc: "Rising droplets after send",
          },
        ].map((effect) => (
          <div
            key={effect.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 16px",
              borderRadius: 14,
              background: NEX.panel,
              border: `1px solid rgba(255,255,255,0.08)`,
              opacity: 0.5,
              cursor: "not-allowed",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: NEX.text, marginBottom: 2 }}>
                {effect.label}
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 9,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: NEX.textMute,
                    fontWeight: 700,
                  }}
                >
                  Prototype
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: NEX.textDim, lineHeight: 1.4 }}>
                {effect.desc}
              </div>
            </div>
            <Switch isOn={false} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Switch component ──────────────────────────────────────────────

function Switch({ isOn }: { isOn: boolean }): React.JSX.Element {
  return (
    <span
      aria-hidden
      style={{
        position: "relative",
        display: "inline-block",
        width: 36,
        height: 20,
        borderRadius: 999,
        background: isOn ? NEX.cyan : "rgba(255,255,255,0.12)",
        transition: "background 160ms ease",
        flex: "none",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: isOn ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: 999,
          background: isOn ? "#0B0F1A" : NEX.text,
          transition: "left 160ms ease, background 160ms ease",
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }}
      />
    </span>
  );
}
