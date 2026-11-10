// src/app/nex-native/free-chat/_types.ts
//
// NEX · Free Chat · shared types for the standalone surface.
// Owner-authorised 2026-10-21 (iteration 53).
//
// `OutgoingDeliveryStatus` was previously inlined in page.tsx. Moved
// to this shared module so the client canvas and the server page both
// reference the same union without a cyclic import.

/** Owner directive 2026-10-21 (iteration 37) · outgoing bubble
 *  delivery indicator REPLACED tick checkmarks with a single
 *  colour-coded DOT:
 *    delivered · orange dot · reached recipient's device, not read yet
 *    read      · green dot  · recipient opened the chat
 *  Peer bubbles never render a dot (dots only confirm YOUR sends). */
export type OutgoingDeliveryStatus = "delivered" | "read";

// ─── Free-chat first-visit theme catalog (shared) ────────────────
//
// Owner directive 2026-10-21 (iteration 54) · THEMES moved out of the
// client canvas so the server page can resolve the initial wallpaper
// URL from the cookie-stored themeId and paint it on the <main>
// background BEFORE hydration · prevents the flash-of-navy on return
// visitors who had already picked a wallpaper.
export interface FreeChatTheme {
  readonly id: string;
  readonly label: string;
  readonly wallpaperUrl: string | null;
  readonly placeholderLabel: string | null;
  /** Owner directive 2026-10-21 (iteration 59) · the first tile is the
   *  NEX default · plain navy page with no wallpaper · marked with
   *  this flag so the tile renders a NEX-branded navy preview + "NEX"
   *  label instead of the generic numbered placeholder. */
  readonly isDefault?: boolean;
  /** Owner directive 2026-10-21 · per-theme bubble accent · both peer
   *  and self chat bubbles tint to this colour when the theme is
   *  applied · bubble shape, radius and glass design are unchanged.
   *  Hex `#RRGGBB` · the free-chat canvas synthesises fill + rim
   *  alpha layers from this one value. */
  readonly accentHex: string;
  /** Owner-authorised 2026-11-02 · country-scoped tile. When unset the
   *  theme is a Worldwide default (shown on Worldwide + Indonesia).
   *  When set to a NEX_APP_IDENTITY value, the theme is only offered
   *  in the picker for that identity. The isDefault tile is shown on
   *  every identity regardless of this field. */
  readonly identity?: "worldwide" | "ireland" | "indonesia";
  /** Owner-authorised 2026-11-03 · spotlight tile · pulled from the
   *  paid library as part of the daily "free preview" rotation. When
   *  true the renderer shows a small "€3.99 · preview" badge so the
   *  user sees it's a sampler from the paid catalog, not a permanent
   *  free theme. Picking a spotlight still applies the wallpaper
   *  immediately · payment is only taken via the Theme Library. */
  readonly isSpotlight?: boolean;
}

export const FREE_CHAT_THEMES: readonly FreeChatTheme[] = [
  // Universal default · shown on every identity.
  { id: "nex-default", label: "NEX", wallpaperUrl: null, placeholderLabel: null, isDefault: true, accentHex: "#00AFFF" },

  // ── Worldwide / Indonesia tiles · owner-sealed 2026-10-23 ────────
  // Owner directive 2026-10-23 · swap accentHex between the top-row
  // 2nd (theme-1) and 3rd (theme-2) tiles. Wallpaper assignments
  // stay the same · only the UI chrome tint moves left → right.
  { id: "theme-1", label: "Theme 1", wallpaperUrl: "/nex-themes/free-chat-theme-1.png", placeholderLabel: null, accentHex: "#FF4FD7", identity: "worldwide" },
  { id: "theme-2", label: "Theme 2", wallpaperUrl: "/nex-themes/free-chat-theme-2.png", placeholderLabel: null, accentHex: "#D4A24C", identity: "worldwide" },
  { id: "theme-3", label: "Theme 3", wallpaperUrl: "/nex-themes/free-chat-theme-3.png", placeholderLabel: null, accentHex: "#16D66B", identity: "worldwide" },
  { id: "theme-5", label: "Theme 5", wallpaperUrl: "/nex-themes/free-chat-theme-5.png", placeholderLabel: null, accentHex: "#FF7200", identity: "worldwide" },

  // ── Ireland tiles · owner-authorised 2026-11-02 ──────────────────
  // 4 Irish wallpapers chosen by the owner (ire3 · ire2 · ireland-7 ·
  // ireland-8). Accent hex uses the sealed Ireland Gold (#C6A15B) ·
  // the sealed premium Irish accent · matches the Visit Shop badge,
  // the drawer edge-light, and the Live Side Drawer gold detail.
  { id: "ireland-1", label: "Ireland 1", wallpaperUrl: "/nex-themes/ireland/ire3.png",       placeholderLabel: null, accentHex: "#C6A15B", identity: "ireland" },
  { id: "ireland-2", label: "Ireland 2", wallpaperUrl: "/nex-themes/ireland/ire2.png",       placeholderLabel: null, accentHex: "#C6A15B", identity: "ireland" },
  { id: "ireland-3", label: "Ireland 3", wallpaperUrl: "/nex-themes/ireland/ireland-7.png",  placeholderLabel: null, accentHex: "#C6A15B", identity: "ireland" },
  // Owner directive 2026-11-02 (revision 7) · the container-colour
  // concept was retired · ireland-4 reverts to a standard wallpaper
  // tile (ireland-8.png · the 5th Ireland asset the owner shipped).
  { id: "ireland-4", label: "Ireland 4", wallpaperUrl: "/nex-themes/ireland/ireland-8.png", placeholderLabel: null, accentHex: "#C6A15B", identity: "ireland" },
  { id: "ireland-5", label: "Ireland 5", wallpaperUrl: "/nex-themes/ireland/ireland-5.png",  placeholderLabel: null, accentHex: "#C6A15B", identity: "ireland" },
];

/** Owner-authorised 2026-11-02 · identity-scoped theme list for the
 *  picker. The isDefault tile is included on every identity. Country-
 *  scoped themes are returned ONLY on their matching identity. Themes
 *  with no identity field are treated as Worldwide. */
export function getFreeChatThemesForIdentity(
  identity: string | undefined,
): readonly FreeChatTheme[] {
  const normalized = (identity ?? "").trim().toLowerCase();
  const target =
    normalized === "ireland" || normalized === "indonesia"
      ? normalized
      : "worldwide";
  return FREE_CHAT_THEMES.filter(
    (t) =>
      t.isDefault ||
      t.identity === target ||
      (!t.identity && target === "worldwide"),
  );
}

/** Owner-authorised 2026-11-03 · the free-chat picker surfaces 5 tiles:
 *  2 "pinned always-free" tiles + 3 spotlight tiles that rotate daily
 *  from the paid Theme Library. Spotlight picks are deterministic
 *  (seeded by UTC date) so SSR + hydration never mismatch, AND so
 *  every visitor on the same day sees the same featured set.
 *
 *  If the user's current pick is a library theme not in today's
 *  rotation, we replace the LAST spotlight slot with their current
 *  pick so the picker always shows "their" theme as selected. This
 *  keeps the "my chosen theme" state coherent across rotations.
 *
 *  Worldwide / Indonesia keep the pre-sealed static picker for now
 *  (no rotation) · Ireland is the only identity with the library
 *  catalog populated. When Worldwide/Indonesia library drops ship,
 *  extend LIBRARY_SPOTLIGHT_POOL to pick per-identity. */
import { LIBRARY_THEMES } from "../chat-themes-library/_catalog";

// Owner directive 2026-11-03 · 6-tile picker · 1 pinned plain tile
// (nex-default, ALWAYS first) + 5 daily-rotating spotlights from the
// paid Theme Library. Spotlights show a €3.99 price with a red
// strike line · reads as "this is your free first-pick · the
// normal price doesn't apply yet". After the user picks + creates
// account + hits Live, subsequent library buys are at full price
// (strike line disappears · enforced at the Theme Library page).
const PINNED_TILES_BY_IDENTITY: Record<string, readonly string[]> = {
  ireland: ["nex-default"],
  worldwide: [],
  indonesia: [],
};

const SPOTLIGHT_SLOTS = 5;

/** FNV-1a 32-bit hash · deterministic + fast · just enough variance
 *  for a date → index-sequence seed. */
function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h = (h ^ input.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Pick N themes from the pool deterministically for `dateKey`. */
function pickSpotlightForDate(
  pool: readonly { readonly id: string; readonly label: string; readonly wallpaperUrl: string; readonly accentHex: string }[],
  dateKey: string,
  count: number,
): readonly { readonly id: string; readonly label: string; readonly wallpaperUrl: string; readonly accentHex: string }[] {
  if (pool.length === 0) return [];
  const take = Math.min(count, pool.length);
  const seen = new Set<number>();
  const picked: typeof pool extends readonly (infer U)[] ? U[] : never = [];
  let salt = 0;
  while (picked.length < take && seen.size < pool.length) {
    const h = hashString(`${dateKey}:${salt}`);
    const idx = h % pool.length;
    if (!seen.has(idx)) {
      seen.add(idx);
      picked.push(pool[idx]);
    }
    salt++;
    if (salt > pool.length * 4) break; // safety
  }
  return picked;
}

export function getDailyFreeChatPicker(
  identity: string | undefined,
  currentThemeId: string | null | undefined,
  nowIso?: string,
): readonly FreeChatTheme[] {
  const normalized = (identity ?? "").trim().toLowerCase();
  const target =
    normalized === "ireland" || normalized === "indonesia"
      ? normalized
      : "worldwide";

  // Non-Ireland identities keep the sealed static picker for now ·
  // library catalog is Ireland-only today.
  if (target !== "ireland") {
    return getFreeChatThemesForIdentity(identity);
  }

  const pinnedIds = PINNED_TILES_BY_IDENTITY[target] ?? [];
  const pinned = pinnedIds
    .map((id) => FREE_CHAT_THEMES.find((t) => t.id === id))
    .filter((t): t is FreeChatTheme => t !== undefined);

  const dateKey = (nowIso ?? new Date().toISOString()).slice(0, 10);
  const spotlights = pickSpotlightForDate(
    LIBRARY_THEMES.filter((t) => t.wallpaperUrl.length > 0),
    dateKey,
    SPOTLIGHT_SLOTS,
  ).map<FreeChatTheme>((t) => ({
    id: t.id,
    label: t.label,
    wallpaperUrl: t.wallpaperUrl,
    placeholderLabel: null,
    accentHex: t.accentHex,
    identity: "ireland",
    isSpotlight: true,
  }));

  // Coherence · if the user's current pick is a library theme not in
  // today's rotation AND not pinned, swap it into the LAST spotlight
  // slot so the picker reflects their active choice.
  let finalSpotlights = spotlights;
  if (
    currentThemeId &&
    currentThemeId.startsWith("library-") &&
    !spotlights.some((s) => s.id === currentThemeId) &&
    !pinnedIds.includes(currentThemeId)
  ) {
    const currentLibrary = LIBRARY_THEMES.find((t) => t.id === currentThemeId);
    if (currentLibrary) {
      finalSpotlights = [
        ...spotlights.slice(0, SPOTLIGHT_SLOTS - 1),
        {
          id: currentLibrary.id,
          label: currentLibrary.label,
          wallpaperUrl: currentLibrary.wallpaperUrl,
          placeholderLabel: null,
          accentHex: currentLibrary.accentHex,
          identity: "ireland",
          isSpotlight: true,
        },
      ];
    }
  }

  return [...pinned, ...finalSpotlights];
}

/** Resolve a theme id to its accent hex · defaults to NEX cyan when
 *  the id is null or unknown. Spotlight tiles live in LIBRARY_THEMES ·
 *  checked as a fallback so a picked spotlight paints correctly. */
export function resolveFreeChatAccentHex(themeId: string | null | undefined): string {
  if (!themeId) return "#00AFFF";
  const match = FREE_CHAT_THEMES.find((t) => t.id === themeId);
  if (match) return match.accentHex;
  const library = LIBRARY_THEMES.find((t) => t.id === themeId);
  return library?.accentHex ?? "#00AFFF";
}

/** Convert a `#RRGGBB` hex to an rgba() string with the given alpha
 *  (0..1). Used by the bubble renderer to synthesise glass fill +
 *  rim tints from a single accent. */
export function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "").trim();
  const safe = h.length === 6 ? h : "00AFFF";
  const r = parseInt(safe.slice(0, 2), 16);
  const g = parseInt(safe.slice(2, 4), 16);
  const b = parseInt(safe.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Resolve a theme id (from cookie) to its wallpaper URL. Returns null
 *  when no theme is selected OR the theme is a placeholder slot.
 *  Spotlight tiles live in LIBRARY_THEMES · checked as a fallback so
 *  a user-picked spotlight paints its wallpaper across the live chat. */
export function resolveFreeChatWallpaperUrl(
  themeId: string | null | undefined,
): string | null {
  if (!themeId) return null;
  const match = FREE_CHAT_THEMES.find((t) => t.id === themeId);
  if (match) return match.wallpaperUrl;
  const library = LIBRARY_THEMES.find((t) => t.id === themeId);
  return library?.wallpaperUrl ?? null;
}

// ─── Bubble customization · owner-authorised 2026-11-02 ────────────
//
// The owner-of-chat customises both the peer AND self bubble colours
// (hue + opacity). Settings are keyed by themeId · a given theme can
// have different customisations for different owners.
//
// Model (sealed · same-day confirmation): "the owner buys the theme has
// controls for both chat bubbles. The other user sees the theme also."
// This maps to a shared chat appearance where the owner's choices apply
// for both viewers.
//
// Today's /free-chat is a single-viewer preview surface · guest cookies
// persist the choices locally. When real two-way chat ships, the same
// payload will be stored on nex_chat_theme (per owner/conversation) and
// served to both participants. Serialisation format is forward-
// compatible: a plain JSON blob with four keys.

export interface BubbleCustomization {
  readonly peerColor: string;    // hex `#RRGGBB`
  /** Owner-authorised 2026-11-02 (revision 2) · darken-only slider.
   *  0 = chosen colour renders at sealed alpha unchanged
   *  1 = chosen colour fully blended with black (near-black)
   *  Values between fade the bubble DARKER · never lighter. The
   *  sealed per-bubble alphas (0.12 fill / 0.42 rim · 0.16 / 0.72)
   *  stay constant · only the base RGB blends toward black. */
  readonly peerDarken: number;   // 0..1 · 0 = original · 1 = near-black
  readonly selfColor: string;    // hex `#RRGGBB`
  readonly selfDarken: number;   // 0..1
  /** Owner-authorised 2026-11-02 (revision 3) · optional chat
   *  container background colour · ONLY honoured when the picked
   *  theme has no wallpaper (e.g. the Custom Color tile). Null
   *  means "use the theme's sealed background" · a hex value paints
   *  the whole chat container with that solid colour. */
  readonly containerColor?: string | null;
}

/** Clamp a number to [0, 1]. */
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 1;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Validate a hex colour string. Returns the normalised uppercase form
 *  or null when the input is not a well-formed `#RRGGBB`. */
export function parseHexColor(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

/** Narrow a candidate payload (from cookie JSON) to a valid
 *  `BubbleCustomization` or null. Fail-closed on any malformed field.
 *  Owner-authorised 2026-11-02 revision 2 · field names renamed from
 *  `peerOpacity` / `selfOpacity` to `peerDarken` / `selfDarken` to
 *  reflect darken-only semantics. Any cookie carrying the OLD field
 *  shape is treated as missing and the user falls back to theme
 *  defaults · no silent misinterpretation. */
export function parseBubbleCustomization(
  input: unknown,
): BubbleCustomization | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  const peerColor = parseHexColor(r.peerColor);
  const selfColor = parseHexColor(r.selfColor);
  if (!peerColor || !selfColor) return null;
  const peerDarken = typeof r.peerDarken === "number" ? clamp01(r.peerDarken) : NaN;
  const selfDarken = typeof r.selfDarken === "number" ? clamp01(r.selfDarken) : NaN;
  if (!Number.isFinite(peerDarken) || !Number.isFinite(selfDarken)) return null;
  // Container colour is OPTIONAL · null/absent is honest fallback to
  // the theme's own background. Non-hex values are rejected.
  const containerColor =
    "containerColor" in r ? parseHexColor(r.containerColor) : null;
  return {
    peerColor,
    peerDarken,
    selfColor,
    selfDarken,
    containerColor,
  };
}

/** Resolve the DEFAULT bubble customisation for a theme id · reads the
 *  theme's accentHex and applies it to BOTH bubbles with darken=0.
 *  Darken=0 means the user has not pulled the slider · bubble renders
 *  with the theme's chosen colour at the sealed alpha (0.12 fill /
 *  0.42 rim for peer · 0.16 / 0.72 for self). */
export function defaultBubbleCustomizationForTheme(
  themeId: string | null | undefined,
): BubbleCustomization {
  const accent = resolveFreeChatAccentHex(themeId);
  // Owner directive 2026-11-03 · "page back ground is not displaying
  // the nex green global color" · default container colour for the
  // nex-default tile is the sealed Ireland Emerald #123D2B so the
  // page matches the global --nex-world-drawer-bg instead of pure
  // black. Users can still pick any other hue · this is just the
  // first-paint default. Prior default (#000000) retired.
  // Every other theme defaults containerColor to null (ignored).
  const theme = themeId
    ? FREE_CHAT_THEMES.find((t) => t.id === themeId)
    : null;
  const supportsBackgroundPicker = theme?.isDefault === true;
  return {
    peerColor: accent,
    peerDarken: 0,
    selfColor: accent,
    selfDarken: 0,
    containerColor: supportsBackgroundPicker ? "#123D2B" : null,
  };
}

/** Blend a hex colour toward black at the given darken ratio.
 *  darken=0 → original hex · darken=1 → black. Returns a new hex
 *  so hexWithAlpha can wrap it. */
function darkenHex(hex: string, darken: number): string {
  const d = clamp01(darken);
  if (d === 0) return hex;
  const h = hex.replace("#", "").trim();
  const safe = h.length === 6 ? h : "00AFFF";
  const r = Math.round(parseInt(safe.slice(0, 2), 16) * (1 - d));
  const g = Math.round(parseInt(safe.slice(2, 4), 16) * (1 - d));
  const b = Math.round(parseInt(safe.slice(4, 6), 16) * (1 - d));
  const toHex = (n: number): string =>
    Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Compute the final RGBA strings the canvas renderer applies.
 *  Sealed alphas stay constant · the user's darken slider blends
 *  the base RGB toward black BEFORE applying the alpha. Darken-only
 *  means the slider can make a bubble DARKER but never lighter than
 *  the chosen colour at its sealed alpha. */
export function resolveBubbleFillAndRim(custom: BubbleCustomization): {
  readonly peerFill: string;
  readonly peerRim: string;
  readonly selfFill: string;
  readonly selfRim: string;
} {
  const peerBase = darkenHex(custom.peerColor, custom.peerDarken);
  const selfBase = darkenHex(custom.selfColor, custom.selfDarken);
  // Owner directive 2026-11-02 (revision 10) · the darken slider at max
  // must land on a solid colour. We ramp the sealed base alphas up to
  // 1.0 as the darken value climbs 0 → 1 (linear). At darken=0 the
  // bubble reads at its sealed translucent alpha (0.12 peer / 0.16
  // self) · at darken=1 the bubble is 100% opaque. Rim alpha ramps
  // the same way so the border stays coherent with the fill.
  const peerD = clamp01(custom.peerDarken);
  const selfD = clamp01(custom.selfDarken);
  const peerFillAlpha = 0.12 + (1 - 0.12) * peerD;
  const peerRimAlpha = 0.42 + (1 - 0.42) * peerD;
  const selfFillAlpha = 0.16 + (1 - 0.16) * selfD;
  const selfRimAlpha = 0.72 + (1 - 0.72) * selfD;
  return {
    peerFill: hexWithAlpha(peerBase, peerFillAlpha),
    peerRim: hexWithAlpha(peerBase, peerRimAlpha),
    selfFill: hexWithAlpha(selfBase, selfFillAlpha),
    selfRim: hexWithAlpha(selfBase, selfRimAlpha),
  };
}

/** WCAG-ish relative luminance for a hex colour. 0=black, 1=white.
 *  Used to pick dark vs light text ink on top of a bubble so the
 *  message stays readable at every colour/opacity. */
export function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return 0;
  const toLin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLin(parseInt(h.slice(0, 2), 16));
  const g = toLin(parseInt(h.slice(2, 4), 16));
  const b = toLin(parseInt(h.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Pick dark or light ink based on bubble colour + darken amount.
 *  Darken-only slider · the effective colour is `color` blended toward
 *  black by `darken`. If the effective luminance after darkening is
 *  still high (bright + low darken), use dark ink for legibility ·
 *  otherwise use light ink which reads on dark bubbles AND on the
 *  translucent-against-wallpaper case. */
export function pickInkForBubble(color: string, darken: number): string {
  const d = clamp01(darken);
  const baseLum = relativeLuminance(color);
  // Darkening reduces luminance linearly: L_effective ≈ L_base * (1 - d).
  const effective = baseLum * (1 - d);
  // Threshold ~0.55 covers Gold / Cream / White / pale yellows at
  // zero darken · once darkened past ~45% they fall below and we
  // flip to light ink.
  return effective > 0.55 ? "#1A1A1A" : "#F2F5F8";
}

/** Broad, attractive palette for the customise colour drawer.
 *  Owner-authorised 2026-11-02 · "broad palette including Ireland
 *  theme colours, additional colours and neutrals. Do not restrict
 *  users to seven colours." Grouped by hue family so the drawer
 *  reads as a thoughtful palette rather than a crayon box. */
export const BUBBLE_PALETTE: readonly {
  readonly hex: string;
  readonly label: string;
}[] = [
  // ── NEX brand ────────────────────────────
  { hex: "#00AFFF", label: "NEX Cyan" },
  { hex: "#FF7200", label: "NEX Orange" },
  // ── Ireland sealed ───────────────────────
  // Owner directive 2026-11-03 · "we need 1 color per button choice ·
  // remove duplicates" · Forest #1B5138 retired (near-duplicate of
  // Emerald #123D2B · same Irish deep-green family).
  { hex: "#123D2B", label: "Emerald" },
  { hex: "#C6A15B", label: "Gold" },
  { hex: "#AFC5B5", label: "Sage" },
  { hex: "#FAF8F4", label: "Cream" },
  // ── Indonesia sealed ─────────────────────
  { hex: "#C8102E", label: "Garuda Red" },
  { hex: "#E0A020", label: "Turmeric" },
  { hex: "#3B4C8C", label: "Batik Indigo" },
  // ── Warm hues ────────────────────────────
  { hex: "#D4A24C", label: "Honey" },
  { hex: "#FF4F70", label: "Coral" },
  { hex: "#F5A623", label: "Amber" },
  { hex: "#B23A48", label: "Cherry" },
  { hex: "#D9480F", label: "Burnt Orange" },
  // ── Cool hues ────────────────────────────
  { hex: "#1DA1F2", label: "Twilight Blue" },
  // Owner directive 2026-11-03 · "remove duplicates" · Lilac #A78BFA
  // retired (near-duplicate of Lavender #8B5CF6) · Fresh #4ADE80
  // retired (near-duplicate of Mint #16D66B).
  { hex: "#8B5CF6", label: "Lavender" },
  { hex: "#6D28D9", label: "Plum" },
  { hex: "#2EC4B6", label: "Teal" },
  { hex: "#16D66B", label: "Mint" },
  { hex: "#FF4FD7", label: "Magenta" },
  // ── Neutrals ─────────────────────────────
  { hex: "#FFFFFF", label: "White" },
  { hex: "#E5E7EB", label: "Light Grey" },
  { hex: "#9CA3AF", label: "Medium Grey" },
  { hex: "#4B5563", label: "Dark Grey" },
  { hex: "#1F2937", label: "Charcoal" },
  { hex: "#0A0A0A", label: "Near Black" },
] as const;

/** Full `background` CSS value for the free-chat <main> given a resolved
 *  wallpaperUrl. Used by both the server page (initial paint) and the
 *  client canvas (post-hydration state updates) so the layer stack
 *  stays byte-identical.
 *
 *  Owner-authorised 2026-11-02 · Ireland theme routing · the base-colour
 *  default now reads `--nex-world-drawer-bg` (sealed Emerald on Ireland;
 *  navy fallback for Worldwide / Indonesia). The wallpaper darkening
 *  gradient is kept at the sealed charcoal navy rgba so the wallpaper
 *  tint reads consistently regardless of world · the fade is a readability
 *  overlay, not a theme accent. */
export function freeChatBackgroundCss(
  wallpaperUrl: string | null,
  baseFallback: string = "var(--nex-world-drawer-bg, #020914)",
): string {
  if (!wallpaperUrl) return baseFallback;
  return `linear-gradient(rgba(2, 9, 20, 0.35), rgba(2, 9, 20, 0.55)), url("${wallpaperUrl}") center / cover no-repeat, ${baseFallback}`;
}
