// src/lib/nex-native/chat-theme-service.ts
//
// Bridge 4 · chat theme catalogue.
// --------------------------------
// Reads + writes for nex_chat_theme (migration 048). Peer chat surface
// and the /nex-native/chat-themes-library picker consume this via
// listActiveThemes() and getThemeById(); the admin builder at
// /nex-native/admin/theme/new
// consumes createTheme() / updateTheme().
//
// Doctrine · doctrine_theme_ownership_2026_09_27.md.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import { getBackgroundAsset } from "./library/catalog-service";
import { updateChatTheme } from "./account-service";
import type { NexUuid } from "./types";

export type NexChatThemeTier = "gratis" | "bisnis";
export type NexChatThemeCategory = "standard" | "premium";

export interface NexChatThemeRow {
  id: string;
  name: string;
  tagline: string | null;
  accent_hex: string;
  /** Optional override for message bubble rims (both sides) · when
   *  null, bubbles use accent_hex. Sealed 2026-09-27 · migration 051. */
  bubble_rim_hex: string | null;
  /** Optional override for composer input rim · when null, composer
   *  uses accent_hex. Send button stays universal orange regardless. */
  composer_rim_hex: string | null;
  tier: NexChatThemeTier;
  category: NexChatThemeCategory;
  hero_image_url: string | null;
  is_active: boolean;
  sort_order: number;
  /** Per-theme environmental overlay settings · e.g. moon glow
   *  position, size, colour. When null, the theme's chat surface
   *  paints no environmental overlay. Sealed 2026-09-27 · migration
   *  056. */
  wallpaper_config: NexChatThemeWallpaperConfig | null;
  /** Bridge 34 · feed shape · migration 085. Determines the message
   *  row renderer used by PortraitBloomShell:
   *    'bubbles'         · classic bubble feed (default)
   *    'sky_cards'       · cloud-shaped panels · sealed as Theme 1
   *    'timeline_ribbon' · tab-slate panels · sealed as Theme 4
   *  When the DB row predates migration 085 or the value is missing
   *  in code, callers should treat it as 'bubbles'. */
  layout_style: NexChatThemeLayoutStyle;
  /** Phase 4A · migration 135 · optional cinematic intro video asset
   *  served before the themed chat shell renders. NULL = no intro ·
   *  shell renders immediately with zero gate. Owner uploads via a
   *  future admin flow · all 41 catalogue themes land here as NULL
   *  by default so the feature stays dormant until seeded. */
  intro_video_url: string | null;
  /** Phase 4A · nominal video duration in milliseconds. Informational
   *  only · the client never WAITS past this value · it listens for
   *  the actual video `onended` event. The client enforces a 5000ms
   *  hard safety ceiling regardless of this value. CHECK ensures
   *  0 < intro_duration_ms <= 10000 when set. */
  intro_duration_ms: number | null;
  /** Phase 4A · optional still-frame rendered while the video
   *  downloads · prevents blank frame flash. NULL = no poster. */
  intro_poster_url: string | null;
  created_at: string;
  updated_at: string;
}

export type NexChatThemeLayoutStyle =
  | "bubbles"
  | "sky_cards"
  | "timeline_ribbon";

/** Structured shape of nex_chat_theme.wallpaper_config JSONB. Every
 *  key is optional so themes can opt into whichever overlays fit.
 *  Mirrors the overlays natively supported by `PortraitBloomShell`
 *  (migration 056 + Bridge 97). */
export interface NexChatThemeWallpaperConfig {
  /** Soft breathing halo positioned over a moon (or other point
   *  source) in the wallpaper photograph. */
  moonGlow?: {
    /** CSS left · e.g. "72%" */
    x: string;
    /** CSS top · e.g. "calc(11% - 15px)" */
    y: string;
    /** Halo diameter in px */
    size: number;
    /** Core colour of the halo · e.g. "rgba(225, 238, 255, 0.6)" */
    color?: string;
  };
  /** Soft particles drifting upward across the chat canvas · drives
   *  the NEX Orange Centre "orange bubbles floating up" overlay. */
  particleDrift?: {
    color: string;
    count?: number;
    direction?: "up";
    size?: number;
    speedSeconds?: number;
  };
  /** Twinkling star-like sparkles over the wallpaper. */
  sparkle?: {
    color: string;
    count?: number;
    size?: number;
    twinkleSeconds?: number;
  };
  /** Fog blobs that rise from below the composer. */
  mistDrift?: {
    color?: string;
    count?: number;
    size?: number;
    blur?: number;
    speedSeconds?: number;
  };
  /** Bubble-shape preset the shell applies to every message bubble. */
  bubbleStyle?: {
    preset: "classic" | "pill" | "square" | "outlined" | "gradient";
  };
}

/** Resolved colour bundle for a theme · every element has a concrete
 *  hex. Callers use this to paint bubbles / composer / ripple without
 *  reaching for null-check boilerplate. */
export interface NexChatThemeColours {
  accent: string;
  bubbleRim: string;
  composerRim: string;
}

/** Given a theme row, resolve every element's colour with fallbacks
 *  to accent when overrides are null. Pure function · safe anywhere. */
export function resolveThemeColours(
  row: Pick<NexChatThemeRow, "accent_hex" | "bubble_rim_hex" | "composer_rim_hex">,
): NexChatThemeColours {
  return {
    accent: row.accent_hex,
    bubbleRim: row.bubble_rim_hex ?? row.accent_hex,
    composerRim: row.composer_rim_hex ?? row.accent_hex,
  };
}

export interface NexChatThemeInsert {
  id: string;
  name: string;
  tagline?: string | null;
  accent_hex: string;
  bubble_rim_hex?: string | null;
  composer_rim_hex?: string | null;
  tier?: NexChatThemeTier;
  category?: NexChatThemeCategory;
  hero_image_url?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

/** List every active theme, ordered for picker rendering. */
export async function listActiveThemes(): Promise<NexChatThemeRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_chat_theme")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    throw new Error(
      `chat-theme-service.listActiveThemes: ${error.message}`,
    );
  }
  return (data as NexChatThemeRow[]) ?? [];
}

/** Get a single theme by id. Falls back to null on unknown / inactive. */
export async function getThemeById(
  id: string,
): Promise<NexChatThemeRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_chat_theme")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`chat-theme-service.getThemeById: ${error.message}`);
  }
  if (data) return data as NexChatThemeRow;
  // Step 1G/1H hotfix (2026-10-11) · live-world themes (nex-bubbles,
  // nex-flat, waterworld, coffee, café family, food, pizza,
  // bike-rental) are code-registered packages that never land in
  // nex_chat_theme. The chat renderer, peer-chat page, cover-content
  // loader and every other consumer of `getThemeById` was coming up
  // empty-handed and falling back to the generic cyan+navy default ·
  // which looked identical to app chrome. We synthesise a
  // NexChatThemeRow from the matching ThemePackage so every consumer
  // paints the correct per-theme palette automatically.
  try {
    const { LIVE_WORLD_PACKAGES, isLiveWorldId } = await import(
      "@/app/nex-native/chat-standard/_live-worlds"
    );
    if (!isLiveWorldId(id)) return null;
    const pkg = LIVE_WORLD_PACKAGES[id];
    const introVideoUrl =
      pkg.intro && pkg.intro.kind === "standard" ? pkg.intro.videoUrl : null;
    const nowIso = new Date().toISOString();
    // Step 1J (2026-10-11) · attach the real-chat overlay for the
    // two FREE NEX themes so PortraitBloomShell actually paints the
    // moonGlow + particleDrift when the theme is applied in a live
    // peer chat. The shell reads these fields natively today · no
    // shell change needed. Other live-worlds keep the null overlay
    // and rely on wallpaperUrl + colour tokens alone.
    const wallpaperConfig = liveWorldChatOverlay(pkg.identity.id);
    const synthetic: NexChatThemeRow = {
      id: pkg.identity.id,
      name: pkg.identity.name,
      tagline: pkg.identity.tagline ?? null,
      accent_hex: pkg.colours.primary,
      bubble_rim_hex: pkg.colours.secondary ?? pkg.colours.primary,
      composer_rim_hex: pkg.colours.highlight ?? pkg.colours.primary,
      tier: "gratis",
      category: "standard",
      hero_image_url: pkg.wallpaperUrl ?? null,
      is_active: true,
      sort_order: -1,
      wallpaper_config: wallpaperConfig,
      layout_style: "bubbles",
      intro_video_url: introVideoUrl,
      intro_duration_ms: null,
      intro_poster_url: null,
      created_at: nowIso,
      updated_at: nowIso,
    };
    return synthetic;
  } catch {
    // Fallback failed (import error / unexpected shape) · behave as
    // if no theme was found. Caller already handles null.
    return null;
  }
}

/** Resolve the accent hex for a chat_theme value with a safe fallback
 *  when the id is unknown or the theme is inactive. Never throws. */
export async function accentForTheme(
  themeId: string | null | undefined,
): Promise<string> {
  const DEFAULT = "#00AFFF";
  if (!themeId) return DEFAULT;
  try {
    const row = await getThemeById(themeId);
    if (!row || !row.is_active) return DEFAULT;
    return row.accent_hex;
  } catch {
    return DEFAULT;
  }
}

/** Admin-only · insert a new theme row. Slug must be unique. */
export async function createTheme(
  input: NexChatThemeInsert,
): Promise<NexChatThemeRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_chat_theme")
    .insert({
      id: input.id,
      name: input.name,
      tagline: input.tagline ?? null,
      accent_hex: input.accent_hex,
      bubble_rim_hex: input.bubble_rim_hex ?? null,
      composer_rim_hex: input.composer_rim_hex ?? null,
      tier: input.tier ?? "gratis",
      category: input.category ?? "standard",
      hero_image_url: input.hero_image_url ?? null,
      is_active: input.is_active ?? true,
      sort_order: input.sort_order ?? 100,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `chat-theme-service.createTheme: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexChatThemeRow;
}

/** Admin-only · patch fields on an existing theme by id. */
export async function updateTheme(
  id: string,
  patch: Partial<Omit<NexChatThemeInsert, "id">>,
): Promise<NexChatThemeRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_chat_theme")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `chat-theme-service.updateTheme: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexChatThemeRow;
}

/** Upload a hero image for a theme to Supabase Storage
 *  (bucket `nex-chat-theme-hero`, public read · migration 049).
 *  Returns the public URL to save into `nex_chat_theme.hero_image_url`.
 *  Throws on failure · caller decides how to surface it. */
export async function uploadThemeHero(
  themeSlug: string,
  file: File,
): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const safeExt = ["png", "jpg", "jpeg", "webp", "avif"].includes(ext)
    ? ext
    : "png";
  const objectPath = `${themeSlug}-${Date.now()}.${safeExt}`;
  const bucket = nexSupabaseAdmin.storage.from("nex-chat-theme-hero");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await bucket.upload(objectPath, bytes, {
    contentType: file.type || `image/${safeExt}`,
    upsert: true,
  });
  if (error) {
    throw new Error(
      `chat-theme-service.uploadThemeHero: ${error.message}`,
    );
  }
  const { data } = bucket.getPublicUrl(objectPath);
  return data.publicUrl;
}

/** Step 1J helper · maps live-world ids to the sealed
 *  PortraitBloomShell `wallpaper_config` shape so the two FREE NEX
 *  themes paint their signature overlays inside the real chat shell.
 *  Live-worlds that don't need a chat-canvas overlay return null ·
 *  the shell renders with wallpaper + colour tokens alone. */
function liveWorldChatOverlay(
  themeId: string,
): NexChatThemeWallpaperConfig | null {
  if (themeId === "nex-flat") {
    // NEX Orange Centre · glowing orange centre + 14 small orange
    // bubbles floating up. Both overlays are first-class in the
    // sealed PortraitBloomShell (migration 056 + Bridge 97). The
    // shell already honours prefers-reduced-motion for both.
    return {
      moonGlow: {
        x: "50%",
        y: "45%",
        size: 240,
        color: "rgba(255, 120, 0, 0.42)",
      },
      particleDrift: {
        color: "#FF7200",
        count: 14,
        direction: "up",
        size: 8,
        speedSeconds: 10,
      },
    };
  }
  // NEX Original (nex-bubbles) + every other live-world · no overlay.
  // The shell paints bubbles + composer with the theme palette and
  // the default navy stage.
  return null;
}

/** Group themes by category for picker rendering.
 *  Guarantees at least an empty array on each category. */
export function groupByCategory(themes: NexChatThemeRow[]): {
  standard: NexChatThemeRow[];
  premium: NexChatThemeRow[];
} {
  const standard: NexChatThemeRow[] = [];
  const premium: NexChatThemeRow[] = [];
  for (const t of themes) {
    if (t.category === "premium") premium.push(t);
    else standard.push(t);
  }
  return { standard, premium };
}

/** L-052 follow-up · 2026-11-27 · Option B cookie→DB migration on signup.
 *  Seeds `nex_account.chat_theme` from the `nex-free-chat-wallpaper`
 *  cookie set by the first-visit three-category cards flow when an
 *  anonymous viewer picks a free theme before registering. The cookie
 *  stores the BARE library asset id (`chat:` / `shop:` prefixes
 *  stripped by ApplyPreviewModal's first-visit branch). First-visit
 *  three-category cards only open chat-context library sub-routes, so
 *  the cookie value is always a chat-prefixed asset's bare id — this
 *  helper re-attaches `chat:` and looks the asset up in
 *  nex_background_asset, lazy-upserts the matching nex_chat_theme row
 *  (same discipline as applyFromLibraryChatAction), and writes the
 *  account's chat_theme via the existing validated updateChatTheme
 *  pathway.
 *
 *  Scope limits (deliberate · entitlement honoured):
 *   · Chat-context assets only. Shop-origin assets are never seeded
 *     here because the first-visit cards do not surface them AND
 *     shop-origin themes carry a bisnis tier whose entitlement must
 *     be honoured, not silently bypassed at signup.
 *   · Gratis tier only. Any resolved chat asset whose underlying
 *     catalog tier != 'gratis' falls through without writing the
 *     account column; the user still sees their pick in free-chat
 *     (cookie) and can re-apply later through the full entitlement
 *     flow in the library's ApplyPreviewModal.
 *   · Best-effort. Every failure returns a structured
 *     `{ ok: false, reason }` and never throws into the signup flow.
 *     A failure degrades to the pre-seed behaviour: cookie still
 *     wins visually, DB column still reads the sealed default
 *     'theme-0', user can re-apply later. */
export async function seedChatThemeFromFreeChatCookie(args: {
  readonly accountId: NexUuid;
  readonly bareWallpaperId: string;
}): Promise<
  | { readonly ok: true; readonly chatThemeId: string }
  | { readonly ok: false; readonly reason: string }
> {
  const { accountId, bareWallpaperId } = args;
  // Defensive · defuse any unexpected cookie contents before touching DB.
  if (
    typeof bareWallpaperId !== "string" ||
    !/^[a-z0-9][a-z0-9_-]{1,60}$/i.test(bareWallpaperId)
  ) {
    return { ok: false, reason: "invalid-id-format" };
  }

  const asset = await getBackgroundAsset(`chat:${bareWallpaperId}`);
  if (!asset) return { ok: false, reason: "asset-not-found" };
  if (asset.tier !== "gratis") {
    return { ok: false, reason: `tier-gated:${asset.tier}` };
  }

  // Chat-origin: bare id is CHECK-constraint compliant per migration 337.
  const chatThemeId = asset.id.replace(/^chat:/, "");

  // Lazy-upsert nex_chat_theme row · mirrors the apply-from-library
  // action so updateChatTheme's validator finds the row.
  const { data: existing } = await nexSupabaseAdmin
    .from("nex_chat_theme")
    .select("id,is_active")
    .eq("id", chatThemeId)
    .maybeSingle<{ id: string; is_active: boolean }>();

  if (!existing || !existing.is_active) {
    const { error: upsertErr } = await nexSupabaseAdmin
      .from("nex_chat_theme")
      .upsert({
        id: chatThemeId,
        name: asset.label,
        accent_hex: asset.tintHex ?? "#C6A15B",
        tier: "gratis",
        category: "standard",
        hero_image_url: asset.storageUrl,
        is_active: true,
      });
    if (upsertErr) {
      return { ok: false, reason: `upsert:${upsertErr.message}` };
    }
  }

  try {
    await updateChatTheme(accountId, chatThemeId);
  } catch (e) {
    return { ok: false, reason: `update:${(e as Error).message}` };
  }
  return { ok: true, chatThemeId };
}
