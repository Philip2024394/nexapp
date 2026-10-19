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

// ─── Food (fast-food) emoji · 30 slugs · owner-registered 2026-10-19 ─
// Source · "Glossy Fast-Food Icon Sticker Sheet (1).png" sliced into
// 30 individual 256×204 tiles (then resized to 160×128 for picker
// density) via scripts in session 2026-10-19. Assets live under
// `public/nex-themes/food/emoji/<slug>.png`.
//
// This catalog is shared across every food-category Standard
// Experience world (owner directive 2026-10-19 · "add to crispy
// chicken and any other food chat theme emoji panel"). The food
// chat themes are: food · crispy-chicken · pizza · coffee ·
// botanical-cafe · midnight-cafe · french-cafe (categoryId: "food"
// in each package).
const FOOD_EMOJI: readonly BuiltInThemeEmoji[] = [
  // ─── Fast-food icon set (30) · "Glossy Fast-Food Icon Sticker
  // Sheet (1).png" sliced into 30 tiles on 2026-10-19. ─────────────
  // Row 1 (burgers + classic lineup)
  "burger",
  "double-burger",
  "triple-burger",
  "chicken-burger",
  "hot-dog",
  "pizza-slice",
  // Row 2 (international + sides)
  "pizza",
  "taco",
  "burrito",
  "fries",
  "onion-rings",
  "chicken-nuggets",
  // Row 3 (chicken-forward · aligns with Crispy Chicken theme)
  "chicken-pieces",
  "chicken-wings",
  "chicken-strips",
  "nachos",
  "nachos-cheese",
  "waffle-fries",
  // Row 4 (bowls + shakes)
  "salad-bowl",
  "mac-and-cheese",
  "chili-bowl",
  "strawberry-shake",
  "chocolate-shake",
  "soft-serve",
  // Row 5 (desserts)
  "cookie",
  "brownie",
  "donut",
  "pie-slice",
  "cupcake",
  "smoothie",
  // ─── Chef character set (24) · "Glossy Chef Emoji Sticker Sheet
  // (1).png" sliced into 24 tiles on 2026-10-19. Added as the
  // "character" lane beneath the fast-food "object" lane. All food-
  // category themes expose both lanes together. ───────────────────
  // Row 1 (chef gestures)
  "chef-thumbs-up",
  "chef-ok-sign",
  "chef-tongue-out",
  "chef-with-knife",
  "chef-tasting-spoon",
  "chef-cool-shades",
  // Row 2 (chef cooking actions)
  "chef-wok-flame",
  "chef-chopping",
  "chef-stirring-pot",
  "chef-serving-plate",
  "chef-silver-dome",
  "chef-flame-pan",
  // Row 3 (chef with ingredients)
  "chef-salad",
  "chef-rolling-dough",
  "chef-with-fish",
  "chef-with-lobster",
  "chef-with-pasta",
  "chef-grating",
  // Row 4 (chef with finished dishes)
  "chef-with-wine",
  "chef-with-burger",
  "chef-with-shrimp",
  "chef-with-cake",
  "chef-with-beer",
  "chef-at-grill",
].map((slug, i) => ({
  slug,
  image_url: `/nex-themes/food/emoji/${slug}.png`,
  label: "",
  sort_order: i + 1,
}));

// ─── Food stickers · 40 total · owner-registered 2026-10-19 ─────────
// Two sticker vocabularies live together under one catalog so the
// composer's Stickers tab paints a complete reaction set:
//
//   Glossy chef set (15 · 2026-10-19) · from "Glossy Chef's Food
//     Sticker Grid (2).png" · white chef-hat sticker treatment
//     (cool · thanks · great · preparing · packaged · picked up ·
//     wait · ok · we can · sure · sold out · new try · delicious ·
//     fresh · enjoy)
//
//   3D colorful set (25 · 2026-10-19) · from "Colorful 3D Food
//     Sticker Pack.png" · superset of the glossy set + 10 extra
//     reactions (refreshing · spicy · tasty · sweet · hot · healthy
//     · good food · freshly made · chef's choice · eat well). Pop-
//     art 3D treatment · different visual language from the glossy
//     set.
//
// Aspect ratios recorded so the picker can render each cell
// faithfully instead of forcing a square. All ratios below are
// width:height from the slicer output (240×267 for glossy = 0.899;
// 240×160 for 3D = 1.5).
const FOOD_STICKERS: readonly BuiltInThemeSticker[] = [
  // Glossy chef (15)
  "glossy-cool",
  "glossy-thanks",
  "glossy-great",
  "glossy-preparing",
  "glossy-packaged",
  "glossy-picked-up",
  "glossy-wait",
  "glossy-ok",
  "glossy-we-can",
  "glossy-sure",
  "glossy-sold-out",
  "glossy-new-try",
  "glossy-delicious",
  "glossy-fresh",
  "glossy-enjoy",
].map((slug, i) => ({
  slug,
  image_url: `/nex-themes/food/sticker/${slug}.png`,
  label: "",
  sticker_type: "static" as const,
  aspect_ratio: 240 / 267,
  sort_order: i + 1,
})).concat(
  // 3D colorful (25)
  [
    "3d-cool",
    "3d-thanks",
    "3d-great",
    "3d-preparing",
    "3d-packaged",
    "3d-picked-up",
    "3d-wait",
    "3d-ok",
    "3d-we-can",
    "3d-sure",
    "3d-sold-out",
    "3d-new-try",
    "3d-delicious",
    "3d-fresh",
    "3d-enjoy",
    "3d-refreshing",
    "3d-spicy",
    "3d-tasty",
    "3d-sweet",
    "3d-hot",
    "3d-healthy",
    "3d-good-food",
    "3d-freshly-made",
    "3d-chefs-choice",
    "3d-eat-well",
  ].map((slug, i) => ({
    slug,
    image_url: `/nex-themes/food/sticker/${slug}.png`,
    label: "",
    sticker_type: "static" as const,
    aspect_ratio: 240 / 160,
    sort_order: 15 + i + 1,
  })),
);

// Food-family theme ids · one catalog shared across all seven worlds
// so Crispy Chicken, Pizza, Coffee, the three Café worlds and the
// generic Food theme all surface the same 30 fast-food emojis in the
// composer picker.
const FOOD_THEME_IDS = new Set<string>([
  "food",
  "crispy-chicken",
  "pizza",
  "coffee",
  "botanical-cafe",
  "midnight-cafe",
  "french-cafe",
]);

// ─── Public lookup ──────────────────────────────────────────────────

/** Return the built-in emoji catalog for a known theme id, or null
 *  when no catalog is defined for it. Called by
 *  `theme-emoji-service.listThemeEmojis()` as a fallback when the DB
 *  returns zero rows. */
export function getBuiltInEmoji(
  themeId: string,
): readonly BuiltInThemeEmoji[] | null {
  if (themeId === "theme-0") return JOKER_EMOJI;
  if (FOOD_THEME_IDS.has(themeId)) return FOOD_EMOJI;
  return null;
}

/** Return the built-in sticker catalog for a known theme id, or null
 *  when no catalog is defined for it. Called by
 *  `theme-sticker-service.listThemeStickers()` as a fallback when
 *  the DB returns zero rows. */
export function getBuiltInStickers(
  themeId: string,
): readonly BuiltInThemeSticker[] | null {
  if (themeId === "theme-0") return JOKER_STICKERS;
  if (FOOD_THEME_IDS.has(themeId)) return FOOD_STICKERS;
  return null;
}
