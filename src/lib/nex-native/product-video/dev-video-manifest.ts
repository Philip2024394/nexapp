// src/lib/nex-native/live-broadcast/dev-video-manifest.ts
//
// Dev-mode local video manifest · 2026-10-24.
// -----------------------------------------------------------------------------
// Owner directive · "we have 50 videos from admin to upload or maybe
// 100 · the Live link from side drawer should show the live screen
// playing video and the buttons in footer area".
//
// Target decision (owner-provided 2026-10-24): "wait for isolated
// sandbox" · we do NOT connect to Supabase from this environment.
// Dev-mode local manifest serves the SAME shape the real
// `listPublishedUploadedVideos` service returns · the feed page can
// swap between them with one env flag or one line.
//
// Files served from `/public/dev/live-videos/{filename}` so Next.js
// Image / Video server-serves them as static assets. The directory
// is gitignored · never committed.
//
// To add more videos (scaling to the owner's 50-100):
//   1 · Drop the mp4 into `public/dev/live-videos/`.
//   2 · Add an entry to DEV_VIDEO_MANIFEST below with id + title +
//       country + tags + published_at.
//   3 · Save · the feed picks it up on next dev-server reload.
//
// When the sandbox lands:
//   · Flip the feed caller from `listDevUploadedVideos` to the real
//     `listPublishedUploadedVideos` and the dev manifest becomes
//     unused scaffolding (safe to delete).

import type { UploadedVideoRow } from "./uploaded-video-service";

/** Minimal shape a dev-manifest entry must declare. All other
 *  UploadedVideoRow fields are derived or defaulted. */
export interface DevVideoManifestEntry {
  readonly id: string;
  readonly title: string;
  readonly caption: string | null;
  readonly filename: string;
  readonly countryOfOrigin: string; // ISO alpha-2 uppercase
  readonly topicTags: readonly string[];
  readonly durationSeconds: number | null;
  readonly byteSize: number;
  readonly publishedAtIso: string;
  /** Owner directive 2026-10-25 · Migration 221 · when true the
   *  viewer header renders a red "(AI)" label after the broadcast
   *  date. Omit for ordinary human-authored content · absence of
   *  the flag does NOT imply human origin (there is no "100% human"
   *  badge). Dev-manifest · 2–3 entries carry `true` so the chip is
   *  visible in dev screenshots; the rest default to false. */
  readonly isAiGenerated?: boolean;
  /** Owner directive 2026-10-26 · optional watch-listing metadata.
   *  Added for Hendra's Watch-Seller library so each video can carry
   *  a brand + model + collapsed headline + expanded description that
   *  the WatchOverlayCaption component surfaces on the viewer.
   *  Absent on generic Indonesian clips · present on the hendra-NN
   *  entries. These fields are DEV-ONLY · a production shop-upload
   *  surface will carry its own schema (see owner note 2026-10-26). */
  readonly watchBrand?: string;
  /** If the model cannot be identified, use the literal string
   *  "On Request" · the collapsed header renders brand + model so
   *  "Rolex · On Request" is a valid, honest placeholder. */
  readonly watchModel?: string;
  /** Short label shown while the overlay is COLLAPSED. Keep ≤ 60
   *  chars so the pill does not wrap at mobile widths. */
  readonly watchHeadline?: string;
  /** Full body shown while the overlay is EXPANDED. Keep ≤ 800
   *  chars so the panel does not scroll past the composer. */
  readonly watchDescription?: string;
  /** Owner directive 2026-10-26 (Round 3b) · enriched watch spec
   *  fields. Dev-only on this manifest · the production shop-upload
   *  schema will carry the authoritative column set (see the
   *  shop-watches-upload design in docs/doctrine/). Any field may be
   *  omitted (undefined) · overlay renders "On Request" fallbacks. */

  /** Case diameter in millimetres. Numeric so filters can sort. */
  readonly caseDiameterMm?: number;
  /** Case thickness in millimetres. */
  readonly caseThicknessMm?: number;
  /** Lug-to-lug distance in millimetres. */
  readonly lugToLugMm?: number;
  /** Movement type · what powers the watch. */
  readonly movement?:
    | "automatic"
    | "manual-wind"
    | "quartz-battery"
    | "solar-quartz"
    | "spring-drive"
    | "mecaquartz"
    | "on-request";
  /** Movement caliber reference (e.g. "Cal. 4130"). Free text. */
  readonly movementCaliber?: string;
  /** Water resistance in metres (not ATM). Use 0 for not rated. */
  readonly waterResistanceM?: number;
  /** Case material (free text so two-tone combos read naturally).
   *  Example: "Stainless steel + 18k yellow gold". */
  readonly caseMaterial?: string;
  /** Strap material. Example: "Oyster bracelet (steel + 18k gold)". */
  readonly strapMaterial?: string;
  /** Strap / bracelet width at the lugs in mm. */
  readonly strapWidthMm?: number;
  /** Strap length (end-to-end) in mm. Useful for leather / rubber. */
  readonly strapLengthMm?: number;
  /** ISO country or free-text manufacture origin. */
  readonly madeIn?: string;
  /** Condition. */
  readonly condition?: "new" | "pre-owned" | "vintage" | "on-request";
  /** True when sold with original box + papers (full set). */
  readonly fullSet?: boolean;
  /** Which packaging items are included. Rendered as a bullet list. */
  readonly packaging?: readonly (
    | "box"
    | "papers"
    | "warranty-card"
    | "service-card"
    | "manual"
    | "spare-link"
    | "none"
  )[];
  /** Authenticity note. */
  readonly authenticity?:
    | "original-brand"
    | "original-brand-service-pending"
    | "homage-disclosed"
    | "replica-disclosed"
    | "on-request";
  /** Warranty note (free text so the seller can describe terms). */
  readonly warrantyNote?: string;
  /** Shipping availability. */
  readonly shippingScope?: readonly (
    | "local"
    | "domestic"
    | "export"
    | "pickup-only"
  )[];
  /** Pricing mode the seller is open to. */
  readonly pricingModes?: readonly ("retail" | "wholesale" | "trade-in")[];
  /** Free-text price note (seller-authored · never NEX-asserted).
   *  Example: "Retail IDR by DM · wholesale from 3 units". */
  readonly priceNote?: string;
  /** Year of production (approximate OK). */
  readonly productionYear?: number;
  /** Dial color (free text so "ice-blue" / "panda" / "salmon" work). */
  readonly dialColor?: string;
  /** Complications (chronograph, GMT, moonphase, etc.). */
  readonly complications?: readonly string[];
  /** Owner directive 2026-10-26 (Round 3f) · Buy Now price in integer
   *  rupiah (no fractional). When present, the floating yellow Buy Now
   *  button renders under the broadcaster header on the live surface.
   *  Omit on pieces where the seller only accepts "price on request"
   *  (grail watches, dealer catalogues). Dev-only field · production
   *  pricing lives on `nex_watch_listing.retail_price_minor` (DRAFT
   *  doctrine, 2026-10-26 schema). */
  readonly buyNowPriceIdr?: number;
}

/* ─── Manifest · owner-authored · 14 entries so far · scales to 100 ─── */

export const DEV_VIDEO_MANIFEST: readonly DevVideoManifestEntry[] = [
  // Owner directive 2026-10-24 · 6 dev videos tagged with placeholder
  // topics so the category-chain playback (travel → temple → volcano
  // → beach · transport → bike-rental → car-rental → bicycle-rental)
  // demonstrates end-to-end. These tags are prototype placeholders;
  // real uploads carry owner-authored tags.
  {
    id: "dev-video-1",
    title: "Live from Indonesia · 1",
    caption: null,
    filename: "snaptik_7689160014333807879_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["temple"],
    durationSeconds: null,
    byteSize: 8_141_145,
    publishedAtIso: "2026-10-24T16:13:00Z",
  },
  {
    id: "dev-video-2",
    title: "Live from Indonesia · 2",
    caption: null,
    filename: "snaptik_7692805970472209671_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["volcano"],
    durationSeconds: null,
    byteSize: 9_718_290,
    publishedAtIso: "2026-10-24T16:15:00Z",
  },
  {
    id: "dev-video-3",
    title: "Live from Indonesia · 3",
    caption: null,
    filename: "snaptik_7697419111164300564_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["beach"],
    durationSeconds: null,
    byteSize: 3_595_036,
    publishedAtIso: "2026-10-24T17:05:00Z",
    isAiGenerated: true,
  },
  {
    id: "dev-video-4",
    title: "Live from Indonesia · 4",
    caption: null,
    filename: "snaptik_7696739787771841800_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["bike-rental"],
    durationSeconds: null,
    byteSize: 2_503_871,
    publishedAtIso: "2026-10-24T17:06:00Z",
  },
  {
    id: "dev-video-5",
    title: "Live from Indonesia · 5",
    caption: null,
    filename: "snaptik_7693407706052316424_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["car-rental"],
    durationSeconds: null,
    byteSize: 6_319_214,
    publishedAtIso: "2026-10-24T17:07:00Z",
  },
  {
    id: "dev-video-6",
    title: "Live from Indonesia · 6",
    caption: null,
    filename: "snaptik_7694574193979034901_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["bicycle-rental"],
    durationSeconds: null,
    byteSize: 3_983_659,
    publishedAtIso: "2026-10-24T17:08:00Z",
  },
  {
    id: "dev-video-7",
    title: "Live from Indonesia · 7",
    caption: null,
    filename: "snaptik_7693407241893907732_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 6_104_899,
    publishedAtIso: "2026-10-24T17:09:00Z",
  },
  {
    id: "dev-video-8",
    title: "Live from Indonesia · 8",
    caption: null,
    filename: "snaptik_7699485791248059669_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 1_531_669,
    publishedAtIso: "2026-10-24T17:35:00Z",
  },
  {
    id: "dev-video-9",
    title: "Live from Indonesia · 9",
    caption: null,
    filename: "snaptik_7691639225162206486_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 1_684_620,
    publishedAtIso: "2026-10-24T17:55:00Z",
  },
  {
    id: "dev-video-10",
    title: "Live from Indonesia · 10",
    caption: null,
    filename: "snaptik_7678490854473944338_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 2_743_231,
    publishedAtIso: "2026-10-24T17:56:00Z",
  },
  {
    id: "dev-video-11",
    title: "Live from Indonesia · 11",
    caption: null,
    filename: "snaptik_7691490715842514198_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 1_413_327,
    publishedAtIso: "2026-10-24T17:57:00Z",
    isAiGenerated: true,
  },
  {
    id: "dev-video-12",
    title: "Live from Indonesia · 12",
    caption: null,
    filename: "snaptik_7697148211630181645_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 1_914_721,
    publishedAtIso: "2026-10-24T17:58:00Z",
    isAiGenerated: true,
  },
  {
    id: "dev-video-13",
    title: "Live from Indonesia · 13",
    caption: null,
    filename: "snaptik_7690683579726089503_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 3_566_902,
    publishedAtIso: "2026-10-24T17:59:00Z",
  },
  {
    id: "dev-video-14",
    title: "Live from Indonesia · 14",
    caption: null,
    filename: "snaptik_7692035162833571104_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 1_190_155,
    publishedAtIso: "2026-10-24T18:00:00Z",
    isAiGenerated: true,
  },
  // Owner directive 2026-10-25 · three additional videos. Shown in
  // the central Live feed's RecordedVideosSection with sessionStorage-
  // backed shuffle-no-repeat per browser tab (see
  // src/app/nex-native/live-commerce/feed/_shuffled-recorded-videos.tsx).
  {
    id: "dev-video-15",
    title: "Live from Indonesia · 15",
    caption: null,
    filename: "snaptik_7685765109767048462_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 2_836_836,
    publishedAtIso: "2026-10-25T16:32:00Z",
    isAiGenerated: true,
  },
  {
    id: "dev-video-16",
    title: "Live from Indonesia · 16",
    caption: null,
    filename: "snaptik_7596993425254272270_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 2_512_845,
    publishedAtIso: "2026-10-25T16:35:00Z",
  },
  {
    id: "dev-video-17",
    title: "Live from Indonesia · 17",
    caption: null,
    filename: "snaptik_7686667273347550472_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 2_335_490,
    publishedAtIso: "2026-10-25T16:36:00Z",
    isAiGenerated: true,
  },
  // Owner directive 2026-10-25 · four additional videos. Shuffle-
  // no-repeat applies automatically (reconciliation in
  // _shuffled-recorded-videos.tsx keeps existing tabs' seen state
  // and appends new IDs at the tail; new tabs get a fresh shuffle).
  {
    id: "dev-video-18",
    title: "Live from Indonesia · 18",
    caption: null,
    filename: "snaptik_7685626567778733326_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 4_844_922,
    publishedAtIso: "2026-10-25T16:45:00Z",
    isAiGenerated: true,
  },
  {
    id: "dev-video-19",
    title: "Live from Indonesia · 19",
    caption: null,
    filename: "snaptik_7591136738777582868_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 4_799_148,
    publishedAtIso: "2026-10-25T16:48:00Z",
    isAiGenerated: true,
  },
  {
    id: "dev-video-20",
    title: "Live from Indonesia · 20",
    caption: null,
    filename: "snaptik_7662699864001645856_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 10_818_741,
    publishedAtIso: "2026-10-25T16:50:00Z",
    isAiGenerated: true,
  },
  {
    id: "dev-video-21",
    title: "Live from Indonesia · 21",
    caption: null,
    filename: "snaptik_7695402685310324001_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 6_003_008,
    publishedAtIso: "2026-10-25T16:51:00Z",
  },
  {
    id: "dev-video-22",
    title: "Live from Indonesia · 22",
    caption: null,
    filename: "snaptik_7663892999473990942_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 5_685_361,
    publishedAtIso: "2026-10-25T16:52:00Z",
    isAiGenerated: true,
  },
  {
    id: "dev-video-23",
    title: "Live from Indonesia · 23",
    caption: null,
    filename: "snaptik_7683203253370146069_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 2_258_788,
    publishedAtIso: "2026-10-25T16:53:00Z",
  },
  {
    id: "dev-video-24",
    title: "Live from Indonesia · 24",
    caption: null,
    filename: "snaptik_7680463541656243477_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 6_769_075,
    publishedAtIso: "2026-10-25T16:54:00Z",
  },
  {
    id: "dev-video-25",
    title: "Live from Indonesia · 25",
    caption: null,
    filename: "snaptik_7617214662471453973_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 12_584_666,
    publishedAtIso: "2026-10-25T16:55:00Z",
  },

  // ───────────────────────────────────────────────────────────────────
  // Owner directive 2026-10-26 · Hendra Watch-Seller library · 9 real
  // watch-content videos sourced by the owner. Identified from
  // extracted frames · drafts flagged "On Request" where brand or
  // model could not be read legibly from the content. These power the
  // WatchOverlayCaption collapsible overlay on
  // /nex-native/dev/live-persona/hendra. Dev-only · a production shop
  // upload surface will carry its own schema (owner note 2026-10-26
  // · "the watch information where we can take details or information
  // will help us build the shop watches upload detailed page").
  // ───────────────────────────────────────────────────────────────────

  {
    id: "dev-video-hendra-01",
    title: "Rolex Cosmograph Daytona · Two-Tone",
    caption: null,
    filename: "snaptik_7519456454613519634_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["watch", "rolex", "daytona"],
    durationSeconds: null,
    byteSize: 1_468_006,
    publishedAtIso: "2026-10-26T08:00:00Z",
    watchBrand: "Rolex",
    watchModel: "Cosmograph Daytona · Two-Tone",
    watchHeadline: "Rolex · Cosmograph Daytona",
    watchDescription:
      "Oyster Perpetual Superlative Chronometer · Officially Certified Cosmograph. Two-tone stainless steel + 18ct yellow gold Oyster bracelet, black dial, gold tachymeter bezel. Full set with original green Rolex box and papers.",
    caseDiameterMm: 40,
    movement: "automatic",
    movementCaliber: "Rolex Cal. 4130 (chronograph)",
    waterResistanceM: 100,
    caseMaterial: "Stainless steel + 18ct yellow gold",
    strapMaterial: "Oyster bracelet · steel + 18ct yellow gold",
    madeIn: "Switzerland",
    condition: "new",
    fullSet: true,
    packaging: ["box", "papers", "warranty-card"],
    authenticity: "original-brand",
    warrantyNote: "Rolex international warranty · activation date on request.",
    shippingScope: ["local", "domestic", "export"],
    pricingModes: ["retail"],
    priceNote: "Retail · IDR on request. Not a wholesale piece.",
    dialColor: "Black",
    complications: ["chronograph", "tachymeter"],
    buyNowPriceIdr: 450_000_000,
  },
  {
    id: "dev-video-hendra-02",
    title: "Luxury Gold Chronograph · Automatic",
    caption: null,
    filename: "snaptik_7678950005880704278_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["watch", "chronograph"],
    durationSeconds: null,
    byteSize: 2_726_912,
    publishedAtIso: "2026-10-26T08:05:00Z",
    watchBrand: "Brand · On Request",
    watchModel: "On Request",
    watchHeadline: "Gold Automatic Chronograph",
    watchDescription:
      "Yellow gold-tone case, automatic movement visible through sapphire caseback (marked AUTOMATIC), black leather strap with gold deployant clasp. Chronograph pushers. Brand mark not legible in the stream · brand, model, reference and full condition report on request.",
    movement: "automatic",
    caseMaterial: "Yellow gold-tone · plating details on request",
    strapMaterial: "Black leather with gold-tone deployant",
    condition: "on-request",
    fullSet: false,
    authenticity: "on-request",
    warrantyNote: "On request.",
    shippingScope: ["local", "domestic"],
    pricingModes: ["retail"],
    priceNote: "Price and condition report on request.",
    complications: ["chronograph"],
    buyNowPriceIdr: 18_500_000,
  },
  {
    id: "dev-video-hendra-03",
    title: "Open-Heart Automatic · Green Dial",
    caption: null,
    filename: "snaptik_7644378544654568724_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["watch", "open-heart"],
    durationSeconds: null,
    byteSize: 1_572_864,
    publishedAtIso: "2026-10-26T08:10:00Z",
    watchBrand: "Brand · On Request",
    watchModel: "On Request",
    watchHeadline: "Open-Heart Automatic · Green",
    watchDescription:
      "Teal / green sun-ray dial with exposed balance wheel (open-heart) at 6, day display (SUN–SAT), chronograph subdials, chamfered case with knurled bezel, steel link bracelet. Presented on a dragon display stand. Exact brand, reference and price on request.",
    movement: "automatic",
    caseMaterial: "Stainless steel (two-tone finish)",
    strapMaterial: "Steel link bracelet",
    condition: "new",
    fullSet: false,
    authenticity: "on-request",
    warrantyNote: "On request.",
    shippingScope: ["local", "domestic"],
    pricingModes: ["retail", "wholesale"],
    priceNote: "Entry-tier automatic · wholesale possible on 5+ units.",
    dialColor: "Teal / green sun-ray",
    complications: ["day", "chronograph-subdials", "open-heart"],
    buyNowPriceIdr: 2_250_000,
  },
  {
    id: "dev-video-hendra-04",
    title: "Rolex Collection · 15-Watch Showcase",
    caption: null,
    filename: "snaptik_7518643978426797343_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["watch", "rolex", "showcase"],
    durationSeconds: null,
    byteSize: 3_250_586,
    publishedAtIso: "2026-10-26T08:15:00Z",
    watchBrand: "Rolex",
    watchModel: "Collection Showcase · 15 pieces",
    watchHeadline: "Rolex · 15-Watch Collection",
    watchDescription:
      "Hendra's current Rolex display case. Includes: Sky-Dweller (rose gold), Daytona two-tone, GMT-Master II root beer, Submariner Date, Day-Date 40 President (yellow + rose gold), Datejust with ice-blue diamond-bezel, iced-out Datejust, green-dial Day-Date. Not a single listing · individual piece reference, condition and price on request.",
    caseMaterial: "Mixed · steel, two-tone, yellow gold, rose gold, platinum variants",
    madeIn: "Switzerland",
    condition: "on-request",
    authenticity: "original-brand",
    warrantyNote: "Each piece evaluated individually · Rolex papers where present.",
    shippingScope: ["local", "domestic", "export"],
    pricingModes: ["retail", "wholesale", "trade-in"],
    priceNote: "Catalogue video · individual prices on request. Wholesale + trade-in considered.",
  },
  {
    id: "dev-video-hendra-05",
    title: "Omega Speedmaster · Silver Snoopy Award 50th Anniversary",
    caption: null,
    filename: "snaptik_7678721918811344158_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["watch", "omega", "speedmaster"],
    durationSeconds: null,
    byteSize: 3_879_731,
    publishedAtIso: "2026-10-26T08:20:00Z",
    watchBrand: "Omega",
    watchModel: "Speedmaster · Silver Snoopy Award 50th Anniversary (Ref. 310.32.42.50.02.001)",
    watchHeadline: "Omega · Speedmaster Silver Snoopy 50th",
    watchDescription:
      "42mm stainless steel · Co-Axial Master Chronometer Calibre 3861. Deep-blue caseback with animated Snoopy module orbiting the dark side of the moon, 'Eyes on the Stars' engraving, Apollo XIII commemoration (Award Oct. 5, 1970). Blue nylon strap with embossed Omega buckle. Serial, warranty-card status, and price on request.",
    caseDiameterMm: 42,
    movement: "manual-wind",
    movementCaliber: "Omega Co-Axial Master Chronometer Cal. 3861",
    waterResistanceM: 50,
    caseMaterial: "Stainless steel",
    strapMaterial: "Blue woven nylon with embossed Omega buckle",
    strapWidthMm: 21,
    madeIn: "Switzerland",
    condition: "new",
    fullSet: true,
    packaging: ["box", "papers", "warranty-card"],
    authenticity: "original-brand",
    warrantyNote: "Omega 5-year international warranty from original purchase.",
    shippingScope: ["local", "domestic", "export"],
    pricingModes: ["retail"],
    priceNote: "Limited anniversary piece · retail only · price on request.",
    productionYear: 2020,
    dialColor: "White with blue subdials",
    complications: ["chronograph", "small-seconds", "tachymeter"],
  },
  {
    id: "dev-video-hendra-06",
    title: "Jacob & Co. Astronomia · The Godfather / Casino",
    caption: null,
    filename: "snaptik_7277784030106357000_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["watch", "jacob-and-co", "astronomia"],
    durationSeconds: null,
    byteSize: 4_509_696,
    publishedAtIso: "2026-10-26T08:25:00Z",
    watchBrand: "Jacob & Co.",
    watchModel: "Astronomia · The Godfather / Casino variants",
    watchHeadline: "Jacob & Co. · Astronomia Godfather",
    watchDescription:
      "Multi-axis Astronomia tourbillon with rotating celestial sphere · diamond-pavé rose gold case · 44mm. The Godfather edition shows Vito Corleone miniature on blue alligator strap. The Astronomia Casino variant displays South Pole / North Pole plates and figurines. One-off and limited availability pieces · in-stock reference on request.",
    caseDiameterMm: 44.5,
    movement: "manual-wind",
    movementCaliber: "Jacob & Co. in-house (variant-specific)",
    waterResistanceM: 30,
    caseMaterial: "18k rose gold with diamond pavé",
    strapMaterial: "Blue alligator (Godfather) / variant per edition",
    madeIn: "Switzerland",
    condition: "new",
    fullSet: true,
    packaging: ["box", "papers", "warranty-card", "manual"],
    authenticity: "original-brand",
    warrantyNote: "Jacob & Co. international warranty · edition-specific terms on request.",
    shippingScope: ["local", "export", "pickup-only"],
    pricingModes: ["retail"],
    priceNote: "High-complication piece · private viewing recommended · price on request.",
    complications: ["triple-axis-tourbillon", "celestial-sphere", "moonphase"],
  },
  {
    id: "dev-video-hendra-07",
    title: "Hublot Big Bang MP-09 · Tourbillon Bi-Axis · Limited 11/50",
    caption: null,
    filename: "snaptik_7655208197325655328_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["watch", "hublot", "mp-09"],
    durationSeconds: null,
    byteSize: 2_411_724,
    publishedAtIso: "2026-10-26T08:30:00Z",
    watchBrand: "Hublot",
    watchModel: "Big Bang MP-09 · Tourbillon Bi-Axis",
    watchHeadline: "Hublot · Big Bang MP-09 11/50",
    watchDescription:
      "49mm rose gold case · bi-axis tourbillon visible through sapphire caseback · engraved 'LIMITED EDITION 11/50'. Structured black rubber strap with gold deployant. Supplied with Hublot International Warranty card (visible in the video). Current price and verification on request.",
    caseDiameterMm: 49,
    movement: "manual-wind",
    movementCaliber: "Hublot HUB9009.H1 · bi-axis tourbillon",
    waterResistanceM: 30,
    caseMaterial: "18k King Gold (rose gold)",
    strapMaterial: "Structured black rubber with 18k rose gold deployant",
    strapWidthMm: 29,
    madeIn: "Switzerland",
    condition: "new",
    fullSet: true,
    packaging: ["box", "papers", "warranty-card"],
    authenticity: "original-brand",
    warrantyNote: "Hublot International Warranty card visible in video · activation date on request.",
    shippingScope: ["local", "export", "pickup-only"],
    pricingModes: ["retail"],
    priceNote: "Limited edition 11 of 50 · retail only · six-figure USD equivalent · price on request.",
    complications: ["bi-axis-tourbillon"],
  },
  {
    id: "dev-video-hendra-08",
    title: "Jacob & Co. Bugatti Chiron Tourbillon · W16 engine",
    caption: null,
    filename: "snaptik_7528879074966523149_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["watch", "jacob-and-co", "bugatti"],
    durationSeconds: null,
    byteSize: 10_066_329,
    publishedAtIso: "2026-10-26T08:35:00Z",
    watchBrand: "Jacob & Co.",
    watchModel: "Bugatti Chiron Tourbillon · multiple variants",
    watchHeadline: "Jacob & Co. · Bugatti Chiron W16",
    watchDescription:
      "Working replica W16 engine inside the case · 16 pistons animate on-demand · tourbillon at 6 · Bugatti EB badge. Variants shown: rose gold, blue-sapphire-baguette, and ruby + diamond with red Alcantara strap. Jacob & Co. Genève. Specific SKU in stock, strap colour, and price on request.",
    caseDiameterMm: 55,
    movement: "manual-wind",
    movementCaliber: "Jacob & Co. Cal. JCAM37 · tourbillon with W16 engine animation",
    waterResistanceM: 30,
    caseMaterial: "18k rose gold / baguette-sapphire / ruby + diamond variants",
    strapMaterial: "Blue or red Alcantara-rubber composite with branded buckle",
    madeIn: "Switzerland",
    condition: "new",
    fullSet: true,
    packaging: ["box", "papers", "warranty-card", "manual"],
    authenticity: "original-brand",
    warrantyNote: "Jacob & Co. international warranty · Bugatti licensed series.",
    shippingScope: ["local", "export", "pickup-only"],
    pricingModes: ["retail"],
    priceNote: "Six to seven figures depending on variant · private viewing recommended · price on request.",
    complications: ["inclined-tourbillon", "animated-w16-engine-replica"],
  },
  {
    id: "dev-video-hendra-09",
    title: "Patek Philippe Grandmaster Chime Ref. 6300",
    caption: null,
    filename: "snaptik_7673173245784378654_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["watch", "patek-philippe", "grandmaster-chime"],
    durationSeconds: null,
    byteSize: 5_976_883,
    publishedAtIso: "2026-10-26T08:40:00Z",
    watchBrand: "Patek Philippe",
    watchModel: "Grandmaster Chime · Ref. 6300",
    watchHeadline: "Patek Philippe · Grandmaster Chime 6300",
    watchDescription:
      "Hand-engraved rose gold case with laurel-leaf bezel · dual-dial reversible design · 20 complications including Grande & Petite Sonnerie, minute repeater, alarm, perpetual calendar, moon phase, second time zone, date repeater. One of the most complicated Patek wristwatches ever made · availability and private viewing on request.",
    caseDiameterMm: 47.7,
    caseThicknessMm: 16.1,
    movement: "manual-wind",
    movementCaliber: "Patek Cal. 300 GS AL 36-750 QIS FUS IRM",
    waterResistanceM: 30,
    caseMaterial: "18k rose gold · hand-engraved",
    strapMaterial: "Hand-stitched brown alligator with 18k rose gold fold-over clasp",
    madeIn: "Switzerland",
    condition: "new",
    fullSet: true,
    packaging: ["box", "papers", "warranty-card", "manual", "service-card"],
    authenticity: "original-brand",
    warrantyNote: "Patek Philippe lifetime maintenance offer · papers to be transferred on sale.",
    shippingScope: ["pickup-only"],
    pricingModes: ["retail"],
    priceNote: "Grail-tier · one of only 20 examples made in rose gold · seven-figure USD · private viewing only.",
    productionYear: 2020,
    dialColor: "Silvery opaline with Roman numerals",
    complications: [
      "grande-sonnerie",
      "petite-sonnerie",
      "minute-repeater",
      "alarm",
      "date-repeater",
      "perpetual-calendar",
      "moonphase",
      "second-time-zone",
      "day-night-indicator",
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  // Owner directive 2026-10-28 · W-6 · 6 additional Hendra watch videos.
  // Still-frame identifications below are best-effort visual reads of
  // middle-frames extracted via OpenCV (scripts/extract-frames-6.py).
  // Where brand/model is not legible in the clip, fields are marked
  // "on request" per the sealed R3d doctrine (no fabricated brands).
  // ─────────────────────────────────────────────────────────────────────

  {
    id: "dev-video-hendra-10",
    title: "Dual-Time Watch · World Map + Classic",
    caption: null,
    filename: "snaptik_7690132468275498253_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["watch", "dual-time", "world-map"],
    durationSeconds: 12,
    byteSize: 1_100_369,
    publishedAtIso: "2026-10-28T08:00:00Z",
    watchBrand: "Brand · On Request",
    watchModel: "On Request",
    watchHeadline: "Dual-Dial Watch · World Map + Classic",
    watchDescription:
      "Single black case with two integrated dial-watches side by side · left dial is a world-map GMT with 12-hour arabic numerals · right dial is a classic time dial with stick markers and a crown-shaped logo. Shot on wet rocks with ocean spray · brand signature partially legible in the clip. Brand, model, reference and full condition report on request.",
    movement: "automatic",
    caseMaterial: "Black · finish on request",
    strapMaterial: "On request",
    condition: "on-request",
    fullSet: false,
    authenticity: "on-request",
    warrantyNote: "On request.",
    shippingScope: ["local", "domestic"],
    pricingModes: ["retail"],
    priceNote: "On Request · boutique dual-watch piece · pricing on verification of brand.",
    dialColor: "Dual dial · world-map + classic",
    complications: ["gmt", "second-time-zone"],
  },
  {
    id: "dev-video-hendra-11",
    title: "Nordgreen Infinity Petite · Blue",
    caption: null,
    filename: "snaptik_7691193978569395470_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["watch", "nordgreen", "infinity-petite"],
    durationSeconds: 13,
    byteSize: 773_950,
    publishedAtIso: "2026-10-28T08:05:00Z",
    watchBrand: "Nordgreen",
    watchModel: "Infinity Petite · Blue",
    watchHeadline: "Nordgreen · Infinity Petite · Blue",
    watchDescription:
      "Nordgreen Infinity Petite with blue sunray dial and polished silver-tone round case. Milanese mesh bracelet. Minimalist Danish design · dauphine hands · ultra-slim profile. Brand confirmed from original Nordgreen Infinity Petite packaging visible in the clip.",
    movement: "quartz-battery",
    caseMaterial: "Stainless steel · silver-tone",
    strapMaterial: "Milanese mesh · silver-tone",
    madeIn: "Switzerland (Nordgreen Danish design)",
    condition: "new",
    fullSet: true,
    packaging: ["box"],
    authenticity: "original-brand",
    warrantyNote: "Nordgreen 2-year international warranty · papers on request.",
    shippingScope: ["local", "domestic", "export"],
    pricingModes: ["retail"],
    priceNote: "New in box · Nordgreen Infinity Petite retail.",
    dialColor: "Blue sunray",
    complications: [],
    buyNowPriceIdr: 2_500_000,
  },
  {
    id: "dev-video-hendra-12",
    title: "Jewelry Watch · Green MOP Dial · 12 Gem Markers",
    caption: null,
    filename: "snaptik_7691568982611987725_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["watch", "jewelry", "gem-set"],
    durationSeconds: 11,
    byteSize: 1_322_018,
    publishedAtIso: "2026-10-28T08:10:00Z",
    watchBrand: "Brand · On Request",
    watchModel: "On Request",
    watchHeadline: "Luxury Jewelry Watch · Green MOP · 12 Gem Markers",
    watchDescription:
      "Steel case with a green mother-of-pearl centre dial and twelve flower-shaped gemstone hour markers (alternating coloured stones) · snake/serpent motif on the dial centre · ribbon-stitched black leather strap. Boutique jewellery-grade piece · brand mark not legible in the clip · brand, model, reference and authenticity verification on request.",
    movement: "quartz-battery",
    caseMaterial: "Steel",
    strapMaterial: "Black leather with ribbon-style stitching",
    condition: "on-request",
    fullSet: false,
    authenticity: "on-request",
    warrantyNote: "On request.",
    shippingScope: ["local", "domestic"],
    pricingModes: ["retail"],
    priceNote: "On Request · jewelry-grade piece · brand verification required before pricing.",
    dialColor: "Green mother-of-pearl",
    complications: [],
  },
  {
    id: "dev-video-hendra-13",
    title: "Rose Gold Pavé Diamond Chronograph",
    caption: null,
    filename: "snaptik_7693088304782134542_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["watch", "chronograph", "diamonds", "rose-gold"],
    durationSeconds: 16,
    byteSize: 2_814_167,
    publishedAtIso: "2026-10-28T08:15:00Z",
    watchBrand: "Brand · On Request (Hublot-style)",
    watchModel: "On Request",
    watchHeadline: "Rose Gold Pavé Diamond Chronograph · Skeleton Dial",
    watchDescription:
      "Fully diamond-pavé rose gold case with skeletonised chronograph dial exposing the movement bridges · black rubber strap. Visual language matches a Hublot Big Bang Unico iced-out variant · the specific brand/model/reference is not legible in the clip. Full brand, authenticity verification, diamond grading and condition report on request.",
    movement: "automatic",
    caseMaterial: "Rose gold · fully diamond-pavé case + bezel",
    strapMaterial: "Black rubber",
    condition: "on-request",
    fullSet: false,
    authenticity: "on-request",
    warrantyNote: "On request.",
    shippingScope: ["local", "domestic"],
    pricingModes: ["retail"],
    priceNote: "Top-tier · fully pavé diamond rose gold · negotiable for serious inquiries only.",
    dialColor: "Skeleton · rose gold accents",
    complications: ["chronograph"],
    buyNowPriceIdr: 1_300_000_000,
  },
  {
    id: "dev-video-hendra-14",
    title: "Yellow Gold Cushion Chronograph · Blue Dial",
    caption: null,
    filename: "snaptik_7696085218729544973_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["watch", "chronograph", "cushion"],
    durationSeconds: 7,
    byteSize: 1_182_069,
    publishedAtIso: "2026-10-28T08:20:00Z",
    watchBrand: "Brand · On Request",
    watchModel: "On Request",
    watchHeadline: "Yellow Gold Cushion Chronograph · Blue Dial",
    watchDescription:
      "Yellow-gold cushion-shaped case with deep blue sunburst dial, two chronograph sub-dials, day/date aperture. Cushion geometry evokes Franck Muller Vanguard / Grimoldi territory · brand mark not legible in the clip. Brand, model, reference and full condition report on request.",
    movement: "automatic",
    caseMaterial: "Yellow gold-tone · finish on request",
    strapMaterial: "On request",
    condition: "on-request",
    fullSet: false,
    authenticity: "on-request",
    warrantyNote: "On request.",
    shippingScope: ["local", "domestic"],
    pricingModes: ["retail"],
    priceNote: "Mid-tier yellow gold cushion chronograph.",
    dialColor: "Blue sunburst",
    complications: ["chronograph", "day-date"],
    buyNowPriceIdr: 180_000_000,
  },
  {
    id: "dev-video-hendra-15",
    title: "Yellow Gold Chronograph · Green Dial · Open-Heart · Diamond Bezel",
    caption: null,
    filename: "snaptik_7673852249835097357_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["watch", "chronograph", "open-heart", "diamonds"],
    durationSeconds: 12,
    byteSize: 2_141_480,
    publishedAtIso: "2026-10-28T08:25:00Z",
    watchBrand: "Brand · On Request",
    watchModel: "On Request",
    watchHeadline: "Yellow Gold Chronograph · Green Dial · Open-Heart",
    watchDescription:
      "Yellow-gold case with diamond-set bezel · deep green dial with chronograph sub-dials and an open-heart aperture showing the balance wheel · brown leather strap. Shot worn on-wrist with a Lakers #74 jersey backdrop. Brand mark not legible in the clip · brand, model, reference, diamond grading and authenticity verification on request.",
    movement: "automatic",
    caseMaterial: "Yellow gold-tone · diamond-set bezel",
    strapMaterial: "Brown leather",
    condition: "on-request",
    fullSet: false,
    authenticity: "on-request",
    warrantyNote: "On request.",
    shippingScope: ["local", "domestic"],
    pricingModes: ["retail"],
    priceNote: "Diamond-set bezel + open-heart complication · brown leather strap.",
    dialColor: "Green",
    complications: ["chronograph", "open-heart"],
    buyNowPriceIdr: 225_000_000,
  },
];

const DEV_BUCKET = "nex-live-uploaded";
const DEV_OBJECT_PREFIX = "owner/first-live";

/** Build a public URL for a dev manifest entry. In dev the file
 *  lives at `/dev/live-videos/{filename}` served by Next.js static
 *  file middleware. */
export function devVideoPublicUrl(entry: DevVideoManifestEntry): string {
  return `/dev/live-videos/${entry.filename}`;
}

/** Owner directive 2026-10-25 · 5 mock dev NEX accounts seeded via
 *  `scripts/seed-dev-mock-accounts.mjs` into the sealed Supabase
 *  project `ijvqdvsvwtwxzcqmoqit`. Dev manifest entries rotate
 *  round-robin through these owners so the Live Message panel can
 *  resolve a real `nex_handle` + `display_name` + country when the
 *  viewer taps Message. Each dev video deterministically maps to
 *  one owner by `index % DEV_MOCK_OWNER_ACCOUNT_IDS.length`.
 *
 *  These five UUIDs are the deterministic ids inserted by the seed
 *  script · recognisable prefixes (1111.., 2222.., etc.) make
 *  cleanup trivial if the owner ever authorises it. */
export const DEV_MOCK_OWNER_ACCOUNT_IDS: readonly string[] = [
  "11111111-1111-4111-8111-111111111111", // nex-99901 · Sari Dewi
  "22222222-2222-4222-8222-222222222222", // nex-99902 · Rizky Pratama
  "33333333-3333-4333-8333-333333333333", // nex-99903 · Budi Setiawan
  "44444444-4444-4444-8444-444444444444", // nex-99904 · Maya Putri
  "55555555-5555-4555-8555-555555555555", // nex-99905 · Dika Ananda
];

function devOwnerForEntry(entry: DevVideoManifestEntry): string {
  // Round-robin by the entry's position in the manifest · deterministic.
  const idx = DEV_VIDEO_MANIFEST.findIndex((e) => e.id === entry.id);
  if (idx < 0) return DEV_MOCK_OWNER_ACCOUNT_IDS[0]!;
  return DEV_MOCK_OWNER_ACCOUNT_IDS[idx % DEV_MOCK_OWNER_ACCOUNT_IDS.length]!;
}

/** Project a dev-manifest entry into the UploadedVideoRow shape
 *  that the rest of the feed pipeline consumes. The dev-mode
 *  `owner_account_id` resolves to one of 5 seeded mock accounts
 *  (see DEV_MOCK_OWNER_ACCOUNT_IDS) so the Message panel renders a
 *  real broadcaster identity. `business_id` + `storage_bucket` keep
 *  their safe placeholder values. */
export function devManifestToRow(
  entry: DevVideoManifestEntry,
): UploadedVideoRow {
  return {
    id: entry.id,
    owner_account_id: devOwnerForEntry(entry),
    business_id: null,
    title: entry.title,
    caption: entry.caption,
    storage_bucket: DEV_BUCKET,
    storage_object_path: `${DEV_OBJECT_PREFIX}/${entry.filename}`,
    duration_seconds: entry.durationSeconds,
    width: null,
    height: null,
    byte_size: entry.byteSize,
    mime_type: "video/mp4",
    rights_declaration: "owner_content",
    country_of_origin: entry.countryOfOrigin,
    topic_tags: entry.topicTags,
    source: "owner_upload",
    visibility: "public",
    created_at: entry.publishedAtIso,
    published_at: entry.publishedAtIso,
    // Owner directive 2026-10-25 · Migration 221 · dev-only flag ·
    // defaults to false when the manifest entry omits it.
    is_ai_generated: entry.isAiGenerated === true,
  };
}

/** Dev-mode listing · fail-open · returns the manifest unchanged
 *  except projected into UploadedVideoRow shape. Mirrors the
 *  signature of the real `listPublishedUploadedVideos` so callers
 *  can swap between them. */
export function listDevUploadedVideos(opts: {
  readonly limit?: number;
} = {}): readonly UploadedVideoRow[] {
  const limit = Math.max(1, Math.min(100, opts.limit ?? DEV_VIDEO_MANIFEST.length));
  return DEV_VIDEO_MANIFEST
    .slice(0, limit)
    .map(devManifestToRow);
}

/** Dev-mode by-id lookup. Fail-open · null when absent. */
export function getDevUploadedVideoById(
  id: string,
): UploadedVideoRow | null {
  const entry = DEV_VIDEO_MANIFEST.find((e) => e.id === id);
  return entry ? devManifestToRow(entry) : null;
}

/** Is dev-mode local serving active? True when the ambient env
 *  flag `NEXT_PUBLIC_NEX_LIVE_DEV_MANIFEST` is `"1"` OR when the
 *  real Supabase target is unreachable (service-role missing). The
 *  owner provides the env flag · we never auto-flip it. */
export function isDevManifestActive(): boolean {
  if (typeof process === "undefined") return false;
  return process.env.NEXT_PUBLIC_NEX_LIVE_DEV_MANIFEST === "1";
}
