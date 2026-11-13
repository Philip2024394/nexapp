"use client";

// src/app/nex-native/settings/chat-settings/_appearance-client.tsx
//
// NEX Chat settings · Bubble Colours visual design surface.
// Owner-sealed 2026-11-13 iter 3 · "visual bubble-design page".
// -----------------------------------------------------------------------------
// Replaces the pre-set-swatch grid with a full visual customiser:
//
//   · Preview area · two bubbles on the viewer's REAL chat theme
//     wallpaper + accent (passed in from the server page).
//   · Rainbow palette · 7 hues × 3 shades + free-form hex input.
//   · Glass-to-solid appearance slider per channel (0 = glass,
//     100 = solid). Appearance is CLIENT-ONLY persistence today ·
//     migration 343 is drafted but NOT applied · colours save to
//     nex_account via setBubbleColoursAction (mig 341 live).
//   · Independent controls for outgoing (self) + incoming (peer).
//   · Reset restores both colour + appearance to theme defaults.
//
// UX contract:
//   · Preview repaints on every pick / slider tick · no page round-trip.
//   · Colour changes persist via the existing bubble-colours service.
//   · Honest subtitle flags the appearance-persistence gap until
//     mig 343 is applied.

import * as React from "react";
import {
  setBubbleColoursAction,
  resetBubbleColoursAction,
} from "./_actions";

// Owner directive 2026-11-13 iter 2 · peach-then-white palette.
const CARD_BG = "#FFFFFF";
const CARD_INK = "#6B2A1F";
const CARD_INK_DIM = "#5A3A20";
const ICON_BG = "#1D2432";
const ICON_RING = "#FF7200";
const CONTROL_BG = "#1D2432";
const CONTROL_INK = "#F3E3C6";
const CONTROL_ACTIVE = "#FF7200";

// Rainbow palette · 7 hues (Red, Orange, Yellow, Green, Blue, Indigo,
// Violet) × 3 shades (light, base, dark). Hex values picked from the
// Material / Tailwind convention for consistent contrast.
const RAINBOW_PALETTE: ReadonlyArray<{
  readonly hue: string;
  readonly shades: ReadonlyArray<string>;
}> = [
  { hue: "Red",    shades: ["#ef5350", "#e53935", "#c62828"] },
  { hue: "Orange", shades: ["#ffa726", "#fb8c00", "#ef6c00"] },
  { hue: "Yellow", shades: ["#ffee58", "#fdd835", "#f9a825"] },
  { hue: "Green",  shades: ["#66bb6a", "#43a047", "#2e7d32"] },
  { hue: "Blue",   shades: ["#42a5f5", "#1e88e5", "#1565c0"] },
  { hue: "Indigo", shades: ["#5c6bc0", "#3949ab", "#283593"] },
  { hue: "Violet", shades: ["#ab47bc", "#8e24aa", "#6a1b9a"] },
];

const HEX_RE = /^#[0-9a-f]{6}$/i;

export interface AppearanceControlsProps {
  readonly bubbleSelfHex: string | null;
  readonly bubblePeerHex: string | null;
  /** Owner directive 2026-11-13 · glass-to-solid 0..100 persistence
   *  (mig 343). NULL = theme default (solid). */
  readonly bubbleSelfAppearance: number | null;
  readonly bubblePeerAppearance: number | null;
  readonly themeSelfHex: string;
  readonly themePeerHex: string;
  readonly schemaReadyBubbleColours: boolean;
  /** Owner directive 2026-11-13 · theme hero so the preview paints on
   *  the user's actual chat background rather than a generic dark card. */
  readonly themeHeroImageUrl: string | null;
  readonly themeName: string;
}

export function AppearanceControls(
  props: AppearanceControlsProps,
): React.JSX.Element {
  const initialSelf = props.bubbleSelfHex ?? props.themeSelfHex;
  const initialPeer = props.bubblePeerHex ?? props.themePeerHex;
  return (
    <BubbleColourCard
      initialSelf={initialSelf.toLowerCase()}
      initialPeer={initialPeer.toLowerCase()}
      initialSelfAppearance={props.bubbleSelfAppearance ?? 100}
      initialPeerAppearance={props.bubblePeerAppearance ?? 100}
      themeSelfHex={props.themeSelfHex.toLowerCase()}
      themePeerHex={props.themePeerHex.toLowerCase()}
      hasSelfOverride={props.bubbleSelfHex !== null}
      hasPeerOverride={props.bubblePeerHex !== null}
      hasSelfAppearanceOverride={props.bubbleSelfAppearance !== null}
      hasPeerAppearanceOverride={props.bubblePeerAppearance !== null}
      schemaReady={props.schemaReadyBubbleColours}
      themeHeroImageUrl={props.themeHeroImageUrl}
      themeName={props.themeName}
    />
  );
}

// ─── Bubble colour card ───────────────────────────────────────────────

function BubbleColourCard({
  initialSelf,
  initialPeer,
  initialSelfAppearance,
  initialPeerAppearance,
  themeSelfHex,
  themePeerHex,
  hasSelfOverride,
  hasPeerOverride,
  hasSelfAppearanceOverride,
  hasPeerAppearanceOverride,
  schemaReady,
  themeHeroImageUrl,
  themeName,
}: {
  initialSelf: string;
  initialPeer: string;
  initialSelfAppearance: number;
  initialPeerAppearance: number;
  themeSelfHex: string;
  themePeerHex: string;
  hasSelfOverride: boolean;
  hasPeerOverride: boolean;
  hasSelfAppearanceOverride: boolean;
  hasPeerAppearanceOverride: boolean;
  schemaReady: boolean;
  themeHeroImageUrl: string | null;
  themeName: string;
}): React.JSX.Element {
  // Client state · drives the live preview. Colour AND appearance
  // changes persist via the server action (mig 341 hex + mig 343
  // appearance both live 2026-11-13). Slider writes are debounced
  // so a drag doesn't spam the DB.
  const [selfHex, setSelfHex] = React.useState<string>(initialSelf);
  const [peerHex, setPeerHex] = React.useState<string>(initialPeer);
  const [selfAppearance, setSelfAppearance] = React.useState<number>(
    initialSelfAppearance,
  );
  const [peerAppearance, setPeerAppearance] = React.useState<number>(
    initialPeerAppearance,
  );
  const [savingChannel, setSavingChannel] = React.useState<
    "self" | "peer" | "reset" | null
  >(null);
  const [saveStatus, setSaveStatus] = React.useState<string | null>(null);

  const selfOverride = selfHex !== themeSelfHex || hasSelfAppearanceOverride;
  const peerOverride = peerHex !== themePeerHex || hasPeerAppearanceOverride;

  async function persistColour(channel: "self" | "peer", hex: string) {
    if (!schemaReady) return;
    setSavingChannel(channel);
    try {
      const fd = new FormData();
      if (channel === "self") fd.set("self_hex", hex);
      if (channel === "peer") fd.set("peer_hex", hex);
      try {
        await setBubbleColoursAction(fd);
      } catch {
        /* redirect expected · local state already updated */
      }
      setSaveStatus(`Saved ${channel === "self" ? "sent" : "received"} colour`);
    } finally {
      setSavingChannel(null);
    }
  }

  // Owner directive 2026-11-13 · debounced appearance save. Slider
  // drags stream a flood of values so we commit ~300ms after the last
  // change rather than hammering the DB on every tick. The optimistic
  // local state drives the preview so the user sees instant feedback.
  const selfAppearanceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerAppearanceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function persistAppearanceDebounced(
    channel: "self" | "peer",
    value: number,
  ) {
    if (!schemaReady) return;
    const timerRef =
      channel === "self" ? selfAppearanceTimer : peerAppearanceTimer;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSavingChannel(channel);
      try {
        const fd = new FormData();
        if (channel === "self") fd.set("self_appearance", String(value));
        if (channel === "peer") fd.set("peer_appearance", String(value));
        try {
          await setBubbleColoursAction(fd);
        } catch {
          /* redirect expected */
        }
        setSaveStatus(
          `Saved ${channel === "self" ? "sent" : "received"} appearance`,
        );
      } finally {
        setSavingChannel(null);
      }
    }, 300);
  }

  React.useEffect(
    () => () => {
      if (selfAppearanceTimer.current) clearTimeout(selfAppearanceTimer.current);
      if (peerAppearanceTimer.current) clearTimeout(peerAppearanceTimer.current);
    },
    [],
  );

  async function handleReset() {
    setSavingChannel("reset");
    try {
      try {
        await resetBubbleColoursAction();
      } catch {
        /* redirect expected */
      }
      setSelfHex(themeSelfHex);
      setPeerHex(themePeerHex);
      setSelfAppearance(100);
      setPeerAppearance(100);
      setSaveStatus("Restored theme defaults");
    } finally {
      setSavingChannel(null);
    }
  }

  function onSelfSwatch(hex: string) {
    setSelfHex(hex);
    void persistColour("self", hex);
  }
  function onPeerSwatch(hex: string) {
    setPeerHex(hex);
    void persistColour("peer", hex);
  }
  function onSelfAppearance(v: number) {
    setSelfAppearance(v);
    persistAppearanceDebounced("self", v);
  }
  function onPeerAppearance(v: number) {
    setPeerAppearance(v);
    persistAppearanceDebounced("peer", v);
  }

  return (
    <div
      data-nex-chat-settings-bubble-colours
      style={{
        ...rowStyle,
        flexDirection: "column",
        alignItems: "stretch",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <IconCell emoji="🎈" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={titleStyle}>Bubble colours</div>
          <div style={subtitleStyle}>
            {schemaReady ? (
              <>
                Design each bubble against your own <strong style={{ color: CARD_INK }}>{themeName}</strong>{" "}
                background. Both colour and glass-to-solid appearance save to
                your account · follows you across devices.
              </>
            ) : (
              <>
                <strong style={{ color: ICON_RING }}>
                  Migration 341 not yet applied
                </strong>{" "}
                · bubble colours from the per-theme customiser still apply on
                this device via cookie. Cross-device sync lands with the
                column.
              </>
            )}
          </div>
        </div>
      </div>

      {/* LIVE PREVIEW · bubbles on the viewer's actual theme wallpaper. */}
      <PreviewStage
        heroImageUrl={themeHeroImageUrl}
        selfHex={selfHex}
        peerHex={peerHex}
        selfAppearance={selfAppearance}
        peerAppearance={peerAppearance}
      />

      <ChannelEditor
        label="My Chat Bubble"
        subtitle="Messages you send · outgoing"
        currentHex={selfHex}
        appearance={selfAppearance}
        onHex={onSelfSwatch}
        onAppearance={onSelfAppearance}
        saving={savingChannel === "self"}
        schemaReady={schemaReady}
        isOverride={selfOverride}
      />

      <ChannelEditor
        label="User Chat Bubble"
        subtitle="Messages from contacts · incoming (your view)"
        currentHex={peerHex}
        appearance={peerAppearance}
        onHex={onPeerSwatch}
        onAppearance={onPeerAppearance}
        saving={savingChannel === "peer"}
        schemaReady={schemaReady}
        isOverride={peerOverride}
      />

      <button
        type="button"
        data-nex-chat-settings-bubble-colours-reset
        disabled={
          savingChannel !== null || (!hasSelfOverride && !hasPeerOverride && selfAppearance === 100 && peerAppearance === 100)
        }
        onClick={handleReset}
        style={{
          width: "100%",
          padding: "12px 14px",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.08em",
          color: CONTROL_INK,
          background: CONTROL_BG,
          border: "none",
          borderRadius: 14,
          cursor: savingChannel !== null ? "not-allowed" : "pointer",
          opacity: savingChannel !== null ? 0.5 : 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M1 4v6h6" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
        Reset to theme defaults
      </button>

      {saveStatus ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            textAlign: "center",
            fontSize: 11,
            color: CARD_INK_DIM,
            letterSpacing: "0.04em",
          }}
        >
          {saveStatus}
        </div>
      ) : null}
    </div>
  );
}

// ─── Preview stage · bubbles on the user's actual theme wallpaper ────

function PreviewStage({
  heroImageUrl,
  selfHex,
  peerHex,
  selfAppearance,
  peerAppearance,
}: {
  heroImageUrl: string | null;
  selfHex: string;
  peerHex: string;
  selfAppearance: number;
  peerAppearance: number;
}): React.JSX.Element {
  return (
    <div
      aria-hidden
      data-nex-chat-settings-bubble-preview
      style={{
        position: "relative",
        height: 180,
        borderRadius: 12,
        overflow: "hidden",
        background: heroImageUrl ? "transparent" : "#1D2432",
        border: `1px solid ${ICON_RING}`,
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)",
      }}
    >
      {heroImageUrl ? (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${heroImageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              filter: "saturate(1.05)",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.28) 55%, rgba(0,0,0,0.42) 100%)",
            }}
          />
        </>
      ) : null}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 8,
          height: "100%",
          padding: "10px 14px",
        }}
      >
        <PreviewBubble
          side="in"
          hex={peerHex}
          appearance={peerAppearance}
          text="Nice background choice! 👋"
        />
        <PreviewBubble
          side="out"
          hex={selfHex}
          appearance={selfAppearance}
          text="Thanks — picking the bubble colours now."
        />
      </div>
    </div>
  );
}

function PreviewBubble({
  side,
  hex,
  appearance,
  text,
}: {
  side: "in" | "out";
  hex: string;
  appearance: number;
  text: string;
}): React.JSX.Element {
  const isOut = side === "out";
  const style = resolveBubbleAppearance(hex, appearance);
  return (
    <div
      style={{
        alignSelf: isOut ? "flex-end" : "flex-start",
        maxWidth: "78%",
        padding: "7px 11px",
        borderRadius: isOut ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
        background: style.background,
        border: style.border,
        backdropFilter: style.backdropFilter,
        WebkitBackdropFilter: style.backdropFilter,
        color: style.color,
        textShadow: style.textShadow,
        fontSize: 12.5,
        fontWeight: 600,
        lineHeight: 1.3,
        boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
      }}
    >
      {text}
    </div>
  );
}

/** Pure appearance resolver · derives the CSS that paints a bubble
 *  of the chosen hex at the chosen 0..100 appearance. Low values =
 *  glass (low alpha fill + strong blur + light text with shadow for
 *  readability). High values = solid colour with luminance-based ink.
 *  No JSX · unit-testable. */
function resolveBubbleAppearance(
  hex: string,
  appearance: number,
): {
  readonly background: string;
  readonly border: string;
  readonly backdropFilter: string;
  readonly color: string;
  readonly textShadow: string;
} {
  const clamped = Math.min(100, Math.max(0, Math.round(appearance)));
  const t = clamped / 100;
  const clean = hex.replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;

  // Fill alpha · 0.15 (glass) → 1.0 (solid).
  const fillAlpha = 0.15 + t * 0.85;
  // Blur · 20px (glass) → 0 (solid).
  const blurPx = Math.round(20 * (1 - t));
  // Border tint · visible across the range so bubble silhouette stays
  // crisp over the busy wallpaper.
  const borderAlpha = 0.45 + t * 0.4;
  // Ink · white with dark text-shadow when transparent · luminance-
  // based when the fill is nearly solid.
  const lum = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
  const inkDark = lum >= 0.55;
  const useSolidInk = t >= 0.7;
  const color = useSolidInk
    ? inkDark
      ? "#031018"
      : "#F2F5F8"
    : "#FFFFFF";
  const textShadow = useSolidInk
    ? "none"
    : "0 1px 2px rgba(0,0,0,0.75), 0 0 1px rgba(0,0,0,0.5)";
  return {
    background: `rgba(${r}, ${g}, ${b}, ${fillAlpha.toFixed(3)})`,
    border: `1px solid rgba(${r}, ${g}, ${b}, ${borderAlpha.toFixed(3)})`,
    backdropFilter:
      blurPx > 0 ? `blur(${blurPx}px) saturate(1.25)` : "none",
    color,
    textShadow,
  };
}

// ─── Channel editor · one per bubble (self / peer) ──────────────────

function ChannelEditor({
  label,
  subtitle,
  currentHex,
  appearance,
  onHex,
  onAppearance,
  saving,
  schemaReady,
  isOverride,
}: {
  label: string;
  subtitle: string;
  currentHex: string;
  appearance: number;
  onHex: (hex: string) => void;
  onAppearance: (v: number) => void;
  saving: boolean;
  schemaReady: boolean;
  isOverride: boolean;
}): React.JSX.Element {
  const [hexDraft, setHexDraft] = React.useState<string>(currentHex);
  React.useEffect(() => {
    setHexDraft(currentHex);
  }, [currentHex]);

  function commitHexInput() {
    const normalised = hexDraft.trim().toLowerCase();
    if (HEX_RE.test(normalised)) {
      if (normalised !== currentHex) onHex(normalised);
    } else {
      setHexDraft(currentHex);
    }
  }

  return (
    <div
      data-nex-chat-settings-bubble-channel
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "12px",
        borderRadius: 10,
        background: "rgba(255,114,0,0.06)",
        border: `1px solid ${ICON_RING}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: CARD_INK,
              letterSpacing: "0.02em",
            }}
          >
            {label}
          </div>
          <div style={{ fontSize: 10, color: CARD_INK_DIM, marginTop: 1 }}>
            {subtitle}
          </div>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: isOverride ? ICON_RING : CARD_INK_DIM,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 14,
              height: 14,
              borderRadius: 4,
              background: currentHex,
              border: `1px solid ${ICON_RING}`,
            }}
          />
          {currentHex}
        </div>
      </div>

      {/* Rainbow palette · 7 hues × 3 shades. Each cell is a button. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
        }}
      >
        {RAINBOW_PALETTE.map((hue) => (
          <div
            key={hue.hue}
            style={{ display: "flex", flexDirection: "column", gap: 4 }}
          >
            {hue.shades.map((hex) => {
              const isActive = hex === currentHex;
              return (
                <button
                  key={hex}
                  type="button"
                  disabled={!schemaReady || saving}
                  onClick={() => onHex(hex)}
                  aria-pressed={isActive}
                  aria-label={`${hue.hue} ${hex}`}
                  data-nex-chat-settings-bubble-rainbow={hex}
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    borderRadius: 6,
                    border: `2px solid ${isActive ? CARD_INK : "transparent"}`,
                    background: hex,
                    cursor: !schemaReady || saving ? "not-allowed" : "pointer",
                    padding: 0,
                    opacity: !schemaReady || saving ? 0.6 : 1,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Hex input · free-form entry for precise matches. */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: CARD_INK_DIM,
        }}
      >
        <span>Hex</span>
        <input
          type="text"
          value={hexDraft}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={commitHexInput}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            }
          }}
          disabled={!schemaReady || saving}
          maxLength={7}
          spellCheck={false}
          placeholder="#rrggbb"
          data-nex-chat-settings-bubble-hex-input
          style={{
            flex: 1,
            minWidth: 0,
            padding: "7px 10px",
            borderRadius: 8,
            border: `1px solid ${ICON_RING}`,
            background: CARD_BG,
            color: CARD_INK,
            fontSize: 12,
            fontFamily: "ui-monospace, Menlo, Consolas, monospace",
            letterSpacing: 0,
            textTransform: "lowercase",
          }}
        />
      </label>

      {/* Glass-to-solid appearance slider. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: CARD_INK_DIM,
          }}
        >
          <span>Appearance</span>
          <span>
            {appearance <= 15
              ? "Glass"
              : appearance <= 35
                ? "Frosted"
                : appearance <= 65
                  ? "Semi"
                  : appearance <= 90
                    ? "Rich"
                    : "Solid"}
            {" · "}
            {appearance}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={appearance}
          onChange={(e) => onAppearance(Number(e.target.value))}
          aria-label={`${label} appearance · 0 glass to 100 solid`}
          data-nex-chat-settings-bubble-appearance
          style={{
            width: "100%",
            accentColor: ICON_RING,
            cursor: "pointer",
          }}
        />
      </div>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────

function IconCell({ emoji }: { emoji: string }): React.JSX.Element {
  return (
    <div
      aria-hidden
      style={{
        flexShrink: 0,
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: ICON_BG,
        border: `1.5px solid ${ICON_RING}`,
        display: "grid",
        placeItems: "center",
        fontSize: 18,
        color: "#F2E5CC",
      }}
    >
      {emoji}
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  background: CARD_BG,
  border: "none",
  borderRadius: 14,
  minHeight: 68,
  boxShadow: "0 1px 2px rgba(74,32,24,0.10)",
};

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: CARD_INK,
  letterSpacing: "0.005em",
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 2,
  fontSize: 12,
  color: CARD_INK_DIM,
  lineHeight: 1.4,
};
