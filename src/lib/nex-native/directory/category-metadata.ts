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
  /** Alternate slugs that resolve to this same metadata entry.
   *  Required when the acquisition engine wrote a slug that differs
   *  from this registry's canonical slug (e.g. the DB uses "salons"
   *  while this entry is keyed "hair-salon"). All alias lookups go
   *  through the same case- and whitespace-tolerant match path.
   *  Omitted entries have no aliases · the canonical slug is the
   *  only match. */
  readonly aliases?: readonly string[];
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
      title: "Hotel and overnight stays",
      description:
        "This business is listed on NEX as accommodation · hotels, guesthouses, hostels, kos, apartments, resorts or homestays. Rooms, amenities and nightly rates vary by property. For current availability or longer-stay terms, contact the business directly.",
      heroImageUrl: "/nex-category-images/hotel/p02.png",
      altText: "Hotel · guest rooms and reception",
      aliases: ["guesthouse", "hostel", "kos", "apartment", "resort", "homestay"],
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
        "This business is listed on NEX as a car service · mechanical repair, inspection, routine maintenance or wash. The owner may offer other vehicle services not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/car-service/p06.png",
      altText: "Car service · workshop and vehicle maintenance",
      aliases: ["car-repair", "car-wash", "car_repair", "car_wash"],
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
        "This business is listed on NEX as a health service · pharmacy, clinic, dental practice, optician or allied health. Specific services, prescriptions and consultations are set by the practice. For hours and availability, contact the business directly.",
      heroImageUrl: "/nex-category-images/health/p08.png",
      altText: "Health · medical consultation and care",
      aliases: ["pharmacy", "pharmacies", "clinic", "doctor", "doctors", "dentist", "dentists", "optician", "opticians"],
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
      title: "Sports and fitness",
      description:
        "This business is listed on NEX as a sports or fitness venue, shop or service · gyms, training facilities, sporting goods or coaching. For membership, class schedules or product availability, contact the business directly.",
      heroImageUrl: "/nex-category-images/sports/p17.png",
      altText: "Sports · equipment and activity",
      aliases: ["gym", "gyms", "fitness", "fitness-centre", "fitness-center"],
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
      title: "Hair and beauty salon",
      description:
        "This business is listed on NEX as a hair or beauty salon · cuts, styling, colour, nails or related treatments. The owner may offer other services not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/hair-salon/p22.png",
      altText: "Hair salon · styling chair and tools",
      aliases: ["salon", "salons", "beauty-salon", "hairdresser"],
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
    "leather-products": Object.freeze({
      slug: "leather-products",
      title: "Leather products",
      description:
        "This business is listed on NEX as a leather-goods retailer · typically selling belts, wallets, jackets, bags and other leather items. The owner may stock other goods not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/leather-products/p30.png",
      altText: "Leather products · belts, wallets and bags",
      aliases: ["leather"],
    }),
    "fish-seller": Object.freeze({
      slug: "fish-seller",
      title: "Fish seller",
      description:
        "This business is listed on NEX as a fishmonger · typically selling fresh fish, seafood and shellfish. Catch and availability vary daily · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/fish-seller/p31.png",
      altText: "Fish seller · fresh fish and seafood on display",
      aliases: ["seafood", "fishmonger"],
    }),
    "property-agent": Object.freeze({
      slug: "property-agent",
      title: "Property agent",
      description:
        "This business is listed on NEX as a property or estate agency · typically offering sales, rentals and property viewings. The agent may handle other services not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/property-agent/p32.png",
      altText: "Property agent · for-sale sign and keys",
      aliases: ["estate_agent", "estate-agent", "real-estate"],
    }),
    builder: Object.freeze({
      slug: "builder",
      title: "Builder",
      description:
        "This business is listed on NEX as a builder · typically offering new-build, renovation and structural works. The builder may offer other trades not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/builder/p33.png",
      altText: "Builder · plans, hard hat and construction tools",
      aliases: ["doityourself", "diy"],
    }),
    "car-taxi": Object.freeze({
      slug: "car-taxi",
      title: "Car and taxi",
      description:
        "This business is listed on NEX as a taxi or private-car service · typically offering point-to-point transport. Fares, availability and coverage vary · if in doubt, contact the operator directly.",
      heroImageUrl: "/nex-category-images/car-taxi/p34.png",
      altText: "Car and taxi · passenger vehicle for hire",
      aliases: ["taxi"],
    }),
    "shoe-seller": Object.freeze({
      slug: "shoe-seller",
      title: "Shoe seller",
      description:
        "This business is listed on NEX as a shoe retailer · typically selling men's, women's and children's footwear. The owner may stock other items not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/shoe-seller/p35.png",
      altText: "Shoe seller · pairs of shoes on display",
      aliases: ["shoes"],
    }),
    "coat-seller": Object.freeze({
      slug: "coat-seller",
      title: "Coat and clothes seller",
      description:
        "This business is listed on NEX as a clothing retailer · typically selling coats, jackets and other outerwear. Styles and sizes vary · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/coat-seller/p36.png",
      altText: "Coat and clothes seller · outerwear on display",
      aliases: ["clothes", "clothing", "fashion"],
    }),
    "handbag-seller": Object.freeze({
      slug: "handbag-seller",
      title: "Handbag seller",
      description:
        "This business is listed on NEX as a handbag retailer · typically selling bags, purses and small leather goods. The owner may stock other items not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/handbag-seller/p37.png",
      altText: "Handbag seller · bags and purses on display",
      aliases: ["bag", "bags", "handbag"],
    }),
    "brick-layer": Object.freeze({
      slug: "brick-layer",
      title: "Brick layer",
      description:
        "This business is listed on NEX as a bricklayer or masonry trade · typically offering brickwork, blockwork and small structural builds. The tradesperson may offer related services not shown here · if in doubt, contact them directly.",
      heroImageUrl: "/nex-category-images/brick-layer/p38.png",
      altText: "Brick layer · brickwork in progress",
      aliases: ["bricklayer", "mason"],
    }),
    "baby-clothes": Object.freeze({
      slug: "baby-clothes",
      title: "Baby clothes",
      description:
        "This business is listed on NEX as a baby-goods retailer · typically selling infant clothing, accessories and nursery items. The owner may stock other items not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/baby-clothes/p39.png",
      altText: "Baby clothes · infant outfits and accessories",
      aliases: ["baby_goods", "baby-goods"],
    }),
    vitamins: Object.freeze({
      slug: "vitamins",
      title: "Vitamins and supplements",
      description:
        "This business is listed on NEX as a vitamins or supplements retailer · typically selling health supplements, protein and nutrition products. For medical or clinical advice, consult a qualified professional · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/vitamins/p40.png",
      altText: "Vitamins · supplement bottles on display",
      aliases: ["nutrition_supplements", "health_food", "supplements"],
    }),
    "make-up": Object.freeze({
      slug: "make-up",
      title: "Make-up and cosmetics",
      description:
        "This business is listed on NEX as a cosmetics retailer · typically selling make-up, skincare and beauty products. The owner may stock other items not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/make-up/p41.png",
      altText: "Make-up · cosmetics palette and brushes",
      aliases: ["cosmetics", "makeup"],
    }),
    "pet-supplies": Object.freeze({
      slug: "pet-supplies",
      title: "Pet supplies",
      description:
        "This business is listed on NEX as a pet-supply retailer · typically selling food, toys and accessories for cats, dogs and other pets. The owner may stock other items not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/pet-supplies/p42.png",
      altText: "Pet supplies · pet food, toys and accessories",
      aliases: ["pet", "pet_store"],
    }),
    "garden-supplies": Object.freeze({
      slug: "garden-supplies",
      title: "Garden supplies",
      description:
        "This business is listed on NEX as a garden centre or supply store · typically selling plants, tools, soil and outdoor equipment. The owner may stock other items not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/garden-supplies/p43.png",
      altText: "Garden supplies · plants, pots and tools",
      aliases: ["garden_centre", "garden-centre", "garden"],
    }),
    "home-appliances": Object.freeze({
      slug: "home-appliances",
      title: "Home appliances",
      description:
        "This business is listed on NEX as a home-appliance retailer · typically selling kitchen, laundry and household electrical goods. The owner may stock other items not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/home-appliances/p44.png",
      altText: "Home appliances · washing machine, fridge and small appliances",
      aliases: ["appliance", "appliances"],
    }),
    "language-teacher": Object.freeze({
      slug: "language-teacher",
      title: "Language teacher",
      description:
        "This business is listed on NEX as a language school or tutor · typically offering lessons in English, Bahasa Indonesia and other languages. Lesson formats, prices and schedules vary · contact the teacher directly for current offerings.",
      heroImageUrl: "/nex-category-images/language-teacher/aa1.png",
      altText: "Language teacher · classroom and language books",
      aliases: ["language_school", "language-school"],
    }),
    "tour-guide": Object.freeze({
      slug: "tour-guide",
      title: "Tour guide",
      description:
        "This business is listed on NEX as a tour guide or tourism-information service · typically offering guided tours, trip planning and local expertise. Services and prices vary · contact the operator directly for availability.",
      heroImageUrl: "/nex-category-images/tour-guide/aa2.png",
      altText: "Tour guide · map, compass and tour group",
      aliases: ["tourguide", "guide", "tourism-information"],
    }),
    carpenter: Object.freeze({
      slug: "carpenter",
      title: "Carpenter",
      description:
        "This business is listed on NEX as a carpenter · typically offering furniture building, fitting and wood-work repairs. The tradesperson may offer related services not shown here · if in doubt, contact them directly.",
      heroImageUrl: "/nex-category-images/carpenter/aa3.png",
      altText: "Carpenter · woodworking tools and timber",
    }),
    "ac-service": Object.freeze({
      slug: "ac-service",
      title: "AC service",
      description:
        "This business is listed on NEX as an air-conditioning service · typically offering installation, cleaning and repair of AC units. The owner may offer other HVAC services not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/ac-service/aa4.png",
      altText: "AC service · air-conditioning unit and technician",
      aliases: ["hvac", "air-conditioning"],
    }),
    bars: Object.freeze({
      slug: "bars",
      title: "Bars",
      description:
        "This business is listed on NEX as a bar or pub · typically serving drinks, light food and evening entertainment. Hours, menu and age rules vary · contact the venue directly for current details.",
      heroImageUrl: "/nex-category-images/bars/aa5.png",
      altText: "Bars · bottles, glasses and bar counter",
      aliases: ["bar", "pub"],
    }),
    "bike-taxi": Object.freeze({
      slug: "bike-taxi",
      title: "Bike taxi",
      description:
        "This business is listed on NEX as a motorcycle or bike taxi service · typically offering point-to-point passenger transport. Fares, availability and coverage vary · contact the operator directly.",
      heroImageUrl: "/nex-category-images/bike-taxi/aa6.png",
      altText: "Bike taxi · motorcycle with helmet",
      aliases: ["motorcycle_taxi", "ojek"],
    }),
    "bus-service": Object.freeze({
      slug: "bus-service",
      title: "Bus service",
      description:
        "This listing is a bus station or bus operator · services, routes and timetables are set by the operator, not by NEX. For current routes and ticket prices, contact the operator directly.",
      heroImageUrl: "/nex-category-images/bus-service/aa7.png",
      altText: "Bus service · bus and bus-stop sign",
      aliases: ["bus_station"],
    }),
    "train-service": Object.freeze({
      slug: "train-service",
      title: "Train service",
      description:
        "This listing is a train station or railway operator · services, routes and timetables are set by the operator, not by NEX. For current services, contact the operator directly.",
      heroImageUrl: "/nex-category-images/train-service/aa8.png",
      altText: "Train service · train and station platform",
      aliases: ["railway", "station"],
    }),
    "police-stations": Object.freeze({
      slug: "police-stations",
      title: "Police stations",
      description:
        "This listing is a police station · services, emergency contacts and jurisdiction are set by the authority, not by NEX. For emergencies, call the official number.",
      heroImageUrl: "/nex-category-images/police-stations/aa9.png",
      altText: "Police station · police building and signage",
      aliases: ["police"],
    }),
    hospitals: Object.freeze({
      slug: "hospitals",
      title: "Hospitals",
      description:
        "This listing is a hospital or clinical facility · services, specialities and admission rules are set by the facility, not by NEX. For medical advice or emergencies, contact a qualified healthcare provider directly.",
      heroImageUrl: "/nex-category-images/hospitals/aa10.png",
      altText: "Hospitals · hospital building and medical cross",
      aliases: ["hospital", "clinic"],
    }),
    restaurants: Object.freeze({
      slug: "restaurants",
      title: "Restaurants",
      description:
        "This business is listed on NEX as a restaurant · typically offering sit-down meals, drinks and service. Menu, hours and prices vary · contact the restaurant directly for current details.",
      heroImageUrl: "/nex-category-images/restaurants/aa11.png",
      altText: "Restaurants · dining table and prepared plates",
      aliases: ["restaurant"],
    }),
    "super-market": Object.freeze({
      slug: "super-market",
      title: "Supermarket",
      description:
        "This business is listed on NEX as a supermarket · typically offering groceries, fresh produce, household goods and daily essentials. The owner may stock other items not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/super-market/aa12.png",
      altText: "Supermarket · aisle with shopping cart",
      aliases: ["supermarket"],
    }),
    "petrol-station": Object.freeze({
      slug: "petrol-station",
      title: "Petrol station",
      description:
        "This listing is a fuel or petrol station · typically selling petrol, diesel and sometimes LPG, with associated shop services. Hours and payment methods vary · if in doubt, contact the station directly.",
      heroImageUrl: "/nex-category-images/petrol-station/aa13.png",
      altText: "Petrol station · fuel pumps and canopy",
      aliases: ["fuel", "gas-station", "spbu"],
    }),
    "atm-machines": Object.freeze({
      slug: "atm-machines",
      title: "ATM machines",
      description:
        "This listing is an ATM · operating hours, supported cards and fees are set by the issuing bank, not by NEX. Check with your bank before relying on this ATM for large withdrawals.",
      heroImageUrl: "/nex-category-images/atm-machines/aa14.png",
      altText: "ATM · automated teller machine",
      aliases: ["atm"],
    }),
    banks: Object.freeze({
      slug: "banks",
      title: "Banks",
      description:
        "This listing is a bank branch · services, opening hours and fees are set by the bank, not by NEX. For account or product information, contact the bank directly.",
      heroImageUrl: "/nex-category-images/banks/aa15.png",
      altText: "Banks · bank branch and signage",
      aliases: ["bank"],
    }),
    "bike-rental": Object.freeze({
      slug: "bike-rental",
      title: "Bike rental",
      description:
        "This business is listed on NEX as a bicycle- or motorbike-rental service · typically offering hourly, daily or weekly hire. Rates, deposits and insurance vary · contact the operator directly.",
      heroImageUrl: "/nex-category-images/bike-rental/aa16.png",
      altText: "Bike rental · row of bicycles",
      aliases: ["bicycle_rental", "motorcycle_rental"],
    }),
    "car-rental": Object.freeze({
      slug: "car-rental",
      title: "Car rental",
      description:
        "This business is listed on NEX as a car-rental service · typically offering self-drive or chauffeur hire. Rates, deposits and insurance vary · contact the operator directly.",
      heroImageUrl: "/nex-category-images/car-rental/aa17.png",
      altText: "Car rental · fleet of rental cars",
      aliases: ["car_rental"],
    }),
    "barber-hair": Object.freeze({
      slug: "barber-hair",
      title: "Barber and hair",
      description:
        "This business is listed on NEX as a barber or hair-cut service · typically offering men's and women's cuts, styling and shaves. Services and prices vary · contact the business directly for current offerings.",
      heroImageUrl: "/nex-category-images/barber-hair/aa18.png",
      altText: "Barber · barber chair and tools",
      aliases: ["barber", "hairdresser"],
    }),
    "relax-therapy": Object.freeze({
      slug: "relax-therapy",
      title: "Relaxation therapy",
      description:
        "This business is listed on NEX as a relaxation or wellness-therapy service · typically offering massages, aromatherapy or restorative treatments. Services vary · contact the business directly for details.",
      heroImageUrl: "/nex-category-images/relax-therapy/aa19.png",
      altText: "Relaxation therapy · candle, oils and treatment room",
    }),
    laundry: Object.freeze({
      slug: "laundry",
      title: "Laundry",
      description:
        "This business is listed on NEX as a laundry service · typically offering wash, dry, iron and dry-clean services. Turnaround and prices vary · contact the business directly.",
      heroImageUrl: "/nex-category-images/laundry/aa20.png",
      altText: "Laundry · washing machines and folded clothes",
    }),
    florist: Object.freeze({
      slug: "florist",
      title: "Florist",
      description:
        "This business is listed on NEX as a florist · typically selling fresh flowers, bouquets and arrangements for events and gifts. Stock varies by season · contact the business directly.",
      heroImageUrl: "/nex-category-images/florist/aa21.png",
      altText: "Florist · bouquet of flowers",
      aliases: ["flowers"],
    }),
    "wedding-agents": Object.freeze({
      slug: "wedding-agents",
      title: "Wedding agents",
      description:
        "This business is listed on NEX as a wedding or event-planning agency · typically offering venue booking, catering coordination and bridal services. Packages vary · contact the agency directly.",
      heroImageUrl: "/nex-category-images/wedding-agents/aa22.png",
      altText: "Wedding agent · bride, groom and rings",
      aliases: ["wedding-planner", "event-planner"],
    }),
    maintenance: Object.freeze({
      slug: "maintenance",
      title: "Maintenance",
      description:
        "This business is listed on NEX as a general-maintenance or handyman service · typically offering small repairs, fittings and household fixes. The tradesperson may offer related services not shown here · if in doubt, contact them directly.",
      heroImageUrl: "/nex-category-images/maintenance/aa23.png",
      altText: "Maintenance · tool belt and repair tools",
      aliases: ["handyman"],
    }),
    "cargo-company": Object.freeze({
      slug: "cargo-company",
      title: "Cargo and logistics",
      description:
        "This business is listed on NEX as a cargo or logistics operator · typically offering freight, parcel and warehousing services. Routes, rates and tracking vary · contact the operator directly.",
      heroImageUrl: "/nex-category-images/cargo-company/aa24.png",
      altText: "Cargo company · shipping container and lorry",
      aliases: ["logistics", "freight"],
    }),
    "laptop-repair": Object.freeze({
      slug: "laptop-repair",
      title: "Laptop and electronics repair",
      description:
        "This business is listed on NEX as a laptop or electronics-repair service · typically offering diagnostics, screen replacements, data recovery and other repairs. Services and prices vary · contact the business directly.",
      heroImageUrl: "/nex-category-images/laptop-repair/aa25.png",
      altText: "Laptop repair · open laptop and repair tools",
      aliases: ["electronics-repair", "computer-repair"],
    }),
    "bakso-soup": Object.freeze({
      slug: "bakso-soup",
      title: "Bakso soup",
      description:
        "This business is listed on NEX as a bakso vendor · typically serving Indonesian meatball soup, often with noodles and fried tofu. Menu and hours vary · contact the business directly for current offerings.",
      heroImageUrl: "/nex-category-images/bakso-soup/aa26.png",
      altText: "Bakso soup · bowl of Indonesian meatball soup",
      aliases: ["bakso"],
    }),
    "noodle-soup": Object.freeze({
      slug: "noodle-soup",
      title: "Noodle soup",
      description:
        "This business is listed on NEX as a noodle-soup vendor · typically serving mie, ramen, pho or similar hot noodle dishes. Menu varies · contact the business directly for current offerings.",
      heroImageUrl: "/nex-category-images/noodle-soup/aa27.png",
      altText: "Noodle soup · bowl of noodles and broth",
      aliases: ["noodle", "mie"],
    }),
    pizza: Object.freeze({
      slug: "pizza",
      title: "Pizza",
      description:
        "This business is listed on NEX as a pizza outlet · typically offering dine-in, takeaway or delivery pizza. Menu and hours vary · contact the business directly for current offerings.",
      heroImageUrl: "/nex-category-images/pizza/aa28.png",
      altText: "Pizza · pizza slice and whole pie",
    }),
    spaghetti: Object.freeze({
      slug: "spaghetti",
      title: "Spaghetti and Italian",
      description:
        "This business is listed on NEX as a spaghetti or Italian-food venue · typically serving pasta, pizza and other Italian dishes. Menu varies · contact the business directly for current offerings.",
      heroImageUrl: "/nex-category-images/spaghetti/aa29.png",
      altText: "Spaghetti · plate of pasta",
      aliases: ["italian", "pasta"],
    }),
    "rice-bowl": Object.freeze({
      slug: "rice-bowl",
      title: "Rice bowl",
      description:
        "This business is listed on NEX as a rice-bowl venue · typically serving Indonesian or Asian rice bowls with meat, vegetables and sauce. Menu varies · contact the business directly for current offerings.",
      heroImageUrl: "/nex-category-images/rice-bowl/aa30.png",
      altText: "Rice bowl · bowl of rice with toppings",
    }),
    steak: Object.freeze({
      slug: "steak",
      title: "Steak",
      description:
        "This business is listed on NEX as a steakhouse · typically serving beef steaks, grills and side dishes. Menu and prices vary · contact the business directly for current offerings.",
      heroImageUrl: "/nex-category-images/steak/aa31.png",
      altText: "Steak · grilled steak and sides",
      aliases: ["steak-house", "steak_house"],
    }),
    "grilled-fish": Object.freeze({
      slug: "grilled-fish",
      title: "Grilled fish",
      description:
        "This business is listed on NEX as a grilled-fish or seafood venue · typically serving ikan bakar, grilled seafood and side dishes. Menu varies · contact the business directly for current offerings.",
      heroImageUrl: "/nex-category-images/grilled-fish/aa32.png",
      altText: "Grilled fish · ikan bakar on a plate",
      aliases: ["ikan-bakar", "seafood-grill"],
    }),
    "meat-kebab": Object.freeze({
      slug: "meat-kebab",
      title: "Meat kebab",
      description:
        "This business is listed on NEX as a kebab outlet · typically serving grilled meat kebabs, shawarma and related dishes. Menu varies · contact the business directly for current offerings.",
      heroImageUrl: "/nex-category-images/meat-kebab/aa33.png",
      altText: "Meat kebab · skewer of grilled meat",
      aliases: ["kebab", "shawarma"],
    }),
    sandwiches: Object.freeze({
      slug: "sandwiches",
      title: "Sandwiches",
      description:
        "This business is listed on NEX as a sandwich venue · typically serving burgers, wraps and sandwiches. Menu varies · contact the business directly for current offerings.",
      heroImageUrl: "/nex-category-images/sandwiches/aa34.png",
      altText: "Sandwiches · sandwich and wrap",
      aliases: ["sandwich"],
    }),
    nails: Object.freeze({ slug: "nails", title: "Nails", description: "This business is listed on NEX as a nail salon · typically offering manicures, pedicures and nail art. Services and prices vary · contact the business directly for current offerings.", heroImageUrl: "/nex-category-images/nails/b01.png", altText: "Nails · manicure in progress", aliases: ["nail-salon"] }),
    "foot-massage": Object.freeze({ slug: "foot-massage", title: "Foot massage", description: "This business is listed on NEX as a foot-massage venue · typically offering reflexology and foot-care services. Services vary · contact the business directly.", heroImageUrl: "/nex-category-images/foot-massage/b02.png", altText: "Foot massage · reflexology session", aliases: ["reflexology"] }),
    "pet-grooming": Object.freeze({ slug: "pet-grooming", title: "Pet grooming", description: "This business is listed on NEX as a pet-grooming service · typically offering bathing, trimming and nail-clipping for cats and dogs. Services vary · contact the business directly.", heroImageUrl: "/nex-category-images/pet-grooming/b03.png", altText: "Pet grooming · dog being groomed", aliases: ["pet-groomer"] }),
    "home-doctor": Object.freeze({ slug: "home-doctor", title: "Home doctor", description: "This listing refers to a healthcare provider offering home-visit services · services, specialties and fees are set by the provider, not by NEX. For medical advice or emergencies, contact a qualified healthcare provider directly.", heroImageUrl: "/nex-category-images/home-doctor/b04.png", altText: "Home doctor · medical bag and visit", aliases: ["house-call-doctor"] }),
    dentist: Object.freeze({ slug: "dentist", title: "Dentist", description: "This listing is a dental practice · services, specialties and fees are set by the clinic, not by NEX. For dental advice or emergencies, contact a qualified dentist directly.", heroImageUrl: "/nex-category-images/dentist/b05.png", altText: "Dentist · dental chair and tools", aliases: ["dental-clinic", "dentists"] }),
    "kebab-house": Object.freeze({ slug: "kebab-house", title: "Kebab house", description: "This business is listed on NEX as a kebab outlet · typically serving grilled meat kebabs, wraps and sides. Menu varies · contact the business directly.", heroImageUrl: "/nex-category-images/kebab-house/b06.png", altText: "Kebab house · grilled kebab platter", aliases: ["kebab", "meat-kebab"] }),
    "ice-cream": Object.freeze({ slug: "ice-cream", title: "Ice cream", description: "This business is listed on NEX as an ice-cream parlour · typically serving scoops, cones, sundaes and dessert specials. Flavours vary · contact the business directly.", heroImageUrl: "/nex-category-images/ice-cream/b07.png", altText: "Ice cream · scoops and cone", aliases: ["icecream", "gelato"] }),
    karaoke: Object.freeze({ slug: "karaoke", title: "Karaoke", description: "This business is listed on NEX as a karaoke venue · typically offering private rooms with sing-along systems and drinks. Prices and hours vary · contact the venue directly.", heroImageUrl: "/nex-category-images/karaoke/b08.png", altText: "Karaoke · microphone and stage lights", aliases: ["ktv"] }),
    "post-office": Object.freeze({ slug: "post-office", title: "Post office", description: "This listing is a post office · services, operating hours and parcel rules are set by the postal authority, not by NEX. For current services, contact the office directly.", heroImageUrl: "/nex-category-images/post-office/b09.png", altText: "Post office · envelopes and parcels", aliases: ["postal-service"] }),
    "air-cargo": Object.freeze({ slug: "air-cargo", title: "Air cargo", description: "This business is listed on NEX as an air-cargo or courier operator · typically offering domestic and international freight by air. Rates, routes and documentation vary · contact the operator directly.", heroImageUrl: "/nex-category-images/air-cargo/b010.png", altText: "Air cargo · plane and freight pallets", aliases: ["air-freight"] }),
    "bike-rental-v2": Object.freeze({ slug: "bike-rental-v2", title: "Bike rental", description: "This business is listed on NEX as a bicycle- or motorbike-rental service · typically offering hourly, daily or weekly hire. Rates and deposits vary · contact the operator directly.", heroImageUrl: "/nex-category-images/bike-rental-v2/b011.png", altText: "Bike rental · bicycles for hire", aliases: ["bike-rental"] }),
    "car-driver": Object.freeze({ slug: "car-driver", title: "Car driver", description: "This business is listed on NEX as a private-car driver for hire · typically offering point-to-point and day-rate transport. Rates and coverage vary · contact the driver directly.", heroImageUrl: "/nex-category-images/car-driver/b012.png", altText: "Car driver · driver and passenger car", aliases: ["private-driver"] }),
    "truck-transport": Object.freeze({ slug: "truck-transport", title: "Truck transportation", description: "This business is listed on NEX as a truck-transport operator · typically offering heavy-freight and goods haulage. Routes and rates vary · contact the operator directly.", heroImageUrl: "/nex-category-images/truck-transport/b013.png", altText: "Truck transportation · freight truck", aliases: ["freight-truck"] }),
    beaches: Object.freeze({ slug: "beaches", title: "Beaches", description: "This listing is a beach or waterfront destination · facilities and access are managed locally, not by NEX. Visit at your own discretion and check conditions.", heroImageUrl: "/nex-category-images/beaches/b014.png", altText: "Beaches · sand and sea" }),
    temples: Object.freeze({ slug: "temples", title: "Temples", description: "This listing is a temple or religious landmark · opening hours and visitor rules are set by the institution, not by NEX. Dress modestly and follow local etiquette.", heroImageUrl: "/nex-category-images/temples/b015.png", altText: "Temples · temple architecture", aliases: ["temple"] }),
    "mountain-hike": Object.freeze({ slug: "mountain-hike", title: "Mountain hike", description: "This listing is a mountain-hike trail or guided-trek operator · conditions and difficulty vary · contact the operator or check local information before setting out.", heroImageUrl: "/nex-category-images/mountain-hike/b016.png", altText: "Mountain hike · mountain trail", aliases: ["trek"] }),
    "jeep-tours": Object.freeze({ slug: "jeep-tours", title: "Jeep tours", description: "This business is listed on NEX as a jeep-tour operator · typically offering off-road and sunrise tours. Routes, prices and durations vary · contact the operator directly.", heroImageUrl: "/nex-category-images/jeep-tours/b017.png", altText: "Jeep tours · 4x4 jeep in a landscape", aliases: ["jeeptours"] }),
    hiking: Object.freeze({ slug: "hiking", title: "Hiking", description: "This listing is a hiking trail or guided-walk operator · conditions and difficulty vary · contact the operator or check local information before setting out.", heroImageUrl: "/nex-category-images/hiking/b018.png", altText: "Hiking · hiker on a trail" }),
    camping: Object.freeze({ slug: "camping", title: "Camping", description: "This listing is a campsite or camping-equipment operator · facilities and bookings vary · contact the operator directly for current information.", heroImageUrl: "/nex-category-images/camping/b019.png", altText: "Camping · tent at a campsite", aliases: ["campsite"] }),
    fishing: Object.freeze({ slug: "fishing", title: "Fishing", description: "This business is listed on NEX as a fishing trip or charter operator · routes, duration and prices vary · contact the operator directly.", heroImageUrl: "/nex-category-images/fishing/b020.png", altText: "Fishing · fishing rod and boat", aliases: ["angling"] }),
    surfing: Object.freeze({ slug: "surfing", title: "Surfing", description: "This business is listed on NEX as a surf school or board-rental operator · lessons, rates and conditions vary · contact the operator directly.", heroImageUrl: "/nex-category-images/surfing/b021.png", altText: "Surfing · surfer riding a wave" }),
    diving: Object.freeze({ slug: "diving", title: "Diving", description: "This business is listed on NEX as a dive operator or school · certifications, trip rates and conditions vary · contact the operator directly.", heroImageUrl: "/nex-category-images/diving/b022.png", altText: "Diving · scuba diver underwater", aliases: ["scuba"] }),
    watersports: Object.freeze({ slug: "watersports", title: "Water sports", description: "This business is listed on NEX as a water-sports operator · typically offering parasailing, jet-ski, banana-boat and similar activities. Rates and safety rules vary · contact the operator directly.", heroImageUrl: "/nex-category-images/watersports/b023.png", altText: "Water sports · water activities" }),
    "boat-hire": Object.freeze({ slug: "boat-hire", title: "Boat hire", description: "This business is listed on NEX as a boat-hire operator · typically offering private charter, snorkel trips and day cruises. Rates vary · contact the operator directly.", heroImageUrl: "/nex-category-images/boat-hire/b024.png", altText: "Boat hire · charter boat", aliases: ["boat-charter"] }),
    massage: Object.freeze({ slug: "massage", title: "Massage", description: "This business is listed on NEX as a massage therapist or venue · typically offering body massages, aromatherapy and relaxation services. Services vary · contact the business directly.", heroImageUrl: "/nex-category-images/massage/b025.png", altText: "Massage · therapist and client", aliases: ["massage-spa"] }),
    "wedding-events": Object.freeze({ slug: "wedding-events", title: "Wedding events", description: "This business is listed on NEX as a wedding or event-planning agency · typically offering coordination, decor and vendor booking. Packages vary · contact the agency directly.", heroImageUrl: "/nex-category-images/wedding-events/b026.png", altText: "Wedding events · wedding ceremony setup", aliases: ["wedding-agents"] }),
    "party-planner": Object.freeze({ slug: "party-planner", title: "Party planner", description: "This business is listed on NEX as a party-planning service · typically offering kids' parties, themed events and party-supply coordination. Packages vary · contact the business directly.", heroImageUrl: "/nex-category-images/party-planner/b028.png", altText: "Party planner · balloons and decor" }),
    "camera-hire": Object.freeze({ slug: "camera-hire", title: "Camera hire", description: "This business is listed on NEX as a camera / photography-equipment rental service · typically offering cameras, lenses, lighting and accessory hire. Rates vary · contact the business directly.", heroImageUrl: "/nex-category-images/camera-hire/b029.png", altText: "Camera hire · professional camera gear" }),
    "travel-agency": Object.freeze({ slug: "travel-agency", title: "Travel agency", description: "This business is listed on NEX as a travel agency · typically offering flight booking, tour packages and holiday planning. Packages vary · contact the agency directly.", heroImageUrl: "/nex-category-images/travel-agency/b030.png", altText: "Travel agency · tickets and globe", aliases: ["travel-agent", "tour-guide"] }),
    yoga: Object.freeze({ slug: "yoga", title: "Yoga", description: "This business is listed on NEX as a yoga studio or instructor · typically offering classes, workshops and private sessions. Schedules vary · contact the studio directly.", heroImageUrl: "/nex-category-images/yoga/b031.png", altText: "Yoga · yoga pose on a mat" }),
    "gym-instructor": Object.freeze({ slug: "gym-instructor", title: "Gym instructor", description: "This business is listed on NEX as a personal trainer or gym instructor · typically offering one-on-one training and fitness programming. Rates vary · contact the instructor directly.", heroImageUrl: "/nex-category-images/gym-instructor/b032.png", altText: "Gym instructor · trainer coaching", aliases: ["personal-trainer"] }),
    beautician: Object.freeze({ slug: "beautician", title: "Beautician", description: "This business is listed on NEX as a beautician · typically offering facials, waxing, lash and other beauty treatments. Services vary · contact the business directly.", heroImageUrl: "/nex-category-images/beautician/b033.png", altText: "Beautician · beauty treatment in progress", aliases: ["beauty-therapist"] }),
    tuktuk: Object.freeze({ slug: "tuktuk", title: "Tuktuk", description: "This business is listed on NEX as a tuktuk or bajaj transport operator · typically offering short-distance passenger rides. Fares vary · contact the operator directly.", heroImageUrl: "/nex-category-images/tuktuk/b034.png", altText: "Tuktuk · three-wheeled passenger vehicle", aliases: ["bajaj"] }),
    museum: Object.freeze({ slug: "museum", title: "Museum", description: "This listing is a museum · exhibits and opening hours are set by the institution, not by NEX. For current information, contact the museum directly.", heroImageUrl: "/nex-category-images/museum/b035.png", altText: "Museum · gallery hall", aliases: ["museums"] }),
    "kids-waterworld": Object.freeze({ slug: "kids-waterworld", title: "Kids waterworld", description: "This listing is a water-park or kids'-waterplay venue · facilities, admission and age rules are set by the operator, not by NEX. Check conditions before visiting.", heroImageUrl: "/nex-category-images/kids-waterworld/b036.png", altText: "Kids waterworld · waterpark slide", aliases: ["waterpark"] }),
    "gym-weights": Object.freeze({ slug: "gym-weights", title: "Gym (weights)", description: "This business is listed on NEX as a weight-training gym · typically offering free weights, machines and strength-focused equipment. Memberships vary · contact the gym directly.", heroImageUrl: "/nex-category-images/gym-weights/b037.png", altText: "Gym (weights) · dumbbells and barbell rack", aliases: ["weightlifting"] }),
    "cake-supplier": Object.freeze({ slug: "cake-supplier", title: "Cake supplier", description: "This business is listed on NEX as a cake maker or supplier · typically offering birthday cakes, wedding cakes and custom orders. Prices vary · contact the business directly.", heroImageUrl: "/nex-category-images/cake-supplier/b038.png", altText: "Cake supplier · decorated cake", aliases: ["bakery-cakes"] }),
    "bread-supplier": Object.freeze({ slug: "bread-supplier", title: "Bread supplier", description: "This business is listed on NEX as a bakery · typically selling bread, buns and pastries. Hours and stock vary · contact the business directly.", heroImageUrl: "/nex-category-images/bread-supplier/b039.png", altText: "Bread supplier · fresh loaves", aliases: ["bakery", "roti"] }),
    tobacco: Object.freeze({ slug: "tobacco", title: "Tobacco", description: "This business is listed on NEX as a tobacconist · typically selling cigarettes, cigars and smoking accessories. Age-restricted · contact the business directly.", heroImageUrl: "/nex-category-images/tobacco/b040.png", altText: "Tobacco · cigars and tobacco products", aliases: ["tobacconist"] }),
    "tool-supplier": Object.freeze({ slug: "tool-supplier", title: "Tool supplier", description: "This business is listed on NEX as a tool / hardware retailer · typically selling hand tools, power tools and construction supplies. Stock varies · contact the business directly.", heroImageUrl: "/nex-category-images/tool-supplier/b041.png", altText: "Tool supplier · workshop tools on display", aliases: ["hardware-store"] }),
    "skin-care": Object.freeze({ slug: "skin-care", title: "Skin care", description: "This business is listed on NEX as a skin-care retailer or clinic · typically offering serums, cleansers and skin treatments. For medical skin concerns, consult a qualified professional · contact the business directly.", heroImageUrl: "/nex-category-images/skin-care/b042.png", altText: "Skin care · skincare products", aliases: ["skincare"] }),
    "whitening-cream": Object.freeze({ slug: "whitening-cream", title: "Whitening cream", description: "This business is listed on NEX as a cosmetic retailer specialising in brightening or whitening creams. For skin concerns, consult a qualified dermatologist · contact the business directly.", heroImageUrl: "/nex-category-images/whitening-cream/b043.png", altText: "Whitening cream · cosmetic cream jar" }),
    "staircase-supplier": Object.freeze({ slug: "staircase-supplier", title: "Staircase supplier", description: "This business is listed on NEX as a staircase and railing fabricator · typically offering custom builds in wood, steel or concrete. Lead times vary · contact the business directly.", heroImageUrl: "/nex-category-images/staircase-supplier/b044.png", altText: "Staircase supplier · interior staircase" }),
    plasterer: Object.freeze({ slug: "plasterer", title: "Plasterer", description: "This business is listed on NEX as a plasterer · typically offering wall-finishing, rendering and small repair work. Rates vary · contact the tradesperson directly.", heroImageUrl: "/nex-category-images/plasterer/b045.png", altText: "Plasterer · plastering a wall" }),
    electrician: Object.freeze({ slug: "electrician", title: "Electrician", description: "This business is listed on NEX as an electrician · typically offering wiring, installations and electrical repairs. Rates vary · contact the tradesperson directly.", heroImageUrl: "/nex-category-images/electrician/b046.png", altText: "Electrician · wiring work" }),
    "heavy-machinery": Object.freeze({ slug: "heavy-machinery", title: "Heavy machinery", description: "This business is listed on NEX as a heavy-equipment operator or rental · typically offering excavators, bulldozers and plant hire. Rates and operators vary · contact the business directly.", heroImageUrl: "/nex-category-images/heavy-machinery/b047.png", altText: "Heavy machinery · excavator at work" }),
    drywaller: Object.freeze({ slug: "drywaller", title: "Drywaller", description: "This business is listed on NEX as a drywall / plasterboard installer · typically offering partition walls, ceilings and finish work. Rates vary · contact the tradesperson directly.", heroImageUrl: "/nex-category-images/drywaller/b048.png", altText: "Drywaller · fitting plasterboard" }),
    security: Object.freeze({ slug: "security", title: "Security", description: "This business is listed on NEX as a security service · typically offering guards, patrols or alarm monitoring. Rates and scope vary · contact the business directly.", heroImageUrl: "/nex-category-images/security/b049.png", altText: "Security · security guard uniform" }),
    "shopping-mall": Object.freeze({ slug: "shopping-mall", title: "Shopping mall", description: "This listing is a shopping mall · tenants, opening hours and events are set by the mall management, not by NEX. For current information, check the mall's own channels.", heroImageUrl: "/nex-category-images/shopping-mall/b050.png", altText: "Shopping mall · retail concourse", aliases: ["mall"] }),
    graveyard: Object.freeze({ slug: "graveyard", title: "Graveyard", description: "This listing is a cemetery or memorial park · visiting hours and services are set by the operator, not by NEX. Be respectful of local customs when visiting.", heroImageUrl: "/nex-category-images/graveyard/b051.png", altText: "Graveyard · memorial headstones", aliases: ["cemetery"] }),
    church: Object.freeze({ slug: "church", title: "Church", description: "This listing is a church · service times and visitor rules are set by the congregation, not by NEX. For current services, check the church's own channels.", heroImageUrl: "/nex-category-images/church/b052.png", altText: "Church · church exterior" }),
    mosque: Object.freeze({ slug: "mosque", title: "Mosque", description: "This listing is a mosque (masjid) · prayer times and visitor rules are set by the institution, not by NEX. Dress modestly and follow local etiquette.", heroImageUrl: "/nex-category-images/mosque/b053.png", altText: "Mosque · mosque with minaret", aliases: ["masjid"] }),
    "horse-riding": Object.freeze({ slug: "horse-riding", title: "Horse riding", description: "This business is listed on NEX as a horse-riding stable or trail operator · typically offering lessons and ride-outs. Rates and conditions vary · contact the operator directly.", heroImageUrl: "/nex-category-images/horse-riding/b054.png", altText: "Horse riding · rider on a horse", aliases: ["equestrian"] }),
    welder: Object.freeze({ slug: "welder", title: "Welder", description: "This business is listed on NEX as a welder / metalworker · typically offering steel fabrication, repairs and custom work. Rates vary · contact the tradesperson directly.", heroImageUrl: "/nex-category-images/welder/b055.png", altText: "Welder · welding sparks" }),
    "metal-fabrication": Object.freeze({ slug: "metal-fabrication", title: "Metal fabrication", description: "This business is listed on NEX as a metal-fabrication workshop · typically offering gates, railings and custom steel work. Lead times vary · contact the business directly.", heroImageUrl: "/nex-category-images/metal-fabrication/b056.png", altText: "Metal fabrication · steel workshop" }),
    "laser-supply": Object.freeze({ slug: "laser-supply", title: "Laser supply and cutting", description: "This business is listed on NEX as a laser-cutting / laser-supplies specialist · typically offering sign-making, acrylic and sheet-metal services. Rates vary · contact the business directly.", heroImageUrl: "/nex-category-images/laser-supply/b057.png", altText: "Laser supply · laser cutting in action" }),
    "coffee-shop": Object.freeze({ slug: "coffee-shop", title: "Coffee shop", description: "This business is listed on NEX as a coffee shop · typically serving coffee, light meals and pastries. Menu and hours vary · contact the business directly.", heroImageUrl: "/nex-category-images/coffee-shop/b058.png", altText: "Coffee shop · barista and espresso machine", aliases: ["cafe", "coffee"] }),
    "fruit-supplier": Object.freeze({ slug: "fruit-supplier", title: "Fruit supplier", description: "This business is listed on NEX as a fruit retailer or wholesaler · typically selling fresh seasonal fruit. Stock varies by season · contact the business directly.", heroImageUrl: "/nex-category-images/fruit-supplier/b064.png", altText: "Fruit supplier · market stall with fruit", aliases: ["greengrocer-fruit"] }),
    "herbs-supplier": Object.freeze({ slug: "herbs-supplier", title: "Herbs supplier", description: "This business is listed on NEX as a herb retailer · typically selling fresh and dried culinary and medicinal herbs. For medical use, consult a qualified professional.", heroImageUrl: "/nex-category-images/herbs-supplier/b065.png", altText: "Herbs supplier · bundles of fresh herbs" }),
    "cotton-supplier": Object.freeze({ slug: "cotton-supplier", title: "Cotton and fabric supplier", description: "This business is listed on NEX as a fabric / textile retailer · typically selling cotton rolls, upholstery and sewing supplies. Stock varies · contact the business directly.", heroImageUrl: "/nex-category-images/cotton-supplier/b066.png", altText: "Cotton supplier · rolls of fabric" }),
    "watches-supplier": Object.freeze({ slug: "watches-supplier", title: "Watches", description: "This business is listed on NEX as a watch retailer · typically selling wrist watches, straps and repairs. Stock varies · contact the business directly.", heroImageUrl: "/nex-category-images/watches-supplier/b067.png", altText: "Watches · wristwatch display", aliases: ["watchmaker"] }),
    jewelry: Object.freeze({ slug: "jewelry", title: "Jewelry", description: "This business is listed on NEX as a jewellery retailer · typically selling necklaces, rings, earrings and bespoke pieces. Prices vary · contact the business directly.", heroImageUrl: "/nex-category-images/jewelry/b068.png", altText: "Jewelry · ring and gemstones", aliases: ["jewellery", "jeweler"] }),
    gold: Object.freeze({ slug: "gold", title: "Gold", description: "This business is listed on NEX as a gold trader · typically buying, selling and verifying gold bullion and jewellery. Prices track daily market rates · contact the business directly.", heroImageUrl: "/nex-category-images/gold/b069.png", altText: "Gold · gold bars and coins", aliases: ["gold-trader"] }),
    "pets-supplier": Object.freeze({ slug: "pets-supplier", title: "Pet supplies", description: "This business is listed on NEX as a pet-supply retailer · typically selling food, toys and accessories for cats, dogs and other pets. Stock varies · contact the business directly.", heroImageUrl: "/nex-category-images/pets-supplier/b070.png", altText: "Pet supplies · pet accessories", aliases: ["pet-supplies"] }),
    "home-decor": Object.freeze({ slug: "home-decor", title: "Home decor", description: "This business is listed on NEX as a home-decor retailer · typically selling ornaments, soft furnishings and interior accessories. Stock varies · contact the business directly.", heroImageUrl: "/nex-category-images/home-decor/b071.png", altText: "Home decor · styled living room", aliases: ["interior-decor"] }),
    "sofa-supplier": Object.freeze({ slug: "sofa-supplier", title: "Sofa and upholstery", description: "This business is listed on NEX as a sofa retailer or upholsterer · typically selling and reupholstering sofas and seating. Lead times vary · contact the business directly.", heroImageUrl: "/nex-category-images/sofa-supplier/b072.png", altText: "Sofa supplier · showroom sofa", aliases: ["upholstery"] }),
    "car-sales": Object.freeze({ slug: "car-sales", title: "Car sales", description: "This business is listed on NEX as a car dealership · typically selling new or used vehicles with finance options. Stock and prices vary · contact the dealership directly.", heroImageUrl: "/nex-category-images/car-sales/b073.png", altText: "Car sales · car on a showroom floor", aliases: ["car-dealer"] }),
    "bicycle-supplier": Object.freeze({ slug: "bicycle-supplier", title: "Bicycle supplier", description: "This business is listed on NEX as a bicycle retailer · typically selling new and used bikes, parts and accessories. Stock varies · contact the business directly.", heroImageUrl: "/nex-category-images/bicycle-supplier/b074.png", altText: "Bicycle supplier · bikes on display" }),
    jetski: Object.freeze({ slug: "jetski", title: "Jetski", description: "This business is listed on NEX as a jetski-hire operator · typically offering jetski rentals and guided experiences. Rates and safety rules vary · contact the operator directly.", heroImageUrl: "/nex-category-images/jetski/b075.png", altText: "Jetski · jetski on water" }),
    "fishing-v2": Object.freeze({ slug: "fishing-v2", title: "Fishing (variant)", description: "This business is listed on NEX as a fishing operator · see also fishing. Routes, duration and prices vary · contact the operator directly.", heroImageUrl: "/nex-category-images/fishing-v2/b076.png", altText: "Fishing · variant illustration", aliases: ["fishing"] }),
    "camping-v2": Object.freeze({ slug: "camping-v2", title: "Camping (variant)", description: "This listing is a campsite or camping operator · see also camping. Facilities vary · contact the operator directly.", heroImageUrl: "/nex-category-images/camping-v2/b077.png", altText: "Camping · variant illustration", aliases: ["camping"] }),
    "yoga-v2": Object.freeze({ slug: "yoga-v2", title: "Yoga (variant)", description: "This business is listed on NEX as a yoga studio or instructor · see also yoga. Schedules vary · contact the studio directly.", heroImageUrl: "/nex-category-images/yoga-v2/b078.png", altText: "Yoga · variant illustration", aliases: ["yoga"] }),
    aerobics: Object.freeze({ slug: "aerobics", title: "Aerobics", description: "This business is listed on NEX as an aerobics studio or instructor · typically offering group fitness classes and dance workouts. Schedules vary · contact the studio directly.", heroImageUrl: "/nex-category-images/aerobics/b079.png", altText: "Aerobics · group fitness class" }),
  });

/** Pre-built lookup from any registered slug or alias (lowercased)
 *  back to its CategoryMetadata entry. Computed once at module load ·
 *  O(1) lookup. Collision detection: if two entries declare the same
 *  slug/alias, the LAST-written one wins (deterministic by registry
 *  insertion order) · in practice we author the registry carefully
 *  so this never happens. */
const SLUG_INDEX: ReadonlyMap<string, CategoryMetadata> = (() => {
  const m = new Map<string, CategoryMetadata>();
  for (const entry of Object.values(CATEGORY_METADATA)) {
    m.set(entry.slug.trim().toLowerCase(), entry);
    if (entry.aliases) {
      for (const a of entry.aliases) {
        const key = typeof a === "string" ? a.trim().toLowerCase() : "";
        if (key.length === 0) continue;
        m.set(key, entry);
      }
    }
  }
  return m;
})();

/** Look up a single category's metadata by slug or alias. Returns null
 *  when the slug is not registered · the UI then shows the chip-only
 *  treatment. Pure · case- and whitespace-tolerant. */
export function getCategoryMetadata(
  slug: string | null | undefined,
): CategoryMetadata | null {
  if (typeof slug !== "string") return null;
  const normalized = slug.trim().toLowerCase();
  if (normalized.length === 0) return null;
  return SLUG_INDEX.get(normalized) ?? null;
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
 *  ones as chips below. Preserves input order within each bucket.
 *
 *  Alias-aware: when multiple input slugs alias to the same
 *  registry entry (e.g. ["hotel", "guesthouse"] both mapping to the
 *  hotel entry), the entry is included only once · first-seen wins.
 *  Prevents duplicate cards on listings carrying two slugs from the
 *  same family. */
export function partitionCategories(
  categoryIds: readonly string[],
): {
  readonly known: readonly CategoryMetadata[];
  readonly unknown: readonly string[];
} {
  const known: CategoryMetadata[] = [];
  const unknown: string[] = [];
  const seenInputSlugs = new Set<string>();
  const seenCanonicalSlugs = new Set<string>();
  for (const raw of categoryIds) {
    if (typeof raw !== "string") continue;
    const slug = raw.trim().toLowerCase();
    if (slug.length === 0) continue;
    if (seenInputSlugs.has(slug)) continue;
    seenInputSlugs.add(slug);
    const meta = getCategoryMetadata(slug);
    if (meta !== null) {
      // Deduplicate by canonical registry slug · a hotel entry
      // reached via "hotel" OR "guesthouse" counts once.
      if (seenCanonicalSlugs.has(meta.slug)) continue;
      seenCanonicalSlugs.add(meta.slug);
      known.push(meta);
    } else {
      unknown.push(raw.trim());
    }
  }
  return { known, unknown };
}
