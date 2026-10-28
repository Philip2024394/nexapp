// src/lib/nex-native/watch-catalog/watch-brands.ts
//
// Curated watch-brand catalogue · owner directive 2026-10-26 (R3g).
// Spans luxury Swiss, luxury German, Japanese, independent /
// microbrand, smartwatch, fashion, pro / tool, and regional makers so
// a seller can type into the Shop > Watches upload form and pick the
// right brand without inventing a text label. If the brand is not in
// this list, the seller selects "Other brand" and types a 2-word max
// custom label (enforced in the BrandPicker component).
//
// Data shape: `{ name, categories[] }`. Categories are advisory ·
// used by the upload form to suggest sensible defaults (watch type,
// movement) when the brand is picked. Nothing is enforced on the
// brand label itself.
//
// NOT exhaustive · the catalogue will grow as sellers list new
// brands. Keep sorted alphabetically within each tier for easy
// human-editability.

export type WatchBrandCategory =
  | "luxury-swiss"
  | "luxury-german"
  | "japanese"
  | "independent"
  | "microbrand"
  | "smartwatch"
  | "fashion"
  | "pro-dive"
  | "vintage-heritage"
  | "american"
  | "regional-asia";

export interface WatchBrand {
  readonly name: string;
  readonly categories: readonly WatchBrandCategory[];
}

/** Curated brand list · ~110 entries · alphabetically sorted. */
export const WATCH_BRANDS: readonly WatchBrand[] = [
  { name: "A. Lange & Söhne", categories: ["luxury-german"] },
  { name: "Alexandre Christie", categories: ["regional-asia", "fashion"] },
  { name: "Amazfit", categories: ["smartwatch"] },
  { name: "Apple Watch", categories: ["smartwatch"] },
  { name: "Audemars Piguet", categories: ["luxury-swiss"] },
  { name: "Baltic", categories: ["microbrand"] },
  { name: "Baume & Mercier", categories: ["luxury-swiss"] },
  { name: "Bell & Ross", categories: ["luxury-swiss", "pro-dive"] },
  { name: "Blancpain", categories: ["luxury-swiss", "pro-dive"] },
  { name: "Breguet", categories: ["luxury-swiss"] },
  { name: "Breitling", categories: ["luxury-swiss"] },
  { name: "Bulgari", categories: ["luxury-swiss"] },
  { name: "Bulova", categories: ["american", "vintage-heritage"] },
  { name: "Cartier", categories: ["luxury-swiss"] },
  { name: "Casio", categories: ["japanese"] },
  { name: "Chopard", categories: ["luxury-swiss"] },
  { name: "Christopher Ward", categories: ["microbrand"] },
  { name: "Chronoswiss", categories: ["luxury-swiss"] },
  { name: "Citizen", categories: ["japanese"] },
  { name: "Credor", categories: ["japanese", "luxury-swiss"] },
  { name: "Daniel Wellington", categories: ["fashion"] },
  { name: "Diesel", categories: ["fashion"] },
  { name: "DKNY", categories: ["fashion"] },
  { name: "Doxa", categories: ["vintage-heritage", "pro-dive"] },
  { name: "Ebel", categories: ["vintage-heritage"] },
  { name: "Eterna", categories: ["vintage-heritage"] },
  { name: "Farer", categories: ["microbrand"] },
  { name: "Favre-Leuba", categories: ["vintage-heritage"] },
  { name: "Fiyta", categories: ["regional-asia"] },
  { name: "Fitbit", categories: ["smartwatch"] },
  { name: "Fortis", categories: ["luxury-swiss", "pro-dive"] },
  { name: "Fossil", categories: ["fashion", "smartwatch"] },
  { name: "F.P. Journe", categories: ["luxury-swiss", "independent"] },
  { name: "Franck Muller", categories: ["luxury-swiss"] },
  { name: "Frederique Constant", categories: ["luxury-swiss"] },
  { name: "Garmin", categories: ["smartwatch", "pro-dive"] },
  { name: "Girard-Perregaux", categories: ["luxury-swiss"] },
  { name: "Glashütte Original", categories: ["luxury-german"] },
  { name: "Google Pixel Watch", categories: ["smartwatch"] },
  { name: "Grand Seiko", categories: ["japanese"] },
  { name: "G-Shock", categories: ["japanese"] },
  { name: "H. Moser & Cie.", categories: ["luxury-swiss", "independent"] },
  { name: "Halios", categories: ["microbrand", "pro-dive"] },
  { name: "Hamilton", categories: ["luxury-swiss", "vintage-heritage"] },
  { name: "Huawei Watch", categories: ["smartwatch"] },
  { name: "Hublot", categories: ["luxury-swiss"] },
  { name: "IWC", categories: ["luxury-swiss"] },
  { name: "Jacob & Co.", categories: ["luxury-swiss", "independent"] },
  { name: "Jaeger-LeCoultre", categories: ["luxury-swiss"] },
  { name: "Junghans", categories: ["luxury-german"] },
  { name: "Lorier", categories: ["microbrand"] },
  { name: "Longines", categories: ["luxury-swiss"] },
  { name: "Louis Vuitton", categories: ["luxury-swiss", "fashion"] },
  { name: "Maurice Lacroix", categories: ["luxury-swiss"] },
  { name: "MeisterSinger", categories: ["microbrand", "independent"] },
  { name: "Michael Kors", categories: ["fashion"] },
  { name: "Minase", categories: ["japanese", "independent"] },
  { name: "Mido", categories: ["luxury-swiss"] },
  { name: "Monta", categories: ["microbrand"] },
  { name: "Montblanc", categories: ["luxury-swiss"] },
  { name: "Movado", categories: ["luxury-swiss", "vintage-heritage"] },
  { name: "MVMT", categories: ["fashion"] },
  { name: "Nixon", categories: ["fashion"] },
  { name: "Nomos Glashütte", categories: ["luxury-german"] },
  { name: "NTH", categories: ["microbrand", "pro-dive"] },
  { name: "Omega", categories: ["luxury-swiss"] },
  { name: "Orient", categories: ["japanese"] },
  { name: "Oris", categories: ["luxury-swiss", "pro-dive"] },
  { name: "Panerai", categories: ["luxury-swiss", "pro-dive"] },
  { name: "Patek Philippe", categories: ["luxury-swiss"] },
  { name: "Perrelet", categories: ["luxury-swiss"] },
  { name: "Piaget", categories: ["luxury-swiss"] },
  { name: "Rado", categories: ["luxury-swiss"] },
  { name: "Raymond Weil", categories: ["luxury-swiss"] },
  { name: "Richard Mille", categories: ["luxury-swiss", "independent"] },
  { name: "Rolex", categories: ["luxury-swiss"] },
  { name: "Samsung Galaxy Watch", categories: ["smartwatch"] },
  { name: "Seiko", categories: ["japanese"] },
  { name: "Serica", categories: ["microbrand"] },
  { name: "Shinola", categories: ["american"] },
  { name: "Sinn", categories: ["luxury-german", "pro-dive"] },
  { name: "Squale", categories: ["luxury-swiss", "pro-dive"] },
  { name: "Studio Underd0g", categories: ["microbrand"] },
  { name: "Suunto", categories: ["smartwatch", "pro-dive"] },
  { name: "Swatch", categories: ["fashion"] },
  { name: "TAG Heuer", categories: ["luxury-swiss"] },
  { name: "Timex", categories: ["american"] },
  { name: "Tissot", categories: ["luxury-swiss"] },
  { name: "Tudor", categories: ["luxury-swiss"] },
  { name: "Ulysse Nardin", categories: ["luxury-swiss"] },
  { name: "Union Glashütte", categories: ["luxury-german"] },
  { name: "Universal Genève", categories: ["vintage-heritage"] },
  { name: "Urwerk", categories: ["luxury-swiss", "independent"] },
  { name: "Vacheron Constantin", categories: ["luxury-swiss"] },
  { name: "Victorinox", categories: ["luxury-swiss"] },
  { name: "Wear OS", categories: ["smartwatch"] },
  { name: "Weiss", categories: ["american", "microbrand"] },
  { name: "Withings", categories: ["smartwatch"] },
  { name: "Xiaomi", categories: ["smartwatch", "regional-asia"] },
  { name: "Zenith", categories: ["luxury-swiss"] },
];

/** Alphabetical name list · stable for client-side autocomplete. */
export const WATCH_BRAND_NAMES: readonly string[] = WATCH_BRANDS.map((b) => b.name);

/** Case-insensitive substring filter · returns at most `limit` matches
 *  sorted by match-quality (prefix matches first, then substring). */
export function filterWatchBrands(query: string, limit = 10): readonly string[] {
  const q = query.trim().toLowerCase();
  if (!q) return WATCH_BRAND_NAMES.slice(0, limit);
  const prefix: string[] = [];
  const contains: string[] = [];
  for (const name of WATCH_BRAND_NAMES) {
    const lower = name.toLowerCase();
    if (lower.startsWith(q)) prefix.push(name);
    else if (lower.includes(q)) contains.push(name);
    if (prefix.length + contains.length >= limit * 2) break;
  }
  return [...prefix, ...contains].slice(0, limit);
}

/** Enforce the 2-word cap on custom brand labels · owner directive
 *  2026-10-26 (R3g) · "limit to 2 words max". Trims, collapses
 *  whitespace, truncates to the first 2 whitespace-separated tokens. */
export function clampCustomBrand(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const words = trimmed.split(" ");
  return words.slice(0, 2).join(" ");
}
