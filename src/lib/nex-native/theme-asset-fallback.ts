// src/lib/nex-native/theme-asset-fallback.ts
//
// Built-in theme-emoji + theme-sticker catalogs · sealed 2026-10-11.
// -----------------------------------------------------------------
// The sealed D:/trades Supabase project seeded 23 Joker emoji
// (`joker-03..joker-25`) via migration 116 + upload-joker-emoji.mjs
// and 9 Joker stickers (`joker-sticker-01..09`) via migration 118 +
// upload-joker-stickers.mjs. The nexapp fork inherited the SCHEMAS
// but not the DATA (the upload scripts weren't carried over), so the
// nex_theme_emoji / nex_theme_sticker rows for theme-0 are empty on
// the nexapp Supabase project.
//
// This module serves as the SINGLE-SOURCE FALLBACK that
// `theme-emoji-service.ts` + `theme-sticker-service.ts` consult when
// the DB returns no rows for a known theme id. Assets live locally
// under `public/nex-themes/joker/` so Next.js serves them without
// any Supabase storage dependency.
//
// Load-bearing rules:
//   · Images are served from `/nex-themes/joker/{emoji,sticker}/<slug>.png`
//     · the actual files sit in `public/nex-themes/joker/`
//   · Slugs, label text ("" per the upload scripts), sort_order and
//     aspect_ratio values are BYTE-IDENTICAL to what the upload
//     scripts would have inserted into the DB.
//   · The services prefer DB rows when they exist · the fallback
//     only kicks in for a known theme with zero DB rows. If the
//     owner later re-seeds the real Supabase bucket + table, the
//     DB rows win and this fallback silently stops firing.

export interface BuiltInThemeEmoji {
  slug: string;
  image_url: string;
  label: string;
  sort_order: number;
}

export interface BuiltInThemeSticker {
  slug: string;
  image_url: string;
  label: string;
  sticker_type: "static";
  aspect_ratio: number;
  sort_order: number;
}

// ─── Joker emoji · migration 116 · 23 slugs ─────────────────────────
// Range: joker-03..joker-25 · zero-padded two-digit · label field is
// the empty string per the sealed upload script. sort_order equals
// the index (3..25). Image URLs point at the local public asset.
const JOKER_EMOJI: readonly BuiltInThemeEmoji[] = Array.from(
  { length: 23 },
  (_, idx) => {
    const i = idx + 3; // 3 through 25 inclusive
    const slug = `joker-${String(i).padStart(2, "0")}`;
    return {
      slug,
      image_url: `/nex-themes/joker/emoji/${slug}.png`,
      label: "",
      sort_order: i,
    };
  },
);

// ─── Joker stickers · migration 118 · 9 slugs ───────────────────────
// Range: joker-sticker-01..joker-sticker-09 · aspect ratios measured
// from the sealed source PNGs via sharp 2026-10-11 so the catalog
// matches what the upload script would have persisted.
const JOKER_STICKERS: readonly BuiltInThemeSticker[] = [
  { slug: "joker-sticker-01", aspect_ratio: 0.7179, sort_order: 1 },
  { slug: "joker-sticker-02", aspect_ratio: 0.728, sort_order: 2 },
  { slug: "joker-sticker-03", aspect_ratio: 0.726, sort_order: 3 },
  { slug: "joker-sticker-04", aspect_ratio: 0.7242, sort_order: 4 },
  { slug: "joker-sticker-05", aspect_ratio: 0.7103, sort_order: 5 },
  { slug: "joker-sticker-06", aspect_ratio: 0.7099, sort_order: 6 },
  { slug: "joker-sticker-07", aspect_ratio: 0.7155, sort_order: 7 },
  { slug: "joker-sticker-08", aspect_ratio: 0.7182, sort_order: 8 },
  { slug: "joker-sticker-09", aspect_ratio: 0.7182, sort_order: 9 },
].map((s) => ({
  slug: s.slug,
  image_url: `/nex-themes/joker/sticker/${s.slug}.png`,
  label: "",
  sticker_type: "static" as const,
  aspect_ratio: s.aspect_ratio,
  sort_order: s.sort_order,
}));

// ─── Public lookup ──────────────────────────────────────────────────

/** Return the built-in emoji catalog for a known theme id, or null
 *  when no catalog is defined for it. Called by
 *  `theme-emoji-service.listThemeEmojis()` as a fallback when the DB
 *  returns zero rows. */
export function getBuiltInEmoji(
  themeId: string,
): readonly BuiltInThemeEmoji[] | null {
  switch (themeId) {
    case "theme-0":
      return JOKER_EMOJI;
    default:
      return null;
  }
}

/** Return the built-in sticker catalog for a known theme id, or null
 *  when no catalog is defined for it. Called by
 *  `theme-sticker-service.listThemeStickers()` as a fallback when
 *  the DB returns zero rows. */
export function getBuiltInStickers(
  themeId: string,
): readonly BuiltInThemeSticker[] | null {
  switch (themeId) {
    case "theme-0":
      return JOKER_STICKERS;
    default:
      return null;
  }
}
