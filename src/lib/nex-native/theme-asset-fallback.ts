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

// ─── Food meta · per-slug aspect ratio + human label ────────────────
// Owner directive 2026-10-19 · "we must only scan the image and apply
// to emoji and stickers not cut size · each sheet emoji will have
// different size height emoji or sticker · you are looking to save
// the outer rim of the imoji and sticker and apply to libary" + "and
// store what each emoji or sticker is for search field finding".
//
// Each tile was re-sliced on 2026-10-19 via
// scripts/reslice-theme-assets.mjs which uses pixel-level content
// detection: sample the 4 corner averages to estimate the cell's
// background colour, scan every pixel for RGB distance > 36, crop
// to the tight bounding box + 4px safety padding, resize so long
// side ≤ 400px, save as PNG. The output aspect ratio therefore
// REFLECTS THE ACTUAL CONTENT SHAPE of each tile (not the sheet's
// uniform grid size) so the picker renders the natural outer rim
// of every emoji / sticker without cropping shadows, hats or
// decorations that extended past the grid lines in the source.
//
// `label` powers the picker's search field · typing "burger" filters
// to every slug whose slug OR label contains "burger" (case-
// insensitive). Keep labels tight + human (max ~24 chars) · they
// also show as the chip title on hover.
interface FoodAssetMeta {
  readonly aspect: number;
  readonly label: string;
}
const FOOD_META: Record<string, FoodAssetMeta> = {
  // ─ Fast-food emoji (30 · "Glossy Fast-Food Icon Sticker Sheet (1).png") ─
  burger: { aspect: 1.2488, label: "Burger" },
  "double-burger": { aspect: 1.161, label: "Double burger" },
  "triple-burger": { aspect: 1.1902, label: "Triple burger" },
  "chicken-burger": { aspect: 1.1415, label: "Chicken burger" },
  "hot-dog": { aspect: 1.2653, label: "Hot dog" },
  "pizza-slice": { aspect: 1.2439, label: "Pizza slice" },
  pizza: { aspect: 1.239, label: "Pizza" },
  taco: { aspect: 1.122, label: "Taco" },
  burrito: { aspect: 1.2488, label: "Burrito" },
  fries: { aspect: 1.1659, label: "Fries" },
  "onion-rings": { aspect: 1.2488, label: "Onion rings" },
  "chicken-nuggets": { aspect: 1.2488, label: "Chicken nuggets" },
  "chicken-pieces": { aspect: 1.1961, label: "Chicken pieces" },
  "chicken-wings": { aspect: 1.2549, label: "Chicken wings" },
  "chicken-strips": { aspect: 1.2549, label: "Chicken strips" },
  nachos: { aspect: 1.2549, label: "Nachos" },
  "nachos-cheese": { aspect: 1.2549, label: "Nachos with cheese" },
  "waffle-fries": { aspect: 1.1961, label: "Waffle fries" },
  "salad-bowl": { aspect: 1.2488, label: "Salad bowl" },
  "mac-and-cheese": { aspect: 1.2488, label: "Mac and cheese" },
  "chili-bowl": { aspect: 1.2488, label: "Chili bowl" },
  "strawberry-shake": { aspect: 1.2, label: "Strawberry shake" },
  "chocolate-shake": { aspect: 1.0488, label: "Chocolate shake" },
  "soft-serve": { aspect: 0.9902, label: "Soft serve ice cream" },
  cookie: { aspect: 1.2488, label: "Cookie" },
  brownie: { aspect: 1.1317, label: "Brownie" },
  donut: { aspect: 1.2488, label: "Donut" },
  "pie-slice": { aspect: 1.1463, label: "Pie slice" },
  cupcake: { aspect: 1.2488, label: "Cupcake" },
  smoothie: { aspect: 1.2488, label: "Smoothie" },
  // ─ Chef character emoji (24 · "Glossy Chef Emoji Sticker Sheet (1).png") ─
  "chef-thumbs-up": { aspect: 0.9648, label: "Chef thumbs up" },
  "chef-ok-sign": { aspect: 0.9766, label: "Chef ok sign" },
  "chef-tongue-out": { aspect: 0.8594, label: "Chef tongue out" },
  "chef-with-knife": { aspect: 1, label: "Chef with knife" },
  "chef-tasting-spoon": { aspect: 0.8867, label: "Chef tasting spoon" },
  "chef-cool-shades": { aspect: 0.9922, label: "Chef cool shades" },
  "chef-wok-flame": { aspect: 1, label: "Chef wok with flame" },
  "chef-chopping": { aspect: 1, label: "Chef chopping" },
  "chef-stirring-pot": { aspect: 1, label: "Chef stirring pot" },
  "chef-serving-plate": { aspect: 0.9453, label: "Chef serving plate" },
  "chef-silver-dome": { aspect: 0.8867, label: "Chef silver dome" },
  "chef-flame-pan": { aspect: 1, label: "Chef flame pan" },
  "chef-salad": { aspect: 1, label: "Chef with salad" },
  "chef-rolling-dough": { aspect: 1, label: "Chef rolling dough" },
  "chef-with-fish": { aspect: 1, label: "Chef with fish" },
  "chef-with-lobster": { aspect: 1, label: "Chef with lobster" },
  "chef-with-pasta": { aspect: 0.9402, label: "Chef with pasta" },
  "chef-grating": { aspect: 1, label: "Chef grating cheese" },
  "chef-with-wine": { aspect: 1, label: "Chef with wine" },
  "chef-with-burger": { aspect: 0.9336, label: "Chef with burger" },
  "chef-with-shrimp": { aspect: 1, label: "Chef with shrimp" },
  "chef-with-cake": { aspect: 1, label: "Chef with cake" },
  "chef-with-beer": { aspect: 1, label: "Chef with beer" },
  "chef-at-grill": { aspect: 1, label: "Chef at grill" },
  // ─ Glossy chef stickers (15 · "Glossy Chef's Food Sticker Grid (2).png") ─
  "glossy-cool": { aspect: 0.9003, label: "Cool" },
  "glossy-thanks": { aspect: 0.9003, label: "Thanks" },
  "glossy-great": { aspect: 0.9032, label: "Great" },
  "glossy-preparing": { aspect: 0.9003, label: "Preparing" },
  "glossy-packaged": { aspect: 0.9003, label: "Packaged" },
  "glossy-picked-up": { aspect: 0.8304, label: "Picked up" },
  "glossy-wait": { aspect: 0.8977, label: "Wait" },
  "glossy-ok": { aspect: 0.9006, label: "OK" },
  "glossy-we-can": { aspect: 0.8977, label: "We can" },
  "glossy-sure": { aspect: 0.8977, label: "Sure" },
  "glossy-sold-out": { aspect: 0.9003, label: "Sold out" },
  "glossy-new-try": { aspect: 0.9003, label: "New try" },
  "glossy-delicious": { aspect: 0.9032, label: "Delicious" },
  "glossy-fresh": { aspect: 0.9003, label: "Fresh" },
  "glossy-enjoy": { aspect: 0.9003, label: "Enjoy" },
  // ─ 3D colorful stickers (25 · "Colorful 3D Food Sticker Pack.png") ─
  "3d-cool": { aspect: 1.4976, label: "Cool" },
  "3d-thanks": { aspect: 1.4976, label: "Thanks" },
  "3d-great": { aspect: 1.5024, label: "Great" },
  "3d-preparing": { aspect: 1.4146, label: "Preparing" },
  "3d-packaged": { aspect: 1.3659, label: "Packaged" },
  "3d-picked-up": { aspect: 1.2634, label: "Picked up" },
  "3d-wait": { aspect: 1.4976, label: "Wait" },
  "3d-ok": { aspect: 1.4829, label: "OK" },
  "3d-we-can": { aspect: 1.4976, label: "We can" },
  "3d-sure": { aspect: 1.4976, label: "Sure" },
  "3d-sold-out": { aspect: 1.4853, label: "Sold out" },
  "3d-new-try": { aspect: 1.5049, label: "New try" },
  "3d-delicious": { aspect: 1.4069, label: "Delicious" },
  "3d-fresh": { aspect: 1.3186, label: "Fresh" },
  "3d-enjoy": { aspect: 1.2108, label: "Enjoy" },
  "3d-refreshing": { aspect: 1.4976, label: "Refreshing" },
  "3d-spicy": { aspect: 1.4976, label: "Spicy" },
  "3d-tasty": { aspect: 1.5024, label: "Tasty" },
  "3d-sweet": { aspect: 1.4976, label: "Sweet" },
  "3d-hot": { aspect: 1.3805, label: "Hot" },
  "3d-healthy": { aspect: 1.4976, label: "Healthy" },
  "3d-good-food": { aspect: 1.4976, label: "Good food" },
  "3d-freshly-made": { aspect: 1.5024, label: "Freshly made" },
  "3d-chefs-choice": { aspect: 1.4732, label: "Chef's choice" },
  "3d-eat-well": { aspect: 1.1902, label: "Eat well" },
  // ─ Glossy promo (24 · "Glossy Fast-Food Promo Sticker Collection.png") ─
  "promo-5-off": { aspect: 1, label: "5% off" },
  "promo-10-off": { aspect: 1, label: "10% off" },
  "promo-15-off": { aspect: 1, label: "15% off" },
  "promo-20-off": { aspect: 1.0407, label: "20% off" },
  "promo-25-off": { aspect: 1, label: "25% off" },
  "promo-30-off": { aspect: 1, label: "30% off" },
  "promo-buy1-get1": { aspect: 1, label: "Buy 1 get 1 free" },
  "promo-free-drink": { aspect: 1, label: "Free drink" },
  "promo-free-fries": { aspect: 1, label: "Free fries" },
  "promo-free-dessert": { aspect: 1, label: "Free dessert" },
  "promo-free-water": { aspect: 1, label: "Free water" },
  "promo-free-delivery": { aspect: 1, label: "Free delivery" },
  "promo-free-rice": { aspect: 1, label: "Free rice" },
  "promo-free-sauce": { aspect: 1, label: "Free sauce" },
  "promo-half-price": { aspect: 1, label: "Half price" },
  "promo-special-offer": { aspect: 1, label: "Special offer" },
  "promo-limited-time": { aspect: 1, label: "Limited time" },
  "promo-hot-deal": { aspect: 1, label: "Hot deal" },
  "promo-fresh-ingredients": { aspect: 1, label: "Fresh ingredients" },
  "promo-chefs-special": { aspect: 1, label: "Chef's special" },
  "promo-best-choice": { aspect: 1, label: "Best choice" },
  "promo-tasty-food": { aspect: 1, label: "Tasty food" },
  "promo-good-food": { aspect: 1, label: "Good food" },
  "promo-premium-quality": { aspect: 0.9688, label: "Premium quality" },
  // ─ 3D promo (24 · "Colorful 3D Food Promotion Sticker Sheet.png") ─
  "promo3d-special-offer": { aspect: 1, label: "Special offer" },
  "promo3d-limited-offer": { aspect: 1, label: "Limited offer" },
  "promo3d-hot-deal": { aspect: 1, label: "Hot deal" },
  "promo3d-new-item": { aspect: 1, label: "New item" },
  "promo3d-best-price": { aspect: 1, label: "Best price" },
  "promo3d-dont-miss-out": { aspect: 1, label: "Don't miss out" },
  "promo3d-premium-quality": { aspect: 1, label: "Premium quality" },
  "promo3d-fresh-ingredients": { aspect: 1, label: "Fresh ingredients" },
  "promo3d-special-menu": { aspect: 1, label: "Special menu" },
  "promo3d-combo-deal": { aspect: 1, label: "Combo deal" },
  "promo3d-save-more": { aspect: 1, label: "Save more" },
  "promo3d-time-limited": { aspect: 1, label: "Time limited" },
  "promo3d-pizza-special": { aspect: 1, label: "Pizza special" },
  "promo3d-hot-food": { aspect: 1, label: "Hot food" },
  "promo3d-customer-favorite": { aspect: 1, label: "Customer favorite" },
  "promo3d-freshly-made": { aspect: 1, label: "Freshly made" },
  "promo3d-free-drink": { aspect: 1, label: "Free drink" },
  "promo3d-free-fries": { aspect: 0.9567, label: "Free fries" },
  "promo3d-free-dessert": { aspect: 1, label: "Free dessert" },
  "promo3d-free-water": { aspect: 1, label: "Free water" },
  "promo3d-free-delivery": { aspect: 1, label: "Free delivery" },
  "promo3d-free-rice": { aspect: 1, label: "Free rice" },
  "promo3d-free-sauce": { aspect: 1, label: "Free sauce" },
  "promo3d-birthday-special": { aspect: 1, label: "Birthday special" },
  // Cute cake girl emoji set (24 · aspect assumed square 4×6 grid at
  // 1536×1024 · 256×256 cells, so aspect 1). Generic labels so each
  // tile is findable in the picker search · owner can relabel later
  // if desired.
  "cakegirl-01": { aspect: 1, label: "Cake girl 1" },
  "cakegirl-02": { aspect: 1, label: "Cake girl 2" },
  "cakegirl-03": { aspect: 1, label: "Cake girl 3" },
  "cakegirl-04": { aspect: 1, label: "Cake girl 4" },
  "cakegirl-05": { aspect: 1, label: "Cake girl 5" },
  "cakegirl-06": { aspect: 1, label: "Cake girl 6" },
  "cakegirl-07": { aspect: 1, label: "Cake girl 7" },
  "cakegirl-08": { aspect: 1, label: "Cake girl 8" },
  "cakegirl-09": { aspect: 1, label: "Cake girl 9" },
  "cakegirl-10": { aspect: 1, label: "Cake girl 10" },
  "cakegirl-11": { aspect: 1, label: "Cake girl 11" },
  "cakegirl-12": { aspect: 1, label: "Cake girl 12" },
  "cakegirl-13": { aspect: 1, label: "Cake girl 13" },
  "cakegirl-14": { aspect: 1, label: "Cake girl 14" },
  "cakegirl-15": { aspect: 1, label: "Cake girl 15" },
  "cakegirl-16": { aspect: 1, label: "Cake girl 16" },
  "cakegirl-17": { aspect: 1, label: "Cake girl 17" },
  "cakegirl-18": { aspect: 1, label: "Cake girl 18" },
  "cakegirl-19": { aspect: 1, label: "Cake girl 19" },
  "cakegirl-20": { aspect: 1, label: "Cake girl 20" },
  "cakegirl-21": { aspect: 1, label: "Cake girl 21" },
  "cakegirl-22": { aspect: 1, label: "Cake girl 22" },
  "cakegirl-23": { aspect: 1, label: "Cake girl 23" },
  "cakegirl-24": { aspect: 1, label: "Cake girl 24" },
  // Glossy 3D emoji set (24 · owner-exported from the Visual Sticker
  // Editor on 2026-10-19 from "Glossy 3D Emoji Sticker Collection.png").
  // Numbered labels keep each tile findable in search · owner can
  // relabel to specific moods later.
  "glossy3d-01": { aspect: 1, label: "Glossy 3D 1" },
  "glossy3d-02": { aspect: 1, label: "Glossy 3D 2" },
  "glossy3d-03": { aspect: 1, label: "Glossy 3D 3" },
  "glossy3d-04": { aspect: 1, label: "Glossy 3D 4" },
  "glossy3d-05": { aspect: 1, label: "Glossy 3D 5" },
  "glossy3d-06": { aspect: 1, label: "Glossy 3D 6" },
  "glossy3d-07": { aspect: 1, label: "Glossy 3D 7" },
  "glossy3d-08": { aspect: 1, label: "Glossy 3D 8" },
  "glossy3d-09": { aspect: 1, label: "Glossy 3D 9" },
  "glossy3d-10": { aspect: 1, label: "Glossy 3D 10" },
  "glossy3d-11": { aspect: 1, label: "Glossy 3D 11" },
  "glossy3d-12": { aspect: 1, label: "Glossy 3D 12" },
  "glossy3d-13": { aspect: 1, label: "Glossy 3D 13" },
  "glossy3d-14": { aspect: 1, label: "Glossy 3D 14" },
  "glossy3d-15": { aspect: 1, label: "Glossy 3D 15" },
  "glossy3d-16": { aspect: 1, label: "Glossy 3D 16" },
  "glossy3d-17": { aspect: 1, label: "Glossy 3D 17" },
  "glossy3d-18": { aspect: 1, label: "Glossy 3D 18" },
  "glossy3d-19": { aspect: 1, label: "Glossy 3D 19" },
  "glossy3d-20": { aspect: 1, label: "Glossy 3D 20" },
  "glossy3d-21": { aspect: 1, label: "Glossy 3D 21" },
  "glossy3d-22": { aspect: 1, label: "Glossy 3D 22" },
  "glossy3d-23": { aspect: 1, label: "Glossy 3D 23" },
  "glossy3d-24": { aspect: 1, label: "Glossy 3D 24" },
};

function foodMeta(slug: string): FoodAssetMeta {
  return FOOD_META[slug] ?? { aspect: 1, label: slug };
}

// ─── Food (fast-food) emoji · 54 slugs · owner-registered 2026-10-19 ─
// Sources ·
//   30 tiles · "Glossy Fast-Food Icon Sticker Sheet (1).png"
//   24 tiles · "Glossy Chef Emoji Sticker Sheet (1).png"
// Re-sliced on 2026-10-19 via scripts/reslice-theme-assets.mjs with
// bounding-box content detection · aspect ratios reflect each tile's
// natural visual shape · labels power the picker search field.
//
// This catalog is shared across every food-category Standard
// Experience world (owner directive 2026-10-19 · "add to crispy
// chicken and any other food chat theme emoji panel"). The food
// chat themes are: food · crispy-chicken · pizza · coffee ·
// botanical-cafe · midnight-cafe · french-cafe (categoryId: "food"
// in each package).
const FOOD_EMOJI: readonly BuiltInThemeEmoji[] = [
  // ─── Glossy 3D emoji set (24 · owner directive 2026-10-19 · "the
  // yellow imoji is the first to show on the liabry") · moved to the
  // top of the catalog so this set lands first in the picker. PNGs
  // live at public/nex-themes/food/emoji/glossy3d-NN.png. ───────────
  "glossy3d-01",
  "glossy3d-02",
  "glossy3d-03",
  "glossy3d-04",
  "glossy3d-05",
  "glossy3d-06",
  "glossy3d-07",
  "glossy3d-08",
  "glossy3d-09",
  "glossy3d-10",
  "glossy3d-11",
  "glossy3d-12",
  "glossy3d-13",
  "glossy3d-14",
  "glossy3d-15",
  "glossy3d-16",
  "glossy3d-17",
  "glossy3d-18",
  "glossy3d-19",
  "glossy3d-20",
  "glossy3d-21",
  "glossy3d-22",
  "glossy3d-23",
  "glossy3d-24",
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
  // ─── 3D promo icons (24 · "Colorful 3D Food Promotion Sticker
  // Sheet.png") dual-registered 2026-10-19 · owner directive · "copy
  // the image and all other line only and update the emoji libary ·
  // also add name for search field". The same art appears in the
  // Stickers tab too · labels in FOOD_META power picker search in
  // both tabs. PNG files were copied from
  // public/nex-themes/food/sticker/ to public/nex-themes/food/emoji/
  // so the /emoji/<slug>.png URL below resolves. ───────────────────
  "promo3d-special-offer",
  "promo3d-limited-offer",
  "promo3d-hot-deal",
  "promo3d-new-item",
  "promo3d-best-price",
  "promo3d-dont-miss-out",
  "promo3d-premium-quality",
  "promo3d-fresh-ingredients",
  "promo3d-special-menu",
  "promo3d-combo-deal",
  "promo3d-save-more",
  "promo3d-time-limited",
  "promo3d-pizza-special",
  "promo3d-hot-food",
  "promo3d-customer-favorite",
  "promo3d-freshly-made",
  "promo3d-free-drink",
  "promo3d-free-fries",
  "promo3d-free-dessert",
  "promo3d-free-water",
  "promo3d-free-delivery",
  "promo3d-free-rice",
  "promo3d-free-sauce",
  "promo3d-birthday-special",
  // ─── Cute cake girl emoji set (24 · owner-exported from the Visual
  // Sticker Editor on 2026-10-19 from "Cute Cake Girl Emoji Sticker
  // Sheet.png"). Emoji-only lane · PNGs live at
  // public/nex-themes/food/emoji/cakegirl-NN.png. ─────────────────────
  "cakegirl-01",
  "cakegirl-02",
  "cakegirl-03",
  "cakegirl-04",
  "cakegirl-05",
  "cakegirl-06",
  "cakegirl-07",
  "cakegirl-08",
  "cakegirl-09",
  "cakegirl-10",
  "cakegirl-11",
  "cakegirl-12",
  "cakegirl-13",
  "cakegirl-14",
  "cakegirl-15",
  "cakegirl-16",
  "cakegirl-17",
  "cakegirl-18",
  "cakegirl-19",
  "cakegirl-20",
  "cakegirl-21",
  "cakegirl-22",
  "cakegirl-23",
  "cakegirl-24",
].map((slug, i) => ({
  slug,
  image_url: `/nex-themes/food/emoji/${slug}.png`,
  label: foodMeta(slug).label,
  sort_order: i + 1,
}));

// ─── Food stickers · 88 total · owner-registered 2026-10-19 ─────────
// Four sticker vocabularies live together under one catalog so the
// composer's Stickers tab paints a complete reaction + promo set:
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
//   Glossy promo set (24 · 2026-10-19) · from "Glossy Fast-Food
//     Promo Sticker Collection.png" · sales / badge treatments for
//     a food business (6 discount percentages 5-30% off · 6 freebie
//     offers · 6 deal/urgency badges · 6 quality badges). Square
//     tiles · the business owner uses these to run flash promos in
//     chat.
//
//   3D promo set (24 · 2026-10-19) · from "Colorful 3D Food
//     Promotion Sticker Sheet.png" · same business-promo vocabulary
//     as the glossy set but with a 3D pop treatment (special offer
//     · limited offer · hot deal · new item · best price · don't
//     miss out · premium quality · fresh ingredients · special menu
//     · combo deal · save more · time limited · pizza special · hot
//     food · customer favorite · freshly made · 5 free-X items ·
//     birthday special). Visually different from the glossy promo
//     set · the business owner picks whichever tone suits.
//
// Aspect ratios recorded so the picker can render each cell
// faithfully instead of forcing a square. Ratios below are
// width:height from the slicer output (240×267 for glossy = 0.899;
// 240×160 for 3D = 1.5; 240×240 for both promo sets = 1.0).
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
  label: foodMeta(slug).label,
  sticker_type: "static" as const,
  aspect_ratio: foodMeta(slug).aspect,
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
    label: foodMeta(slug).label,
    sticker_type: "static" as const,
    aspect_ratio: foodMeta(slug).aspect,
    sort_order: 15 + i + 1,
  })),
).concat(
  // Promo set (24) · square 240×240 tiles
  [
    // Row 1 · discount percentages
    "promo-5-off",
    "promo-10-off",
    "promo-15-off",
    "promo-20-off",
    "promo-25-off",
    "promo-30-off",
    // Row 2 · freebies
    "promo-buy1-get1",
    "promo-free-drink",
    "promo-free-fries",
    "promo-free-dessert",
    "promo-free-water",
    "promo-free-delivery",
    // Row 3 · deals + urgency
    "promo-free-rice",
    "promo-free-sauce",
    "promo-half-price",
    "promo-special-offer",
    "promo-limited-time",
    "promo-hot-deal",
    // Row 4 · quality badges
    "promo-fresh-ingredients",
    "promo-chefs-special",
    "promo-best-choice",
    "promo-tasty-food",
    "promo-good-food",
    "promo-premium-quality",
  ].map((slug, i) => ({
    slug,
    image_url: `/nex-themes/food/sticker/${slug}.png`,
    label: foodMeta(slug).label,
    sticker_type: "static" as const,
    aspect_ratio: foodMeta(slug).aspect,
    sort_order: 40 + i + 1,
  })),
).concat(
  // 3D Promo set (24) · square 240×240 tiles
  [
    // Row 1 · hero promos
    "promo3d-special-offer",
    "promo3d-limited-offer",
    "promo3d-hot-deal",
    "promo3d-new-item",
    "promo3d-best-price",
    "promo3d-dont-miss-out",
    // Row 2 · quality / combos / urgency
    "promo3d-premium-quality",
    "promo3d-fresh-ingredients",
    "promo3d-special-menu",
    "promo3d-combo-deal",
    "promo3d-save-more",
    "promo3d-time-limited",
    // Row 3 · item-specific + firsts
    "promo3d-pizza-special",
    "promo3d-hot-food",
    "promo3d-customer-favorite",
    "promo3d-freshly-made",
    "promo3d-free-drink",
    "promo3d-free-fries",
    // Row 4 · more free items + special moment
    "promo3d-free-dessert",
    "promo3d-free-water",
    "promo3d-free-delivery",
    "promo3d-free-rice",
    "promo3d-free-sauce",
    "promo3d-birthday-special",
  ].map((slug, i) => ({
    slug,
    image_url: `/nex-themes/food/sticker/${slug}.png`,
    label: foodMeta(slug).label,
    sticker_type: "static" as const,
    aspect_ratio: foodMeta(slug).aspect,
    sort_order: 64 + i + 1,
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

// ─── Universal catalog aggregators · owner-authorised 2026-10-19 ────
//
// Owner directive · "emoji and stickers and giphy images and files
// will be one great library and same for all chat themes" · the
// aggregators below merge every known theme's built-in catalog into
// a single pool. The unified picker reads from these so the Emoji
// and Sticker tabs show the FULL cross-theme set regardless of which
// theme the user is currently viewing. Slugs stay globally unique
// (joker-01 vs chef-wok-flame vs promo-sold-out etc.) so there's no
// collision risk.

/** Returns every built-in emoji across every theme in one array ·
 *  stable sorted by sort_order within each theme block, themes in
 *  stable listing order (Joker · food family) so the picker reads
 *  deterministically on every render. */
export function getAllBuiltInEmoji(): readonly BuiltInThemeEmoji[] {
  return [...JOKER_EMOJI, ...FOOD_EMOJI];
}

/** Same model for stickers. */
export function getAllBuiltInStickers(): readonly BuiltInThemeSticker[] {
  return [...JOKER_STICKERS, ...FOOD_STICKERS];
}
