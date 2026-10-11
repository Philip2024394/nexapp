// src/app/nex-native/chat-standard/_engine/preview-mini-phone.ts
//
// Shared Mini-Phone Theme Treatment · sealed 2026-10-11.
// Final Parity Pass update 2026-10-11 · controls + ambient unified
// through the live engine's resolvers.
// ------------------------------------------------------
// Preview surfaces (category phone grid · gallery phone tiles · free
// NEX mini-phones · immersive preview shell) all paint a scaled-down
// version of the Standard Experience chat shell. Before this module
// each surface duplicated the pixel-level formulas independently and
// drifted away from the live engine (hardcoded cyan/navy glass,
// hardcoded orange send button, pink avatar borders).
//
// This file is the SINGLE SOURCE OF TRUTH for the colours + materials
// a mini-phone paints. Every formula here mirrors the live engine's
// equivalent in `_engine/theme-engine.tsx` (`resolveBubbleBackground`,
// `resolveBubbleBorder`) or DELEGATES to the live resolver
// (`resolveControlsTreatment` from `./control-resolver`) for the
// controls that already have a shared implementation.
//
// Unified via `resolveControlsTreatment` (2026-10-11 final parity pass):
//   · Header R1 cluster (Home · Shop · Cart) → `controls.headerButton`
//     (identical bg/border/color on all three · the live chat's
//     StandardHeader paints all three with `baseBtn`).
//   · Composer container → `controls.composerContainer`.
//   · Send button → `controls.sendButton(false)`.
// Mini-phones only override width/height for scale · chrome rules are
// byte-identical to the live engine.
//
// Load-bearing rules sealed 2026-10-11:
//
//   · Preview surfaces MUST import these helpers rather than inline
//     their own rgba literals. The regression test
//     `_preview-visual-parity.test.ts` guards this by failing CI if
//     a preview file re-introduces chrome hexes (#FF3F9F pink ·
//     #4FC3FF cyan · #FF9033 orange gradient start) into theme-
//     sensitive positions.
//   · Avatar presence border is UNIVERSAL GREEN (#22C55E) · never
//     theme-tinted · matches the live chat's semantic for the online
//     presence dot.
//   · When a theme row carries a resolved `palette` field, these
//     helpers paint byte-identical colours to the live chat. When
//     a theme row lacks a palette (legacy data path), these helpers
//     fall back to NEX defaults rather than crashing.

import { resolveControlsTreatment } from "./control-resolver";
import {
  resolveBubbleBackground as liveResolveBubbleBackground,
  resolveBubbleBorder as liveResolveBubbleBorder,
} from "./bubble-material-resolver";

/** Full palette shape · mirrors `Required<ColourSystem>` from the
 *  theme-package types but is intentionally duplicated here so the
 *  preview layer has NO runtime dependency on the engine's type
 *  surface. Keeping these in lockstep is a sealed test invariant. */
export interface MiniPhonePalette {
  /** Theme accent · drives mine-bubble tint + send button + avatar
   *  gradient + border glow. */
  primary: string;
  /** Theme secondary · bubble/composer rim secondary accent. */
  secondary: string;
  /** Theme highlight · bubble text + composer input text. */
  highlight: string;
  /** Theme glow · ambient halo for the frame. */
  glow: string;
  /** Theme deep · chat stage anchor + peer bubble fill. */
  deep: string;
}

/** NEX default palette · used only when a legacy data path hands us a
 *  theme row with no `palette` field. The live engine's own default
 *  is identical (see `_engine/theme-engine.tsx:43-49`) so the fallback
 *  is a direct mirror. */
export const NEX_DEFAULT_PALETTE: MiniPhonePalette = {
  primary: "#00AFFF",
  secondary: "#4FC3DC",
  highlight: "#F4F7FC",
  glow: "rgba(0,175,255,0.35)",
  deep: "#020914",
};

/** Universal avatar presence border · green on every theme. Matches
 *  the live Standard Experience's online-presence semantic (the dot
 *  is green on every theme regardless of palette). Mini-phones follow
 *  the same rule rather than inventing a theme-tinted or static pink. */
export const AVATAR_PRESENCE_BORDER = "#22C55E";

/** Infer a complete `MiniPhonePalette` from a partial BrowserThemeRow
 *  shape. Live-world themes already supply a full palette via the
 *  adapter · DB themes supply only `accent_hex` + optional
 *  `bubble_rim_hex` / `composer_rim_hex`. For DB rows we promote
 *  `accent_hex` to primary, use bubble_rim_hex (or accent) for
 *  secondary, and inherit the NEX defaults for `highlight` + `deep`
 *  because those two tokens anchor the universal chrome (off-white
 *  text, navy stage) rather than a theme-specific identity signal. */
export function inferPaletteFromRow(input: {
  accent_hex: string;
  bubble_rim_hex: string | null | undefined;
  composer_rim_hex: string | null | undefined;
  deep_hex?: string | null | undefined;
  highlight_hex?: string | null | undefined;
  glow_hex?: string | null | undefined;
  secondary_hex?: string | null | undefined;
}): MiniPhonePalette {
  const primary = input.accent_hex || NEX_DEFAULT_PALETTE.primary;
  const secondary =
    input.secondary_hex ||
    input.bubble_rim_hex ||
    input.composer_rim_hex ||
    primary;
  return {
    primary,
    secondary,
    highlight: input.highlight_hex || NEX_DEFAULT_PALETTE.highlight,
    glow: input.glow_hex || `${primary}55`,
    deep: input.deep_hex || NEX_DEFAULT_PALETTE.deep,
  };
}

/** Convert a hex colour (#RGB · #RRGGBB · #RRGGBBAA) to an rgba() string.
 *  Mirrors the engine's own `hexToRgba` (see
 *  `_engine/theme-engine.tsx:61-77`) so previews paint byte-identical
 *  colours to the live engine. */
export function hexToRgba(colour: string, alpha: number): string {
  const trimmed = (colour ?? "").trim();
  // Already an rgba()/rgb() string · trust the caller and swap in the
  // requested alpha without rewriting the RGB channel.
  const rgbaMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(",").map((s) => s.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  }
  const clean = trimmed.replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean.split("").map((x) => x + x).join("")
      : clean.length === 6 || clean.length === 8
        ? clean.slice(0, 6)
        : "00afff";
  const n = parseInt(full, 16);
  if (!Number.isFinite(n)) return `rgba(0,175,255,${alpha})`;
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Chat stage ─────────────────────────────────────────────────────

/** Chat stage background · wallpaper when provided, otherwise the
 *  live engine's layered deep-gradient fallback (see
 *  `_standard-experience.tsx:154-163`). */
export function miniPhoneStageBackground(
  palette: MiniPhonePalette,
  wallpaperUrl: string | null | undefined,
): string {
  if (wallpaperUrl) {
    // Image behind, deep underlay so a transient load failure doesn't
    // flash to white.
    return `url("${encodeURI(wallpaperUrl)}") center/cover, ${palette.deep}`;
  }
  return `linear-gradient(180deg, #000 0%, ${palette.deep} 18%, ${palette.deep} 82%, #000 100%)`;
}

// ─── Chat bubbles · material-aware · delegates to the LIVE engine ──
//
// Sealed Final Parity Pass 2026-10-11 · the mini-phone must paint
// each theme's bubbles with ITS OWN material, not a hardcoded glass
// formula. nex-flat uses `solid`, midnight-cafe uses `neon-glass`,
// coffee uses `warm-liquid`, etc. We dispatch to the live engine's
// `resolveBubbleBackground(material, colours, mine)` so every
// material branch (glass · solid · gradient · parchment · frosting ·
// water · driftwood · ceramic · warm-liquid · neon-glass · glow)
// paints byte-identical to the live chat.
//
// The default material when `material` is omitted stays "glass",
// mirroring the live resolver's `default` branch.

/** Bubble background · delegates to the live engine's
 *  `resolveBubbleBackground`. When a theme's bubble material is
 *  unknown or absent the engine's default (glass) applies. */
export function miniPhoneBubbleBackground(
  palette: MiniPhonePalette,
  mine: boolean,
  material?: string | null,
): string {
  return liveResolveBubbleBackground(material ?? "glass", palette, mine);
}

/** Bubble border · delegates to the live engine's `resolveBubbleBorder`
 *  so the mini-phone paints the border the live chat would.
 *  For `glass` the live engine returns no explicit border, so we
 *  mirror the engine's default (no border) rather than inventing one. */
export function miniPhoneBubbleBorder(
  palette: MiniPhonePalette,
  mine: boolean,
  material?: string | null,
): string {
  const resolved = liveResolveBubbleBorder(material ?? "glass", palette, mine);
  // The engine returns `""` for materials with no explicit border
  // (glass, solid, etc.) · in that case the mini-phone falls back to
  // a thin highlight hairline so bubbles stay legible on dark
  // wallpapers at tile scale. Non-empty returns are the engine's own
  // border string · byte-identical to the live chat.
  if (!resolved) return `1px solid ${hexToRgba(palette.highlight, mine ? 0.18 : 0.12)}`;
  return resolved;
}

/** Bubble text colour · universal `highlight` on every theme because
 *  mine/peer glass bubbles both sit over the dark stage. */
export function miniPhoneBubbleTextColor(palette: MiniPhonePalette): string {
  return palette.highlight;
}

// ─── Composer (bottom-of-screen pill) ───────────────────────────────
//
// Delegates to the LIVE engine's `resolveControlsTreatment()`. Any
// change to the live composer rule propagates to every mini-phone
// via one import, with zero duplication.

/** Composer background · identical to `controls.composerContainer.background` */
export function miniPhoneComposerBackground(
  palette: MiniPhonePalette,
): string {
  const bg = resolveControlsTreatment(palette).composerContainer.background;
  return typeof bg === "string" ? bg : palette.deep;
}

/** Composer border · identical to `controls.composerContainer.border` */
export function miniPhoneComposerBorder(palette: MiniPhonePalette): string {
  const border = resolveControlsTreatment(palette).composerContainer.border;
  return typeof border === "string" ? border : `1px solid ${palette.primary}`;
}

/** Composer input placeholder colour · dim highlight so the field reads
 *  as empty but discoverable. The live engine does not expose a
 *  placeholder-specific treatment · this helper mirrors the pattern
 *  used by `StandardComposer` (highlight at ~55% alpha). */
export function miniPhoneComposerPlaceholderColor(
  palette: MiniPhonePalette,
): string {
  return hexToRgba(palette.highlight, 0.55);
}

// ─── Send button + plus button ──────────────────────────────────────
//
// Delegates to the LIVE engine's `resolveControlsTreatment()` so a
// change to the live send treatment propagates to every mini-phone.

/** Send button background · identical to `controls.sendButton(false).background`
 *  = solid theme primary on every theme (sealed 2026-10-06 universal
 *  Theme Controls Rule). */
export function miniPhoneSendBackground(palette: MiniPhonePalette): string {
  const bg = resolveControlsTreatment(palette).sendButton(false).background;
  return typeof bg === "string" ? bg : palette.primary;
}

/** Send button icon colour · identical to
 *  `controls.sendButton(false).color` · auto-contrast via
 *  `iconColorOn()` so a light primary gets dark icons. */
export function miniPhoneSendIconColor(palette: MiniPhonePalette): string {
  const color = resolveControlsTreatment(palette).sendButton(false).color;
  return typeof color === "string" ? color : palette.deep;
}

/** Send button border · identical to `controls.sendButton(false).border`. */
export function miniPhoneSendBorder(palette: MiniPhonePalette): string {
  const border = resolveControlsTreatment(palette).sendButton(false).border;
  return typeof border === "string" ? border : `1px solid ${palette.primary}`;
}

// ─── Header right-cluster (Home · Shop · Cart) ──────────────────────
//
// Final parity pass 2026-10-11 · the earlier version painted each of
// the three buttons in a different theme-slot colour (primary /
// secondary / highlight gradients). The LIVE chat (see
// `_standard-experience.tsx:584-611`) paints all three buttons with
// the SAME `controls.headerButton` style — identical bg + border +
// icon colour, only the glyph differs. Mini-phones now mirror that
// exactly by consuming `controls.headerButton` for all three slots.

export interface MiniPhoneHeaderButton {
  key: "home" | "shop" | "cart";
  glyph: string;
  bg: string;
  border: string;
  color: string;
  shadow: string;
  hasBadge?: boolean;
}

export function miniPhoneHeaderCluster(
  palette: MiniPhonePalette,
): readonly MiniPhoneHeaderButton[] {
  const controls = resolveControlsTreatment(palette);
  const base = controls.headerButton;
  const bg = typeof base.background === "string" ? base.background : palette.deep;
  const border =
    typeof base.border === "string" ? base.border : `1px solid ${palette.primary}`;
  const color = typeof base.color === "string" ? base.color : palette.highlight;
  const shadow = `0 2px 4px ${hexToRgba(palette.primary, 0.4)}`;
  return [
    { key: "home", glyph: "⌂", bg, border, color, shadow },
    { key: "shop", glyph: "🛍", bg, border, color, shadow },
    {
      key: "cart",
      glyph: "🛒",
      bg,
      border,
      color,
      shadow,
      // Cart carries a universal notification dot · the live chat's
      // CartIcon renders a tiny inner notification mark on every theme.
      hasBadge: true,
    },
  ];
}

// ─── Avatar (header leading element) ────────────────────────────────

/** Avatar background gradient · theme accent → secondary · the live
 *  Portrait Bloom paints the viewer's photo but for a mini-phone we
 *  show an initial on a theme-tinted gradient. */
export function miniPhoneAvatarBackground(palette: MiniPhonePalette): string {
  return `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`;
}

/** Avatar border · UNIVERSAL GREEN presence indicator · mirrors the
 *  live chat's "online dot" semantic which is green on every theme.
 *  Never theme-tinted · never NEX pink. */
export function miniPhoneAvatarBorder(): string {
  return `1.5px solid ${AVATAR_PRESENCE_BORDER}`;
}

/** Avatar glow · soft presence-green halo. */
export function miniPhoneAvatarGlow(): string {
  return `0 0 6px ${hexToRgba(AVATAR_PRESENCE_BORDER, 0.55)}`;
}

// ─── Frame rim (outer phone silhouette) ─────────────────────────────

/** Phone silhouette rim · softened accent so the frame reads as a
 *  theme-tinted edge rather than a sold frame colour. */
export function miniPhoneFrameRim(
  palette: MiniPhonePalette,
  options?: { active?: boolean },
): string {
  const alpha = options?.active ? 1 : 0.55;
  return hexToRgba(palette.primary, alpha);
}

/** Phone silhouette shadow · dark + accent-tinted glow. */
export function miniPhoneFrameShadow(palette: MiniPhonePalette): string {
  return `0 10px 30px -16px rgba(0,0,0,0.6), 0 0 20px -12px ${palette.primary}`;
}

// ─── Ambient family map · live-chat parity preserving performance ───
//
// Every live theme declares an `ambient.families` array consumed by
// `StandardAmbientLayer` in the full-size chat. The live renderer
// paints real animated particles / streaks / glows. For a mini-phone
// we drop the full renderer (too heavy for a 160×320 tile) but we
// preserve each family's VISUAL IDENTITY via a lightweight static
// representation keyed off the SAME family name the live chat uses.
//
// Static-first by design (user directive 2026-10-11 · "do not
// introduce expensive animation into every grid tile"). Each
// `MiniPhoneAmbientSpec` is just a shape · consumers render SVG /
// CSS circles / linear gradients from the spec with no runtime cost
// beyond initial paint.

/** Every ambient family the live engine supports (mirrors the discriminated
 *  union in `_surfaces/_ambient-layer.tsx`). Keeping it as a readonly
 *  string list means the preview module stays zero-dependency from the
 *  AmbientTreatment type. The regression test enforces that every live
 *  family present in a shipped ThemePackage has a mini-phone
 *  representation here. */
export type MiniPhoneAmbientFamilyKind =
  | "bubbles-rising"
  | "light-rays"
  | "sparks"
  | "sparkles"
  | "stars"
  | "mist"
  | "leaves-falling"
  | "heat-shimmer"
  | "particles-up"
  | "surface-caustics"
  | "steam-rising"
  | "warm-glow-pulse"
  | "sun-dapple"
  | "pollen-float"
  | "neon-flicker"
  | "rain-streak";

/** A static ambient dot/streak/glow descriptor. Consumers render
 *  these as absolute-positioned <span> elements over the chat stage.
 *  All positions are percentages so the spec is resolution-agnostic. */
export interface MiniPhoneAmbientElement {
  kind: "dot" | "streak" | "glow" | "band";
  /** CSS left % (dot/streak/glow) · ignored for band. */
  left?: string;
  /** CSS top % (dot/streak/glow) · ignored for band. */
  top?: string;
  /** Element size in px at the native 160–220 px tile width. */
  size: number;
  /** Fill colour · consumers do not need to re-tint. */
  color: string;
  /** 0-1 opacity. */
  opacity: number;
  /** Optional glow shadow. */
  shadow?: string;
  /** Streaks + bands only · rotation in degrees. */
  rotateDeg?: number;
  /** Streaks only · length in px. */
  length?: number;
}

/** One mini-phone representation of a single ambient family. The
 *  `kindLabel` is a stable string every regression test can assert
 *  against ("this theme carries a `bubbles-rising` representation"). */
export interface MiniPhoneAmbientSpec {
  family: MiniPhoneAmbientFamilyKind;
  elements: readonly MiniPhoneAmbientElement[];
}

/** Resolve a theme's ambient family list into mini-phone render specs.
 *  Unknown family kinds are silently skipped (defence in depth · a
 *  future family type added to a ThemePackage won't crash the Library).
 *  `density` controls the element count:
 *    sparse  → 3 elements per family
 *    medium  → 5 elements per family
 *    dense   → 7 elements per family */
export function miniPhoneAmbient(
  palette: MiniPhonePalette,
  families: readonly string[] | null | undefined,
  density: "sparse" | "medium" | "dense" = "sparse",
): readonly MiniPhoneAmbientSpec[] {
  if (!families || families.length === 0) return [];
  const count = density === "dense" ? 7 : density === "medium" ? 5 : 3;
  const out: MiniPhoneAmbientSpec[] = [];
  for (const raw of families) {
    const family = raw as MiniPhoneAmbientFamilyKind;
    const spec = resolveAmbientFamily(palette, family, count);
    if (spec) out.push(spec);
  }
  return out;
}

function resolveAmbientFamily(
  palette: MiniPhonePalette,
  family: MiniPhoneAmbientFamilyKind,
  count: number,
): MiniPhoneAmbientSpec | null {
  // Each family's static representation preserves ITS OWN visual
  // identity (shape + colour + rough position) so a visitor glancing
  // at a mini-phone recognises what the live theme will add on top of
  // its base palette. Numbers are tuned for 160–220 px tile width.
  switch (family) {
    case "bubbles-rising":
    case "particles-up":
    case "sparks":
    case "steam-rising":
      return {
        family,
        elements: risingParticles(palette, count, family === "sparks" ? palette.primary : palette.primary),
      };
    case "sparkles":
    case "stars":
      return { family, elements: sparkleField(palette, count) };
    case "light-rays":
    case "sun-dapple":
      return { family, elements: lightRays(palette, Math.max(2, Math.floor(count / 2))) };
    case "mist":
    case "surface-caustics":
      return { family, elements: mistBand(palette) };
    case "heat-shimmer":
    case "warm-glow-pulse":
      return { family, elements: warmGlow(palette) };
    case "leaves-falling":
    case "pollen-float":
      return { family, elements: driftingSpecks(palette, count) };
    case "neon-flicker":
      return {
        family,
        elements: [
          {
            kind: "glow",
            left: "50%",
            top: "40%",
            size: 24,
            color: palette.primary,
            opacity: 0.5,
            shadow: `0 0 18px ${hexToRgba(palette.primary, 0.65)}`,
          },
        ],
      };
    case "rain-streak":
      return { family, elements: rainStreaks(palette, count) };
    default:
      return null;
  }
}

// ─── Family element builders · pure functions · deterministic ──────

function risingParticles(
  palette: MiniPhonePalette,
  count: number,
  tint: string,
): MiniPhoneAmbientElement[] {
  // Fixed positions (not randomised) so the mini-phone renders
  // consistently across reloads · live chat randomises but the
  // mini-phone's purpose is identity recognition, not individuality.
  const slots = [
    { left: "22%", top: "72%", size: 6 },
    { left: "60%", top: "62%", size: 8 },
    { left: "40%", top: "48%", size: 5 },
    { left: "70%", top: "36%", size: 7 },
    { left: "28%", top: "26%", size: 4 },
    { left: "55%", top: "16%", size: 5 },
    { left: "80%", top: "20%", size: 4 },
  ];
  return slots.slice(0, count).map((s) => ({
    kind: "dot" as const,
    left: s.left,
    top: s.top,
    size: s.size,
    color: tint,
    opacity: 0.55,
    shadow: `0 0 ${s.size * 2}px ${hexToRgba(tint, 0.4)}`,
  }));
}

function sparkleField(
  palette: MiniPhonePalette,
  count: number,
): MiniPhoneAmbientElement[] {
  const slots = [
    { left: "15%", top: "22%", size: 2 },
    { left: "72%", top: "28%", size: 3 },
    { left: "48%", top: "16%", size: 2 },
    { left: "28%", top: "50%", size: 2 },
    { left: "66%", top: "58%", size: 3 },
    { left: "82%", top: "44%", size: 2 },
    { left: "20%", top: "66%", size: 2 },
  ];
  return slots.slice(0, count).map((s) => ({
    kind: "dot" as const,
    left: s.left,
    top: s.top,
    size: s.size,
    color: palette.highlight,
    opacity: 0.85,
    shadow: `0 0 ${s.size * 2}px ${hexToRgba(palette.highlight, 0.7)}`,
  }));
}

function lightRays(
  palette: MiniPhonePalette,
  count: number,
): MiniPhoneAmbientElement[] {
  const slots = [
    { left: "30%", top: "10%", length: 60, rotateDeg: 25 },
    { left: "65%", top: "15%", length: 48, rotateDeg: 25 },
    { left: "50%", top: "20%", length: 54, rotateDeg: 25 },
  ];
  return slots.slice(0, count).map((s) => ({
    kind: "streak" as const,
    left: s.left,
    top: s.top,
    size: 2,
    length: s.length,
    rotateDeg: s.rotateDeg,
    color: palette.highlight,
    opacity: 0.3,
  }));
}

function mistBand(palette: MiniPhonePalette): MiniPhoneAmbientElement[] {
  return [
    {
      kind: "band",
      size: 20,
      top: "60%",
      color: hexToRgba(palette.highlight, 0.14),
      opacity: 1,
    },
  ];
}

function warmGlow(palette: MiniPhonePalette): MiniPhoneAmbientElement[] {
  return [
    {
      kind: "glow",
      left: "50%",
      top: "45%",
      size: 48,
      color: palette.primary,
      opacity: 0.42,
      shadow: `0 0 36px ${hexToRgba(palette.primary, 0.55)}`,
    },
  ];
}

function driftingSpecks(
  palette: MiniPhonePalette,
  count: number,
): MiniPhoneAmbientElement[] {
  const slots = [
    { left: "35%", top: "32%", size: 2 },
    { left: "68%", top: "22%", size: 3 },
    { left: "22%", top: "44%", size: 2 },
    { left: "58%", top: "40%", size: 2 },
    { left: "80%", top: "52%", size: 2 },
    { left: "40%", top: "58%", size: 2 },
    { left: "12%", top: "60%", size: 2 },
  ];
  return slots.slice(0, count).map((s) => ({
    kind: "dot" as const,
    left: s.left,
    top: s.top,
    size: s.size,
    color: palette.secondary,
    opacity: 0.6,
    shadow: `0 0 ${s.size * 1.5}px ${hexToRgba(palette.secondary, 0.5)}`,
  }));
}

function rainStreaks(
  palette: MiniPhonePalette,
  count: number,
): MiniPhoneAmbientElement[] {
  const slots = [
    { left: "22%", top: "20%", length: 32, rotateDeg: 10 },
    { left: "48%", top: "15%", length: 40, rotateDeg: 10 },
    { left: "68%", top: "25%", length: 28, rotateDeg: 10 },
    { left: "35%", top: "40%", length: 36, rotateDeg: 10 },
    { left: "75%", top: "55%", length: 32, rotateDeg: 10 },
  ];
  return slots.slice(0, count).map((s) => ({
    kind: "streak" as const,
    left: s.left,
    top: s.top,
    size: 1.5,
    length: s.length,
    rotateDeg: s.rotateDeg,
    color: palette.highlight,
    opacity: 0.4,
  }));
}
