"use client";

// src/app/nex-native/dev/animation-controls-viewer/_client.tsx
//
// Prototype client surface · viewer-level animation controls.
// -----------------------------------------------------------
// Single-column settings surface:
//   · a page header mirroring other NEX settings pages
//   · a three-option card group (Full · Reduced · Off) with
//     radio-style selection
//   · a live mini-chat preview below that reflects the current
//     level · when "Off", the ambient layer disappears · when
//     "Reduced", ambient density drops to sparse · when "Full",
//     everything the owner enabled fires
//
// Zero DB · zero session wiring · pure UI exploration.

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
} from "../../chat-standard/_engine/preview-mini-phone";
import { MiniPhoneAmbientLayer } from "../../chat-themes-library/_mini-phone-ambient-layer";

type MotionLevel = "full" | "reduced" | "off";

const SAMPLE = {
  themeName: "NEX Orange Centre",
  palette: {
    primary: "#FF7200",
    secondary: "#FF9033",
    highlight: "#F2F5F8",
    glow: "rgba(255,114,0,0.45)",
    deep: "#020914",
  },
  wallpaperUrl: null as string | null,
  ambientFamilies: ["bubbles-rising", "heat-shimmer", "sparkles"],
};

const NEX = {
  bg: "#020914",
  panel: "#071525",
  panelHi: "#0A1A2D",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.35)",
  cyanFaint: "rgba(0,175,255,0.12)",
  orange: "#FF7800",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
};

const LEVELS: readonly {
  id: MotionLevel;
  label: string;
  desc: string;
  bullets: readonly string[];
}[] = [
  {
    id: "full",
    label: "Full",
    desc: "The way the owner designed it",
    bullets: [
      "Every enabled ambient family fires",
      "Message effects (send-flicker, ripple) play",
      "Scripted intros play twice-then-skip",
    ],
  },
  {
    id: "reduced",
    label: "Reduced",
    desc: "Lighter touch · fewer particles",
    bullets: [
      "Ambient density drops to sparse",
      "Message effects play once, then skip",
      "Intros skip after first view",
    ],
  },
  {
    id: "off",
    label: "Off",
    desc: "No chat animations anywhere",
    bullets: [
      "No ambient layer renders",
      "No message effects play",
      "Intros skip entirely",
    ],
  },
];

export function ViewerAnimationControlsPrototype(): React.JSX.Element {
  const [level, setLevel] = React.useState<MotionLevel>("full");
  const [savedLevel, setSavedLevel] = React.useState<MotionLevel>("full");
  const dirty = level !== savedLevel;

  const resolvedFamilies = React.useMemo(() => {
    if (level === "off") return [];
    return SAMPLE.ambientFamilies;
  }, [level]);

  const density: "sparse" | "medium" | "dense" =
    level === "reduced" ? "sparse" : level === "off" ? "sparse" : "medium";

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "24px 20px 60px",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <PageHeader dirty={dirty} onSave={() => setSavedLevel(level)} />

      <div style={{ marginTop: 20 }}>
        <SystemHint />
      </div>

      <section
        aria-label="Chat animation level"
        style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}
      >
        {LEVELS.map((option) => (
          <OptionCard
            key={option.id}
            option={option}
            selected={level === option.id}
            onSelect={() => setLevel(option.id)}
          />
        ))}
      </section>

      <section
        aria-label="Live preview"
        style={{
          marginTop: 28,
          padding: 20,
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
          Preview · {SAMPLE.themeName}
        </div>

        <MiniPhonePreview
          palette={SAMPLE.palette}
          wallpaperUrl={SAMPLE.wallpaperUrl}
          families={resolvedFamilies}
          density={density}
          showMessageFlicker={level === "full"}
        />

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
            maxWidth: 420,
          }}
        >
          Setting applies to <strong style={{ color: NEX.text }}>every chat</strong> you open ·
          themes you receive from friends will respect this level too.
        </div>
      </section>
    </main>
  );
}

function PageHeader({
  dirty,
  onSave,
}: {
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
        href="/nex-native/settings"
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
          Settings · Motion
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
          Chat animations
        </div>
        <div
          style={{
            fontSize: 12,
            color: NEX.textDim,
            marginTop: 2,
          }}
        >
          Controls how much motion plays across every chat you open.
          Doesn't change the themes themselves · just how they move on your device.
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
        {dirty ? "Save" : "Saved"}
      </button>
    </header>
  );
}

function SystemHint(): React.JSX.Element {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: NEX.panel,
        border: "1px solid rgba(255,255,255,0.08)",
        fontSize: 12,
        color: NEX.textDim,
        lineHeight: 1.5,
      }}
    >
      <strong style={{ color: NEX.text }}>Tip:</strong> If your device has{" "}
      <em style={{ color: NEX.text, fontStyle: "normal", fontWeight: 600 }}>
        Reduce motion
      </em>{" "}
      turned on in system settings, NEX will respect that automatically — the setting
      below only applies on top of what the system allows.
    </div>
  );
}

function OptionCard({
  option,
  selected,
  onSelect,
}: {
  option: (typeof LEVELS)[number];
  selected: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
        padding: "16px 18px",
        borderRadius: 14,
        background: selected
          ? `linear-gradient(180deg, ${NEX.cyanFaint} 0%, ${NEX.panel} 100%)`
          : NEX.panel,
        border: `1px solid ${selected ? NEX.cyan : "rgba(255,255,255,0.08)"}`,
        color: NEX.text,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        transition: "border-color 160ms ease, background 160ms ease",
      }}
    >
      <span
        aria-hidden
        style={{
          marginTop: 2,
          width: 20,
          height: 20,
          borderRadius: 999,
          border: `2px solid ${selected ? NEX.cyan : "rgba(255,255,255,0.3)"}`,
          display: "grid",
          placeItems: "center",
          flex: "none",
          transition: "border-color 160ms ease",
        }}
      >
        {selected && (
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: NEX.cyan,
            }}
          />
        )}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: NEX.text,
            marginBottom: 2,
          }}
        >
          {option.label}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: NEX.textDim,
            lineHeight: 1.4,
            marginBottom: 6,
          }}
        >
          {option.desc}
        </div>
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            fontSize: 11.5,
            color: NEX.textMute,
            lineHeight: 1.6,
          }}
        >
          {option.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </div>
    </button>
  );
}

function MiniPhonePreview({
  palette,
  wallpaperUrl,
  families,
  density,
  showMessageFlicker,
}: {
  palette: {
    primary: string;
    secondary: string;
    highlight: string;
    glow: string;
    deep: string;
  };
  wallpaperUrl: string | null;
  families: readonly string[];
  density: "sparse" | "medium" | "dense";
  showMessageFlicker: boolean;
}): React.JSX.Element {
  const stageBg = miniPhoneStageBackground(palette, wallpaperUrl);
  const ambientSpecs = React.useMemo(
    () => miniPhoneAmbient(palette, families, density),
    [palette, families, density],
  );
  const sampleMessages: readonly { text: string; mine: boolean }[] = [
    { text: "hey", mine: false },
    { text: "all good?", mine: true },
    { text: "yes · talk later", mine: false },
  ];

  return (
    <div
      style={{
        position: "relative",
        width: 220,
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
          N
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: palette.highlight,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
          }}
        >
          NEX Orange Centre
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
          inset: "auto 8px 48px 8px",
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
              // Prototype micro-interaction · when motion is Full and
              // this is a mine bubble, flash a soft inset glow once on
              // first render. Reduced + Off branches skip the flash.
              animation:
                showMessageFlicker && m.mine
                  ? "nex-proto-send-flicker 1800ms ease-out 1"
                  : undefined,
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

      <style>{`
        @keyframes nex-proto-send-flicker {
          0%   { box-shadow: 0 0 0 0 ${palette.primary}aa; }
          50%  { box-shadow: 0 0 12px 2px ${palette.primary}66; }
          100% { box-shadow: 0 0 0 0 ${palette.primary}00; }
        }
      `}</style>
    </div>
  );
}
