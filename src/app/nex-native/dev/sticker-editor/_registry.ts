// src/app/nex-native/dev/sticker-editor/_registry.ts
//
// Sticker editor · shared tile registry + manifest types.
// Owner-authorised 2026-10-19 (MVP · manual correction tool).
// -----------------------------------------------------------------------------
// Lists every slug the editor can correct, mapped to its source sheet
// and default grid-computed crop coordinates. The default crop is a
// seed · the owner edits each per-tile crop via the UI, saves the
// corrections to the JSON manifest, then exports via the sealed sharp
// pipeline to overwrite the production tile PNGs.
//
// Hard rules (per owner directive):
//   · Original sheets in C:/Users/Victus/Downloads/ are NEVER modified
//   · Existing generated tiles are OVERWRITTEN ONLY by the Export
//     action, never by Save
//   · Dual-registration (promo3d-* → both /emoji/ and /sticker/) is
//     preserved automatically on export

import type { ThemePackage } from "@/app/nex-native/chat-standard/_engine/types";

export type TileCategory = "emoji" | "sticker";

export interface TileSheet {
  readonly file: string;      // filename in C:/Users/Victus/Downloads/
  readonly rows: number;
  readonly cols: number;
  readonly srcW: number;      // all four sheets are 1536×1024
  readonly srcH: number;
}

export interface TileEntry {
  readonly slug: string;
  readonly sheet: string;     // key into SHEETS map
  readonly row: number;       // 0-indexed row in the sheet grid
  readonly col: number;       // 0-indexed col
  readonly categories: readonly TileCategory[]; // sticker, maybe emoji dual
}

export const SHEETS: Record<string, TileSheet> = {
  promo3d: {
    file: "Colorful 3D Food Promotion Sticker Sheet (2).png",
    rows: 4,
    cols: 6,
    srcW: 1536,
    srcH: 1024,
  },
  promo: {
    file: "Glossy Fast-Food Promo Sticker Collection (1).png",
    rows: 4,
    cols: 6,
    srcW: 1536,
    srcH: 1024,
  },
  glossy: {
    file: "Glossy Chef’s Food Sticker Grid (3).png",
    rows: 3,
    cols: 5,
    srcW: 1536,
    srcH: 1024,
  },
  cakegirl: {
    file: "Cute Cake Girl Emoji Sticker Sheet.png",
    rows: 4,
    cols: 6,
    srcW: 1536,
    srcH: 1024,
  },
  glossy3d: {
    file: "Glossy 3D Emoji Sticker Collection.png",
    rows: 4,
    cols: 6,
    srcW: 1536,
    srcH: 1024,
  },
};

export const TILES: readonly TileEntry[] = [
  // ─── promo3d (24 · dual-registered as emoji + sticker) ──────────
  ...[
    ["promo3d-special-offer","promo3d-limited-offer","promo3d-hot-deal","promo3d-new-item","promo3d-best-price","promo3d-dont-miss-out"],
    ["promo3d-premium-quality","promo3d-fresh-ingredients","promo3d-special-menu","promo3d-combo-deal","promo3d-save-more","promo3d-time-limited"],
    ["promo3d-pizza-special","promo3d-hot-food","promo3d-customer-favorite","promo3d-freshly-made","promo3d-free-drink","promo3d-free-fries"],
    ["promo3d-free-dessert","promo3d-free-water","promo3d-free-delivery","promo3d-free-rice","promo3d-free-sauce","promo3d-birthday-special"],
  ].flatMap((row, r) => row.map((slug, c) => ({
    slug, sheet: "promo3d", row: r, col: c, categories: ["sticker", "emoji"] as const,
  }))),
  // ─── promo (24 · sticker only) ──────────────────────────────────
  ...[
    ["promo-5-off","promo-10-off","promo-15-off","promo-20-off","promo-25-off","promo-30-off"],
    ["promo-buy1-get1","promo-free-drink","promo-free-fries","promo-free-dessert","promo-free-water","promo-free-delivery"],
    ["promo-free-rice","promo-free-sauce","promo-half-price","promo-special-offer","promo-limited-time","promo-hot-deal"],
    ["promo-fresh-ingredients","promo-chefs-special","promo-best-choice","promo-tasty-food","promo-good-food","promo-premium-quality"],
  ].flatMap((row, r) => row.map((slug, c) => ({
    slug, sheet: "promo", row: r, col: c, categories: ["sticker"] as const,
  }))),
  // ─── glossy (15 · sticker only) ─────────────────────────────────
  ...[
    ["glossy-cool","glossy-thanks","glossy-great","glossy-preparing","glossy-packaged"],
    ["glossy-picked-up","glossy-wait","glossy-ok","glossy-we-can","glossy-sure"],
    ["glossy-sold-out","glossy-new-try","glossy-delicious","glossy-fresh","glossy-enjoy"],
  ].flatMap((row, r) => row.map((slug, c) => ({
    slug, sheet: "glossy", row: r, col: c, categories: ["sticker"] as const,
  }))),
  // ─── cakegirl (24 · emoji only · default 4×6 grid · adjust if layout differs) ─
  ...Array.from({ length: 4 }, (_, r) =>
    Array.from({ length: 6 }, (_, c) => {
      const n = String(r * 6 + c + 1).padStart(2, "0");
      return {
        slug: `cakegirl-${n}`,
        sheet: "cakegirl",
        row: r,
        col: c,
        categories: ["emoji"] as const,
      };
    }),
  ).flat(),
  // ─── glossy3d (24 · emoji only · default 4×6 grid) ───────────────
  ...Array.from({ length: 4 }, (_, r) =>
    Array.from({ length: 6 }, (_, c) => {
      const n = String(r * 6 + c + 1).padStart(2, "0");
      return {
        slug: `glossy3d-${n}`,
        sheet: "glossy3d",
        row: r,
        col: c,
        categories: ["emoji"] as const,
      };
    }),
  ).flat(),
];

/** Compute the default (grid-aligned) crop for a tile. Seed data for
 *  the manifest when no override has been saved. */
export function defaultCrop(entry: TileEntry): CropRect {
  const sh = SHEETS[entry.sheet];
  const left = Math.round((entry.col * sh.srcW) / sh.cols);
  const right = Math.round(((entry.col + 1) * sh.srcW) / sh.cols);
  const top = Math.round((entry.row * sh.srcH) / sh.rows);
  const bottom = Math.round(((entry.row + 1) * sh.srcH) / sh.rows);
  return { left, top, width: right - left, height: bottom - top };
}

export interface CropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TileCorrection {
  slug: string;
  sheet: string;
  crop: CropRect | null;
  skipped: boolean;
  skipReason?: string;
  /** Optional per-tile override of registry categories. When omitted
   *  the TileEntry.categories list is used. */
  destinations?: readonly TileCategory[];
}

export interface CorrectionManifest {
  schema: 1;
  updatedAt: string;
  tiles: Record<string, TileCorrection>;
}

/** Shape of the exportCorrectionsAction result. Lives here (not in
 *  _actions.ts) because Next.js server-action files should only export
 *  async functions — moving the type into the registry sidesteps that
 *  constraint on strict builds. */
export interface ExportSummary {
  ok: boolean;
  exported: number;
  skipped: number;
  errors: Array<{ slug: string; message: string }>;
  tilesInfo: Array<{
    slug: string;
    width: number;
    height: number;
    dualCopied: boolean;
  }>;
}

/** Produce a fresh manifest seeded with default grid crops for every
 *  tile · nothing marked skipped. */
export function seedManifest(): CorrectionManifest {
  const tiles: Record<string, TileCorrection> = {};
  for (const t of TILES) {
    tiles[t.slug] = {
      slug: t.slug,
      sheet: t.sheet,
      crop: defaultCrop(t),
      skipped: false,
    };
  }
  return {
    schema: 1,
    updatedAt: new Date().toISOString(),
    tiles,
  };
}

export type _ThemePackageUnused = ThemePackage; // keep import alive for future ties
