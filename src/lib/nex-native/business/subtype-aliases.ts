// src/lib/nex-native/business/subtype-aliases.ts
//
// NEX Business Experience · subtype synonym / alias registry.
// Owner-sealed 2026-11-07 · "No legitimate business should be left
// without a suitable category in NEX."
// -----------------------------------------------------------------------------
// Language-first category discovery · a seller types what they do
// ("hair salon", "juice shop", "staircase manufacturer") and the
// search resolves to the canonical Rev 6 subtype.
//
// Design rules:
//   · Canonical subtype slugs NEVER change · all mappings resolve back
//     to BUSINESS_SUBTYPES (which is the frozen Rev 6 registry +
//     Phase B additions sealed 2026-11-07).
//   · Aliases are English-first. The structure accepts locale-scoped
//     entries later ("en-IE", "en-GB", "id") without changing the
//     search surface · owner-authored locale terms get added via
//     per-locale blocks at the end of this file.
//   · Exact, prefix, word-boundary and loose substring matches all
//     feed the ranker. Match quality drives the result order so
//     "coffee shop" ranks cafe above bakery even though both contain
//     "shop".
//   · Legacy slug round-trip is guaranteed · typing "ice-cream" or
//     "staircase-company" matches the canonical Rev 6 subtype 1:1.
//   · Pure module · no DB, no server-only imports · safe in any bundle.

import type { BusinessCategory, BusinessSubtype } from "./types";
import { BUSINESS_SUBTYPE_CATEGORY, BUSINESS_SUBTYPE_LABEL } from "./subtypes";

/** A single alias bundled with the canonical subtype it resolves to.
 *  `alias` is stored LOWERCASE for cheap case-insensitive matching. */
export interface SubtypeAlias {
  readonly alias: string;
  readonly subtype: BusinessSubtype;
}

// ---------------------------------------------------------------------------
// Canonical alias table · English baseline.
// ---------------------------------------------------------------------------
//
// For each subtype we include:
//   · The canonical label (lowercased · so the LABEL also searches)
//   · Common variants (singular + plural + hyphenated + legacy slug)
//   · Specific business names ("barber", "hairdresser" → salon)
//   · Common abbreviations ("pt" → fitness · "b&b" → guesthouse)
//
// When adding: keep each alias <= 40 chars, prefer the natural
// phrase a seller would type ("gym", "coffee shop", "online retailer")
// over internal taxonomy terms.

const ALIASES_EN: ReadonlyArray<SubtypeAlias> = [
  // ── Food ───────────────────────────────────────────────────────────
  { subtype: "restaurant", alias: "restaurant" },
  { subtype: "restaurant", alias: "restaurants" },
  { subtype: "restaurant", alias: "diner" },
  { subtype: "restaurant", alias: "eatery" },
  { subtype: "restaurant", alias: "bistro" },
  { subtype: "restaurant", alias: "tavern" },
  { subtype: "restaurant", alias: "pub food" },
  { subtype: "restaurant", alias: "gastropub" },
  { subtype: "restaurant", alias: "canteen" },

  { subtype: "cafe", alias: "cafe" },
  { subtype: "cafe", alias: "café" },
  { subtype: "cafe", alias: "coffee" },
  { subtype: "cafe", alias: "coffee shop" },
  { subtype: "cafe", alias: "coffeehouse" },
  { subtype: "cafe", alias: "coffee house" },
  { subtype: "cafe", alias: "tea room" },
  { subtype: "cafe", alias: "tea shop" },
  { subtype: "cafe", alias: "espresso bar" },

  { subtype: "bakery", alias: "bakery" },
  { subtype: "bakery", alias: "bakeries" },
  { subtype: "bakery", alias: "baker" },
  { subtype: "bakery", alias: "bread shop" },
  { subtype: "bakery", alias: "patisserie" },
  { subtype: "bakery", alias: "pâtisserie" },
  { subtype: "bakery", alias: "cake shop" },

  { subtype: "food_maker", alias: "food maker" },
  { subtype: "food_maker", alias: "home cook" },
  { subtype: "food_maker", alias: "meal prep" },
  { subtype: "food_maker", alias: "private chef" },
  { subtype: "food_maker", alias: "cook" },
  { subtype: "food_maker", alias: "food business" },
  { subtype: "food_maker", alias: "other food business" },

  { subtype: "catering", alias: "catering" },
  { subtype: "catering", alias: "caterer" },
  { subtype: "catering", alias: "event catering" },
  { subtype: "catering", alias: "wedding catering" },
  { subtype: "catering", alias: "banqueting" },

  { subtype: "drinks", alias: "drinks" },
  { subtype: "drinks", alias: "drinks shop" },
  { subtype: "drinks", alias: "drinks-shop" },
  { subtype: "drinks", alias: "beverage" },
  { subtype: "drinks", alias: "beverages" },
  { subtype: "drinks", alias: "off licence" },
  { subtype: "drinks", alias: "off-licence" },
  { subtype: "drinks", alias: "wine shop" },
  { subtype: "drinks", alias: "bar" },

  { subtype: "food_delivery", alias: "food delivery" },
  { subtype: "food_delivery", alias: "delivery kitchen" },
  { subtype: "food_delivery", alias: "cloud kitchen" },
  { subtype: "food_delivery", alias: "ghost kitchen" },
  { subtype: "food_delivery", alias: "dark kitchen" },

  { subtype: "ice_cream", alias: "ice cream" },
  { subtype: "ice_cream", alias: "ice-cream" },
  { subtype: "ice_cream", alias: "ice cream shop" },
  { subtype: "ice_cream", alias: "ice-cream shop" },
  { subtype: "ice_cream", alias: "ice cream parlour" },
  { subtype: "ice_cream", alias: "ice cream parlor" },
  { subtype: "ice_cream", alias: "gelato" },
  { subtype: "ice_cream", alias: "gelateria" },
  { subtype: "ice_cream", alias: "frozen yogurt" },
  { subtype: "ice_cream", alias: "froyo" },

  { subtype: "dessert_shop", alias: "dessert" },
  { subtype: "dessert_shop", alias: "desserts" },
  { subtype: "dessert_shop", alias: "dessert shop" },
  { subtype: "dessert_shop", alias: "dessert-shop" },
  { subtype: "dessert_shop", alias: "sweet shop" },
  { subtype: "dessert_shop", alias: "sweets" },
  { subtype: "dessert_shop", alias: "chocolate shop" },
  { subtype: "dessert_shop", alias: "waffle shop" },
  { subtype: "dessert_shop", alias: "donut shop" },
  { subtype: "dessert_shop", alias: "doughnut shop" },

  { subtype: "juice_bar", alias: "juice" },
  { subtype: "juice_bar", alias: "juice bar" },
  { subtype: "juice_bar", alias: "juice-bar" },
  { subtype: "juice_bar", alias: "juice shop" },
  { subtype: "juice_bar", alias: "smoothie" },
  { subtype: "juice_bar", alias: "smoothies" },
  { subtype: "juice_bar", alias: "smoothie bar" },
  { subtype: "juice_bar", alias: "boba" },
  { subtype: "juice_bar", alias: "bubble tea" },
  { subtype: "juice_bar", alias: "bubble tea shop" },

  // ── Accommodation ──────────────────────────────────────────────────
  { subtype: "hotel", alias: "hotel" },
  { subtype: "hotel", alias: "hotels" },
  { subtype: "hotel", alias: "motel" },
  { subtype: "hotel", alias: "inn" },
  { subtype: "hotel", alias: "boutique hotel" },

  { subtype: "villa", alias: "villa" },
  { subtype: "villa", alias: "villas" },
  { subtype: "villa", alias: "holiday villa" },
  { subtype: "villa", alias: "luxury villa" },

  { subtype: "guesthouse", alias: "guesthouse" },
  { subtype: "guesthouse", alias: "guest house" },
  { subtype: "guesthouse", alias: "b&b" },
  { subtype: "guesthouse", alias: "bed and breakfast" },
  { subtype: "guesthouse", alias: "bed & breakfast" },

  { subtype: "homestay", alias: "homestay" },
  { subtype: "homestay", alias: "home stay" },
  { subtype: "homestay", alias: "spare room" },

  { subtype: "resort", alias: "resort" },
  { subtype: "resort", alias: "resorts" },
  { subtype: "resort", alias: "holiday resort" },
  { subtype: "resort", alias: "beach resort" },
  { subtype: "resort", alias: "spa resort" },

  { subtype: "short_rental", alias: "short rental" },
  { subtype: "short_rental", alias: "short-term rental" },
  { subtype: "short_rental", alias: "vacation rental" },
  { subtype: "short_rental", alias: "holiday let" },
  { subtype: "short_rental", alias: "self-catering" },
  { subtype: "short_rental", alias: "airbnb" },

  { subtype: "kost", alias: "kost" },
  { subtype: "kost", alias: "kos" },
  { subtype: "kost", alias: "boarding house" },
  { subtype: "kost", alias: "boarding" },
  { subtype: "kost", alias: "pondokan" },

  // ── Property ───────────────────────────────────────────────────────
  { subtype: "for_sale", alias: "property for sale" },
  { subtype: "for_sale", alias: "house for sale" },
  { subtype: "for_sale", alias: "homes for sale" },
  { subtype: "for_sale", alias: "property sales" },
  { subtype: "for_sale", alias: "sales" },

  { subtype: "for_rent", alias: "property for rent" },
  { subtype: "for_rent", alias: "property to let" },
  { subtype: "for_rent", alias: "rental property" },
  { subtype: "for_rent", alias: "letting" },
  { subtype: "for_rent", alias: "lettings" },

  { subtype: "developer", alias: "property developer" },
  { subtype: "developer", alias: "real estate developer" },
  { subtype: "developer", alias: "land developer" },
  { subtype: "developer", alias: "housebuilder" },

  { subtype: "agent", alias: "property agent" },
  { subtype: "agent", alias: "estate agent" },
  { subtype: "agent", alias: "letting agent" },
  { subtype: "agent", alias: "real estate agent" },
  { subtype: "agent", alias: "realtor" },

  // ── Products ───────────────────────────────────────────────────────
  { subtype: "retail", alias: "retail" },
  { subtype: "retail", alias: "retailer" },
  { subtype: "retail", alias: "shop" },
  { subtype: "retail", alias: "store" },
  { subtype: "retail", alias: "general shop" },
  { subtype: "retail", alias: "other product business" },

  { subtype: "manufacturer", alias: "manufacturer" },
  { subtype: "manufacturer", alias: "manufacturing" },
  { subtype: "manufacturer", alias: "producer" },
  { subtype: "manufacturer", alias: "factory" },
  { subtype: "manufacturer", alias: "maker" },
  { subtype: "manufacturer", alias: "product manufacturer" },

  { subtype: "wholesale", alias: "wholesale" },
  { subtype: "wholesale", alias: "wholesaler" },
  { subtype: "wholesale", alias: "bulk supplier" },
  { subtype: "wholesale", alias: "distributor" },

  { subtype: "local_artisan", alias: "artisan" },
  { subtype: "local_artisan", alias: "craftsperson" },
  { subtype: "local_artisan", alias: "craft maker" },
  { subtype: "local_artisan", alias: "handcraft" },
  { subtype: "local_artisan", alias: "handmade" },
  { subtype: "local_artisan", alias: "local artisan" },

  { subtype: "exporter", alias: "exporter" },
  { subtype: "exporter", alias: "export" },
  { subtype: "exporter", alias: "export business" },
  { subtype: "exporter", alias: "export company" },
  { subtype: "exporter", alias: "international trader" },

  { subtype: "motorbike_shop", alias: "motorbike" },
  { subtype: "motorbike_shop", alias: "motorbike shop" },
  { subtype: "motorbike_shop", alias: "motorcycle" },
  { subtype: "motorbike_shop", alias: "motorcycle shop" },
  { subtype: "motorbike_shop", alias: "bike shop" },
  { subtype: "motorbike_shop", alias: "moto shop" },
  { subtype: "motorbike_shop", alias: "scooter shop" },

  { subtype: "ecommerce", alias: "ecommerce" },
  { subtype: "ecommerce", alias: "e-commerce" },
  { subtype: "ecommerce", alias: "online retail" },
  { subtype: "ecommerce", alias: "online retailer" },
  { subtype: "ecommerce", alias: "online shop" },
  { subtype: "ecommerce", alias: "online store" },
  { subtype: "ecommerce", alias: "web shop" },
  { subtype: "ecommerce", alias: "web store" },
  { subtype: "ecommerce", alias: "internet shop" },

  { subtype: "product_brand", alias: "product brand" },
  { subtype: "product_brand", alias: "product-brand" },
  { subtype: "product_brand", alias: "brand" },
  { subtype: "product_brand", alias: "dtc" },
  { subtype: "product_brand", alias: "direct to consumer" },
  { subtype: "product_brand", alias: "direct-to-consumer" },
  { subtype: "product_brand", alias: "designer brand" },

  // ── Services ───────────────────────────────────────────────────────
  { subtype: "beauty", alias: "beauty" },
  { subtype: "beauty", alias: "cosmetics" },
  { subtype: "beauty", alias: "nail" },
  { subtype: "beauty", alias: "nails" },
  { subtype: "beauty", alias: "nail salon" },
  { subtype: "beauty", alias: "nail technician" },
  { subtype: "beauty", alias: "lash" },
  { subtype: "beauty", alias: "lashes" },
  { subtype: "beauty", alias: "brows" },
  { subtype: "beauty", alias: "makeup" },
  { subtype: "beauty", alias: "make up" },
  { subtype: "beauty", alias: "make-up artist" },
  { subtype: "beauty", alias: "mua" },
  { subtype: "beauty", alias: "aesthetician" },
  { subtype: "beauty", alias: "beautician" },

  { subtype: "health_wellness", alias: "health" },
  { subtype: "health_wellness", alias: "wellness" },
  { subtype: "health_wellness", alias: "health and wellness" },
  { subtype: "health_wellness", alias: "health & wellness" },
  { subtype: "health_wellness", alias: "spa" },
  { subtype: "health_wellness", alias: "massage" },
  { subtype: "health_wellness", alias: "acupuncture" },
  { subtype: "health_wellness", alias: "holistic" },
  { subtype: "health_wellness", alias: "alternative medicine" },
  { subtype: "health_wellness", alias: "physiotherapy" },
  { subtype: "health_wellness", alias: "physio" },
  { subtype: "health_wellness", alias: "chiropractor" },
  { subtype: "health_wellness", alias: "chiropractic" },

  { subtype: "home_services", alias: "home services" },
  { subtype: "home_services", alias: "cleaning" },
  { subtype: "home_services", alias: "cleaner" },
  { subtype: "home_services", alias: "housekeeping" },
  { subtype: "home_services", alias: "maid service" },
  { subtype: "home_services", alias: "handyman" },
  { subtype: "home_services", alias: "gardener" },
  { subtype: "home_services", alias: "gardening" },
  { subtype: "home_services", alias: "landscaping" },
  { subtype: "home_services", alias: "lawn care" },
  { subtype: "home_services", alias: "pest control" },
  { subtype: "home_services", alias: "local service" },
  { subtype: "home_services", alias: "local-service" },

  { subtype: "professional", alias: "professional" },
  { subtype: "professional", alias: "professional services" },
  { subtype: "professional", alias: "professional-service" },
  { subtype: "professional", alias: "lawyer" },
  { subtype: "professional", alias: "solicitor" },
  { subtype: "professional", alias: "accountant" },
  { subtype: "professional", alias: "financial advisor" },
  { subtype: "professional", alias: "financial adviser" },
  { subtype: "professional", alias: "insurance broker" },
  { subtype: "professional", alias: "doctor" },
  { subtype: "professional", alias: "dentist" },
  { subtype: "professional", alias: "notary" },

  { subtype: "trade_construction", alias: "trades" },
  { subtype: "trade_construction", alias: "trade" },
  { subtype: "trade_construction", alias: "trade & construction" },
  { subtype: "trade_construction", alias: "building trades" },
  { subtype: "trade_construction", alias: "other trade" },

  { subtype: "automotive", alias: "automotive" },
  { subtype: "automotive", alias: "garage" },
  { subtype: "automotive", alias: "mechanic" },
  { subtype: "automotive", alias: "car repair" },
  { subtype: "automotive", alias: "auto repair" },
  { subtype: "automotive", alias: "bodywork" },
  { subtype: "automotive", alias: "body shop" },
  { subtype: "automotive", alias: "panel beater" },

  { subtype: "events", alias: "event" },
  { subtype: "events", alias: "events" },
  { subtype: "events", alias: "event planner" },
  { subtype: "events", alias: "wedding planner" },
  { subtype: "events", alias: "party planner" },
  { subtype: "events", alias: "event hire" },
  { subtype: "events", alias: "event venue" },

  { subtype: "creative", alias: "creative" },
  { subtype: "creative", alias: "creative services" },
  { subtype: "creative", alias: "designer" },
  { subtype: "creative", alias: "graphic designer" },
  { subtype: "creative", alias: "illustrator" },
  { subtype: "creative", alias: "writer" },
  { subtype: "creative", alias: "copywriter" },
  { subtype: "creative", alias: "other creative service" },

  { subtype: "salon", alias: "salon" },
  { subtype: "salon", alias: "hair salon" },
  { subtype: "salon", alias: "hair" },
  { subtype: "salon", alias: "hairdresser" },
  { subtype: "salon", alias: "hairdressing" },
  { subtype: "salon", alias: "hairstylist" },
  { subtype: "salon", alias: "stylist" },
  { subtype: "salon", alias: "barber" },
  { subtype: "salon", alias: "barbers" },
  { subtype: "salon", alias: "barbershop" },
  { subtype: "salon", alias: "barber shop" },
  { subtype: "salon", alias: "blow dry" },
  { subtype: "salon", alias: "blowdry" },

  { subtype: "fitness", alias: "fitness" },
  { subtype: "fitness", alias: "gym" },
  { subtype: "fitness", alias: "gyms" },
  { subtype: "fitness", alias: "personal trainer" },
  { subtype: "fitness", alias: "personal training" },
  { subtype: "fitness", alias: "pt" },
  { subtype: "fitness", alias: "yoga" },
  { subtype: "fitness", alias: "yoga studio" },
  { subtype: "fitness", alias: "pilates" },
  { subtype: "fitness", alias: "pilates studio" },
  { subtype: "fitness", alias: "crossfit" },
  { subtype: "fitness", alias: "bootcamp" },
  { subtype: "fitness", alias: "boot camp" },
  { subtype: "fitness", alias: "spin studio" },

  { subtype: "tradesperson", alias: "tradesperson" },
  { subtype: "tradesperson", alias: "tradesman" },
  { subtype: "tradesperson", alias: "tradeswoman" },
  { subtype: "tradesperson", alias: "plumber" },
  { subtype: "tradesperson", alias: "plumbing" },
  { subtype: "tradesperson", alias: "electrician" },
  { subtype: "tradesperson", alias: "electrical" },
  { subtype: "tradesperson", alias: "carpenter" },
  { subtype: "tradesperson", alias: "carpentry" },
  { subtype: "tradesperson", alias: "joiner" },
  { subtype: "tradesperson", alias: "painter" },
  { subtype: "tradesperson", alias: "painter and decorator" },
  { subtype: "tradesperson", alias: "decorator" },
  { subtype: "tradesperson", alias: "tiler" },
  { subtype: "tradesperson", alias: "tiling" },
  { subtype: "tradesperson", alias: "plasterer" },

  { subtype: "construction", alias: "construction" },
  { subtype: "construction", alias: "builder" },
  { subtype: "construction", alias: "building contractor" },
  { subtype: "construction", alias: "general contractor" },
  { subtype: "construction", alias: "contractor" },
  { subtype: "construction", alias: "roofer" },
  { subtype: "construction", alias: "roofing" },
  { subtype: "construction", alias: "bricklayer" },
  { subtype: "construction", alias: "bricklaying" },

  { subtype: "staircase_company", alias: "staircase" },
  { subtype: "staircase_company", alias: "staircases" },
  { subtype: "staircase_company", alias: "staircase company" },
  { subtype: "staircase_company", alias: "staircase-company" },
  { subtype: "staircase_company", alias: "staircase maker" },
  { subtype: "staircase_company", alias: "staircase manufacturer" },
  { subtype: "staircase_company", alias: "stair builder" },
  { subtype: "staircase_company", alias: "stairs" },

  { subtype: "consultant", alias: "consultant" },
  { subtype: "consultant", alias: "consulting" },
  { subtype: "consultant", alias: "business advisor" },
  { subtype: "consultant", alias: "business adviser" },
  { subtype: "consultant", alias: "strategy consultant" },
  { subtype: "consultant", alias: "management consultant" },
  { subtype: "consultant", alias: "independent consultant" },

  { subtype: "agency", alias: "agency" },
  { subtype: "agency", alias: "agencies" },
  { subtype: "agency", alias: "marketing agency" },
  { subtype: "agency", alias: "pr agency" },
  { subtype: "agency", alias: "advertising agency" },
  { subtype: "agency", alias: "creative agency" },
  { subtype: "agency", alias: "digital agency" },
  { subtype: "agency", alias: "web agency" },

  { subtype: "portfolio", alias: "portfolio" },
  { subtype: "portfolio", alias: "photographer" },
  { subtype: "portfolio", alias: "photography" },
  { subtype: "portfolio", alias: "videographer" },
  { subtype: "portfolio", alias: "artist" },
  { subtype: "portfolio", alias: "painter" }, // artist · distinct from decorator
  { subtype: "portfolio", alias: "sculptor" },
  { subtype: "portfolio", alias: "visual artist" },

  { subtype: "creator", alias: "creator" },
  { subtype: "creator", alias: "content creator" },
  { subtype: "creator", alias: "digital content creator" },
  { subtype: "creator", alias: "youtuber" },
  { subtype: "creator", alias: "influencer" },
  { subtype: "creator", alias: "podcaster" },
  { subtype: "creator", alias: "podcast" },
  { subtype: "creator", alias: "streamer" },
  { subtype: "creator", alias: "tiktoker" },

  { subtype: "community", alias: "community" },
  { subtype: "community", alias: "community group" },
  { subtype: "community", alias: "non-profit" },
  { subtype: "community", alias: "non profit" },
  { subtype: "community", alias: "nonprofit" },
  { subtype: "community", alias: "charity" },
  { subtype: "community", alias: "charitable" },
  { subtype: "community", alias: "meetup" },
  { subtype: "community", alias: "club" },
  { subtype: "community", alias: "society" },
];

/** Lowercased · normalised copy of the English alias table. All
 *  callers go through `searchSubtypes`; this is exposed for tests
 *  and future locale-stacking. */
export const ALIAS_TABLE: ReadonlyArray<SubtypeAlias> = normaliseTable(ALIASES_EN);

function normaliseTable(
  table: ReadonlyArray<SubtypeAlias>,
): ReadonlyArray<SubtypeAlias> {
  return table.map((e) => ({
    subtype: e.subtype,
    alias: e.alias.toLowerCase().trim(),
  }));
}

/** Normalise a query the same way the alias table is normalised ·
 *  lowercases, trims, collapses whitespace. */
function normaliseQuery(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, " ");
}

export interface SubtypeSearchHit {
  readonly subtype: BusinessSubtype;
  readonly label: string;
  readonly category: BusinessCategory;
  readonly matchedAlias: string;
  /** 0 (worst) .. 1 (best) match score. */
  readonly score: number;
}

/** Search the alias table for matches to a free-text query.
 *
 *  Ranking:
 *    1.00 · exact alias match
 *    0.90 · alias starts with the full query word(s)
 *    0.75 · alias contains the query as a word boundary
 *    0.50 · alias substring-contains the query
 *    0.40 · query contains the alias as a word boundary (seller
 *            typed MORE than the canonical term · "an ice cream
 *            shop in Dublin" matches "ice cream shop")
 *
 *  Results are deduplicated by subtype (only the top-scoring hit
 *  per subtype survives) and sorted highest-score first. Ties break
 *  on alphabetical subtype slug so results are deterministic. */
export function searchSubtypes(
  query: string,
  options: { readonly limit?: number } = {},
): ReadonlyArray<SubtypeSearchHit> {
  const q = normaliseQuery(query);
  if (q.length === 0) return [];

  const bySubtype = new Map<BusinessSubtype, SubtypeSearchHit>();
  for (const entry of ALIAS_TABLE) {
    const a = entry.alias;
    let score = 0;
    if (a === q) {
      score = 1.0;
    } else if (a.startsWith(q + " ") || a.startsWith(q + "-")) {
      score = 0.9;
    } else if (
      a === q ||
      a.includes(` ${q} `) ||
      a.includes(` ${q}-`) ||
      a.endsWith(` ${q}`) ||
      a.endsWith(`-${q}`)
    ) {
      score = 0.75;
    } else if (a.includes(q)) {
      score = 0.5;
    } else if (
      q.includes(` ${a} `) ||
      q.startsWith(`${a} `) ||
      q.endsWith(` ${a}`)
    ) {
      score = 0.4;
    }
    if (score === 0) continue;
    const prior = bySubtype.get(entry.subtype);
    if (!prior || score > prior.score) {
      bySubtype.set(entry.subtype, {
        subtype: entry.subtype,
        label: BUSINESS_SUBTYPE_LABEL[entry.subtype],
        category: BUSINESS_SUBTYPE_CATEGORY[entry.subtype],
        matchedAlias: entry.alias,
        score,
      });
    }
  }

  const ranked = [...bySubtype.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.subtype.localeCompare(b.subtype);
  });
  const limit = options.limit ?? ranked.length;
  return ranked.slice(0, Math.max(0, limit));
}

/** Count of distinct aliases per subtype · used by registry integrity
 *  tests to catch subtypes that have no alias coverage at all. */
export function aliasCountBySubtype(): Record<BusinessSubtype, number> {
  const counts = Object.create(null) as Record<BusinessSubtype, number>;
  for (const entry of ALIAS_TABLE) {
    counts[entry.subtype] = (counts[entry.subtype] ?? 0) + 1;
  }
  return counts;
}
