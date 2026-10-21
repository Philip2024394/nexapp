// src/app/nex-native/chat-themes-library/marketplace-prototype/_catalog.ts
//
// NEX Themes Marketplace · PROTOTYPE catalog.
// Owner-authorised 2026-10-21 (Marketplace Prototype build).
// -----------------------------------------------------------------------------
// Static prototype catalog that pairs:
//   · theme id            (matches sealed chat-standard package ids)
//   · theme display name
//   · wallpaper hero url  (sealed asset in public/nex-themes/)
//   · intro status        (present | scripted-fallback-only)
//   · intro video url     (null when no video asset)
//
// NO PRICES ARE DECLARED. The prototype never displays or commits a
// price. Every product renders with a "Price TBD" chip until the
// owner approves prices in `pricing-config.ts` per the LOCKED pricing
// discipline.
//
// Catalog data is derived from the verification report of 2026-10-21:
// 13 themes with intros + 6 themes with scripted-only fallbacks. The
// sealed `chat-standard/packages/*.package.ts` files remain the
// authoritative source of truth for the live theme engine; this
// prototype catalog is for VISUAL DEMONSTRATION only and does not
// modify the sealed data.

export interface MarketplaceCatalogEntry {
  readonly themeId: string;
  readonly displayName: string;
  readonly wallpaperUrl: string;
  readonly hasVideoIntro: boolean;
  /** null when the theme uses a scripted-animation fallback */
  readonly introVideoUrl: string | null;
  /** short descriptor shown under the theme name */
  readonly subtitle: string;
  /** Owner directive 2026-10-21 · per-theme bubble accent · tints
   *  both peer + self chat bubbles when the Theme preview sheet
   *  opens. Hex `#RRGGBB`. */
  readonly accentHex: string;
  /** Optional per-side bubble overrides so a theme can give the
   *  OWNER (business, self side) a different hex than the CUSTOMER
   *  (visitor, peer side). Falls back to `accentHex` on either
   *  side if not provided. */
  readonly ownerAccentHex?: string;
  readonly customerAccentHex?: string;
  /** Optional dedicated colour for the sender-name chip (e.g. the
   *  "Crispy Chicken" label on the peer bubble). Defaults to
   *  `ownerAccentHex`. Lets a theme put the business name in a
   *  neutral colour (black / white) when the brand accent would
   *  otherwise clash with the bubble glass. */
  readonly senderNameHex?: string;
  /** Optional bubble-rim thickness in px. Defaults to 1px (matches
   *  the sealed free-chat pattern). Set to 2+ for themes whose
   *  brand reads better with a chunkier outline (e.g. Crispy
   *  Chicken's dark red rim). */
  readonly rimPx?: number;
  /** Business owner's NEX identity · rendered as the chat header
   *  subtitle in place of a generic "Online" string. Format
   *  convention `-NNNNN`. Prototype values. */
  readonly nexId?: string;
  /** When true, the chat header ping animation runs (stronger
   *  double-wave pulse). When false, the avatar is static · reads
   *  as an offline owner. Defaults to true for prototype entries. */
  readonly online?: boolean;
  /** Opening-hours badge shown on the Intro preview footer. Short
   *  phrase, prototype values. Example: `"Open · 11:00 – 22:00"`. */
  readonly hours?: string;
  /** City / location shown as the third line of the Intro preview
   *  hero overlay (Welcome / Business / Location). Prototype
   *  mock value. */
  readonly location?: string;
}

/** The 11 cover-theme layout IDs from `cover/layout-ids.ts`. Mirrored
 *  here so the Shop preview sheet can render options without
 *  importing from a server-side module. The sealed layout-ids are
 *  the authoritative source · this is for prototype display only. */
export interface ShopLayoutEntry {
  readonly layoutId: string;
  readonly label: string;
  readonly blurb: string;
}

export const SHOP_LAYOUTS: readonly ShopLayoutEntry[] = [
  { layoutId: "cafe", label: "Café", blurb: "Portrait hero · products grid · Visit Us panel" },
  { layoutId: "cafe_landscape", label: "Café · Landscape", blurb: "Landscape product cards" },
  { layoutId: "cafe_round", label: "Café · Round", blurb: "Café identity with round product tiles" },
  { layoutId: "product", label: "Product Seller", blurb: "Portrait-first product-led shop" },
  { layoutId: "product_landscape", label: "Product · Landscape", blurb: "Wide product cards" },
  { layoutId: "product_round", label: "Product · Round", blurb: "Product shop with round tiles" },
  { layoutId: "product_landscape_round", label: "Product · Wide Round", blurb: "Landscape + round product tiles" },
  { layoutId: "personal_brand", label: "Personal Brand", blurb: "Hero portrait · about · signature line" },
  { layoutId: "personal_brand_landscape", label: "Personal Brand · Landscape", blurb: "Wide portrait layout" },
  { layoutId: "personal_brand_round", label: "Personal Brand · Round", blurb: "Portrait with round offer tiles" },
  { layoutId: "accommodation", label: "Accommodation", blurb: "Room gallery · amenities · booking" },
];

export const MARKETPLACE_CATALOG: readonly MarketplaceCatalogEntry[] = [
  {
    themeId: "crispy-chicken",
    displayName: "Crispy Chicken",
    wallpaperUrl: "/nex-themes/crispy-chicken-wallpaper.png",
    hasVideoIntro: true,
    introVideoUrl: "/nex-themes/crispy-chicken-intro.mp4",
    subtitle: "Warm gold · food · casual dining",
    accentHex: "#D4A24C",
    // Owner directive 2026-10-21 · Crispy Chicken bubble pairing ·
    // OWNER bubble is red glass (theme colour) · CUSTOMER bubble is
    // white glass. Business-name chip is BLACK · reads as sharp
    // signage over the red glass.
    ownerAccentHex: "#8B1A1A",
    customerAccentHex: "#FFFFFF",
    senderNameHex: "#000000",
    rimPx: 2,
    nexId: "-37123",
    online: true,
    hours: "Open daily · 11:00 – 22:00 · Dine-in · Takeaway",
    location: "New York",
  },
  // Owner directive 2026-10-21 (iteration · universal bubble pairing)
  // · every theme follows the same shape:
  //     owner bubble    = theme accent (brand hue)
  //     customer bubble = white glass
  //     sender chip     = black
  //     rim             = 2px chunky
  // Each theme's own `accentHex` is the brand hue · it is passed into
  // `ownerAccentHex` so the owner bubble reads in-brand. Customer +
  // sender + rim are universal across the catalogue.
  {
    themeId: "pink-dream",
    displayName: "Pink Dream",
    wallpaperUrl: "/nex-themes/pink-dream.png",
    hasVideoIntro: true,
    introVideoUrl: "/nex-themes/pink-dream-intro.mp4",
    subtitle: "Soft pastel · dreamy · personal",
    accentHex: "#FF4FD7",
    ownerAccentHex: "#FF4FD7",
    customerAccentHex: "#FFFFFF",
    // Pink Dream · sender-name chip reads as deep rose · darker +
    // more saturated than the brand hue so it stands apart on the
    // pink glass bubble.
    senderNameHex: "#B01B4D",
    rimPx: 2,
    nexId: "-48291",
    online: true,
    hours: "Tue – Sun · 10:00 – 20:00 · Mon closed",
    location: "Paris",
  },
  {
    themeId: "hollywood",
    displayName: "Hollywood",
    wallpaperUrl: "/nex-themes/hollywood-wallpaper.png",
    hasVideoIntro: true,
    introVideoUrl: "/nex-themes/hollywood-intro.mp4",
    subtitle: "Cinematic · glamour · gold",
    accentHex: "#D4AF37",
    ownerAccentHex: "#D4AF37",
    customerAccentHex: "#FFFFFF",
    // Dark gold · deeper than the brand hue · reads as premium gilt
    // signage over the gold glass.
    senderNameHex: "#8B6914",
    rimPx: 2,
    nexId: "-52904",
    online: true,
    hours: "Thu – Sun · 19:00 – 02:00 · Ages 21+",
    location: "Los Angeles",
  },
  {
    themeId: "pizza",
    displayName: "Pizza",
    wallpaperUrl: "/nex-themes/pizza-wallpaper.png",
    hasVideoIntro: true,
    introVideoUrl: "/nex-themes/pizza-intro.mp4",
    subtitle: "Red · wood · hearth food",
    accentHex: "#D14C4C",
    ownerAccentHex: "#D14C4C",
    customerAccentHex: "#FFFFFF",
    senderNameHex: "#8B0000",
    rimPx: 2,
    nexId: "-61832",
    online: true,
    hours: "Open daily · 11:00 – 23:00 · Delivery available",
    location: "Rome",
  },
  {
    themeId: "food",
    displayName: "Grill House",
    wallpaperUrl: "/nex-themes/food-grill.png",
    hasVideoIntro: true,
    introVideoUrl: "/nex-themes/food-intro.mp4",
    subtitle: "Grill · smoke · hearty",
    accentHex: "#B36A2E",
    ownerAccentHex: "#B36A2E",
    customerAccentHex: "#FFFFFF",
    senderNameHex: "#5C3A1A",
    rimPx: 2,
    nexId: "-39475",
    online: false,
    hours: "Closed now · opens today 17:00 – 23:00",
    location: "Chicago",
  },
  {
    themeId: "lulu",
    displayName: "Lulu",
    wallpaperUrl: "/nex-themes/lulu-wallpaper.png",
    hasVideoIntro: true,
    introVideoUrl: "/nex-themes/lulu-intro.mp4",
    subtitle: "Floral · soft · boutique",
    accentHex: "#F4A6C9",
    ownerAccentHex: "#F4A6C9",
    customerAccentHex: "#FFFFFF",
    senderNameHex: "#8B4A5A",
    rimPx: 2,
    nexId: "-72638",
    online: true,
    hours: "Mon – Sat · 09:00 – 19:00 · Sun by request",
    location: "London",
  },
  {
    themeId: "property1",
    displayName: "Property 1",
    wallpaperUrl: "/nex-themes/property1-wallpaper.png",
    hasVideoIntro: true,
    introVideoUrl: "/nex-themes/property1-intro.mp4",
    subtitle: "Real estate · modern · trust",
    accentHex: "#0E7490",
    ownerAccentHex: "#0E7490",
    customerAccentHex: "#FFFFFF",
    senderNameHex: "#0A4A5F",
    rimPx: 2,
    nexId: "-14093",
    online: true,
    hours: "Mon – Fri · By appointment · Virtual tours available",
    location: "Jakarta",
  },
  {
    themeId: "ac-service",
    displayName: "AC Service",
    wallpaperUrl: "/nex-themes/ac-service-wallpaper.png",
    hasVideoIntro: true,
    introVideoUrl: "/nex-themes/ac-service-intro.mp4",
    subtitle: "Service · technical · trusted",
    accentHex: "#0EA5E9",
    ownerAccentHex: "#0EA5E9",
    customerAccentHex: "#FFFFFF",
    senderNameHex: "#075985",
    rimPx: 2,
    nexId: "-58731",
    online: false,
    hours: "Closed now · opens Mon 08:00 – 18:00 · 24/7 emergency",
    location: "Singapore",
  },
  {
    themeId: "bike-rental",
    displayName: "Bike Rental",
    wallpaperUrl: "/nex-themes/bike-rental-wallpaper.png",
    hasVideoIntro: true,
    introVideoUrl: "/nex-themes/bike-rental-intro.mp4",
    subtitle: "Motion · rental · adventure",
    accentHex: "#F97316",
    ownerAccentHex: "#F97316",
    customerAccentHex: "#FFFFFF",
    senderNameHex: "#9A3412",
    rimPx: 2,
    nexId: "-29405",
    online: true,
    hours: "Open daily · 08:00 – 20:00 · Half-day · Full-day · Weekly",
    location: "Bali",
  },
  {
    themeId: "teddy-play",
    displayName: "Teddy Play",
    hasVideoIntro: true,
    introVideoUrl: "/nex-themes/teddy-play-intro.mp4",
    wallpaperUrl: "/nex-themes/crispy-chicken-wallpaper.png",
    subtitle: "Playful · toys · childcare",
    accentHex: "#FBBF24",
    ownerAccentHex: "#FBBF24",
    customerAccentHex: "#FFFFFF",
    senderNameHex: "#92400E",
    rimPx: 2,
    nexId: "-83162",
    online: true,
    hours: "Mon – Sat · 09:00 – 18:00 · Ages 2 – 8 · Drop-in",
    location: "Tokyo",
  },
];
