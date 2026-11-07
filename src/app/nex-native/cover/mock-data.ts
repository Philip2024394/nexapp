// src/app/nex-native/_cover/mock-data.ts
//
// Mock content used by every layout preview so the 10 covers can be
// judged on their COMPOSITION under one theme rather than on content
// variation. Same peer, same products, same social — different layout.

import type { CoverProduct, CoverSection, CoverSocialLinks } from "./primitives";
import type { NexInfoPagesJson } from "@/lib/nex-native/info-pages";
import type { WeeklyHours } from "./_composer/CoverInfoTray";
import {
  GLOBAL_DEFAULT_TERMINOLOGY,
  type NexTerminology,
} from "@/lib/nex-native/terminology";

/** Small helper · returns the resolved terminology for a content
 *  bundle, falling back to GLOBAL_DEFAULT_TERMINOLOGY when the content
 *  bundle didn't carry one (mock previews that predate Phase 2 · or
 *  real businesses without a profession). Layouts call this at the top
 *  of each function and read t.catalog_heading, t.section_about_label,
 *  t.section_location_label directly. */
export function terminologyForContent(
  content: { terminology?: NexTerminology },
): NexTerminology {
  return content.terminology ?? GLOBAL_DEFAULT_TERMINOLOGY;
}

export interface MockCoverContent {
  businessName: string;
  tagline: string;
  handle: string;
  location: string;
  portraitUrl: string;
  ownerAccountId: string;
  presenceOnline: boolean;
  social: CoverSocialLinks;
  sections: CoverSection[];
  /** Founder direction 2026-09-30 · ISO 3166-1 alpha-2 · renders a
   *  small round flag badge on the portrait circle instead of the
   *  theme charm. Optional · omit for no flag. */
  countryCode?: string | null;
  /** Founder direction 2026-09-30 · seller-configurable eyebrow +
   *  title for the primary catalog section. Both optional · fall back
   *  to sensible defaults ("Services" / resolved shipping scope) when
   *  omitted. A future settings surface will persist per-business
   *  overrides on nex_business.
   *
   *  When shippingScope is set and sectionTitle is NOT, the layout
   *  resolves NEX_SHIPPING_SCOPE_META[shippingScope].label (e.g.
   *  "Local Delivery" / "Local Delivery / Export") as the visible
   *  heading. sectionTitle wins if both are present. */
  sectionEyebrow?: string | null;
  sectionTitle?: string | null;
  /** Migration 108 · nex_business.shipping_scope value. Optional. */
  shippingScope?:
    | "local_delivery"
    | "local_and_export"
    | "international_only"
    | "pickup_only"
    | "dine_in"
    | "digital"
    | null;
  /** Migration 109 · sealed 2026-09-30 · seller-authored info blob
   *  backing the + button info tray on the cover composer. Optional ·
   *  when null the + button falls back to disabled. */
  infoPages?: NexInfoPagesJson | null;
  /** Cover-facing About Us body (from nex_business.description). Kept
   *  as a top-level field on the mock so preview layouts don't have to
   *  reach into a business object. */
  aboutUs?: string | null;
  /** Accepted payment method labels · pre-rendered from
   *  NEX_PAYMENT_METHOD_META so we don't drag business-service into
   *  the client bundle. */
  paymentMethodLabels?: string[];
  /** Pre-rendered return-policy body · optional. */
  returnPolicyBody?: string | null;
  /** Pre-rendered events / catering body · optional. */
  eventsBody?: string | null;
  /** Venue gallery photo URLs · optional. */
  galleryUrls?: string[];
  /** True when the shop's business_category is a venue. */
  isVenue?: boolean;
  /** Migration 110 · seller-uploaded QR image URL. */
  qrCodeImageUrl?: string | null;
  /** True when the seller has 📱 QRIS on Delivery in accepted methods. */
  acceptsQrisDelivery?: boolean;
  /** Founder direction 2026-09-30 · About Us panel enrichments.
   *  yearEstablished from nex_business.year_established (smallint) ·
   *  ownerName / ownerPosition / ownerAvatarUrl derived from
   *  nex_account joined via nex_business.owner_account_id. All
   *  optional · panel gracefully skips missing fields. */
  yearEstablished?: number | null;
  ownerName?: string | null;
  ownerPosition?: string | null;
  ownerAvatarUrl?: string | null;
  /** Founder direction 2026-09-30 · structured Mon–Sun schedule for
   *  the Info Tray Hours panel. When set, the panel renders a
   *  two-column table with "Closed" for any missing / closed day. */
  hoursByDay?: WeeklyHours | null;
  products: CoverProduct[];
  services: {
    id: string;
    name: string;
    fromPrice: string;
    description: string;
  }[];
  reviews: { author: string; body: string; stars: number }[];
  /** Bridge Gallery-A/B/C · seller-uploaded gallery images that render
   *  on the Personal Brand Images tab (Templates 10, 13, 14). Loaded
   *  by cover-content-loader from nex_gallery_image (Migration 111).
   *  When empty (or omitted) the layout falls back to 18 placeholder
   *  IMAGE HERE tiles so previews without a real business still show
   *  the surface shape. */
  galleryImages?: {
    id: string;
    imageUrl: string;
    caption: string;
    longDescription: string;
  }[];
  /** Bridge Profession-D · terminology strings resolved by the
   *  fallback chain (business override → profession → vertical →
   *  global default). Layout files consume these instead of
   *  hardcoding "All products" / "Menu" / "Portfolio" etc. When
   *  omitted the layout falls back to GLOBAL_DEFAULT_TERMINOLOGY. */
  terminology?: {
    catalog_heading: string;
    catalog_action_label: string;
    primary_action_label: string;
    section_about_label: string;
    section_location_label: string;
    story_eyebrow: string;
  };
  /** Bridge ThemeEmoji-B · sealed 2026-10-01 · per-theme emoji set
   *  loaded from nex_theme_emoji (Migration 116). When present AND
   *  non-empty, the CoverComposer emoji picker renders THIS set
   *  instead of the default 40-emoji hardcoded array. */
  themeEmojis?: {
    slug: string;
    imageUrl: string;
    label: string;
  }[];
  hours: string;
  address: string;
  atmosphereLine: string;
  /** Founder direction 2026-09-30 · optional coordinates for the
   *  "Visit Us" Google Maps directions link. Falls back to a text
   *  search of `address` when either is null. Sellers set these via
   *  SellerLocationEditor on /manage/shop. */
  locationLat?: number | null;
  locationLng?: number | null;
}

export const MARIA_MOCK: MockCoverContent = {
  // Founder direction 2026-09-30 · templates are now BLANK STAGES.
  // Every identity field renders as a placeholder so sellers can
  // imagine their own business landing on the layout · no more
  // Maria's Café / Corner Store personalities anchoring the design
  // to a specific vertical. Sellers select a template skin, brain-
  // storm their own business, then rewrite these fields on
  // /manage/shop + /manage/info.
  businessName: "Brand Name",
  tagline: "",
  handle: "Social Links",
  // Owner directive 2026-10-22 · the identity rail's compact location
  // line was a duplicate of the top Visit-Us panel's address block ·
  // mock `location` is now empty so the rail skips its `{location &&
  // …}` block · real businesses with a distinct short location can
  // still populate this independently.
  location: "",
  portraitUrl: "",
  // Owner directive 2026-11-07 · "preview-account" was tripping a
  // UUID 22P02 error at the chat peer page when any surface in the
  // preview iframe linked to this owner (e.g., the chat FAB). Using
  // the all-zeros UUID keeps the shape valid; the chat page's UUID
  // guard + maybeSingle still redirects to /chat since no row owns
  // this id.
  ownerAccountId: "00000000-0000-0000-0000-000000000000",
  presenceOnline: true,
  social: {
    instagram: "yourbusiness",
    tiktok: "@yourbusiness",
    facebook: "yourbusiness",
    whatsapp: "+00000000000",
    website: "https://yourbusiness.com",
  },
  atmosphereLine: "The feeling your customers walk into · one warm line",
  hours: "Opening Hours",
  address: "Your street address · city · region · postcode",
  locationLat: null,
  locationLng: null,
  countryCode: "ID",
  // Owner directive 2026-11-06 · the heading text was "Local Delivery
  // / Export" (resolved from shippingScope) · owner wants it to read
  // "Delivery 38km" on the preview. sectionTitle overrides the enum
  // resolution per the sectionTitle doc above.
  sectionTitle: "Delivery 38km",
  shippingScope: "local_and_export",
  aboutUs:
    "This is where your brand story lives · the place visitors get to know who you are before they buy. Talk about your mission · your ambitions · your goals · the moment you started · the people beside you · the standards you refuse to compromise on.\n\nKeep it specific · keep it warm · keep it yours. If you have been at this for years, say so. If you are new and hungry, own that too. Explain the craft, the promise, the reason you exist.\n\nEvery reader who lands here should leave knowing what makes your work different from everyone else's. Sellers rewrite this at any time from /manage/info.",
  paymentMethodLabels: [
    "💵 Cash on Delivery",
    "📱 QRIS on Delivery",
    "🤝 Meetup Cash",
  ],
  qrCodeImageUrl: null,
  acceptsQrisDelivery: true,
  yearEstablished: null,
  ownerName: "Your Name",
  ownerPosition: "Founder",
  hoursByDay: {
    mon: { open: "09:00", close: "18:00" },
    tue: { open: "09:00", close: "18:00" },
    wed: { open: "09:00", close: "18:00" },
    thu: { open: "09:00", close: "18:00" },
    fri: { open: "09:00", close: "18:00" },
    sat: { open: "10:00", close: "16:00" },
    sun: { closed: true },
  },
  ownerAvatarUrl: null,
  returnPolicyBody:
    "Your return policy goes here. Explain the return window, the condition requirements, and how buyers start a return in a few short sentences.",
  eventsBody:
    "If you host events or take catering bookings, describe the size range, the notice required, and what buyers can expect. Keep it under 400 characters so it scans on a phone screen.",
  galleryUrls: [],
  isVenue: true,
  infoPages: {
    enabled: {
      about_us: true,
      delivery: true,
      hours: true,
      payment: true,
      returns: true,
      catering: true,
      gallery: false,
      custom_orders: false,
      services: false,
    },
    delivery_details:
      "Describe your delivery area · your cut-off times · any fees. Keep it short so buyers know what to expect at a glance.",
    custom_buttons: [
      {
        id: "cb_promise",
        enabled: true,
        icon: "✨",
        label: "Our Promise",
        body: "One or two lines about the standard you hold yourself to. Keep it short · keep it warm · keep it specific.",
        image_url: null,
        external_url: null,
      },
    ],
    faq_items: [
      {
        id: "faq_1",
        enabled: true,
        question: "First question buyers ask?",
        answer:
          "The answer goes here · keep it a few short sentences so it reads fast on a phone screen.",
      },
      {
        id: "faq_2",
        enabled: true,
        question: "Second question buyers ask?",
        answer:
          "The answer goes here · keep it a few short sentences so it reads fast on a phone screen.",
      },
      {
        id: "faq_3",
        enabled: true,
        question: "Third question buyers ask?",
        answer:
          "The answer goes here · keep it a few short sentences so it reads fast on a phone screen.",
      },
    ],
  },
  sections: [
    { id: "sec-cat1", name: "Category 1", sort_order: 0 },
    { id: "sec-cat2", name: "Category 2", sort_order: 1 },
    { id: "sec-cat3", name: "Category 3", sort_order: 2 },
  ],
  products: [
    // Founder direction 2026-09-30 · 6 products per category so the
    // round variant (3x2, 6 per page) fills its first page cleanly
    // regardless of which category the buyer lands on · 18 products
    // total across 3 categories.
    { id: "prod-01", slug: "product-01", name: "Product Name 01", price_pence: 5000000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-02", slug: "product-02", name: "Product Name 02", price_pence: 4500000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-03", slug: "product-03", name: "Product Name 03", price_pence: 6000000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-04", slug: "product-04", name: "Product Name 04", price_pence: 4800000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-05", slug: "product-05", name: "Product Name 05", price_pence: 5100000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-06", slug: "product-06", name: "Product Name 06", price_pence: 4200000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-07", slug: "product-07", name: "Product Name 07", price_pence: 3500000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat2", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-08", slug: "product-08", name: "Product Name 08", price_pence: 7500000, currency: "IDR", image_url: null, stock_status: "low_stock", section_id: "sec-cat2", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-09", slug: "product-09", name: "Product Name 09", price_pence: 4200000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat2", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-10", slug: "product-10", name: "Product Name 10", price_pence: 6200000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat2", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-11", slug: "product-11", name: "Product Name 11", price_pence: 3200000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat2", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-12", slug: "product-12", name: "Product Name 12", price_pence: 5800000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat2", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-13", slug: "product-13", name: "Product Name 13", price_pence: 2800000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat3", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-14", slug: "product-14", name: "Product Name 14", price_pence: 5500000, currency: "IDR", image_url: null, stock_status: "low_stock", section_id: "sec-cat3", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-15", slug: "product-15", name: "Product Name 15", price_pence: 3800000, currency: "IDR", image_url: null, stock_status: "sold_out", section_id: "sec-cat3", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-16", slug: "product-16", name: "Product Name 16", price_pence: 4400000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat3", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-17", slug: "product-17", name: "Product Name 17", price_pence: 5300000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat3", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-18", slug: "product-18", name: "Product Name 18", price_pence: 4900000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat3", description: "Short two-line description of what this product is · sellers author their own copy." },
  ],
  services: [
    { id: "svc-1", name: "Service One", fromPrice: "from Rp 000k", description: "One-line description of what this service delivers to your customers." },
    { id: "svc-2", name: "Service Two", fromPrice: "from Rp 000k", description: "One-line description of what this service delivers to your customers." },
    { id: "svc-3", name: "Service Three", fromPrice: "from Rp 000k", description: "One-line description of what this service delivers to your customers." },
  ],
  reviews: [
    { author: "Customer Name", body: "What a satisfied customer wrote about your work goes here.", stars: 5 },
    { author: "Customer Name", body: "What a satisfied customer wrote about your work goes here.", stars: 5 },
    { author: "Customer Name", body: "What a satisfied customer wrote about your work goes here.", stars: 5 },
  ],
};

/**
 * Template 03 (Product Seller) preview mock. Spreads MARIA_MOCK so
 * every non-catalog field stays consistent (identity, theme, hours,
 * info pages, QR, etc.) · overrides sections + products with content
 * that fits a product-seller vertical.
 *
 * Founder direction 2026-09-30 · sealed categories for the product
 * template preview:  Electronics · Mens Wear · Watches
 */
export const PRODUCT_SELLER_MOCK: MockCoverContent = {
  ...MARIA_MOCK,
  isVenue: false,
  // Founder direction 2026-09-30 · templates are BLANK STAGES · this
  // mock mirrors MARIA_MOCK's generic voice · only sections + products
  // are re-shaped so the Product Seller layouts show a warehouse /
  // shipping flavour (three product categories, wider price range)
  // rather than a hospitality flavour (three menu sections). Copy is
  // still fully generic so sellers imagine their own catalogue.
  infoPages: {
    ...(MARIA_MOCK.infoPages ?? {}),
    delivery_details:
      "Describe your dispatch cut-off, courier partners, and any collection option. Keep it under 200 characters so it scans on a phone screen.",
  },
  sections: [
    { id: "sec-cat1", name: "Category 1", sort_order: 0 },
    { id: "sec-cat2", name: "Category 2", sort_order: 1 },
    { id: "sec-cat3", name: "Category 3", sort_order: 2 },
  ],
  products: [
    { id: "prod-p01", slug: "product-01", name: "Product Name 01", price_pence: 500000000,  currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p02", slug: "product-02", name: "Product Name 02", price_pence: 250000000,  currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p03", slug: "product-03", name: "Product Name 03", price_pence: 1800000000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p04", slug: "product-04", name: "Product Name 04", price_pence: 3200000000, currency: "IDR", image_url: null, stock_status: "low_stock", section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p05", slug: "product-05", name: "Product Name 05", price_pence: 850000000,  currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p06", slug: "product-06", name: "Product Name 06", price_pence: 78000000,   currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat2", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p07", slug: "product-07", name: "Product Name 07", price_pence: 195000000,  currency: "IDR", image_url: null, stock_status: "low_stock", section_id: "sec-cat2", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p08", slug: "product-08", name: "Product Name 08", price_pence: 95000000,   currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat2", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p09", slug: "product-09", name: "Product Name 09", price_pence: 285000000,  currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat2", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p10", slug: "product-10", name: "Product Name 10", price_pence: 3450000000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat3", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p11", slug: "product-11", name: "Product Name 11", price_pence: 425000000,  currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat3", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p12", slug: "product-12", name: "Product Name 12", price_pence: 1650000000, currency: "IDR", image_url: null, stock_status: "sold_out", section_id: "sec-cat3", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p13", slug: "product-13", name: "Product Name 13", price_pence: 725000000,  currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat3", description: "Short two-line description of what this product is · sellers author their own copy." },
  ],
};

/**
 * Owner directive 2026-10-22 · brand-specific shop preview mock for
 * the NEX Themes Marketplace. When a shop template loads with
 * `?brand=crispy-chicken` the sealed cover-preview page swaps in this
 * mock so all 11 shop layouts feel like a chicken restaurant · menu
 * sections (Burgers / Chicken / Meal Deals) + 18 menu items replace
 * the generic MARIA_MOCK placeholders. No hotel rooms, no generic
 * products — just the kind of catalog Crispy Chicken would actually
 * publish.
 *
 * Prototype only · prices are DEMO VALUES in IDR and are NOT the
 * approved production pricing. The marketplace prototype carries the
 * same discipline: price fields never commit to a sealed source of
 * truth until the owner approves them in pricing-config.ts.
 */
export const CRISPY_CHICKEN_MOCK: MockCoverContent = {
  ...MARIA_MOCK,
  businessName: "Crispy Chicken",
  tagline: "Hot. Crispy. Yours.",
  handle: "@crispychicken",
  atmosphereLine: "Fresh buttermilk brine · hand-breaded · 24-hour marinated chicken",
  address: "245 W 45th St, New York, NY 10036",
  countryCode: "US",
  shippingScope: "local_delivery",
  isVenue: true,
  aboutUs:
    "Crispy Chicken started in a tiny New York kitchen with one obsession · the perfect bite of fried chicken. We brine every piece in buttermilk for 24 hours, hand-bread it in our proprietary seasoning blend, and fry it to the exact second it reaches that golden crackle. Nothing frozen, nothing precooked, no shortcuts.\n\nWhether you're grabbing lunch between meetings or feeding the whole family, every box we hand you is the same chicken we'd serve our own kids. Dine in, grab-and-go, or get it delivered hot to your door — we built this place for people who care about what they eat.\n\nSame story, every store, every day.",
  paymentMethodLabels: [
    "💵 Cash on Delivery",
    "💳 Card at Counter",
    "📱 QRIS on Delivery",
  ],
  ownerName: "Marcus Chen",
  ownerPosition: "Founder & Head Chef",
  yearEstablished: 2019,
  hoursByDay: {
    mon: { open: "11:00", close: "22:00" },
    tue: { open: "11:00", close: "22:00" },
    wed: { open: "11:00", close: "22:00" },
    thu: { open: "11:00", close: "22:00" },
    fri: { open: "11:00", close: "23:00" },
    sat: { open: "11:00", close: "23:00" },
    sun: { open: "12:00", close: "21:00" },
  },
  // Owner directive 2026-10-22 · food-vertical terminology · every
  // Crispy Chicken shop template now reads "Menu" instead of
  // "Products" inside the frame · "Add to Order" instead of generic
  // actions · marketplace chrome around the frame still uses the
  // universal "Shop" verb.
  terminology: {
    catalog_heading: "Menu",
    catalog_action_label: "Order",
    primary_action_label: "Order now",
    section_about_label: "Our story",
    section_location_label: "Find us",
    story_eyebrow: "The craft",
  },
  sections: [
    { id: "sec-burgers",    name: "Burgers",    sort_order: 0 },
    { id: "sec-chicken",    name: "Chicken",    sort_order: 1 },
    { id: "sec-meal-deals", name: "Meal Deals", sort_order: 2 },
    { id: "sec-drinks",     name: "Drinks",     sort_order: 3 },
  ],
  // Owner directive 2026-10-22 · 24 menu items across 4 sections
  // (6 per category) so the round variant (3×2, 6 per page) fills
  // its first page cleanly on every category. Prices in IDR cents.
  // Rp 45,000 = price_pence 4500000.
  products: [
    // ─── Burgers ─────────────────────────────────────────────────
    { id: "cc-b01", slug: "classic-crispy-burger",   name: "Classic Crispy Burger",    price_pence: 4500000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-burgers",    description: "Buttermilk-fried chicken · lettuce · mayo · toasted brioche." },
    { id: "cc-b02", slug: "spicy-crispy-burger",     name: "Spicy Crispy Burger",      price_pence: 4800000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-burgers",    description: "Nashville-hot chicken · pickles · slaw · brioche bun." },
    { id: "cc-b03", slug: "cheese-stack-burger",     name: "Cheese Stack Burger",      price_pence: 5500000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-burgers",    description: "Double crispy fillet · cheddar · onion · signature sauce." },
    { id: "cc-b04", slug: "bbq-honey-burger",        name: "BBQ Honey Burger",         price_pence: 5200000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-burgers",    description: "Smoked BBQ glaze · honey · crispy onions · brioche." },
    { id: "cc-b05", slug: "truffle-crispy-burger",   name: "Truffle Crispy Burger",    price_pence: 6500000, currency: "IDR", image_url: null, stock_status: "low_stock", section_id: "sec-burgers",    description: "Truffle aioli · aged cheddar · arugula · house pickles." },
    { id: "cc-b06", slug: "veggie-crisp-burger",     name: "Veggie Crisp Burger",      price_pence: 4200000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-burgers",    description: "Crispy breaded portobello · smoked paprika mayo · lettuce." },
    // Owner directive 2026-10-22 · extra Burgers items to push the
    // category past 6 so the drawer's pagination footer (prev / next
    // + page counter) renders live. 8 total → 2 pages.
    { id: "cc-b07", slug: "smash-burger",            name: "Smash Burger",             price_pence: 4900000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-burgers",    description: "Thin-smashed patty · caramelised onions · American cheese." },
    { id: "cc-b08", slug: "buffalo-crisp-burger",    name: "Buffalo Crisp Burger",     price_pence: 5100000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-burgers",    description: "Buffalo-tossed fillet · blue-cheese slaw · brioche." },
    // ─── Chicken ─────────────────────────────────────────────────
    { id: "cc-c01", slug: "classic-tenders-5",       name: "5-Piece Tenders",          price_pence: 5500000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-chicken",    description: "Five hand-breaded tenders · your choice of dipping sauce." },
    { id: "cc-c02", slug: "classic-tenders-10",      name: "10-Piece Tenders",         price_pence: 9500000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-chicken",    description: "Ten hand-breaded tenders · two dipping sauces." },
    { id: "cc-c03", slug: "bucket-6",                name: "6-Piece Bucket",           price_pence: 7500000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-chicken",    description: "Mixed bone-in · thighs, drums, wings · 24-hour brined." },
    { id: "cc-c04", slug: "bucket-12",               name: "12-Piece Bucket",          price_pence: 12800000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-chicken",    description: "Mixed bone-in · feeds 3–4 · hand-breaded to order." },
    { id: "cc-c05", slug: "spicy-wings-8",           name: "8-Piece Spicy Wings",      price_pence: 6800000, currency: "IDR", image_url: null, stock_status: "low_stock", section_id: "sec-chicken",    description: "Buffalo · Nashville hot · or honey-sriracha. Pick your heat." },
    { id: "cc-c06", slug: "boneless-box",            name: "Boneless Box",             price_pence: 5900000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-chicken",    description: "Crispy boneless bites · tossed in your choice of glaze." },
    // ─── Meal Deals ──────────────────────────────────────────────
    { id: "cc-m01", slug: "solo-deal",               name: "Solo Deal",                price_pence: 6500000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-meal-deals", description: "3 tenders · fries · drink · dipping sauce." },
    { id: "cc-m02", slug: "burger-combo",            name: "Burger Combo",             price_pence: 7500000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-meal-deals", description: "Any burger · fries · drink · one side." },
    { id: "cc-m03", slug: "family-feast",            name: "Family Feast",             price_pence: 18500000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-meal-deals", description: "12-piece bucket · 2 large fries · 4 drinks · 2 sides." },
    { id: "cc-m04", slug: "date-night-box",          name: "Date Night Box",           price_pence: 12500000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-meal-deals", description: "2 burgers · 2 fries · 2 drinks · shared side." },
    { id: "cc-m05", slug: "wings-tenders-combo",     name: "Wings + Tenders Combo",    price_pence: 9500000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-meal-deals", description: "4 wings · 4 tenders · fries · 2 dipping sauces." },
    { id: "cc-m06", slug: "lunch-express",           name: "Lunch Express",            price_pence: 5800000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-meal-deals", description: "Weekday 11am-2pm · 3 tenders · small fries · drink." },
    // ─── Drinks ─────────────────────────────────────────────────
    { id: "cc-d01", slug: "soft-drink-large",        name: "Soft Drink · Large",       price_pence: 1800000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-drinks",     description: "Coca-Cola · Sprite · Fanta · free refills in-store." },
    { id: "cc-d02", slug: "iced-tea",                name: "Fresh Iced Tea",           price_pence: 2200000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-drinks",     description: "Brewed daily · lemon or peach · unsweetened on request." },
    { id: "cc-d03", slug: "lemonade",                name: "House Lemonade",           price_pence: 2500000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-drinks",     description: "Fresh-squeezed · mint sprig · just the right amount of sweet." },
    { id: "cc-d04", slug: "milkshake-vanilla",       name: "Vanilla Milkshake",        price_pence: 3800000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-drinks",     description: "Hand-spun · real vanilla · topped with whipped cream." },
    { id: "cc-d05", slug: "milkshake-chocolate",     name: "Chocolate Milkshake",      price_pence: 3800000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-drinks",     description: "Thick · dark chocolate · topped with whipped cream." },
    { id: "cc-d06", slug: "bottled-water",           name: "Bottled Water",            price_pence: 1200000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-drinks",     description: "500ml · still or sparkling · locally sourced." },
  ],
  services: [
    { id: "svc-dinein",   name: "Dine In",       fromPrice: "Full menu",      description: "Walk in anytime · counter order · comfy booths · fast turnaround." },
    { id: "svc-delivery", name: "Local Delivery", fromPrice: "Rp 15k · 30 min", description: "Hot to your door within 30 min · 5km radius · tracker in-app." },
    { id: "svc-catering", name: "Catering",      fromPrice: "from Rp 850k",   description: "Office lunches · parties · 48h notice · 10+ people." },
  ],
  reviews: [
    { author: "Rachel K.",   body: "The best fried chicken I've had outside of the South. Crispy outside, actually juicy inside, and the Nashville hot has real heat.", stars: 5 },
    { author: "David M.",    body: "Family of four · Family Feast fed all of us with leftovers. Chicken was still crispy 20 minutes after delivery. Impressive.", stars: 5 },
    { author: "Priya S.",    body: "The truffle burger is my new regular order. Not greasy, not heavy, actually tastes like truffle. Service is quick too.", stars: 5 },
  ],
};
