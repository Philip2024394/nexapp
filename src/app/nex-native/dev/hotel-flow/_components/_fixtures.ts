// src/app/nex-native/dev/hotel-flow/_components/_fixtures.ts
//
// All prototype data lives here. Clearly labelled illustrative content
// for the hotel-flow prototype. Does NOT persist. Does NOT touch any
// production table. Honest-null is the default for review scores,
// prices, availability, and verification evidence.

// ─── illustrative SVG helper · no external image loads ─────────────

export function makeIllustrativeSvg(label: string, hue: number, aspect: "4x3" | "16x9" | "1x1" = "4x3"): string {
  const w = aspect === "16x9" ? 800 : aspect === "1x1" ? 600 : 800;
  const h = aspect === "16x9" ? 450 : aspect === "1x1" ? 600 : 600;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='hsl(${hue},55%,80%)'/>
      <stop offset='100%' stop-color='hsl(${hue},40%,55%)'/>
    </linearGradient></defs>
    <rect width='${w}' height='${h}' fill='url(#g)'/>
    <text x='50%' y='48%' text-anchor='middle' font-family='Inter,sans-serif' font-size='26' font-weight='600' fill='#0F172A' opacity='0.72'>${label}</text>
    <text x='50%' y='56%' text-anchor='middle' font-family='Inter,sans-serif' font-size='11' fill='#334155' opacity='0.55' letter-spacing='2'>ILLUSTRATIVE</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ─── property shapes ───────────────────────────────────────────────

export interface PropertyFixture {
  readonly id: string;
  readonly name: string;
  readonly propertyType: "Hotel" | "Villa" | "Guesthouse" | "Apartment";
  readonly city: string;
  readonly region: string;
  readonly country: string;
  readonly address: string;
  readonly coordinates: { readonly lat: number; readonly lng: number };
  readonly ownerVerified: boolean;
  // Hero + gallery images (illustrative)
  readonly hero: readonly { readonly url: string; readonly alt: string }[];
  // Short description paragraph
  readonly description: string;
  // Facilities the hotel confirms it offers (owner-reported, prototype)
  readonly hotelOffers: ReadonlySet<string>;
  // Rooms as prototype content · prices DELIBERATELY null (honest)
  readonly rooms: readonly RoomFixture[];
  // Walking/driving landmarks (OSM-shaped)
  readonly nearby: readonly NearbyFixture[];
  // NEX review state · null means "no NEX reviews yet"
  readonly reviews: ReviewAggregateFixture | null;
}

export interface RoomFixture {
  readonly id: string;
  readonly name: string;
  readonly bedConfig: string;
  readonly maxOccupancy: number;
  readonly facilities: readonly string[];
  readonly imageUrl: string;
  readonly priceStatus: "unknown" | "on_request";
}

export interface NearbyFixture {
  readonly label: string;
  readonly osmKind: string;
  readonly walkMin?: number;
  readonly driveMin?: number;
}

export interface ReviewAggregateFixture {
  readonly overall: number;
  readonly count: number;
  readonly label: "Fair" | "Good" | "Very good" | "Excellent";
  readonly categories: readonly {
    readonly label: string;
    readonly score: number;
  }[];
}

// ─── Bumas Hotel · the primary fixture property ────────────────────

export const BUMAS: PropertyFixture = {
  id: "bumas",
  name: "Bumas Hotel",
  propertyType: "Hotel",
  city: "Denpasar",
  region: "Bali",
  country: "Indonesia",
  address: "Jl. Diponegoro No. 55 · 80114",
  coordinates: { lat: -8.6705, lng: 115.2126 },
  ownerVerified: true, // prototype · prod maps to business_claim VERIFIED
  hero: [
    { url: makeIllustrativeSvg("Bumas Hotel", 210, "4x3"), alt: "Hotel exterior · illustrative" },
    { url: makeIllustrativeSvg("Pool & garden", 170, "4x3"), alt: "Pool & garden · illustrative" },
    { url: makeIllustrativeSvg("Standard room", 32, "4x3"), alt: "Standard room · illustrative" },
    { url: makeIllustrativeSvg("Lobby", 290, "4x3"), alt: "Lobby · illustrative" },
    { url: makeIllustrativeSvg("Breakfast", 90, "4x3"), alt: "Breakfast · illustrative" },
  ],
  description:
    "Comfortable Denpasar accommodation close to Puputan Square and the Bali Museum. Walking distance to Pasar Badung and roughly 7 minutes on foot to Segara Beach. Suitable for short city stays and longer explorations of south Bali.",
  hotelOffers: new Set([
    "wifi",
    "parking",
    "pool",
    "air_conditioning",
    "breakfast",
    "front_desk_24h",
  ]),
  rooms: [
    {
      id: "standard",
      name: "Standard Room",
      bedConfig: "1 double bed",
      maxOccupancy: 2,
      facilities: ["wifi", "ac", "breakfast"],
      imageUrl: makeIllustrativeSvg("Standard room", 210, "4x3"),
      priceStatus: "on_request",
    },
    {
      id: "deluxe",
      name: "Deluxe Room",
      bedConfig: "1 double or 2 singles · garden view",
      maxOccupancy: 2,
      facilities: ["wifi", "ac", "breakfast", "pool"],
      imageUrl: makeIllustrativeSvg("Deluxe room", 32, "4x3"),
      priceStatus: "on_request",
    },
    {
      id: "family",
      name: "Family Suite",
      bedConfig: "1 double + 2 singles · separate living area",
      maxOccupancy: 4,
      facilities: ["wifi", "ac", "breakfast", "pool"],
      imageUrl: makeIllustrativeSvg("Family suite", 170, "4x3"),
      priceStatus: "on_request",
    },
  ],
  nearby: [
    { label: "Segara Beach", osmKind: "natural:beach", walkMin: 7 },
    { label: "Puputan Square", osmKind: "historic:monument", walkMin: 4 },
    { label: "Bali Museum", osmKind: "tourism:museum", walkMin: 6 },
    { label: "Pasar Badung (market)", osmKind: "shop:marketplace", walkMin: 9 },
    { label: "Ngurah Rai Airport", osmKind: "aeroway:aerodrome", driveMin: 30 },
    { label: "Terminal Ubung (bus)", osmKind: "public_transport:station", driveMin: 12 },
  ],
  // Honest-null · no fake reviews. The property has no NEX reviews yet.
  reviews: null,
};

// ─── additional properties for the Results screen ──────────────────

export const ALL_PROPERTIES: readonly PropertyFixture[] = [
  BUMAS,
  {
    id: "puri-santrian",
    name: "Puri Santrian Beach Resort",
    propertyType: "Hotel",
    city: "Sanur",
    region: "Bali",
    country: "Indonesia",
    address: "Jl. Cemara 35 · Sanur",
    coordinates: { lat: -8.7116, lng: 115.263 },
    ownerVerified: false,
    hero: [{ url: makeIllustrativeSvg("Puri Santrian", 32, "4x3"), alt: "Resort · illustrative" }],
    description: "Beachfront resort in Sanur with multiple pools and gardens.",
    hotelOffers: new Set(["wifi", "parking", "pool", "air_conditioning", "breakfast", "spa"]),
    rooms: [],
    nearby: [
      { label: "Sanur Beach", osmKind: "natural:beach", walkMin: 2 },
    ],
    reviews: null,
  },
  {
    id: "villa-kaba-kaba",
    name: "Villa Kaba Kaba",
    propertyType: "Villa",
    city: "Tabanan",
    region: "Bali",
    country: "Indonesia",
    address: "Jl. Kaba Kaba · Tabanan",
    coordinates: { lat: -8.5556, lng: 115.1222 },
    ownerVerified: false,
    hero: [{ url: makeIllustrativeSvg("Villa Kaba Kaba", 170, "4x3"), alt: "Villa · illustrative" }],
    description: "Private villa with pool, 15 minutes from Tanah Lot.",
    hotelOffers: new Set(["wifi", "parking", "pool", "air_conditioning"]),
    rooms: [],
    nearby: [
      { label: "Tanah Lot Temple", osmKind: "historic:monument", driveMin: 15 },
    ],
    reviews: null,
  },
  {
    id: "hotel-nikko",
    name: "Hotel Nikko Bali",
    propertyType: "Hotel",
    city: "Nusa Dua",
    region: "Bali",
    country: "Indonesia",
    address: "Jl. Pratama 70 · Nusa Dua",
    coordinates: { lat: -8.818, lng: 115.236 },
    ownerVerified: false,
    hero: [{ url: makeIllustrativeSvg("Hotel Nikko", 210, "4x3"), alt: "Hotel · illustrative" }],
    description: "Beach-cliff hotel with ocean views and private cove access.",
    hotelOffers: new Set(["wifi", "parking", "pool", "air_conditioning", "breakfast", "spa", "gym"]),
    rooms: [],
    nearby: [
      { label: "Nusa Dua Beach", osmKind: "natural:beach", walkMin: 3 },
    ],
    reviews: null,
  },
  {
    id: "ubud-rice-field-guesthouse",
    name: "Ubud Rice Field Guesthouse",
    propertyType: "Guesthouse",
    city: "Ubud",
    region: "Bali",
    country: "Indonesia",
    address: "Jl. Hanoman 42 · Ubud",
    coordinates: { lat: -8.5195, lng: 115.2638 },
    ownerVerified: true,
    hero: [{ url: makeIllustrativeSvg("Ubud Guesthouse", 90, "4x3"), alt: "Guesthouse · illustrative" }],
    description: "Family-run guesthouse surrounded by rice fields, 10 min walk to central Ubud.",
    hotelOffers: new Set(["wifi", "breakfast", "parking"]),
    rooms: [],
    nearby: [{ label: "Ubud Palace", osmKind: "historic:monument", walkMin: 10 }],
    reviews: null,
  },
];

export function getPropertyById(id: string): PropertyFixture | null {
  return ALL_PROPERTIES.find((p) => p.id === id) ?? null;
}

// ─── local services catalogue (Around Your Stay) ───────────────────

export interface LocalServiceCategory {
  readonly id: string;
  readonly label: string;
  readonly icon: string; // Icon name
  readonly hint: string;
  readonly supersededByHotelOffers?: readonly string[];
}

export const LOCAL_SERVICE_CATALOG: readonly LocalServiceCategory[] = [
  { id: "motorbike_rental", label: "Motorbike rental", icon: "motorbike", hint: "Explore at your own pace" },
  { id: "laundry", label: "Laundry", icon: "laundry", hint: "Fresh clothes during your stay", supersededByHotelOffers: ["laundry"] },
  { id: "massage_spa", label: "Massage & spa", icon: "spa", hint: "Relax nearby", supersededByHotelOffers: ["spa"] },
  { id: "private_driver", label: "Private driver", icon: "car", hint: "Airport transfers & day trips", supersededByHotelOffers: ["airport_shuttle"] },
  { id: "tours", label: "Day tours", icon: "map", hint: "Guided experiences nearby" },
  { id: "coworking", label: "Coworking", icon: "computer", hint: "Reliable Wi-Fi for a work day" },
];

export function visibleLocalCategoriesFor(property: PropertyFixture): readonly LocalServiceCategory[] {
  return LOCAL_SERVICE_CATALOG.filter((cat) => {
    if (!cat.supersededByHotelOffers) return true;
    return !cat.supersededByHotelOffers.some((k) => property.hotelOffers.has(k));
  });
}

// ─── providers per category (prototype illustrative providers) ─────

export interface LocalServiceProvider {
  readonly id: string;
  readonly categoryId: string;
  readonly name: string;
  readonly city: string;
  readonly distanceKm: number;
  readonly oneLiner: string;
  readonly imageUrl: string;
}

export const LOCAL_PROVIDERS: readonly LocalServiceProvider[] = [
  { id: "p1", categoryId: "motorbike_rental", name: "Sanur Scooter Co.", city: "Sanur", distanceKm: 1.2, oneLiner: "Delivered to your hotel", imageUrl: makeIllustrativeSvg("Scooter rental", 32, "4x3") },
  { id: "p2", categoryId: "motorbike_rental", name: "Bali Rider Rentals", city: "Denpasar", distanceKm: 2.4, oneLiner: "Daily & weekly plans", imageUrl: makeIllustrativeSvg("Rider rentals", 210, "4x3") },
  { id: "p3", categoryId: "laundry", name: "Fresh Laundry Sanur", city: "Sanur", distanceKm: 0.8, oneLiner: "Same-day drop off", imageUrl: makeIllustrativeSvg("Laundry", 170, "4x3") },
  { id: "p4", categoryId: "laundry", name: "Puri Washhouse", city: "Denpasar", distanceKm: 1.5, oneLiner: "Wash & fold per kilo", imageUrl: makeIllustrativeSvg("Washhouse", 90, "4x3") },
  { id: "p5", categoryId: "massage_spa", name: "Jiwa Spa", city: "Sanur", distanceKm: 0.6, oneLiner: "Traditional Balinese massage", imageUrl: makeIllustrativeSvg("Jiwa Spa", 290, "4x3") },
  { id: "p6", categoryId: "massage_spa", name: "Padma Wellness", city: "Denpasar", distanceKm: 1.1, oneLiner: "Walk-ins welcome", imageUrl: makeIllustrativeSvg("Padma Wellness", 320, "4x3") },
  { id: "p7", categoryId: "private_driver", name: "Nyoman Private Transport", city: "Denpasar", distanceKm: 0, oneLiner: "English-speaking, airport pickups", imageUrl: makeIllustrativeSvg("Private driver", 32, "4x3") },
  { id: "p8", categoryId: "private_driver", name: "Bali Day Drivers", city: "Denpasar", distanceKm: 0, oneLiner: "Full-day custom routes", imageUrl: makeIllustrativeSvg("Day drivers", 210, "4x3") },
  { id: "p9", categoryId: "tours", name: "Ubud Jungle Trek", city: "Ubud", distanceKm: 32, oneLiner: "Half-day guided walk", imageUrl: makeIllustrativeSvg("Jungle trek", 170, "4x3") },
  { id: "p10", categoryId: "tours", name: "Besakih Temple Tour", city: "Karangasem", distanceKm: 50, oneLiner: "Full-day cultural tour", imageUrl: makeIllustrativeSvg("Temple tour", 290, "4x3") },
  { id: "p11", categoryId: "coworking", name: "Dojo Bali Coworking", city: "Canggu", distanceKm: 18, oneLiner: "Day passes available", imageUrl: makeIllustrativeSvg("Coworking", 210, "4x3") },
];

export function providersForCategory(categoryId: string): readonly LocalServiceProvider[] {
  return LOCAL_PROVIDERS.filter((p) => p.categoryId === categoryId);
}

// ─── user trips fixture (My Trips screen) ──────────────────────────

export interface TripFixture {
  readonly id: string;
  readonly propertyId: string;
  readonly checkIn: string; // display label only
  readonly checkOut: string;
  readonly guests: number;
  readonly status: "request_sent" | "confirmed" | "past";
}

export const USER_TRIPS: readonly TripFixture[] = [
  { id: "t1", propertyId: "bumas", checkIn: "Oct 20", checkOut: "Oct 23", guests: 2, status: "request_sent" },
  { id: "t2", propertyId: "villa-kaba-kaba", checkIn: "Dec 10", checkOut: "Dec 14", guests: 4, status: "past" },
];

// ─── honest copy for empty states ──────────────────────────────────

export const COPY = {
  reviewsEmpty: "No NEX reviews yet · Ask the owner",
  priceEmpty: "Price confirmed on request",
  availabilityEmpty: "Availability confirmed on request",
  verificationUnclaimed: "Owner has not yet claimed this listing",
  verificationClaimed: "Owner-verified listing",
  requestSentNote: "The owner receives your request · they confirm price and availability · no instant booking yet.",
  prototypeNote: "Prototype content · fixture data for design review only.",
};
