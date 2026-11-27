"use client";

// src/app/nex-native/chat-themes-library/plain/_plain-library-client.tsx
//
// NEX Chat Themes · Plain Backgrounds · client picker.
// Owner directive 2026-11-27 (revised 7) · match the Full Image
// library chrome AND fold bubble-colour customisation into the same
// FULL-PAGE preview take-over so background + bubbles save together
// on Apply. Inside the preview:
//   · the whole viewport paints the resolved plain hex (what free-
//     chat will paint after Apply);
//   · a compact top bar shows the hue name + a black close chip;
//   · two visually distinct WINDOWS (translucent white cards) sit
//     over the background:
//       Window 1 · Background · light-to-dark shade slider;
//       Window 2 · Chat bubbles · peer + self rows, each with a
//         curated 10-swatch palette, a "+" chip that opens the
//         native colour picker for ANY RGB value, a live Ab preview
//         chip, and a darken slider;
//   · fresh defaults · cream peer + NEX orange self · the classic
//     chat convention, never a monotone open;
//   · NEX-orange Apply button.
//   · top header row (spacer · black cart pill · black "+" drawer),
//   · body header (black "NEX CHAT THEMES" eyebrow · orange 24px
//     title · "N themes · page 1 of 1" muted line),
//   · 2-per-row card chrome (Ireland-Gold #C6A15B tile · 14px radius
//     · square 1:1 cover · small 32×32 NEX-orange eye button in the
//     bottom-right corner · black "Free" pill under the label),
//   · tapping the eye opens a single preview modal containing:
//       · live background preview with sample peer/self bubbles,
//       · light-to-dark BACKGROUND shade slider,
//       · PEER bubble colour palette + darken slider,
//       · SELF bubble colour palette + darken slider,
//       · Close + Apply.
// Plain colours are intrinsic UI constants (not DB-backed assets) so
// the pill always reads "Free" · they are never purchased.
// Persistence:
//   · Background → `plain:<hueId>@<shade>` into first-party
//     `nex-free-chat-wallpaper` cookie.
//   · Bubbles → `saveBubbleCustomizationAction` writes a per-theme
//     cookie keyed by the same themeId (plain ids are normalised
//     inside `cookieNameFor`) and, when a session is present,
//     writes-through to `nex_account` under mig 341.
// The free-chat canvas then paints the whole background and bubbles
// without a second trip through the standalone bubble-customize page.

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ControlDrawerSession } from "@/components/nex-native/control-drawer/control-drawer-client";
import type { EarnedBadges } from "@/lib/nex-native/creator/creator-badges";
import { UnifiedDrawer } from "@/components/nex-native/drawer/UnifiedDrawer";
import { saveBubbleCustomizationAction } from "@/app/nex-native/free-chat/_customize-actions";
// Owner directive 2026-11-27 (revised 9) · mount the REAL free-chat
// header inside the preview take-over so the viewer sees the exact
// NEX ping avatar + wordmark + subtitle + "+" drawer button on top
// of their chosen background. `FreeChatHeader` is the sealed Chat
// 9001 primitive shared by /free-chat and every peer chat, so
// rendering it here is true parity · not a visual replica.
import { FreeChatHeader } from "@/components/nex-native/chat-chrome/free-chat-header";
import {
  PLAIN_HUES,
  buildPlainThemeId,
  buildPlainHexThemeId,
  resolvePlainHex,
  pickBubbleAccentForPlainHex,
  luminanceOfHex,
} from "./_plain-palette";

/** OWNER DIRECTIVE 2026-11-27 (revised 7) · curated bubble palette +
 *  free colour picker. Ten curated hues cover every realistic chat
 *  background (NEX orange, cream, white, charcoal, ink, emerald, teal,
 *  blue, violet, magenta), then a "+" chip opens the native colour
 *  picker so the viewer can pick ANY RGB value. Keeps the surface
 *  compact while removing the ceiling. */
const BUBBLE_PALETTE: readonly string[] = [
  "#FF7200",
  "#FBF5E9",
  "#FFFFFF",
  "#4A3D22",
  "#1A1512",
  "#16D66B",
  "#0D9488",
  "#2D6CDF",
  "#7C3AED",
  "#E11D74",
] as const;

/** OWNER DIRECTIVE 2026-11-27 (revised 7) · fresh default bubble
 *  colours when the viewer opens a new hue. The classic chat idiom
 *  (cream peer · orange self) reads on every plain hex Rec. 709
 *  luminance can produce and matches the NEX brand accent. The old
 *  behaviour · both bubbles pinned to the palette-picked accent ·
 *  produced monotone screens on mid-tone hexes. */
const DEFAULT_PEER_COLOR = "#FBF5E9";
const DEFAULT_SELF_COLOR = "#FF7200";

/** Linear darken: multiply each RGB channel by (1 - amount). amount in
 *  [0, 1]. Keeps the same visual darken shape used in bubble-customize
 *  (`resolveBubbleFillAndRim`) without pulling the full helper into
 *  this file. */
function darkenHex(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const k = Math.max(0, Math.min(1, 1 - amount));
  const toHex = (n: number): string =>
    Math.max(0, Math.min(255, Math.round(n * k)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const NEX_INK_MUTE = "#7D9BC0";
const COOKIE_NAME = "nex-free-chat-wallpaper";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export interface PlainLibraryClientProps {
  readonly drawerSession: ControlDrawerSession | null;
  readonly viewerCreatorBadges: EarnedBadges;
}

function writeWallpaperCookie(themeId: string): void {
  // JS-writable first-party cookie · the strict `plain:<hue>@<shade>`
  // grammar only uses cookie-octet-safe characters (RFC 6265) so no
  // URL-encoding is needed · raw grammar reaches the server where
  // the existing seed regex rejects it cleanly.
  document.cookie =
    `${COOKIE_NAME}=${themeId}; ` +
    `path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** OWNER DIRECTIVE 2026-11-27 (revised 5 · Option A) · compact bubble
 *  control shown inline inside the plain preview modal. One row per
 *  bubble (peer / self) with: label, swatch palette, darken slider,
 *  and a small live fill preview so the viewer can read what they
 *  picked without scrolling back up to the preview canvas. */
interface BubbleControlRowProps {
  readonly label: string;
  readonly testId: "peer" | "self";
  readonly palette: readonly string[];
  readonly selectedColor: string;
  readonly onPickColor: (hex: string) => void;
  readonly darken: number;
  readonly onDarken: (amount: number) => void;
  readonly fillSwatchHex: string;
  readonly inkHex: string;
}

function BubbleControlRow({
  label,
  testId,
  palette,
  selectedColor,
  onPickColor,
  darken,
  onDarken,
  fillSwatchHex,
  inkHex,
}: BubbleControlRowProps): React.JSX.Element {
  // OWNER DIRECTIVE 2026-11-27 (revised 7) · free colour picker · the
  // "+" chip at the end of the palette opens the native colour picker
  // so the viewer can land on ANY RGB value. The picker's value is
  // bound to the current selectedColor so returning viewers see their
  // custom pick highlighted.
  const colorInputRef = React.useRef<HTMLInputElement | null>(null);
  const normalisedSelected = selectedColor.toUpperCase();
  const isPaletteColor = palette.some(
    (hex) => hex.toUpperCase() === normalisedSelected,
  );
  return (
    <div
      data-nex-plain-bubble-row={testId}
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#1A1512",
            letterSpacing: "0.01em",
          }}
        >
          {label}
        </span>
        <span
          data-nex-plain-bubble-swatch={testId}
          aria-label={`${label} live preview`}
          style={{
            background: fillSwatchHex,
            color: inkHex,
            padding: "4px 12px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 800,
            border: "1px solid rgba(26, 21, 18, 0.14)",
            minWidth: 56,
            textAlign: "center",
          }}
        >
          {normalisedSelected}
        </span>
      </div>
      <div
        role="radiogroup"
        aria-label={label}
        style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
      >
        {palette.map((hex) => {
          const selected = hex.toUpperCase() === normalisedSelected;
          return (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Pick ${hex}`}
              data-nex-plain-bubble-color={testId}
              data-nex-plain-bubble-color-value={hex}
              onClick={() => onPickColor(hex)}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: hex,
                border: selected
                  ? "2px solid #1A1512"
                  : "1px solid rgba(26, 21, 18, 0.14)",
                boxShadow: selected
                  ? "0 0 0 2px #FF7200, 0 2px 4px rgba(0, 0, 0, 0.2)"
                  : "0 1px 2px rgba(0, 0, 0, 0.16)",
                cursor: "pointer",
                padding: 0,
                transition: "transform 120ms ease, box-shadow 120ms ease",
                transform: selected ? "scale(1.08)" : "scale(1)",
              }}
            />
          );
        })}
        {/* Custom colour chip · opens native <input type="color">. When
            the viewer has picked a value outside the curated palette,
            the chip shows that colour AND the selected-ring so they
            can see their custom pick is the active one. */}
        <button
          type="button"
          aria-label="Pick any colour"
          data-nex-plain-bubble-color={testId}
          data-nex-plain-bubble-color-value="custom"
          onClick={() => colorInputRef.current?.click()}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: isPaletteColor
              ? "conic-gradient(from 180deg, #FF7200, #FBF5E9, #16D66B, #2D6CDF, #E11D74, #FF7200)"
              : selectedColor,
            border: !isPaletteColor
              ? "2px solid #1A1512"
              : "1px dashed rgba(26, 21, 18, 0.4)",
            boxShadow: !isPaletteColor
              ? "0 0 0 2px #FF7200, 0 2px 4px rgba(0, 0, 0, 0.2)"
              : "0 1px 2px rgba(0, 0, 0, 0.16)",
            cursor: "pointer",
            padding: 0,
            color: "#1A1512",
            fontSize: 16,
            fontWeight: 900,
            display: "grid",
            placeItems: "center",
            transition: "transform 120ms ease",
            transform: !isPaletteColor ? "scale(1.08)" : "scale(1)",
          }}
        >
          {isPaletteColor ? "+" : ""}
        </button>
        <input
          ref={colorInputRef}
          type="color"
          data-nex-plain-bubble-custom={testId}
          aria-label={`${label} custom colour`}
          value={selectedColor}
          onChange={(e) => onPickColor(e.target.value.toUpperCase())}
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: "none",
          }}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 1.1,
            color: "#5A6473",
            fontWeight: 700,
          }}
        >
          <span>Darken</span>
          <span>{Math.round(darken * 100)}%</span>
        </div>
        <input
          data-nex-plain-bubble-darken={testId}
          aria-label={`${label} darken`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(darken * 100)}
          onChange={(e) =>
            onDarken(
              Math.max(0, Math.min(100, Number(e.target.value))) / 100,
            )
          }
          style={{ width: "100%", accentColor: fillSwatchHex }}
        />
      </div>
    </div>
  );
}

export function PlainLibraryClient({
  drawerSession,
  viewerCreatorBadges,
}: PlainLibraryClientProps): React.JSX.Element {
  const router = useRouter();
  // Silence "unused prop" · badges are threaded in case a future
  // Themes+ gate opens on this page too. No-op at render time.
  void viewerCreatorBadges;
  const [openHueId, setOpenHueId] = React.useState<string | null>(null);
  const [shade, setShade] = React.useState<number>(50);
  const [applying, setApplying] = React.useState<boolean>(false);
  // OWNER DIRECTIVE 2026-11-27 (revised 8 · Scope B) · freeform-hex
  // background mode. When set, the preview and Apply path use this
  // hex directly instead of the hue+shade resolver · shade slider is
  // hidden because it doesn't apply. Any hue-swatch tap clears it.
  const [customBgHex, setCustomBgHex] = React.useState<string | null>(null);
  const bgColorInputRef = React.useRef<HTMLInputElement | null>(null);
  const isHexMode = customBgHex !== null;

  const openHue = React.useMemo(
    () => PLAIN_HUES.find((h) => h.id === openHueId) ?? null,
    [openHueId],
  );
  const previewHex = React.useMemo<string | null>(() => {
    if (customBgHex) return customBgHex;
    if (!openHue) return null;
    return resolvePlainHex(openHue.id, shade);
  }, [customBgHex, openHue, shade]);
  const previewBubbleAccent = React.useMemo<string>(() => {
    if (!previewHex) return "#FF7200";
    return pickBubbleAccentForPlainHex(previewHex);
  }, [previewHex]);

  // OWNER DIRECTIVE 2026-11-27 (revised 5 · Option A) · bubble
  //
  // (The old `previewBubbleTextHex` helper was replaced by per-bubble
  // luminance-picked `peerInk` / `selfInk` below · Rec. 709 stays as
  // the readability rule.)
  // customisation is folded INTO this modal · one sheet, one Apply.
  // The default peer/self colour is the accent the palette picks for
  // the current background hex. When the viewer opens a new hue the
  // defaults reset to that new accent, otherwise their earlier
  // choices stick while they tune the shade slider.
  const [peerColor, setPeerColor] = React.useState<string>(DEFAULT_PEER_COLOR);
  const [peerDarken, setPeerDarken] = React.useState<number>(0);
  const [selfColor, setSelfColor] = React.useState<string>(DEFAULT_SELF_COLOR);
  const [selfDarken, setSelfDarken] = React.useState<number>(0);
  const bubbleResetHueRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    // OWNER DIRECTIVE 2026-11-27 (revised 8) · bubble defaults reset
    // only on the CLOSED → OPEN transition. Switching background
    // hue INSIDE the preview (via the Background palette below)
    // leaves the viewer's bubble picks alone — they explicitly
    // chose those colours.
    if (openHueId && bubbleResetHueRef.current === null) {
      setPeerColor(DEFAULT_PEER_COLOR);
      setPeerDarken(0);
      setSelfColor(DEFAULT_SELF_COLOR);
      setSelfDarken(0);
    }
    bubbleResetHueRef.current = openHueId;
  }, [openHueId]);
  // previewBubbleAccent is no longer read here (defaults are brand
  // constants) · keep the memo so future preview layers can reuse it.
  void previewBubbleAccent;

  const peerFill = React.useMemo(
    () => darkenHex(peerColor, peerDarken),
    [peerColor, peerDarken],
  );
  const selfFill = React.useMemo(
    () => darkenHex(selfColor, selfDarken),
    [selfColor, selfDarken],
  );
  // Rec. 709 luminance picks a readable ink per bubble so a white
  // bubble never carries white text (regression seen on Red @ ~50).
  const peerInk = React.useMemo<string>(
    () => (luminanceOfHex(peerFill) > 0.5 ? "#1A1512" : "#FFFFFF"),
    [peerFill],
  );
  const selfInk = React.useMemo<string>(
    () => (luminanceOfHex(selfFill) > 0.5 ? "#1A1512" : "#FFFFFF"),
    [selfFill],
  );

  const onView = React.useCallback((hueId: string) => {
    setOpenHueId(hueId);
    setShade(50);
    setCustomBgHex(null);
  }, []);

  // OWNER DIRECTIVE 2026-11-27 (revised 8) · hue switch from INSIDE
  // the preview · the viewer is already tuning shade/bubbles, so we
  // only swap the hue and keep their current shade position. Bubble
  // colours are preserved (see the reset effect above). Hex mode is
  // cleared because the viewer picked a curated hue.
  const switchBackgroundHue = React.useCallback((hueId: string) => {
    setOpenHueId(hueId);
    setCustomBgHex(null);
  }, []);

  // OWNER DIRECTIVE 2026-11-27 (revised 8 · Scope B) · the "+" chip
  // and native colour picker set a freeform hex that bypasses the
  // hue+shade path. Normalised to upper-case "#RRGGBB" so the Apply
  // builder gets a stable value.
  const pickCustomBgHex = React.useCallback((hex: string) => {
    const clean = hex.replace("#", "").trim();
    if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return;
    setCustomBgHex(`#${clean.toUpperCase()}`);
  }, []);

  const onClose = React.useCallback(() => {
    if (applying) return;
    setOpenHueId(null);
    setCustomBgHex(null);
  }, [applying]);

  const onApply = React.useCallback(async () => {
    if (applying || !previewHex) return;
    if (!customBgHex && !openHue) return;
    setApplying(true);
    const themeId = customBgHex
      ? buildPlainHexThemeId(customBgHex)
      : buildPlainThemeId(openHue!.id, shade);
    writeWallpaperCookie(themeId);
    try {
      // Owner directive 2026-11-27 (revised 5 · Option A) · persist
      // the chosen bubble colours in the SAME action so the next
      // free-chat paint picks them up alongside the background. The
      // server action normalises `plain:<hue>@<shade>` into a
      // slug-safe cookie name (see `cookieNameFor`).
      await saveBubbleCustomizationAction({
        themeId,
        customization: {
          peerColor,
          peerDarken,
          selfColor,
          selfDarken,
          containerColor: previewHex,
        },
      });
    } catch {
      // Silent · wallpaper cookie still written. Free-chat will fall
      // back to the theme's default bubble accent on next load.
    }
    router.push("/nex-native/free-chat");
  }, [
    applying,
    customBgHex,
    openHue,
    peerColor,
    peerDarken,
    previewHex,
    router,
    selfColor,
    selfDarken,
    shade,
  ]);

  return (
    <div
      data-nex-plain-library-root
      style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}
    >
      {/* Top header row · OWNER DIRECTIVE 2026-11-27 (revised 3) ·
          byte-identical to the Full Image library (see
          _full-library-client.tsx:144-212): spacer · black cart pill ·
          black "+" drawer trigger. The style override forces the
          UnifiedDrawer's inner button to match (ControlDrawer defaults
          to orange + 40px). */}
      <style>{`
        [data-nex-chat-themes-global-drawer] button {
          background: #000000 !important;
          border: none !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45) !important;
          color: #FFFFFF !important;
          /* Owner directive 2026-11-27 · GLOBAL side-drawer button
             size = 36×36 (the sealed ControlDrawer triggerButtonStyle
             default). Every header on every page must render the
             drawer trigger at this size. Was 32×32 locally. */
          width: 36px !important;
          height: 36px !important;
          font-size: 20px !important;
        }
        [data-nex-chat-themes-global-drawer] svg {
          color: #FFFFFF !important;
          stroke: #FFFFFF !important;
          width: 16px !important;
          height: 16px !important;
        }
        [data-nex-chat-themes-global-drawer] svg * {
          stroke: #FFFFFF !important;
        }
      `}</style>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1 }} />
        {/* Owner directive 2026-11-27 (revised) · the shopping-cart
            Link that used to sit here has been removed · Plain
            Backgrounds is a theme-picker surface, not a commerce
            surface, so the cart affordance belongs on Shop routes
            only. The side-drawer "+" button below remains as the
            sole right-side header control. */}
        {/* Owner directive 2026-11-27 (revised) · the side-drawer "+"
            button renders UNCONDITIONALLY · including for guest
            viewers (null session). Guests get the sealed "Sign in to
            NEX" identity row inside the drawer · exactly the same
            affordance /free-chat offers guests. The earlier
            `drawerSession ? ... : null` gate hid the drawer button
            from guests on this page, which broke parity with the
            Full Image library. */}
        <span
          data-nex-chat-themes-global-drawer
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            // Owner directive 2026-11-27 · GLOBAL side-drawer button
            // size = 36×36. Matches the sealed ControlDrawer default
            // and every other nexapp header. Was 32×32.
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#000000",
            border: "none",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.45)",
            flexShrink: 0,
          }}
        >
          <UnifiedDrawer
            session={drawerSession}
            viewerEarnedCreatorBadges={viewerCreatorBadges.earned}
          />
        </span>
      </header>

      {/* Scrollable body · same frame as Full Image library. */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          overflowX: "hidden",
          padding: "0 2px",
          WebkitOverflowScrolling: "touch",
          width: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <header style={{ textAlign: "center", marginBottom: 18 }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#000000",
              fontWeight: 800,
            }}
          >
            NEX Chat Themes
          </p>
          <h1
            style={{
              margin: "6px 0 0",
              fontSize: 24,
              fontWeight: 700,
              color: "#FF7200",
              textShadow: "0 2px 10px rgba(0, 0, 0, 0.6)",
            }}
          >
            Plain Backgrounds
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 12,
              color: NEX_INK_MUTE,
            }}
          >
            {PLAIN_HUES.length} themes · page 1 of 1
          </p>
        </header>

      {/* Card grid · OWNER DIRECTIVE 2026-11-27 (revised 2) · exact
          same card chrome as the Full Image library ThemeCard:
            · 2-per-row grid, minmax(0, 1fr) tracks,
            · Ireland Gold #C6A15B tile with 14px radius + rgba(198,161,91,.6) border,
            · square 1:1 cover painted with the plain hex,
            · small 32×32 NEX-orange circular "View background" button
              in the bottom-right of the cover (eye icon · same SVG as
              the Full Image tile's Preview button),
            · black-ink theme label underneath.
          No download count and no Buy pill · plain colours are
          intrinsic UI constants, not purchasable assets. */}
      <ul
        data-nex-plain-swatch-grid
        aria-label="Plain background colours"
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 12,
          width: "100%",
          minWidth: 0,
        }}
      >
        {PLAIN_HUES.map((hue) => (
          <li key={hue.id} style={{ minWidth: 0 }}>
            <article
              data-nex-plain-swatch={hue.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: 8,
                borderRadius: 14,
                background: "#C6A15B",
                border: "1px solid rgba(198, 161, 91, 0.6)",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.35)",
                minWidth: 0,
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  position: "relative",
                  borderRadius: 10,
                  overflow: "hidden",
                  aspectRatio: "1 / 1",
                  background: hue.baseHex,
                  boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.08)",
                }}
              >
                <button
                  type="button"
                  data-nex-plain-view={hue.id}
                  aria-label={`View ${hue.label} background`}
                  onClick={() => onView(hue.id)}
                  style={{
                    position: "absolute",
                    bottom: 8,
                    right: 8,
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "#FF7200",
                    color: "#1a0a00",
                    border: "1px solid rgba(0, 0, 0, 0.35)",
                    cursor: "pointer",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 10px rgba(255, 114, 0, 0.5)",
                    zIndex: 1,
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width={16}
                    height={16}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
              <h3
                style={{
                  margin: "2px 0 0",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#F2F5F8",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  lineHeight: 1.2,
                }}
              >
                {hue.label}
              </h3>
              {/* "Free" pill · exact same chrome as the Full Image
                  library FREE_POOL tile · plain colours are intrinsic
                  UI constants so the pill reads Free on every card. */}
              <button
                type="button"
                data-nex-plain-pill={hue.id}
                aria-label={`Apply ${hue.label} free`}
                onClick={() => onView(hue.id)}
                style={{
                  marginTop: 2,
                  minHeight: 32,
                  padding: "0 10px",
                  borderRadius: 999,
                  background: "#000000",
                  color: "#FF7200",
                  border: "1px solid #FF7200",
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                Free
              </button>
            </article>
          </li>
        ))}
      </ul>

      {/* Owner directive 2026-11-27 · footer Close button on the
          plain library index · returns the viewer to the Chat Themes
          three-category hub without changing the saved theme. Sits
          INSIDE the scrollable body so it scrolls into view after
          the 2-per-row card grid · mirrors the cream + orange
          treatment used on the preview sheet's bottom actions. */}
      <footer
        data-nex-plain-library-footer
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "22px 0 calc(env(safe-area-inset-bottom, 0px) + 18px) 0",
        }}
      >
        <button
          type="button"
          data-nex-plain-library-close
          onClick={() => router.push("/nex-native/chat-themes")}
          style={{
            minWidth: 140,
            padding: "10px 22px",
            borderRadius: 10,
            border: "1px solid rgba(26, 21, 18, 0.18)",
            background: "#F2EEE4",
            color: "#1A1512",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.02em",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </footer>
      </div>

      {/* Preview modal · opens via View · shows the colour at full
          size with a light-to-dark shade slider and an Apply button.
          Pure CSS fixed overlay · no portal needed because the parent
          <main> uses position:absolute and already covers the
          viewport. */}
      {openHue && previewHex ? (
        <div
          data-nex-plain-preview-modal
          role="dialog"
          aria-modal="true"
          aria-label={`${openHue.label} preview`}
          style={{
            // OWNER DIRECTIVE 2026-11-27 (revised 6) · the preview is
            // now a FULL-PAGE take-over · no backdrop, no bottom
            // sheet · the whole viewport paints the resolved plain
            // hex so the viewer sees the exact free-chat background
            // they're about to apply. Matches `freeChatBackgroundCss`
            // when `wallpaperUrl` is null (plain mode) · that path
            // returns the plain hex directly, so what we paint here
            // is what free-chat paints after Apply.
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: previewHex,
            color: "#F2F5F8",
            display: "flex",
            flexDirection: "column",
            // Owner directive 2026-11-27 (revised 9) · the real
            // FreeChatHeader supplies its own safe-area-top padding,
            // so the outer modal only pads the SIDES and BOTTOM.
            // Padding-top 0 keeps the header ping avatar in the exact
            // same location as /free-chat.
            padding:
              "0 0 calc(env(safe-area-inset-bottom, 0px) + 14px)",
            boxSizing: "border-box",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div
            data-nex-plain-preview-sheet
            style={{
              width: "100%",
              maxWidth: 480,
              margin: "0 auto",
              color: "#1A1512",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              // Owner directive 2026-11-27 (revised 9) · horizontal
              // padding lives on the sheet wrapper so every section
              // below is inset 16px from the viewport edge. The
              // FreeChatHeader breaks out of this inset with negative
              // margins (see below) so it touches the viewport edges
              // exactly like /free-chat.
              padding: "0 16px",
              boxSizing: "border-box",
            }}
          >
            {/* Owner directive 2026-11-27 (revised 9) · mount the
                REAL FreeChatHeader so the viewer sees exactly the
                NEX ping avatar + wordmark + subtitle + black "+"
                drawer button that will sit on top of this background
                on /free-chat after Apply. Display name + subtitle
                mirror the sealed hero-preview sample ("Siobhán ·
                online") so the header has real content to render
                without needing a live peer. `drawerSession` is
                threaded from the server page so the "+" drawer
                shows the viewer's actual rows, not a stubbed sign-
                in prompt. `hideMagnifier` + `currentSurface="chat"`
                match the /free-chat mount. Negative margins break
                out of the sheet wrapper's 16px inset so the header
                touches the viewport edges exactly like /free-chat. */}
            <div
              data-nex-plain-preview-header-wrap
              style={{ marginLeft: -16, marginRight: -16 }}
            >
              <FreeChatHeader
                // Owner directive 2026-11-27 (revised 14) · guest
                // viewers see "Guest" on the main line and the
                // smaller gray "Guest Account" sub-line beneath it.
                // Signed-in viewers still get their NEX-handle on
                // the sub-line. Mirrors /free-chat/page.tsx.
                displayName={drawerSession?.displayName ?? "Guest"}
                subtitle={
                  drawerSession?.nexHandle
                    ? drawerSession.nexHandle.replace(/^nex-/i, "NEX-")
                    : "Guest Account"
                }
                avatarUrl={null}
                drawerSession={drawerSession}
                // Preview header ping = NEX ORANGE rim + orange pulse
                // (overrides the sealed green default on /free-chat for
                // this preview surface only). Matches the orange Apply
                // button + the orange card eye icon so the preview
                // chrome reads as one accent family.
                pingBadgeAccent="#FF7200"
                // Owner directive 2026-11-27 (revised 16) · the preview
                // paints on user-picked backgrounds that are typically
                // cream / white / pastel. Cream subtitle text (tried
                // in revision 15 to match drawer bg) disappears on
                // those surfaces, so the sub-line reverts to a medium
                // GRAY (#6B7280) that remains legible on cream AND
                // white AND the pastel swatches. Main-line ink stays
                // BLACK for maximum contrast on any plain swatch.
                textColor="#000000"
                subtitleColor="#6B7280"
                hideMagnifier={true}
                currentSurface="chat"
              />
            </div>
            {/* Owner directive 2026-11-27 (revised 11) · the
                hue-label pill + X close chip that previously sat here
                have been removed · the real FreeChatHeader above and
                the "Close" button in the bottom action bar cover both
                identity and dismissal. Removing the strip takes the
                preview even closer to a true /free-chat canvas · the
                background flows straight from the header into the
                sample bubbles with no preview-only chrome between
                them. */}

            {/* Sample bubbles float DIRECTLY on the full-page plain
                hex so the viewer sees exactly what free-chat will
                paint after Apply · no inner canvas, no border, no
                scaled preview · the preview IS the page. */}
            <div
              data-nex-plain-preview-canvas
              style={{
                minHeight: 160,
                padding: "8px 2px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <div
                data-nex-plain-preview-peer
                style={{
                  alignSelf: "flex-start",
                  background: peerFill,
                  color: peerInk,
                  padding: "6px 10px",
                  borderRadius: 14,
                  fontSize: 12,
                  maxWidth: "75%",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.15)",
                }}
              >
                Contacts bubble · live preview
              </div>
              <div
                data-nex-plain-preview-self
                style={{
                  alignSelf: "flex-end",
                  background: selfFill,
                  color: selfInk,
                  padding: "6px 10px",
                  borderRadius: 14,
                  fontSize: 12,
                  maxWidth: "75%",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.18)",
                }}
              >
                Your bubble
              </div>
            </div>

            {/* ── Window 1 · BACKGROUND ────────────────────────────
                OWNER DIRECTIVE 2026-11-27 (revised 7) · the
                background shade adjustment lives in its OWN panel so
                the viewer can tell at a glance which section controls
                the page colour vs. the bubble colours. */}
            <section
              data-nex-plain-bg-panel
              aria-label="Background colour"
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                borderRadius: 16,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                boxShadow: "0 10px 28px rgba(0, 0, 0, 0.28)",
                color: "#1A1512",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    aria-hidden
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: previewHex,
                      border: "1px solid rgba(26, 21, 18, 0.2)",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#1A1512",
                      letterSpacing: "0.01em",
                    }}
                  >
                    Background
                  </span>
                </div>
                <span
                  data-nex-plain-shade-value
                  style={{
                    fontSize: 11,
                    color: "#5A6473",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  {shade < 50 ? "Light" : shade > 50 ? "Dark" : "Base"} ·{" "}
                  {shade}
                </span>
              </div>
              {/* Background hue palette · OWNER DIRECTIVE 2026-11-27
                  (revised 8 · Scope A) · lets the viewer switch to
                  another plain hue without closing the preview.
                  Shade position is preserved across hue switches so
                  someone fine-tuning a dark palette doesn't lose
                  their place. */}
              <div
                role="radiogroup"
                aria-label="Background hue"
                data-nex-plain-bg-palette
                style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
              >
                {PLAIN_HUES.map((hue) => {
                  const selected = !isHexMode && hue.id === openHueId;
                  return (
                    <button
                      key={hue.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`Switch background to ${hue.label}`}
                      data-nex-plain-bg-hue={hue.id}
                      onClick={() => switchBackgroundHue(hue.id)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: hue.baseHex,
                        border: selected
                          ? "2px solid #1A1512"
                          : "1px solid rgba(26, 21, 18, 0.14)",
                        boxShadow: selected
                          ? "0 0 0 2px #FF7200, 0 2px 4px rgba(0, 0, 0, 0.2)"
                          : "0 1px 2px rgba(0, 0, 0, 0.16)",
                        cursor: "pointer",
                        padding: 0,
                        transition:
                          "transform 120ms ease, box-shadow 120ms ease",
                        transform: selected ? "scale(1.08)" : "scale(1)",
                      }}
                    />
                  );
                })}
                {/* Free-hex chip · Scope B · opens the native colour
                    picker. When active, shows the viewer's custom
                    hex with the same selected ring the hue swatches
                    use, so they can see their custom pick is live. */}
                <button
                  type="button"
                  aria-label="Pick any background colour"
                  data-nex-plain-bg-custom
                  onClick={() => bgColorInputRef.current?.click()}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: isHexMode
                      ? (customBgHex as string)
                      : "conic-gradient(from 180deg, #FF7200, #FBF5E9, #16D66B, #2D6CDF, #E11D74, #FF7200)",
                    border: isHexMode
                      ? "2px solid #1A1512"
                      : "1px dashed rgba(26, 21, 18, 0.4)",
                    boxShadow: isHexMode
                      ? "0 0 0 2px #FF7200, 0 2px 4px rgba(0, 0, 0, 0.2)"
                      : "0 1px 2px rgba(0, 0, 0, 0.16)",
                    cursor: "pointer",
                    padding: 0,
                    color: "#1A1512",
                    fontSize: 14,
                    fontWeight: 900,
                    display: "grid",
                    placeItems: "center",
                    transition: "transform 120ms ease",
                    transform: isHexMode ? "scale(1.08)" : "scale(1)",
                  }}
                >
                  {isHexMode ? "" : "+"}
                </button>
                <input
                  ref={bgColorInputRef}
                  type="color"
                  data-nex-plain-bg-custom-input
                  aria-label="Background custom colour"
                  value={customBgHex ?? previewHex ?? "#FBF5E9"}
                  onChange={(e) => pickCustomBgHex(e.target.value)}
                  style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    opacity: 0,
                    pointerEvents: "none",
                  }}
                />
              </div>
              {!isHexMode ? (
                <>
                  <div
                    aria-hidden
                    style={{
                      height: 1,
                      background: "rgba(26, 21, 18, 0.08)",
                      margin: "2px 0",
                    }}
                  />
                  <div
                    data-nex-plain-shade-row
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <input
                      data-nex-plain-shade-input
                      aria-label="Light to dark adjustment"
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={shade}
                      onChange={(e) =>
                        setShade(
                          Math.max(0, Math.min(100, Number(e.target.value))),
                        )
                      }
                      style={{ width: "100%", accentColor: previewHex ?? undefined }}
                    />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 10,
                        letterSpacing: 1.1,
                        textTransform: "uppercase",
                        color: "#5A6473",
                        fontWeight: 700,
                      }}
                    >
                      <span>Light</span>
                      <span>Dark</span>
                    </div>
                  </div>
                </>
              ) : (
                <div
                  data-nex-plain-shade-disabled
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.04em",
                    color: "#5A6473",
                    fontWeight: 600,
                    textAlign: "center",
                    padding: "6px 4px 2px",
                  }}
                >
                  Custom hex · tap any swatch to return to the shade slider
                </div>
              )}
            </section>

            {/* ── Window 2 · CHAT BUBBLES ──────────────────────────
                Separate panel for peer + self bubble colour and
                darken. Each row inside offers the curated palette AND
                the "+" chip for a free colour pick. */}
            <section
              data-nex-plain-bubbles-panel
              aria-label="Chat bubble colours"
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                borderRadius: 16,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
                boxShadow: "0 10px 28px rgba(0, 0, 0, 0.28)",
                color: "#1A1512",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  aria-hidden
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    background:
                      "linear-gradient(135deg, #FBF5E9 0 50%, #FF7200 50% 100%)",
                    border: "1px solid rgba(26, 21, 18, 0.2)",
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#1A1512",
                    letterSpacing: "0.01em",
                  }}
                >
                  Chat bubbles
                </span>
              </div>

              <BubbleControlRow
                label="Contacts bubble"
                testId="peer"
                palette={BUBBLE_PALETTE}
                selectedColor={peerColor}
                onPickColor={setPeerColor}
                darken={peerDarken}
                onDarken={setPeerDarken}
                fillSwatchHex={peerFill}
                inkHex={peerInk}
              />

              <div
                aria-hidden
                style={{
                  height: 1,
                  background: "rgba(26, 21, 18, 0.08)",
                  margin: "2px 0",
                }}
              />

              <BubbleControlRow
                label="Your bubble"
                testId="self"
                palette={BUBBLE_PALETTE}
                selectedColor={selfColor}
                onPickColor={setSelfColor}
                darken={selfDarken}
                onDarken={setSelfDarken}
                fillSwatchHex={selfFill}
                inkHex={selfInk}
              />
            </section>

            {/* Actions · sticky-feel bottom bar */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                data-nex-plain-close
                onClick={onClose}
                disabled={applying}
                style={{
                  flex: "0 0 auto",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(26, 21, 18, 0.18)",
                  background: "#F2EEE4",
                  color: "#1A1512",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: applying ? "not-allowed" : "pointer",
                }}
              >
                Close
              </button>
              <button
                type="button"
                data-nex-plain-apply
                disabled={applying}
                onClick={onApply}
                style={{
                  // OWNER DIRECTIVE 2026-11-27 (revised 6) · NEX
                  // orange Apply button · same primary accent used
                  // on the card eye button and the Free pill border.
                  flex: "1 1 auto",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(0, 0, 0, 0.35)",
                  background: "#FF7200",
                  color: "#1A0A00",
                  fontWeight: 900,
                  fontSize: 14,
                  cursor: applying ? "wait" : "pointer",
                  letterSpacing: "0.03em",
                  boxShadow:
                    "0 4px 10px rgba(255, 114, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.28)",
                }}
              >
                {applying ? "Applying…" : "Apply"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
