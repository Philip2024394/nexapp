// src/lib/nex-native/watch-catalog/watch-vocabularies.ts
//
// Shared watch vocabularies · owner directive 2026-10-26 (R3g).
// Covers watch type, movement, display, case, strap, crystal,
// condition, authenticity, bezel, dial, hand style, case finish,
// materials, water-resistance ratings, seller type, availability.
//
// All lists are `readonly [key, label] tuples` so the UI binds to a
// single source of truth and the keys are stable for database writes
// when `nex_watch_listing` lands.
//
// Keep in sync with the DRAFT doctrine at
// `docs/doctrine/nex-shop-watches-upload-draft-2026-10-26.md`.

export type Option<K extends string> = readonly [K, string];

// ─── Watch type (visual / use-case category) ───────────────────────
export type WatchType =
  | "dress" | "casual" | "dive" | "pilot" | "field"
  | "racing" | "fashion" | "sports" | "smartwatch";
export const WATCH_TYPES: readonly Option<WatchType>[] = [
  ["dress", "Dress"],
  ["casual", "Casual"],
  ["dive", "Dive"],
  ["pilot", "Pilot"],
  ["field", "Field"],
  ["racing", "Racing"],
  ["fashion", "Fashion"],
  ["sports", "Sports"],
  ["smartwatch", "Smartwatch"],
];

// ─── Movement type (what powers the watch) ─────────────────────────
export type MovementType =
  | "manual" | "automatic" | "quartz-battery" | "digital"
  | "hybrid" | "smartwatch" | "solar-quartz" | "spring-drive"
  | "mecaquartz" | "on-request";
export const MOVEMENT_TYPES: readonly Option<MovementType>[] = [
  ["manual", "Manual-wind (mechanical)"],
  ["automatic", "Automatic (mechanical)"],
  ["quartz-battery", "Quartz · battery"],
  ["solar-quartz", "Solar quartz"],
  ["spring-drive", "Spring Drive"],
  ["mecaquartz", "Meca-quartz"],
  ["digital", "Digital"],
  ["hybrid", "Hybrid (analogue + digital)"],
  ["smartwatch", "Smartwatch"],
  ["on-request", "On Request"],
];

/** Which movement groups should REVEAL which optional field blocks on
 *  the upload form. Owner directive 2026-10-26 (R3g) · "do not
 *  require mechanical-only fields for a quartz watch or smartwatch." */
export const MECHANICAL_MOVEMENTS: readonly MovementType[] = [
  "manual", "automatic", "spring-drive",
];
export const QUARTZ_MOVEMENTS: readonly MovementType[] = [
  "quartz-battery", "solar-quartz", "mecaquartz",
];
export const DIGITAL_MOVEMENTS: readonly MovementType[] = [
  "digital", "smartwatch", "hybrid",
];

// ─── Power source ──────────────────────────────────────────────────
export type PowerSource =
  | "mainspring" | "disposable-battery" | "rechargeable" | "solar-light";
export const POWER_SOURCES: readonly Option<PowerSource>[] = [
  ["mainspring", "Mainspring"],
  ["disposable-battery", "Disposable battery"],
  ["rechargeable", "Rechargeable cell"],
  ["solar-light", "Solar / light"],
];

// ─── Display type ──────────────────────────────────────────────────
export type DisplayType = "analogue" | "digital" | "hybrid";
export const DISPLAY_TYPES: readonly Option<DisplayType>[] = [
  ["analogue", "Analogue"],
  ["digital", "Digital"],
  ["hybrid", "Hybrid"],
];

// ─── Case shape ────────────────────────────────────────────────────
export type CaseShape =
  | "round" | "square" | "rectangular" | "tonneau" | "oval" | "cushion" | "other";
export const CASE_SHAPES: readonly Option<CaseShape>[] = [
  ["round", "Round"],
  ["square", "Square"],
  ["rectangular", "Rectangular"],
  ["tonneau", "Tonneau"],
  ["oval", "Oval"],
  ["cushion", "Cushion"],
  ["other", "Other"],
];

// ─── Crystal material ──────────────────────────────────────────────
export type CrystalMaterial =
  | "sapphire" | "mineral" | "acrylic" | "other";
export const CRYSTAL_MATERIALS: readonly Option<CrystalMaterial>[] = [
  ["sapphire", "Sapphire"],
  ["mineral", "Mineral"],
  ["acrylic", "Acrylic / plexiglas"],
  ["other", "Other"],
];

// ─── Strap / bracelet material ─────────────────────────────────────
export type StrapMaterial =
  | "leather" | "steel-bracelet" | "titanium-bracelet" | "silicone"
  | "rubber" | "fabric" | "nato" | "mesh" | "integrated-gold"
  | "integrated-ceramic" | "paracord" | "velcro" | "other";
export const STRAP_MATERIALS: readonly Option<StrapMaterial>[] = [
  ["leather", "Leather"],
  ["steel-bracelet", "Steel bracelet"],
  ["titanium-bracelet", "Titanium bracelet"],
  ["silicone", "Silicone"],
  ["rubber", "Rubber"],
  ["fabric", "Fabric"],
  ["nato", "NATO"],
  ["mesh", "Mesh / milanese"],
  ["integrated-gold", "Integrated gold"],
  ["integrated-ceramic", "Integrated ceramic"],
  ["paracord", "Paracord"],
  ["velcro", "Velcro"],
  ["other", "Other"],
];

// ─── Clasp / closure ───────────────────────────────────────────────
export type ClaspType =
  | "pin-buckle" | "deployment" | "butterfly" | "fold-over"
  | "magnetic" | "slide-through" | "velcro-closure" | "pin-and-tuck"
  | "other";
export const CLASP_TYPES: readonly Option<ClaspType>[] = [
  ["pin-buckle", "Pin buckle"],
  ["deployment", "Deployment clasp"],
  ["butterfly", "Butterfly clasp"],
  ["fold-over", "Fold-over clasp"],
  ["magnetic", "Magnetic closure"],
  ["slide-through", "Slide-through"],
  ["velcro-closure", "Velcro closure"],
  ["pin-and-tuck", "Pin and tuck"],
  ["other", "Other"],
];

// ─── Condition ─────────────────────────────────────────────────────
export type Condition =
  | "new" | "unworn" | "pre-owned" | "refurbished" | "for-parts" | "on-request";
export const CONDITIONS: readonly Option<Condition>[] = [
  ["new", "New"],
  ["unworn", "Unworn"],
  ["pre-owned", "Pre-owned"],
  ["refurbished", "Refurbished"],
  ["for-parts", "For parts"],
  ["on-request", "On Request"],
];

// ─── Strap interchangeability ──────────────────────────────────────
export type StrapInterchangeability =
  | "standard-spring-bar" | "quick-release" | "integrated" | "proprietary";
export const STRAP_INTERCHANGEABILITIES: readonly Option<StrapInterchangeability>[] = [
  ["standard-spring-bar", "Standard spring bar"],
  ["quick-release", "Quick-release"],
  ["integrated", "Integrated"],
  ["proprietary", "Proprietary"],
];

// ─── Lug type ──────────────────────────────────────────────────────
export type LugType = "straight" | "curved" | "integrated" | "proprietary";
export const LUG_TYPES: readonly Option<LugType>[] = [
  ["straight", "Straight"],
  ["curved", "Curved"],
  ["integrated", "Integrated"],
  ["proprietary", "Proprietary"],
];

// ─── Crown position ────────────────────────────────────────────────
export type CrownPosition = "3-oclock" | "4-oclock" | "9-oclock" | "other";
export const CROWN_POSITIONS: readonly Option<CrownPosition>[] = [
  ["3-oclock", "3 o'clock"],
  ["4-oclock", "4 o'clock"],
  ["9-oclock", "9 o'clock (left-handed)"],
  ["other", "Other"],
];

// ─── Case size category ────────────────────────────────────────────
export type CaseSizeCategory = "small" | "medium" | "large" | "oversized";
export const CASE_SIZE_CATEGORIES: readonly Option<CaseSizeCategory>[] = [
  ["small", "Small (< 38 mm)"],
  ["medium", "Medium (38–42 mm)"],
  ["large", "Large (42–46 mm)"],
  ["oversized", "Oversized (> 46 mm)"],
];

// ─── Bezel style ───────────────────────────────────────────────────
export type BezelStyle =
  | "fixed" | "rotating-uni" | "rotating-bi" | "smooth"
  | "fluted" | "tachymeter" | "dive-scale" | "gmt-scale"
  | "slide-rule" | "gem-set";
export const BEZEL_STYLES: readonly Option<BezelStyle>[] = [
  ["fixed", "Fixed"],
  ["rotating-uni", "Rotating · unidirectional"],
  ["rotating-bi", "Rotating · bidirectional"],
  ["smooth", "Smooth"],
  ["fluted", "Fluted"],
  ["tachymeter", "Tachymeter"],
  ["dive-scale", "Dive scale"],
  ["gmt-scale", "GMT scale"],
  ["slide-rule", "Slide-rule"],
  ["gem-set", "Gem-set"],
];

// ─── Dial finish ───────────────────────────────────────────────────
export type DialFinish =
  | "matte" | "sunburst" | "sunray" | "enamel" | "lacquer"
  | "skeleton" | "open-heart" | "guilloche" | "mother-of-pearl" | "textured";
export const DIAL_FINISHES: readonly Option<DialFinish>[] = [
  ["matte", "Matte"],
  ["sunburst", "Sunburst"],
  ["sunray", "Sunray"],
  ["enamel", "Enamel"],
  ["lacquer", "Lacquer"],
  ["skeleton", "Skeleton"],
  ["open-heart", "Open-heart"],
  ["guilloche", "Guilloché"],
  ["mother-of-pearl", "Mother-of-pearl"],
  ["textured", "Textured"],
];

// ─── Hand style ────────────────────────────────────────────────────
export type HandStyle =
  | "baton" | "dauphine" | "sword" | "syringe" | "leaf"
  | "cathedral" | "mercedes" | "snowflake" | "digital-display";
export const HAND_STYLES: readonly Option<HandStyle>[] = [
  ["baton", "Baton"],
  ["dauphine", "Dauphine"],
  ["sword", "Sword"],
  ["syringe", "Syringe"],
  ["leaf", "Leaf"],
  ["cathedral", "Cathedral"],
  ["mercedes", "Mercedes"],
  ["snowflake", "Snowflake"],
  ["digital-display", "Digital display"],
];

// ─── Case finish ───────────────────────────────────────────────────
export type CaseFinish =
  | "polished" | "brushed" | "matte" | "bead-blasted" | "mixed";
export const CASE_FINISHES: readonly Option<CaseFinish>[] = [
  ["polished", "Polished"],
  ["brushed", "Brushed"],
  ["matte", "Matte"],
  ["bead-blasted", "Bead-blasted"],
  ["mixed", "Mixed"],
];

// ─── Style audience ────────────────────────────────────────────────
export type StyleAudience =
  | "classic" | "minimalist" | "vintage" | "modern" | "luxury"
  | "sport" | "mens" | "womens" | "unisex";
export const STYLE_AUDIENCES: readonly Option<StyleAudience>[] = [
  ["classic", "Classic"],
  ["minimalist", "Minimalist"],
  ["vintage", "Vintage"],
  ["modern", "Modern"],
  ["luxury", "Luxury"],
  ["sport", "Sport"],
  ["mens", "Men's"],
  ["womens", "Women's"],
  ["unisex", "Unisex"],
];

// ─── Case material categories ─────────────────────────────────────
export type CaseMaterialCategory =
  | "stainless-steel" | "316l-steel" | "titanium" | "ceramic"
  | "gold-solid" | "gold-plated" | "pvd-coated" | "platinum"
  | "bronze" | "carbon" | "resin" | "other";
export const CASE_MATERIAL_CATEGORIES: readonly Option<CaseMaterialCategory>[] = [
  ["stainless-steel", "Stainless steel"],
  ["316l-steel", "316L steel"],
  ["titanium", "Titanium"],
  ["ceramic", "Ceramic"],
  ["gold-solid", "Solid gold"],
  ["gold-plated", "Gold-plated / gold-tone"],
  ["pvd-coated", "PVD coated"],
  ["platinum", "Platinum"],
  ["bronze", "Bronze"],
  ["carbon", "Carbon composite"],
  ["resin", "Resin"],
  ["other", "Other"],
];

// ─── Gold karat ────────────────────────────────────────────────────
export type GoldKarat = "9k" | "14k" | "18k" | "22k" | "24k";
export const GOLD_KARATS: readonly Option<GoldKarat>[] = [
  ["9k", "9 ct"],
  ["14k", "14 ct"],
  ["18k", "18 ct"],
  ["22k", "22 ct"],
  ["24k", "24 ct"],
];

// ─── Water resistance (manufacturer-rated, NOT a swim claim) ───────
export type WaterResistance =
  | "not-rated" | "30m-3bar" | "50m-5bar" | "100m-10bar"
  | "200m-20bar" | "300m-30bar" | "500m-50bar" | "1000m-100bar";
export const WATER_RESISTANCE_RATINGS: readonly Option<WaterResistance>[] = [
  ["not-rated", "Not rated"],
  ["30m-3bar", "30 m / 3 bar"],
  ["50m-5bar", "50 m / 5 bar"],
  ["100m-10bar", "100 m / 10 bar"],
  ["200m-20bar", "200 m / 20 bar"],
  ["300m-30bar", "300 m / 30 bar"],
  ["500m-50bar", "500 m / 50 bar"],
  ["1000m-100bar", "1000 m / 100 bar"],
];

// ─── Authenticity ──────────────────────────────────────────────────
export type Authenticity =
  | "original-brand" | "original-brand-service-pending"
  | "homage-disclosed" | "replica-disclosed" | "on-request";
export const AUTHENTICITY_OPTIONS: readonly Option<Authenticity>[] = [
  ["original-brand", "Original · brand-authenticated"],
  ["original-brand-service-pending", "Original · service pending"],
  ["homage-disclosed", "Homage · disclosed"],
  ["replica-disclosed", "Replica · disclosed"],
  ["on-request", "On Request"],
];

// ─── Seller type ───────────────────────────────────────────────────
export type SellerType =
  | "brand" | "authorised-dealer" | "independent-retailer" | "private-seller";
export const SELLER_TYPES: readonly Option<SellerType>[] = [
  ["brand", "Brand"],
  ["authorised-dealer", "Authorised dealer"],
  ["independent-retailer", "Independent retailer"],
  ["private-seller", "Private seller"],
];

// ─── Availability ──────────────────────────────────────────────────
export type Availability = "in-stock" | "made-to-order" | "sold" | "on-hold";
export const AVAILABILITY_OPTIONS: readonly Option<Availability>[] = [
  ["in-stock", "In stock"],
  ["made-to-order", "Made to order"],
  ["on-hold", "On hold"],
  ["sold", "Sold"],
];

// ─── Shipping scope ────────────────────────────────────────────────
export type ShippingScope = "local" | "domestic" | "export" | "pickup-only";
export const SHIPPING_SCOPES: readonly Option<ShippingScope>[] = [
  ["local", "Local"],
  ["domestic", "Domestic"],
  ["export", "Export (international)"],
  ["pickup-only", "Pickup only"],
];

// ─── Pricing mode ──────────────────────────────────────────────────
export type PricingMode = "retail" | "wholesale" | "trade-in";
export const PRICING_MODES: readonly Option<PricingMode>[] = [
  ["retail", "Retail"],
  ["wholesale", "Wholesale"],
  ["trade-in", "Trade-in"],
];

// ─── Packaging / "What's included" ─────────────────────────────────
export type PackagingItem =
  | "box" | "papers" | "warranty-card" | "receipt" | "service-card"
  | "manual" | "spare-link" | "charger" | "extra-strap" | "none";
export const PACKAGING_ITEMS: readonly Option<PackagingItem>[] = [
  ["box", "Original box"],
  ["papers", "Papers"],
  ["warranty-card", "Warranty card"],
  ["receipt", "Original receipt"],
  ["service-card", "Service card"],
  ["manual", "Manual"],
  ["spare-link", "Spare link(s)"],
  ["charger", "Charger / dock"],
  ["extra-strap", "Extra strap"],
  ["none", "None"],
];
