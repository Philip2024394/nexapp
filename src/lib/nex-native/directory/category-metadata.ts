// src/lib/nex-native/directory/category-metadata.ts
//
// Static registry of per-category visitor-facing metadata · title,
// description, and hero image · for the NEX Directory detail page.
//
// Scope:
//   · Only categories listed in CATEGORY_METADATA get the richer
//     "card" presentation (image + description + title).
//   · Categories NOT listed fall back to the existing chip-only
//     treatment · we do NOT fabricate a description or image for
//     them. Missing data stays missing.
//
// Why TypeScript (not DB):
//   · Content changes (copy, image swaps) iterate often · code
//     commits are the right change-control surface for this.
//   · The images live as static assets under `public/` for CDN
//     caching · no per-request DB round trip.
//   · The sealed `nex.category_image_library` (migration 112) stays
//     authoritative for the ADR-0022 representative-illustration
//     pattern used by the listing cards · this module is a parallel
//     presentation layer for the detail page.
//
// Honesty contract:
//   · Images represent the CATEGORY as a whole, NOT the specific
//     business. The detail page's hero caption makes this explicit
//     ("Example image · owner has not uploaded photos").
//   · Descriptions describe what the category typically means
//     ("fast-food venue · typically serving…") · they never claim
//     anything specific to the individual business.

export interface CategoryMetadata {
  /** The vertical category slug as it appears in
   *  `nex.food_business.category` / `.categories` and projected onto
   *  DirectoryListingVM.categoryIds. Lowercase, kebab-case. */
  readonly slug: string;
  /** Human-readable section title (e.g. "Fast food"). */
  readonly title: string;
  /** Visitor-facing description · category-level, never
   *  business-specific. */
  readonly description: string;
  /** Public path to the hero image (served from /public). */
  readonly heroImageUrl: string;
  /** Alt text for the hero image · screen-reader friendly, honest. */
  readonly altText: string;
}

/**
 * Known-category registry. Add entries as new category images and
 * copy are approved. Entries NOT in this map fall back to the
 * chip-only presentation on the detail page · never a fabricated
 * description.
 */
export const CATEGORY_METADATA: Readonly<Record<string, CategoryMetadata>> =
  Object.freeze({
    "fast-food": Object.freeze({
      slug: "fast-food",
      title: "Fast food",
      description:
        "This business is listed on NEX as a fast-food venue · typically serving burgers, fries, cold drinks and quick-service meals. The owner may offer other items not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/fast-food/p01.png",
      altText: "Fast food · burger, fries, chicken, cold drink",
    }),
    hotel: Object.freeze({
      slug: "hotel",
      title: "Hotel",
      description:
        "This business is listed on NEX as a hotel · typically offering overnight rooms, breakfast and front-desk reception. The owner may offer other amenities not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/hotel/p02.png",
      altText: "Hotel · guest rooms and reception",
    }),
    villa: Object.freeze({
      slug: "villa",
      title: "Villa",
      description:
        "This business is listed on NEX as a villa · typically a self-contained property with private pool, kitchen and multiple bedrooms. The owner may offer other services not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/villa/p03.png",
      altText: "Villa · private pool and self-contained accommodation",
    }),
    products: Object.freeze({
      slug: "products",
      title: "Products",
      description:
        "This business is listed on NEX as a product retailer · typically selling items in-store or for delivery. The owner may stock other items not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/products/p04.png",
      altText: "Products · retail items on display",
    }),
    construction: Object.freeze({
      slug: "construction",
      title: "Construction",
      description:
        "This business is listed on NEX as a construction service · typically offering building, renovation and site works. The owner may offer other trades not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/construction/p05.png",
      altText: "Construction · building and site works",
    }),
    "car-service": Object.freeze({
      slug: "car-service",
      title: "Car service",
      description:
        "This business is listed on NEX as a car service · typically offering mechanical repair, inspection and routine maintenance. The owner may offer other vehicle services not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/car-service/p06.png",
      altText: "Car service · workshop and vehicle maintenance",
    }),
    "massage-spa": Object.freeze({
      slug: "massage-spa",
      title: "Massage and spa",
      description:
        "This business is listed on NEX as a massage and spa venue · typically offering body treatments, massages and wellness therapies. The owner may offer other services not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/massage-spa/p07.png",
      altText: "Massage and spa · wellness and body treatments",
    }),
    health: Object.freeze({
      slug: "health",
      title: "Health",
      description:
        "This business is listed on NEX as a health service · typically offering medical, dental or allied health consultations. The owner may provide other services not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/health/p08.png",
      altText: "Health · medical consultation and care",
    }),
    education: Object.freeze({
      slug: "education",
      title: "Education",
      description:
        "This business is listed on NEX as an education provider · typically offering classes, tutoring or training programmes. The owner may offer other courses not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/education/p09.png",
      altText: "Education · classroom and learning materials",
    }),
    travel: Object.freeze({
      slug: "travel",
      title: "Travel",
      description:
        "This business is listed on NEX as a travel service · typically offering tours, bookings or transfers. The owner may offer other travel packages not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/travel/p10.png",
      altText: "Travel · tours and bookings",
    }),
    nightclub: Object.freeze({
      slug: "nightclub",
      title: "Nightclub",
      description:
        "This business is listed on NEX as a nightclub · typically offering music, drinks and late-night entertainment. The owner may offer other events not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/nightclub/p11.png",
      altText: "Nightclub · music and nightlife",
    }),
    "currency-exchange": Object.freeze({
      slug: "currency-exchange",
      title: "Currency exchange",
      description:
        "This business is listed on NEX as a currency exchange · typically converting cash between major currencies at the posted rate. The owner may offer other financial services not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/currency-exchange/p12.png",
      altText: "Currency exchange · banknotes and conversion",
    }),
    gardening: Object.freeze({
      slug: "gardening",
      title: "Gardening",
      description:
        "This business is listed on NEX as a gardening service · typically offering plant care, landscaping and maintenance. The owner may offer other outdoor services not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/gardening/p13.png",
      altText: "Gardening · plants and landscaping",
    }),
    electronic: Object.freeze({
      slug: "electronic",
      title: "Electronics",
      description:
        "This business is listed on NEX as an electronics retailer or repair service · typically selling or servicing household and personal electronics. The owner may offer other brands or models not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/electronic/p14.png",
      altText: "Electronics · consumer devices",
    }),
    furniture: Object.freeze({
      slug: "furniture",
      title: "Furniture",
      description:
        "This business is listed on NEX as a furniture retailer or maker · typically selling home or office furniture. The owner may offer other pieces or custom work not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/furniture/p15.png",
      altText: "Furniture · home furnishings",
    }),
    clothes: Object.freeze({
      slug: "clothes",
      title: "Clothes",
      description:
        "This business is listed on NEX as a clothing retailer · typically selling garments, accessories or ready-to-wear items. The owner may stock other sizes or styles not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/clothes/p16.png",
      altText: "Clothes · garments and apparel",
    }),
    sports: Object.freeze({
      slug: "sports",
      title: "Sports",
      description:
        "This business is listed on NEX as a sports venue, shop or service · typically offering sporting goods, training or facilities. The owner may offer other activities not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/sports/p17.png",
      altText: "Sports · equipment and activity",
    }),
    pets: Object.freeze({
      slug: "pets",
      title: "Pets",
      description:
        "This business is listed on NEX as a pet shop or service · typically offering animal supplies, grooming or veterinary care. The owner may offer other services not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/pets/p18.png",
      altText: "Pets · animal supplies and care",
    }),
    "bike-motor-delivery": Object.freeze({
      slug: "bike-motor-delivery",
      title: "Bike and motor delivery",
      description:
        "This business is listed on NEX as a bike or motorbike delivery service · typically moving food, parcels or documents around the city. The owner may offer other routes not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/bike-motor-delivery/p19.png",
      altText: "Bike and motor delivery · courier on two wheels",
    }),
    "computer-services": Object.freeze({
      slug: "computer-services",
      title: "Computer services",
      description:
        "This business is listed on NEX as a computer service · typically offering repairs, upgrades, software support or networking. The owner may offer other services not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/computer-services/p20.png",
      altText: "Computer services · repairs and support",
    }),
    lawyers: Object.freeze({
      slug: "lawyers",
      title: "Lawyers",
      description:
        "This business is listed on NEX as a legal practice · typically offering consultation, representation or document services. The owner may handle other matters not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/lawyers/p21.png",
      altText: "Lawyers · legal consultation",
    }),
    "hair-salon": Object.freeze({
      slug: "hair-salon",
      title: "Hair salon",
      description:
        "This business is listed on NEX as a hair salon · typically offering cuts, styling, colour and treatments. The owner may offer other services not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/hair-salon/p22.png",
      altText: "Hair salon · styling chair and tools",
    }),
    plumbing: Object.freeze({
      slug: "plumbing",
      title: "Plumbing",
      description:
        "This business is listed on NEX as a plumbing service · typically offering installation, leak repair and drainage work. The owner may offer other trades not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/plumbing/p23.png",
      altText: "Plumbing · pipes and fittings",
    }),
    cleaning: Object.freeze({
      slug: "cleaning",
      title: "Cleaning",
      description:
        "This business is listed on NEX as a cleaning service · typically offering home or office cleaning on scheduled or one-off visits. The owner may offer other services not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/cleaning/p24.png",
      altText: "Cleaning · supplies and tools",
    }),
    farming: Object.freeze({
      slug: "farming",
      title: "Farming",
      description:
        "This business is listed on NEX as a farming operation · typically producing crops, livestock or farm goods. The owner may offer other produce not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/farming/p25.png",
      altText: "Farming · crops and farm produce",
    }),
    storage: Object.freeze({
      slug: "storage",
      title: "Storage",
      description:
        "This business is listed on NEX as a storage provider · typically offering unit rental for personal or business goods. The owner may offer other sizes or terms not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/storage/p26.png",
      altText: "Storage · units and warehouse",
    }),
    government: Object.freeze({
      slug: "government",
      title: "Government",
      description:
        "This listing is a government office or public institution · services and operating hours are set by the authority, not by NEX. For current procedures, forms or payment information, contact the office directly.",
      heroImageUrl: "/nex-category-images/government/p27.png",
      altText: "Government · public institution",
    }),
    photographer: Object.freeze({
      slug: "photographer",
      title: "Photographer",
      description:
        "This business is listed on NEX as a photography service · typically offering portraits, events or commercial shoots. The owner may offer other packages not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/photographer/p28.png",
      altText: "Photographer · camera and lens",
    }),
    "phone-services": Object.freeze({
      slug: "phone-services",
      title: "Phone services",
      description:
        "This business is listed on NEX as a phone service · typically offering device sales, repairs, SIM cards or top-ups. The owner may offer other services not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/phone-services/p29.png",
      altText: "Phone services · mobile devices and accessories",
    }),
  });

/** Look up a single category's metadata by slug. Returns null when the
 *  slug is not in the registry · the UI then shows the chip-only
 *  treatment for that category. Pure. */
export function getCategoryMetadata(
  slug: string | null | undefined,
): CategoryMetadata | null {
  if (typeof slug !== "string") return null;
  const normalized = slug.trim().toLowerCase();
  if (normalized.length === 0) return null;
  return CATEGORY_METADATA[normalized] ?? null;
}

/** Given an ordered list of category slugs (as the projector yields:
 *  vertical primary first, then secondaries), return the FIRST
 *  category that has registry metadata. Deterministic. Returns null
 *  when none of the row's categories are registered yet · the UI then
 *  skips the card presentation entirely and renders only chips. */
export function getPrimaryCategoryMetadata(
  categoryIds: readonly string[],
): CategoryMetadata | null {
  for (const slug of categoryIds) {
    const meta = getCategoryMetadata(slug);
    if (meta !== null) return meta;
  }
  return null;
}

/** Partition a list of category slugs into {known, unknown}. The
 *  detail page renders known categories as full cards and unknown
 *  ones as chips below. Preserves input order within each bucket. */
export function partitionCategories(
  categoryIds: readonly string[],
): {
  readonly known: readonly CategoryMetadata[];
  readonly unknown: readonly string[];
} {
  const known: CategoryMetadata[] = [];
  const unknown: string[] = [];
  const seenSlugs = new Set<string>();
  for (const raw of categoryIds) {
    if (typeof raw !== "string") continue;
    const slug = raw.trim().toLowerCase();
    if (slug.length === 0) continue;
    if (seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    const meta = getCategoryMetadata(slug);
    if (meta !== null) {
      known.push(meta);
    } else {
      unknown.push(raw.trim());
    }
  }
  return { known, unknown };
}
