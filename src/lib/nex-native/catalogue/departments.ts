// src/lib/nex-native/catalogue/departments.ts
//
// INTERIM shared category module · sealed 2026-10-28 (A2-T2)
// ----------------------------------------------------------------
// This file is NOT a database-backed catalogue.
// This file is NOT the central source of truth for NEX categories.
// This file is a hardcoded TypeScript transcription of the owner-
// sealed 30-department taxonomy, used ONLY by Stage A2 to drive the
// `_category-picker.tsx` tile grid. The eventual replacement is a
// Stage-B database-backed catalogue requiring its own doctrine and
// migration approvals.
//
// Why hardcoded for now:
//   · Stage A2 is code-only · no DB changes authorised
//   · A single reader (the category picker) consumes this file today
//   · Status enablement is driven by the `enabled` field, not DB rows
//
// Why documented at length:
//   · Readers must not mistake this for the authoritative source
//   · Stage B migration must know to deprecate this file explicitly
//
// Watches is the only `enabled: true` department today. Research
// completion for Books / Office / Arts (Batch 1) does NOT make them
// enabled · founder blocker resolution plus Specification complete
// plus Verification passed plus Enabled gate are required first.

export type Department = {
  readonly id: DepartmentId;
  readonly label: string;
  readonly blurb: string;
  readonly enabled: boolean;
  readonly categories: readonly Category[];
};

export type Category = {
  readonly id: string;
  readonly label: string;
};

export type DepartmentId =
  | "electronics_technology"
  | "home_furniture_living"
  | "kitchen_dining"
  | "fashion_clothing"
  | "jewellery_watches"
  | "beauty_personal_care"
  | "health_wellness_medical"
  | "baby_nursery_parenting"
  | "toys_games_hobbies"
  | "sports_fitness_outdoors"
  | "garden_outdoor_agriculture"
  | "tools_diy_construction"
  | "automotive_motorcycles_transport"
  | "food_grocery_beverages"
  | "pet_supplies_animals"
  | "books_education_stationery"
  | "office_business_industrial"
  | "arts_crafts_handmade"
  | "music_film_entertainment"
  | "travel_luggage_outdoor"
  | "digital_products_software"
  | "accommodation_property"
  | "food_delivery_restaurants"
  | "services_marketplace"
  | "experiences_activities_tickets"
  | "second_hand_refurbished"
  | "luxury_premium_collectibles"
  | "gifts_celebrations_seasonal"
  | "renewable_energy_utilities"
  | "everything_else";

/* ─── 30-department taxonomy ────────────────────────────────────── */

export const DEPARTMENTS: readonly Department[] = [
  {
    id: "electronics_technology",
    label: "Electronics & Technology",
    blurb: "Phones, laptops, audio, cameras",
    enabled: true,
    categories: [
      { id: "mobile_phones", label: "Mobile Phones & Accessories" },
      { id: "computers_laptops", label: "Computers & Laptops" },
      { id: "computer_components", label: "Computer Components" },
      { id: "computer_accessories", label: "Computer Accessories" },
      { id: "monitors_displays", label: "Monitors & Displays" },
      { id: "tv_entertainment", label: "TV & Home Entertainment" },
      { id: "audio_headphones", label: "Audio & Headphones" },
      { id: "cameras_photography", label: "Cameras & Photography" },
      { id: "smart_home", label: "Smart Home" },
      { id: "networking", label: "Networking" },
      { id: "printers_scanners", label: "Printers & Scanners" },
    ],
  },
  {
    id: "home_furniture_living",
    label: "Home, Furniture & Living",
    blurb: "Sofas, beds, décor, lighting",
    enabled: true,
    categories: [
      { id: "living_room", label: "Living Room Furniture" },
      { id: "bedroom", label: "Bedroom Furniture" },
      { id: "dining_room", label: "Dining Room" },
      { id: "office_furniture", label: "Office Furniture" },
      { id: "home_decor", label: "Home Decor" },
      { id: "lighting", label: "Lighting" },
      { id: "bedding_textiles", label: "Bedding & Textiles" },
      { id: "storage_organisation", label: "Storage & Organisation" },
      { id: "cleaning_household", label: "Cleaning & Household" },
      { id: "home_safety", label: "Home Safety" },
    ],
  },
  {
    id: "kitchen_dining",
    label: "Kitchen & Dining",
    blurb: "Cookware, tableware, appliances",
    enabled: true,
    categories: [
      { id: "cookware", label: "Cookware" },
      { id: "kitchen_utensils", label: "Kitchen Utensils" },
      { id: "tableware", label: "Tableware" },
      { id: "kitchen_storage", label: "Kitchen Storage" },
      { id: "kitchen_appliances", label: "Kitchen Appliances" },
      { id: "refrigeration", label: "Refrigeration" },
      { id: "laundry_appliances", label: "Laundry Appliances" },
      { id: "water_beverage", label: "Water & Beverage" },
    ],
  },
  {
    id: "fashion_clothing",
    label: "Fashion & Clothing",
    blurb: "Women, men, kids, shoes, bags",
    enabled: true,
    categories: [
      { id: "womens", label: "Women's Clothing" },
      { id: "mens", label: "Men's Clothing" },
      { id: "childrens", label: "Children's Clothing" },
      { id: "shoes", label: "Shoes" },
      { id: "bags_luggage", label: "Bags & Luggage" },
      { id: "accessories", label: "Fashion Accessories" },
      { id: "underwear_sleepwear", label: "Underwear & Sleepwear" },
      { id: "traditional_cultural", label: "Traditional & Cultural Clothing" },
    ],
  },
  {
    id: "jewellery_watches",
    label: "Jewellery & Watches",
    blurb: "Luxury, smart, fashion",
    enabled: true,
    categories: [
      { id: "fine_jewellery", label: "Fine Jewellery" },
      { id: "fashion_jewellery", label: "Fashion Jewellery" },
      { id: "watches", label: "Watches" },
      { id: "jewellery_accessories", label: "Jewellery Accessories" },
      { id: "collectible_watches", label: "Collectible Watches" },
    ],
  },
  {
    id: "beauty_personal_care",
    label: "Beauty & Personal Care",
    blurb: "Skincare, makeup, fragrance",
    enabled: true,
    categories: [
      { id: "skincare", label: "Skincare" },
      { id: "makeup", label: "Makeup" },
      { id: "haircare", label: "Haircare" },
      { id: "fragrances", label: "Fragrances" },
      { id: "bath_body", label: "Bath & Body" },
      { id: "grooming", label: "Grooming" },
      { id: "oral_care", label: "Oral Care" },
      { id: "beauty_accessories", label: "Beauty Accessories" },
    ],
  },
  {
    id: "health_wellness_medical",
    label: "Health, Wellness & Medical",
    blurb: "Monitoring, mobility, first aid",
    enabled: true,
    categories: [
      { id: "personal_wellness", label: "Personal Wellness" },
      { id: "health_monitoring", label: "Health Monitoring" },
      { id: "mobility", label: "Mobility & Accessibility" },
      { id: "first_aid", label: "First Aid" },
      { id: "medical_equipment", label: "Medical Equipment" },
      { id: "hearing_vision", label: "Hearing & Vision" },
      { id: "health_consumables", label: "Health Consumables" },
      { id: "vitamins_supplements", label: "Vitamins & Supplements" },
    ],
  },
  {
    id: "baby_nursery_parenting",
    label: "Baby, Nursery & Parenting",
    blurb: "Feeding, nappies, nursery, travel",
    enabled: true,
    categories: [
      { id: "baby_clothing", label: "Baby Clothing" },
      { id: "feeding", label: "Feeding" },
      { id: "nappies_hygiene", label: "Nappies & Hygiene" },
      { id: "nursery_furniture", label: "Nursery Furniture" },
      { id: "travel_safety", label: "Travel & Safety" },
      { id: "baby_toys", label: "Baby Toys" },
      { id: "parenting_accessories", label: "Parenting Accessories" },
    ],
  },
  {
    id: "toys_games_hobbies",
    label: "Toys, Games & Hobbies",
    blurb: "Dolls, board games, musical instruments",
    enabled: true,
    categories: [
      { id: "toys", label: "Toys" },
      { id: "board_games", label: "Board Games" },
      { id: "collectibles", label: "Collectibles" },
      { id: "hobbies", label: "Hobbies" },
      { id: "arts_crafts", label: "Arts & Crafts" },
      { id: "musical_instruments", label: "Musical Instruments" },
    ],
  },
  {
    id: "sports_fitness_outdoors",
    label: "Sports, Fitness & Outdoors",
    blurb: "Gym, cycling, camping, fishing",
    enabled: true,
    categories: [
      { id: "fitness_equipment", label: "Fitness Equipment" },
      { id: "running", label: "Running" },
      { id: "cycling", label: "Cycling" },
      { id: "camping_hiking", label: "Camping & Hiking" },
      { id: "water_sports", label: "Water Sports" },
      { id: "team_sports", label: "Team Sports" },
      { id: "fishing", label: "Fishing" },
      { id: "outdoor_recreation", label: "Outdoor Recreation" },
    ],
  },
  {
    id: "garden_outdoor_agriculture",
    label: "Garden, Outdoor & Agriculture",
    blurb: "Tools, plants, machinery",
    enabled: true,
    categories: [
      { id: "gardening_tools", label: "Gardening Tools" },
      { id: "plants_seeds", label: "Plants & Seeds" },
      { id: "garden_supplies", label: "Garden Supplies" },
      { id: "outdoor_furniture", label: "Outdoor Furniture" },
      { id: "outdoor_structures", label: "Outdoor Structures" },
      { id: "garden_machinery", label: "Garden Machinery" },
      { id: "agriculture_farming", label: "Agriculture & Farming" },
      { id: "outdoor_living", label: "Outdoor Living" },
    ],
  },
  {
    id: "tools_diy_construction",
    label: "Tools, DIY & Construction",
    blurb: "Hand/power tools, building materials",
    enabled: true,
    categories: [
      { id: "hand_tools", label: "Hand Tools" },
      { id: "power_tools", label: "Power Tools" },
      { id: "tool_storage", label: "Tool Storage" },
      { id: "fixings_fasteners", label: "Fixings & Fasteners" },
      { id: "building_materials", label: "Building Materials" },
      { id: "doors_windows", label: "Doors, Windows & Joinery" },
      { id: "flooring", label: "Flooring" },
      { id: "paint_decorating", label: "Paint & Decorating" },
      { id: "plumbing", label: "Plumbing" },
      { id: "electrical_supplies", label: "Electrical Supplies" },
      { id: "heating_ventilation", label: "Heating & Ventilation" },
      { id: "roofing_guttering", label: "Roofing & Guttering" },
      { id: "safety_workwear", label: "Safety & Workwear" },
      { id: "access_equipment", label: "Access Equipment" },
      { id: "building_finishes", label: "Building Finishes" },
      { id: "workshop_equipment", label: "Workshop Equipment" },
      { id: "trade_consumables", label: "Trade Consumables" },
    ],
  },
  {
    id: "automotive_motorcycles_transport",
    label: "Automotive & Motorcycles",
    blurb: "Parts, tyres, EVs, vehicles",
    enabled: true,
    categories: [
      { id: "car_parts", label: "Car Parts" },
      { id: "car_accessories", label: "Car Accessories" },
      { id: "tyres_wheels", label: "Tyres & Wheels" },
      { id: "car_electronics", label: "Car Electronics" },
      { id: "car_care", label: "Car Care" },
      { id: "motorcycles", label: "Motorcycles" },
      { id: "automotive_tools", label: "Automotive Tools" },
      { id: "electric_vehicles", label: "Electric Vehicles" },
      { id: "commercial_vehicles", label: "Commercial Vehicles" },
      { id: "vehicle_listings", label: "Vehicle Listings" },
    ],
  },
  {
    id: "food_grocery_beverages",
    label: "Food, Grocery & Beverages",
    blurb: "Fresh, pantry, speciality",
    enabled: true,
    categories: [
      { id: "fresh_produce", label: "Fresh Produce" },
      { id: "meat_poultry", label: "Meat & Poultry" },
      { id: "fish_seafood", label: "Fish & Seafood" },
      { id: "dairy_eggs", label: "Dairy & Eggs" },
      { id: "bakery", label: "Bakery" },
      { id: "pantry_staples", label: "Pantry Staples" },
      { id: "snacks_confectionery", label: "Snacks & Confectionery" },
      { id: "beverages", label: "Beverages" },
      { id: "speciality_foods", label: "Speciality Foods" },
      { id: "food_prep_supplies", label: "Food Preparation Supplies" },
    ],
  },
  {
    id: "pet_supplies_animals",
    label: "Pet Supplies & Animals",
    blurb: "Dogs, cats, birds, fish",
    enabled: true,
    categories: [
      { id: "dogs", label: "Dogs" },
      { id: "cats", label: "Cats" },
      { id: "fish_aquariums", label: "Fish & Aquariums" },
      { id: "birds", label: "Birds" },
      { id: "small_animals", label: "Small Animals" },
      { id: "pet_health_grooming", label: "Pet Health & Grooming" },
      { id: "equestrian", label: "Equestrian" },
      { id: "farm_animal_supplies", label: "Farm Animal Supplies" },
    ],
  },
  {
    id: "books_education_stationery",
    label: "Books, Education & Stationery",
    blurb: "Books, school, office stationery",
    enabled: true,
    categories: [
      { id: "books", label: "Books" },
      { id: "school_supplies", label: "School Supplies" },
      { id: "office_stationery", label: "Office Stationery" },
      { id: "educational_resources", label: "Educational Resources" },
      { id: "professional_reference", label: "Professional Reference" },
      { id: "books_media_collectibles", label: "Books & Media Collectibles" },
    ],
  },
  {
    id: "office_business_industrial",
    label: "Office, Business & Industrial",
    blurb: "Equipment, furniture, packaging",
    enabled: true,
    categories: [
      { id: "office_equipment", label: "Office Equipment" },
      { id: "business_furniture", label: "Business Furniture" },
      { id: "packaging_shipping", label: "Packaging & Shipping" },
      { id: "warehouse_equipment", label: "Warehouse Equipment" },
      { id: "industrial_tools", label: "Industrial Tools" },
      { id: "industrial_safety", label: "Industrial Safety" },
      { id: "material_handling", label: "Material Handling" },
      { id: "commercial_cleaning", label: "Commercial Cleaning" },
      { id: "hospitality_catering", label: "Hospitality & Catering Supplies" },
      { id: "business_technology", label: "Business Technology" },
    ],
  },
  {
    id: "arts_crafts_handmade",
    label: "Arts, Crafts & Handmade",
    blurb: "Painting, sewing, handmade goods",
    enabled: true,
    categories: [
      { id: "painting_drawing", label: "Painting & Drawing" },
      { id: "sewing_textiles", label: "Sewing & Textiles" },
      { id: "craft_materials", label: "Craft Materials" },
      { id: "handmade_home_goods", label: "Handmade Home Goods" },
      { id: "personalised_gifts", label: "Personalised Gifts" },
      { id: "handmade_jewellery", label: "Handmade Jewellery" },
      { id: "art_collectibles", label: "Art & Collectibles" },
    ],
  },
  {
    id: "music_film_entertainment",
    label: "Music, Film & Entertainment",
    blurb: "Music, movies, video games",
    enabled: true,
    categories: [
      { id: "music", label: "Music" },
      { id: "movies_tv", label: "Movies & Television" },
      { id: "video_games", label: "Video Games" },
      { id: "gaming_furniture", label: "Gaming Furniture" },
      { id: "collectible_entertainment", label: "Collectible Entertainment" },
    ],
  },
  {
    id: "travel_luggage_outdoor",
    label: "Travel, Luggage & Outdoor",
    blurb: "Luggage, travel accessories, business travel",
    enabled: true,
    categories: [
      { id: "travel_accessories", label: "Travel Accessories" },
      { id: "travel_essentials", label: "Travel Essentials" },
      { id: "outdoor_travel", label: "Outdoor Travel" },
      { id: "business_travel", label: "Business Travel" },
    ],
  },
  {
    id: "digital_products_software",
    label: "Digital Products & Software",
    blurb: "Software, courses, assets, gift cards",
    enabled: true,
    categories: [
      { id: "software", label: "Software" },
      { id: "digital_learning", label: "Digital Learning" },
      { id: "creative_assets", label: "Creative Assets" },
      { id: "digital_tools", label: "Digital Tools" },
      { id: "digital_collectibles", label: "Digital Collectibles" },
      { id: "digital_gift_cards", label: "Digital Gift Cards" },
    ],
  },
  {
    id: "accommodation_property",
    label: "Accommodation & Property",
    blurb: "Hotels, rentals, property for sale",
    enabled: true,
    categories: [
      { id: "hotels", label: "Hotels" },
      { id: "holiday_accommodation", label: "Holiday Accommodation" },
      { id: "short_term_rentals", label: "Short-Term Rentals" },
      { id: "long_term_rentals", label: "Long-Term Rentals" },
      { id: "property_for_sale", label: "Property for Sale" },
      { id: "unique_stays", label: "Unique Stays" },
      { id: "accommodation_services", label: "Accommodation Services" },
    ],
  },
  {
    id: "food_delivery_restaurants",
    label: "Food Delivery & Restaurants",
    blurb: "Restaurants, delivery, catering",
    enabled: true,
    categories: [
      { id: "restaurants", label: "Restaurants" },
      { id: "food_types", label: "Food Types" },
      { id: "popular_dishes", label: "Popular Dishes" },
      { id: "beverages", label: "Beverages" },
      { id: "food_services", label: "Food Services" },
      { id: "dietary_options", label: "Special Dietary Options" },
    ],
  },
  {
    id: "services_marketplace",
    label: "Services Marketplace",
    blurb: "Home, trades, creative, personal",
    enabled: true,
    categories: [
      { id: "home_services", label: "Home Services" },
      { id: "construction_trades", label: "Construction & Trades" },
      { id: "professional_services", label: "Professional Services" },
      { id: "creative_services", label: "Creative Services" },
      { id: "personal_services", label: "Personal Services" },
      { id: "automotive_services", label: "Automotive Services" },
      { id: "events", label: "Events" },
      { id: "business_support", label: "Business Support" },
      { id: "delivery_transport", label: "Delivery & Transport" },
    ],
  },
  {
    id: "experiences_activities_tickets",
    label: "Experiences & Tickets",
    blurb: "Activities, tours, classes, tickets",
    enabled: true,
    categories: [
      { id: "activities", label: "Activities" },
      { id: "entertainment", label: "Entertainment" },
      { id: "sports_recreation", label: "Sports & Recreation" },
      { id: "tours", label: "Tours" },
      { id: "classes_workshops", label: "Classes & Workshops" },
      { id: "tickets", label: "Tickets" },
    ],
  },
  {
    id: "second_hand_refurbished",
    label: "Second-Hand & Refurbished",
    blurb: "Pre-owned across categories",
    enabled: true,
    categories: [
      { id: "used_electronics", label: "Used Electronics" },
      { id: "refurbished_computers", label: "Refurbished Computers" },
      { id: "pre_owned_phones", label: "Pre-Owned Phones" },
      { id: "second_hand_furniture", label: "Second-Hand Furniture" },
      { id: "used_tools", label: "Used Tools" },
      { id: "pre_owned_vehicles", label: "Pre-Owned Vehicles" },
      { id: "used_fashion", label: "Used Fashion" },
      { id: "vintage_clothing", label: "Vintage Clothing" },
      { id: "used_books", label: "Used Books" },
      { id: "used_sports_equipment", label: "Used Sports Equipment" },
    ],
  },
  {
    id: "luxury_premium_collectibles",
    label: "Luxury, Premium & Collectibles",
    blurb: "Designer fashion, fine jewellery, art",
    enabled: false,
    categories: [
      { id: "luxury_fashion", label: "Luxury Fashion" },
      { id: "luxury_watches", label: "Luxury Watches" },
      { id: "fine_jewellery", label: "Fine Jewellery" },
      { id: "art_antiques", label: "Art & Antiques" },
      { id: "collectibles", label: "Collectibles" },
      { id: "premium_lifestyle", label: "Premium Lifestyle" },
    ],
  },
  {
    id: "gifts_celebrations_seasonal",
    label: "Gifts, Celebrations & Seasonal",
    blurb: "Occasions, hampers, seasonal shopping",
    enabled: false,
    categories: [
      { id: "gift_occasions", label: "Gift Occasions" },
      { id: "gift_types", label: "Gift Types" },
      { id: "celebrations", label: "Celebrations" },
      { id: "seasonal_shopping", label: "Seasonal Shopping" },
    ],
  },
  {
    id: "renewable_energy_utilities",
    label: "Renewable Energy & Utilities",
    blurb: "Solar, backup, efficiency, water",
    enabled: false,
    categories: [
      { id: "solar_energy", label: "Solar Energy" },
      { id: "power_backup", label: "Power Backup" },
      { id: "energy_efficiency", label: "Energy Efficiency" },
      { id: "water_systems", label: "Water Systems" },
      { id: "renewable_accessories", label: "Renewable Energy Accessories" },
    ],
  },
  {
    id: "everything_else",
    label: "Everything Else",
    blurb: "Unclassified · controlled fallback",
    enabled: false,
    categories: [
      { id: "unclassified", label: "Products not yet classified" },
    ],
  },
] as const;

/* ─── Helpers (pure, no side effects) ───────────────────────────── */

export function findDepartment(id: DepartmentId): Department | undefined {
  return DEPARTMENTS.find((d) => d.id === id);
}

/** Case-insensitive substring match across department labels + blurbs +
 *  category labels. Returns the matching Department entries. */
export function searchDepartments(query: string): readonly Department[] {
  const q = query.trim().toLowerCase();
  if (!q) return DEPARTMENTS;
  return DEPARTMENTS.filter((d) => {
    if (d.label.toLowerCase().includes(q)) return true;
    if (d.blurb.toLowerCase().includes(q)) return true;
    return d.categories.some((c) => c.label.toLowerCase().includes(q));
  });
}

/** Case-insensitive substring match on category labels only, returns
 *  the matching { department, category } pairs. */
export function searchCategories(
  query: string,
): readonly { department: Department; category: Category }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: { department: Department; category: Category }[] = [];
  for (const d of DEPARTMENTS) {
    for (const c of d.categories) {
      if (c.label.toLowerCase().includes(q)) hits.push({ department: d, category: c });
    }
  }
  return hits;
}
