// src/app/nex-native/free-chat/bubble-customize/_customize-client.tsx
//
// NEX · Free Chat · bubble-customize client component.
// Owner-authorised 2026-11-02.
// -----------------------------------------------------------------------------
// Interactive controls for the per-theme bubble customization. The
// server renders the layout + wallpaper + initial values · this client
// owns the colour drawer open-state, slider state, and submits via the
// server actions.

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  resolveBubbleFillAndRim,
  pickInkForBubble,
  type BubbleCustomization,
  hexWithAlpha,
} from "../_types";
import { ColorDrawer } from "./_color-drawer";
import {
  saveBubbleCustomizationAction,
  resetBubbleCustomizationAction,
} from "../_customize-actions";

const PAGE_BG_FALLBACK = "var(--nex-world-drawer-bg, #020914)";
const TEXT_INK = "#F2F5F8";
const TEXT_DIM = "#B5C3D6";
const TEXT_MUTE = "#7D9BC0";
const ACCENT_RING = "var(--nex-world-secondary, #00AFFF)";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface CustomizeClientProps {
  readonly themeId: string;
  readonly wallpaperUrl: string | null;
  readonly themeLabel: string;
  /** Resolved customization: saved values if any, else theme defaults. */
  readonly initial: BubbleCustomization;
  /** Theme defaults · used by Reset to restore baseline. */
  readonly defaults: BubbleCustomization;
  /** True ONLY for the plain `nex-default` tile · gates the background
   *  colour picker (3rd control column + preview backdrop). Wallpaper
   *  tiles ship their own backdrop so the picker is hidden there. */
  readonly supportsBackgroundPicker: boolean;
}

export function CustomizeClient({
  themeId,
  wallpaperUrl,
  themeLabel,
  initial,
  defaults,
  supportsBackgroundPicker,
}: CustomizeClientProps): React.JSX.Element {
  const router = useRouter();
  const [peerColor, setPeerColor] = React.useState<string>(initial.peerColor);
  // Owner directive 2026-11-02 (revision 4) · darken sliders always
  // start at 0 (the chosen hue at full brightness) regardless of what
  // was previously saved. Mental model: "the bubble on-screen IS the
  // lightest · move the slider to darken from here." Any prior
  // saved darken persists in the cookie and still paints the live
  // chat · it's just not pre-filled into the slider on this page.
  const [peerDarken, setPeerDarken] = React.useState<number>(0);
  const [selfColor, setSelfColor] = React.useState<string>(initial.selfColor);
  const [selfDarken, setSelfDarken] = React.useState<number>(0);
  // Owner directive 2026-11-02 (revision 8) · chat-background colour
  // for the plain `nex-default` tile only. Wallpaper tiles ignore
  // this field (null persisted, picker hidden).
  const [backgroundColor, setBackgroundColor] = React.useState<string>(
    initial.containerColor ?? "#000000",
  );

  const [drawer, setDrawer] = React.useState<
    "peer" | "self" | "background" | null
  >(null);
  const [isPending, startTransition] = React.useTransition();
  const [feedback, setFeedback] = React.useState<string | null>(null);

  // Live-computed fills + rims from the current colour + darken amount.
  const bubbleStyle = React.useMemo(
    () =>
      resolveBubbleFillAndRim({
        peerColor,
        peerDarken,
        selfColor,
        selfDarken,
      }),
    [peerColor, peerDarken, selfColor, selfDarken],
  );
  // Text ink per bubble · auto-flips to dark on bright+not-darkened colours.
  const peerInk = pickInkForBubble(peerColor, peerDarken);
  const selfInk = pickInkForBubble(selfColor, selfDarken);

  const handlePick =
    (which: "peer" | "self" | "background") =>
    (hex: string): void => {
      if (which === "peer") setPeerColor(hex);
      else if (which === "self") setSelfColor(hex);
      else setBackgroundColor(hex);
      setDrawer(null);
    };

  const handleSave = (): void => {
    setFeedback(null);
    startTransition(async () => {
      const res = await saveBubbleCustomizationAction({
        themeId,
        customization: {
          peerColor,
          peerDarken,
          selfColor,
          selfDarken,
          // Only the plain `nex-default` tile persists a chosen chat
          // background colour · wallpaper tiles leave this null.
          containerColor: supportsBackgroundPicker ? backgroundColor : null,
        },
      });
      if (res.ok) {
        // Owner directive 2026-11-04 · post-bubble-save flow routes to
        // the redesigned profile editor (first-fill for new users ·
        // from=signup lands them in /free-chat after save). Edit-from-
        // drawer users hit the same route and return to /profile/me on
        // save. Prior revision bounced straight to /free-chat.
        router.push("/nex-native/settings/profile/edit?from=signup");
        router.refresh();
      } else {
        setFeedback(`Save failed: ${res.code}`);
      }
    });
  };

  const handleReset = (): void => {
    setFeedback(null);
    setPeerColor(defaults.peerColor);
    setPeerDarken(defaults.peerDarken);
    setSelfColor(defaults.selfColor);
    setSelfDarken(defaults.selfDarken);
    setBackgroundColor(defaults.containerColor ?? "#000000");
    startTransition(async () => {
      await resetBubbleCustomizationAction({ themeId });
      setFeedback("Reset to theme defaults.");
    });
  };

  // Preview container background · wallpaper paints at full fidelity
  // (no overlay) so the user sees the SAME image they picked on the
  // theme tile. The plain `nex-default` tile paints the user-picked
  // background colour so the preview matches the live chat.
  //
  // Owner directive 2026-11-04 later-same-day · "why image cut at
  // header" · preview is anchored to TOP CENTER so the header portion
  // of the wallpaper (where the theme's primary illustration usually
  // sits) is visible inside the preview panel, not cropped off above.
  const previewContainerStyle: React.CSSProperties = wallpaperUrl
    ? {
        backgroundImage: `url("${wallpaperUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "top center",
        backgroundColor: PAGE_BG_FALLBACK,
      }
    : {
        backgroundColor: supportsBackgroundPicker
          ? backgroundColor
          : PAGE_BG_FALLBACK,
      };

  // Owner directive 2026-11-03 · "must show the theme back ground
   // from the chat home free page" · the SAME wallpaper the user picked
   // on /free-chat?show-themes=1 paints the full-page background here.
   // For the plain `nex-default` tile (no wallpaper · supportsBackgroundPicker)
   // the user's picked containerColor fills the page instead. Fallback
   // to the sealed drawer-bg while the image loads.
   const pageBg: React.CSSProperties = wallpaperUrl
     ? {
         backgroundImage: `url("${wallpaperUrl}")`,
         backgroundSize: "cover",
         backgroundPosition: "center",
         backgroundRepeat: "no-repeat",
         backgroundColor: PAGE_BG_FALLBACK,
       }
     : {
         backgroundColor: supportsBackgroundPicker ? backgroundColor : PAGE_BG_FALLBACK,
       };

  return (
    <div
      style={{
        height: "100vh",
        maxHeight: "100vh",
        overflow: "hidden",
        ...pageBg,
        color: TEXT_INK,
        fontFamily: SANS,
        padding:
          "calc(env(safe-area-inset-top, 0px) + 14px) 14px calc(env(safe-area-inset-bottom, 0px) + 14px)",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: 640,
          width: "100%",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Top row · ← Themes button on the left + theme label centred.
            Owner directive 2026-11-02 · the user must always be able
            to return to the picker to swap themes without losing
            unsaved work (nothing is persisted until Save). */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "80px 1fr 80px",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Link
            href="/nex-native/free-chat?show-themes=1&preview=1"
            aria-label="Back to themes"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(6, 15, 28, 0.72)",
              border: `1px solid rgba(198, 161, 91, 0.3)`,
              color: TEXT_INK,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              lineHeight: 1,
            }}
          >
            <span aria-hidden>←</span>
            <span>Themes</span>
          </Link>
          <h1
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            {themeLabel}
          </h1>
          <span />
        </div>

        {/* ── Preview panel · theme-aware ──────────────────────────
            Owner directive 2026-11-02 (revision 6) · preview height
            CAPPED so the controls panel + Reset/Save action bar never
            clip on short viewports. Prior `flex: 1` ate all remaining
            space and squeezed the buttons off-screen on color-only
            tiles (3-column controls take more height than 2-column). */}
        <section
          data-nex-bubble-customize-preview
          style={{
            flex: "0 1 auto",
            height: "clamp(140px, 32vh, 220px)",
            borderRadius: 16,
            overflow: "hidden",
            border: `1px solid rgba(198, 161, 91, 0.22)`,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div
            style={{
              ...previewContainerStyle,
              width: "100%",
              height: "100%",
              padding: "20px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              justifyContent: "center",
            }}
          >
            {/* Peer bubble · left */}
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                data-nex-bubble-customize-preview-peer
                style={{
                  maxWidth: "78%",
                  padding: "10px 14px",
                  borderRadius: 18,
                  borderBottomLeftRadius: 6,
                  background: bubbleStyle.peerFill,
                  border: `1px solid ${bubbleStyle.peerRim}`,
                  color: peerInk,
                  fontSize: 14,
                  lineHeight: 1.4,
                  backdropFilter: "blur(10px) saturate(140%)",
                  WebkitBackdropFilter: "blur(10px) saturate(140%)",
                  boxShadow: "0 6px 14px -8px rgba(0,0,0,0.6)",
                }}
              >
                Hey, you around? Fancy a chat?
              </div>
            </div>
            {/* Owner bubble · right */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div
                data-nex-bubble-customize-preview-self
                style={{
                  maxWidth: "78%",
                  padding: "10px 14px",
                  borderRadius: 18,
                  borderBottomRightRadius: 6,
                  background: bubbleStyle.selfFill,
                  border: `1px solid ${bubbleStyle.selfRim}`,
                  color: selfInk,
                  fontSize: 14,
                  lineHeight: 1.4,
                  backdropFilter: "blur(10px) saturate(140%)",
                  WebkitBackdropFilter: "blur(10px) saturate(140%)",
                  boxShadow: "0 6px 14px -8px rgba(0,0,0,0.6)",
                }}
              >
                Grand · I just got in. What&apos;s the plan?
              </div>
            </div>
          </div>
        </section>

        {/* ── Controls panel ─────────────────────────────────────
            Row 1 · Other user + Your bubble (2 columns)
            Row 2 · Background (full-width · plain tile only) */}
        <section
          data-nex-bubble-customize-controls
          style={{
            padding: 10,
            borderRadius: 14,
            background: "rgba(6, 15, 28, 0.72)",
            border: `1px solid rgba(198, 161, 91, 0.18)`,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <ControlColumn
            label="Other user"
            color={peerColor}
            darken={peerDarken}
            onOpenDrawer={() => setDrawer("peer")}
            onDarkenChange={setPeerDarken}
          />
          <ControlColumn
            label="Your bubble"
            color={selfColor}
            darken={selfDarken}
            onOpenDrawer={() => setDrawer("self")}
            onDarkenChange={setSelfDarken}
          />
          {supportsBackgroundPicker ? (
            <div style={{ gridColumn: "1 / -1" }}>
              <ControlColumn
                label="Background"
                color={backgroundColor}
                darken={0}
                onOpenDrawer={() => setDrawer("background")}
                onDarkenChange={() => {
                  /* no darken slider for background · hidden via prop */
                }}
                hideDarkenSlider
                buttonText="Page Background"
              />
            </div>
          ) : null}
        </section>

        {/* Action bar · Save + Reset ──────────────────────────── */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            flexShrink: 0,
          }}
        >
          {/* Owner directive 2026-11-04 later-same-day · Reset button
              rendered in NEX green (sealed online-presence #16D66B) so
              it reads as an action on the Pub Country / wallpaper
              themes where transparent-on-dark was washed-out. Save
              remains the world accent. */}
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            style={{
              minHeight: 44,
              padding: "0 20px",
              borderRadius: 999,
              background: "#16D66B",
              color: "#0a1a0a",
              border: `1px solid #16D66B`,
              fontSize: 14,
              fontWeight: 800,
              cursor: isPending ? "wait" : "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            style={{
              minHeight: 44,
              padding: "0 20px",
              borderRadius: 999,
              background: ACCENT_RING,
              color: "#0a1a0a",
              border: `1px solid ${ACCENT_RING}`,
              fontSize: 14,
              fontWeight: 800,
              cursor: isPending ? "wait" : "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </section>
        {feedback ? (
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: TEXT_DIM,
              textAlign: "center",
            }}
          >
            {feedback}
          </p>
        ) : null}
      </div>

      {/* Owner directive 2026-11-02 (revision 5) · slow colour cycle
          on the Choose Colour pill border so the user sees it's
          tappable. Cycles through 4 NEX palette hues on a 5-second
          loop with a soft glow. Opt-out for prefers-reduced-motion.
          Keyframe scoped to this surface only. */}
      <style>{`
        @keyframes nex-choose-color-hint {
          0%, 100% {
            border-color: rgba(198, 161, 91, 0.65);
            box-shadow: 0 0 10px rgba(198, 161, 91, 0.35);
          }
          25% {
            border-color: rgba(29, 161, 242, 0.65);
            box-shadow: 0 0 10px rgba(29, 161, 242, 0.35);
          }
          50% {
            border-color: rgba(255, 79, 112, 0.65);
            box-shadow: 0 0 10px rgba(255, 79, 112, 0.35);
          }
          75% {
            border-color: rgba(74, 222, 128, 0.6);
            box-shadow: 0 0 10px rgba(74, 222, 128, 0.3);
          }
        }
        [data-nex-choose-color-pill] {
          animation: nex-choose-color-hint 5000ms ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-choose-color-pill] {
            animation: none;
          }
        }
      `}</style>

      {/* ── Colour drawer ───────────────────────────────────────── */}
      <ColorDrawer
        open={drawer !== null}
        title={
          drawer === "peer"
            ? "Other user bubble colour"
            : drawer === "self"
              ? "Your bubble colour"
              : "Page Background"
        }
        activeHex={
          drawer === "peer"
            ? peerColor
            : drawer === "self"
              ? selfColor
              : backgroundColor
        }
        onPick={(hex) => (drawer ? handlePick(drawer)(hex) : undefined)}
        onClose={() => setDrawer(null)}
        showPatterns={drawer === "background"}
      />
    </div>
  );
}

// ─── Control column · one per bubble ───────────────────────────────

function ControlColumn({
  label,
  color,
  darken,
  onOpenDrawer,
  onDarkenChange,
  hideDarkenSlider = false,
  buttonText,
}: {
  readonly label: string;
  readonly color: string;
  readonly darken: number;
  readonly onOpenDrawer: () => void;
  readonly onDarkenChange: (next: number) => void;
  readonly hideDarkenSlider?: boolean;
  /** Optional text shown inside the pill button instead of the hex ·
   *  used by the Background row ("Page color") so the tap target is
   *  self-labeled. Falls back to the hex when omitted. */
  readonly buttonText?: string;
}): React.JSX.Element {
  // Visual preview of the fill at current darken · the circle button
  // shows the chosen colour un-darkened so the user sees the HUE they
  // picked · the slider darkens the live bubble preview above.
  const previewFill = hexWithAlpha(color, 0.5);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <span
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          color: TEXT_MUTE,
        }}
      >
        {label}
      </span>

      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label={`Choose ${label} colour · currently ${color}`}
        data-nex-choose-color-pill
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px 6px 6px",
          background: "rgba(6, 15, 28, 0.6)",
          border: `1px solid rgba(255, 255, 255, 0.14)`,
          borderRadius: 999,
          cursor: "pointer",
          color: TEXT_INK,
          fontFamily:
            "'JetBrains Mono', 'Fira Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: 11,
          // Allow the button to shrink inside narrow grid cells so
          // the hex label can truncate rather than overflow the panel
          // (owner report 2026-11-02 · "choose color button offer
          // screen right" on the 3-column color-only layout).
          minWidth: 0,
          width: "100%",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: color,
            border: `2px solid ${previewFill}`,
            flexShrink: 0,
            boxShadow: `0 0 8px ${hexWithAlpha(color, 0.4)}`,
            display: "block",
          }}
        />
        <span
          style={{
            textTransform: buttonText ? "none" : "uppercase",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
            fontWeight: buttonText ? 700 : 400,
            letterSpacing: buttonText ? 0.3 : 0,
          }}
        >
          {buttonText ?? color}
        </span>
      </button>

      {hideDarkenSlider ? null : (
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontSize: 11,
            color: TEXT_MUTE,
          }}
        >
          <span>
            Darken ·{" "}
            <strong style={{ color: TEXT_INK }}>
              {Math.round(darken * 100)}%
            </strong>
          </span>
          {/* Owner directive 2026-11-03 · "the darken scale bar should
              0 to the color of the selected color" · track paints a
              gradient from the live-picked colour (at 0 · left) to black
              (at 1 · right) so the slider visually telegraphs what
              darken does to the chosen hue. Thumb stays accent-tinted. */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={darken}
            onChange={(e) => onDarkenChange(Number(e.target.value))}
            style={{
              width: "100%",
              accentColor: color,
              appearance: "none",
              WebkitAppearance: "none",
              height: 10,
              borderRadius: 999,
              background: `linear-gradient(to right, ${color} 0%, #000000 100%)`,
              outline: "none",
              cursor: "pointer",
            }}
          />
        </label>
      )}
    </div>
  );
}
