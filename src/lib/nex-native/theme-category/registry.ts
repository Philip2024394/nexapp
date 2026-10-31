// src/lib/nex-native/theme-category/registry.ts
//
// Theme Category Registry · re-sealed 2026-10-11 (Step 1G).
//
// History:
//   Step 1A · 2026-10-06 · Ocean · Café · Explore (three categories).
//   Step 1C · 2026-10-11 · Food · Products · Services · Explore (four).
//   Step 1D · 2026-10-11 · Food · Products · Services · Rentals ·
//     Explore (five). Rentals is added for accommodation, vehicle,
//     equipment and tool rentals.
//   Step 1E · 2026-10-11 · Food · Bakery · Products · Services ·
//     Rentals · Explore (six). Bakery is a sibling of Food for
//     cake / bread / pastry worlds.
//   Step 1F · 2026-10-11 · Food · Bakery · Products · Services ·
//     Rentals · Haunted · Explore (seven). Haunted added for
//     spooky / horror / ghost themes. Haunted's keyword rule beats
//     Rentals so "Haunted Hotel" routes correctly.
//   Step 1G · 2026-10-11 · adds Waterworld (eighth category) +
//     renames the ocean World to Waterworld.
//   Step 1H · 2026-10-11 · adds Accommodation (ninth category) ·
//     splits hotel / villa / resort / lodge / guesthouse / airbnb
//     keywords out of Rentals so Accommodation (hosting) and
//     Rentals (vehicle / equipment) are distinct rooms. Keyword
//     rule evaluates between Haunted and Rentals so "haunted
//     hotel" → Haunted, a plain "hotel neo" → Accommodation, and
//     "bike rental" → Rentals. The founder-authorised rule
//     "theme name decides category" is implemented in
//     `./keyword-resolver.ts` and used by the live-worlds adapter +
//     DB loaders as a FALLBACK when a ThemePackage does not declare
//     its own `categoryId`. Explicit declarations always win.
//
// Migration carried out alongside this seal:
//   · the four café worlds (coffee · botanical-cafe · midnight-cafe ·
//     french-cafe) + the food world all fold into the new `food`
//     category.
//   · the ocean world drops into `explore` (no better home among
//     food/products/services).
//   · `products` and `services` are REGISTERED but ship with zero
//     worlds — the "coming soon" state in the Library landing is the
//     intentional day-one presentation (soft rule change authorised
//     2026-10-11; see Step 1C note on `_category-grid.tsx`).
//
// Rules re-sealed with the founder 2026-10-11:
//
//   · ids are stable + lowercase + hyphenated · never emoji / display
//     strings.
//   · "explore" is NOT a visual family · it is the universal bucket
//     for Worlds that do not yet have a dedicated category. Treating
//     it as a real family would be a doctrine violation.
//   · Empty-but-REGISTERED categories (products · services) ARE shown
//     on the landing with a "Coming soon · no worlds yet" state. The
//     "do not invent categories to fill slots" doctrine is PRESERVED:
//     we are not inventing worlds · we are declaring the IA so
//     visitors can see where new families will live.
//   · DB-backed themes default to "explore" · later phases may migrate
//     specific DB themes into Food / Products / Services, but that is
//     a separate authorisation.
//   · When a package references a categoryId that is NOT in this
//     registry, the Library adapter defaults it to "explore" so the
//     Library never crashes · a focused test guards that EVERY code-
//     registered Theme Package declares a REGISTERED categoryId.
//   · UNIVERSAL THEME COLOUR RULE (sealed 2026-10-06): every category
//     declares its OWN ColourSystem · the showcase surface derives its
//     atmosphere from these colours · it is DELIBERATELY NOT derived
//     from any one world inside the category. Adding or removing
//     worlds therefore never changes a category's visual identity.

import type { ThemeCategory } from "./types";

/** The universal uncategorised bucket. Worlds here are NOT a visual
 *  family · they are temporarily collected pending real category
 *  assignment. */
export const EXPLORE_CATEGORY_ID = "explore" as const;

/** All currently-registered Theme Categories. Add a row to this map
 *  to introduce a new category · zero code change elsewhere needed.
 *
 *  Order here = order on the Library landing (listCategories snapshot). */
const CATEGORY_REGISTRY: Readonly<Record<string, ThemeCategory>> = {
  food: {
    id: "food",
    name: "Food",
    tagline: "Café · coffee · grill · warmth",
    icon: "🍽️",
    // Keyword rule (Step 1E · 2026-10-11): theme name/id contains
    // 'food', 'cafe', 'café', 'coffee', 'grill', 'kitchen', 'dining',
    // 'bar', 'bistro', 'meal', 'eat' · falls through to Food.
    // Food palette · warm archetypal café/food-ness that works across
    // the whole family (coffee browns + botanical greens + french
    // rose-wood + midnight neon + grilled fire all live inside this
    // room). The individual world tiles keep their own palettes · only
    // the surrounding chrome is Food-warm.
    colours: {
      primary: "#6B3F22", // espresso
      secondary: "#C8976B", // caramel
      highlight: "#F7E7CA", // cream foam · light text on deep bg
      glow: "rgba(232,170,90,0.55)", // amber warm glow
      deep: "#2A160A", // dark roast · page background
    },
    // Hero · the "food" world is the Food category hero as of
    // 2026-10-11 · its real grilled-food wallpaper reads as "food"
    // more directly than coffee cup imagery. The café worlds
    // (coffee / botanical / midnight / french) + pizza remain
    // visible inside the Food showcase room alongside it.
    heroThemeId: "food",
  },
  bakery: {
    id: "bakery",
    name: "Bakery",
    tagline: "Cake · bread · pastry · patisserie",
    icon: "🧁",
    // Bakery palette · pink pastry + butter cream · a specialised
    // room for cake / bread / pastry worlds · distinct from Food's
    // warm espresso so a cake theme feels at home rather than
    // dropped into a cafe context.
    //
    // Keyword rule (Step 1E · 2026-10-11): theme name/id contains
    // 'cake', 'bakery', 'baker', 'bread', 'pastry', 'patisserie',
    // 'croissant', 'muffin', 'cupcake', 'dessert', 'macaron', 'donut'
    // · falls through to Bakery (specific-first · wins over Food).
    colours: {
      primary: "#C66988", // berry rose
      secondary: "#F3C2CF", // pastry pink
      highlight: "#FBEAE1", // butter cream · light text on deep bg
      glow: "rgba(243,194,207,0.55)",
      deep: "#3A1420", // deep berry · page background
    },
    // Zero worlds today · first bakery world (cake-shop · patisserie)
    // swaps hero in. Empty-tile "Coming soon" treatment paints the
    // palette so the room has identity even without a resident world.
    heroThemeId: null,
  },
  products: {
    id: "products",
    name: "Products",
    tagline: "Shops · catalogues · retail Worlds",
    icon: "🛍️",
    // Keyword rule (Step 1E · 2026-10-11): theme name/id contains
    // 'product', 'shop', 'store', 'retail', 'boutique', 'market',
    // 'goods', 'merch' · falls through to Products.
    // Products palette · cool slate-blue retail room · intentionally
    // distinct from Food's warmth and from Explore's NEX cyan.
    colours: {
      primary: "#4A6B8A", // slate blue
      secondary: "#7FA6CC", // mist blue
      highlight: "#E8EFF7", // pale cloud · light text on deep bg
      glow: "rgba(127,166,204,0.45)",
      deep: "#0E1824", // night slate · page background
    },
    // Zero worlds today · landing tile paints the EmptyScreen fallback
    // using these colours. Hero id reserved for the first Products
    // world when it ships.
    heroThemeId: null,
  },
  services: {
    id: "services",
    name: "Services",
    tagline: "Studios · practitioners · booking Worlds",
    icon: "🛠️",
    // Keyword rule (Step 1E · 2026-10-11): theme name/id contains
    // 'service', 'studio', 'salon', 'agency', 'workshop', 'clinic',
    // 'consulting', 'spa', 'barber' · falls through to Services.
    // Services palette · sage/olive professional room · reads as calm
    // and competent · distinct from Food warmth and Products cool.
    colours: {
      primary: "#5A6E42", // sage olive
      secondary: "#9CB37A", // moss light
      highlight: "#EEF2E4", // chalk green · light text on deep bg
      glow: "rgba(156,179,122,0.45)",
      deep: "#141A0D", // deep forest · page background
    },
    // Zero worlds today · same empty-tile treatment as Products.
    heroThemeId: null,
  },
  rentals: {
    id: "rentals",
    name: "Rentals",
    tagline: "Ride · hire · bike · car · equipment",
    icon: "🔑",
    // Keyword rule (Step 1H · 2026-10-11): theme name/id contains
    // 'rental', 'rent', 'hire', 'bike', 'scooter', 'moped',
    // 'motorbike', 'car', 'auto' · falls through to Rentals.
    // Accommodation keywords (hotel · villa · resort · ...) are
    // now owned by the Accommodation category, which evaluates
    // BEFORE Rentals.
    // Rentals palette · teal / aqua / foam · reads as "away for a
    // while": accommodation, vehicle, equipment. Distinct from
    // Services sage and Products slate · evokes travel / water /
    // keys-on-a-counter.
    colours: {
      primary: "#1E7F8B", // teal
      secondary: "#4FBBC9", // aqua
      highlight: "#DFF4F7", // foam · light text on deep bg
      glow: "rgba(79,187,201,0.45)",
      deep: "#0C2229", // deep lagoon · page background
    },
    // Zero live-world rentals until a motorbike/car-workshop world
    // ships (bike-rental lives here now). Empty-tile treatment
    // paints the palette until a first world lands.
    heroThemeId: null,
  },
  accommodation: {
    id: "accommodation",
    name: "Accommodation",
    tagline: "Hotel · villa · resort · guesthouse · homestay",
    icon: "🏨",
    // Accommodation palette · warm gold + sand + hospitality cream ·
    // reads as "welcome in" rather than Rentals' asphalt / mechanical
    // vibe or Waterworld's deep blue.
    //
    // Keyword rule (Step 1H · 2026-10-11): theme name/id contains
    // 'hotel', 'villa', 'resort', 'lodge', 'guesthouse', 'homestay',
    // 'airbnb', 'bnb', 'inn', 'motel', 'hostel', 'bed-and-breakfast',
    // 'stay' · falls through to Accommodation. Evaluated AFTER
    // Haunted (so "Haunted Hotel" still routes to Haunted) but
    // BEFORE Rentals (so a plain "Hotel Neo" routes to Accommodation
    // rather than Rentals via a stray keyword).
    colours: {
      primary: "#B8893A", // warm gold
      secondary: "#DEBE7E", // sand
      highlight: "#F6EBD2", // hospitality cream · light text on deep bg
      glow: "rgba(222,190,126,0.50)",
      deep: "#1E1407", // deep walnut · page background
    },
    // Zero worlds today · first accommodation world (boutique hotel ·
    // beach villa · mountain lodge) swaps hero in.
    heroThemeId: null,
  },
  haunted: {
    id: "haunted",
    name: "Haunted",
    tagline: "Spooky · ghost · phantom · horror Worlds",
    icon: "👻",
    // Haunted palette · midnight indigo + fog green + candle amber ·
    // reads as "half-lit corridor" without being gory. A visitor
    // opening the room should feel atmospheric mystery, not shock.
    //
    // Keyword rule (Step 1F · 2026-10-11): theme name/id contains
    // 'haunted', 'ghost', 'spooky', 'horror', 'spirit', 'phantom',
    // 'graveyard', 'witch', 'cursed', 'spectre', 'specter', 'eerie' ·
    // falls through to Haunted. Evaluated BEFORE Rentals so a
    // "Haunted Hotel" theme does not get routed to Rentals via 'hotel'.
    colours: {
      primary: "#5A3A8E", // midnight indigo
      secondary: "#8FB89C", // fog green
      highlight: "#F0E6CC", // candle amber · light text on deep bg
      glow: "rgba(143,184,156,0.45)", // ghostly green glow
      deep: "#0C0918", // night corridor · page background
    },
    // Haunted Hotel is DB-registered (nex_chat_theme) · the loader
    // runs the keyword resolver and files it under this category.
    // Hero stays null here so the live-worlds hero resolution falls
    // through to the first in-category row (which is Haunted Hotel
    // once the loader paints it).
    heroThemeId: null,
  },
  waterworld: {
    id: "waterworld",
    name: "Waterworld",
    tagline: "Ocean · river · lake · aquarium · dive",
    icon: "🌊",
    // Waterworld palette · deep ocean blue + turquoise + foam · same
    // family as the former Ocean category (which this category
    // succeeds), tightened to a slightly deeper blue so the Waterworld
    // room reads as "below the surface" rather than "beach".
    //
    // Keyword rule (Step 1G · 2026-10-11): theme name/id contains
    // 'water', 'waterworld', 'ocean', 'sea', 'river', 'lake', 'dive',
    // 'reef', 'coral', 'aquarium', 'surf', 'sail', 'yacht', 'boat' ·
    // falls through to Waterworld. Evaluated after Haunted (so
    // "haunted ship" → Haunted) but before Rentals (so a plain
    // "river rafting" → Waterworld rather than Rentals via 'rafting'
    // which isn't a rental keyword anyway).
    colours: {
      primary: "#2E90B5", // deep blue · same anchor as the Waterworld world
      secondary: "#4FC3DC", // turquoise
      highlight: "#E8F7FF", // white foam · light text on deep bg
      glow: "rgba(130,210,255,0.55)",
      deep: "#0A2535", // abyss · page background
    },
    // Hero · the renamed Waterworld world. First in-category fallback
    // kicks in if the id ever drifts (defence in depth).
    heroThemeId: "waterworld",
  },
  hollywood: {
    id: "hollywood",
    name: "Hollywood",
    tagline: "Red carpet · premiere · spotlight · star",
    icon: "🎬",
    // Hollywood palette · gold + red-carpet crimson + champagne cream
    // over cinematic black · reads as "premiere night". Distinct from
    // Property's terracotta (which is real-estate hospitality) and
    // Haunted's indigo (atmospheric mystery · different cinematic
    // register from Hollywood's glamour).
    //
    // Keyword rule (sealed 2026-10-11): theme name/id contains
    // 'hollywood', 'cinema', 'redcarpet', 'red-carpet', 'premiere',
    // 'spotlight', 'star', 'joker', 'oscar', 'blockbuster' · falls
    // through to Hollywood. The 'joker' keyword captures the sealed
    // DB theme `theme-0` (its name/tagline carries 'joker') so the
    // Library auto-files it into this room without a per-id branch.
    colours: {
      primary: "#D4A542", // hollywood gold
      secondary: "#E85E5E", // red-carpet crimson
      highlight: "#FFF4D6", // champagne cream · light text on deep bg
      glow: "rgba(255,210,100,0.52)",
      deep: "#0D0608", // cinematic black · page background
    },
    heroThemeId: "hollywood",
  },
  vitamins: {
    id: "vitamins",
    name: "Vitamins",
    tagline: "Supplements · health · wellness · pharmacy",
    icon: "💊",
    // Vitamins palette · bright citrus + health cream · reads as
    // "wellness aisle" without being clinical. Distinct from
    // Services sage (which is practitioner territory) and Products
    // slate (which is retail generic).
    //
    // Keyword rule (2026-10-11): theme name/id contains 'vitamin',
    // 'supplement', 'wellness', 'pharmacy', 'nutrition', 'health' ·
    // falls through to Vitamins. Evaluated AFTER Food so a
    // "health kitchen" theme still routes to Food.
    colours: {
      primary: "#F5A623", // citrus amber
      secondary: "#7ED957", // fresh green
      highlight: "#FFF8E1", // health cream · light text on deep bg
      glow: "rgba(245,166,35,0.52)",
      deep: "#1A1507", // deep amber shadow · page background
    },
    // Vitamin Fruit is the first Vitamins live-world with a real
    // wallpaper + intro video (sealed 2026-10-11) · it becomes the
    // category hero. The DB-backed `vitamins` row (migration 137)
    // also files here via the keyword resolver.
    heroThemeId: "vitamin-fruit",
  },
  teddy: {
    id: "teddy",
    name: "Teddy",
    tagline: "Plush · soft toy · cuddle · gift Worlds",
    icon: "🧸",
    // Teddy palette · warm honey + apricot cream + buttermilk · reads
    // as "soft plush shelf". Distinct from Food's espresso warmth
    // (Food is dining · Teddy is huggable). Distinct from Bakery's
    // berry pink (Bakery is sweet-tooth · Teddy is cuddly). Distinct
    // from Accommodation's walnut gold (Accommodation is hospitality
    // · Teddy is toy-shelf).
    //
    // Keyword rule (2026-10-11): theme name/id contains 'teddy',
    // 'plush', 'cuddle', 'stuffie', 'soft-toy' · falls through to
    // Teddy. Deliberately NOT included: 'bear' (collides with
    // "bear beer" / "bear brand" / sports mascots) and 'doll'
    // (collides with "doll house" which is Property / "fashion
    // doll" which is Products).
    colours: {
      primary: "#C68246", // warm honey · plush fur
      secondary: "#F0C597", // peach cream · stuffing cotton
      highlight: "#FEF3DE", // buttermilk · light text on deep bg
      glow: "rgba(240,197,151,0.52)",
      deep: "#2B1A0C", // dark hazelnut · page background
    },
    // TeddyPlay is the first Teddy live-world with a real wallpaper
    // + intro (sealed 2026-10-11) · it becomes the category hero.
    // Pink Dream also lives in Teddy but ships with no wallpaper
    // asset so TeddyPlay reads better as the room's visual anchor.
    heroThemeId: "teddy-play",
  },
  watches: {
    id: "watches",
    name: "Watches",
    tagline: "Luxury · chronograph · dial · craftsmanship Worlds",
    icon: "⌚",
    // Watches palette · Rolex-green anchor + champagne gold + ivory
    // dial cream · reads as "under the loupe at the jeweller".
    // Distinct from Hollywood's hollywood gold (which is premiere /
    // red carpet) and from Teddy's warm honey (which is soft toy).
    // The deep walnut/forest stage reads as a vitrine with directional
    // lighting · the champagne glow is reflected off a polished bezel.
    //
    // Keyword rule (2026-10-13 · evaluated AFTER Haunted/Waterworld
    // so a "water-resistant watch" doesn't fall into Waterworld, and
    // AFTER Property/Accommodation so a "homes watch" collision is
    // avoided · keywords are specific enough that an actual watch
    // theme reliably wins):
    //   'watch', 'watches', 'chronograph', 'rolex', 'omega',
    //   'timepiece', 'dial', 'bezel', 'horology', 'wristwatch'.
    // Deliberately NOT included: 'time' (collides with "time to go"
    // ambient themes) and 'luxury' (too broad · hotel / car /
    // jewellery worlds).
    colours: {
      primary: "#006039", // Rolex green anchor
      secondary: "#C9A961", // champagne gold
      highlight: "#F5F0E6", // ivory dial cream · light text on deep bg
      glow: "rgba(201,169,97,0.52)", // polished-bezel gold glow
      deep: "#0A1F15", // deep forest · vitrine shadow background
    },
    // Hero · the sealed watches-rolex world is the first (and
    // currently only) Watches theme and acts as the category hero.
    heroThemeId: "watches-rolex",
  },
  property: {
    id: "property",
    name: "Property",
    tagline: "Real-estate · house · apartment · land · agent",
    icon: "🏡",
    // Property palette · warm slate / terracotta / dusk cream · reads
    // as "real estate", "modern home at golden hour". Distinct from
    // Accommodation (which is about hosting a stay) and Waterworld
    // (which is deep water-blue). Property is sale / listing / agent
    // territory · the room is purposely warmer than Products' cool
    // slate so it reads as a human-scale real-estate listing surface.
    //
    // Keyword rule (2026-10-11 · evaluated BEFORE Accommodation so a
    // "property listing" routes here rather than Accommodation via
    // 'villa'; evaluated AFTER Haunted so "haunted estate" still
    // routes to Haunted):
    //   'property', 'real-estate', 'realestate', 'realtor', 'realty',
    //   'estate', 'listing', 'home', 'apartment', 'condo', 'mortgage'.
    // Deliberately NOT included: 'house', 'agent' (collide too
    // readily with "coffee house" / "travel agent").
    colours: {
      primary: "#B45B3C", // terracotta
      secondary: "#D8A08A", // dusk clay
      highlight: "#F5E7D8", // dusk cream · light text on deep bg
      glow: "rgba(216,160,138,0.50)",
      deep: "#1E130C", // deep walnut night · page background
    },
    // Hero · the sealed property1 world ships as the first Property
    // theme and acts as the category hero.
    heroThemeId: "property1",
  },
  [EXPLORE_CATEGORY_ID]: {
    id: EXPLORE_CATEGORY_ID,
    name: "Explore",
    tagline: "Worlds not yet grouped into a dedicated category",
    icon: "✨",
    // Explore is the universal uncategorised bucket · its palette is
    // intentionally the NEX default signature so visitors understand
    // "this is NEX itself showing you worlds, not a themed room".
    colours: {
      primary: "#00AFFF", // NEX cyan
      secondary: "#4FC3DC",
      highlight: "#F4F7FC",
      glow: "rgba(0,175,255,0.35)",
      deep: "var(--nex-world-background-base, #020914)",
    },
    // Hero · after the Step 1G rename, Ocean became Waterworld and
    // moved out of Explore into its own Waterworld category. Explore
    // now contains only the two free NEX-brand themes (nex-bubbles +
    // nex-flat). nex-bubbles wins as hero (NEX brand identity).
    heroThemeId: "nex-bubbles",
  },
};

/** Look up a registered category by id. Returns `null` for unknown
 *  ids rather than throwing · callers that need loud failure should
 *  pair this with `isRegisteredCategory` and raise their own error. */
export function getCategory(id: string): ThemeCategory | null {
  return CATEGORY_REGISTRY[id] ?? null;
}

/** List every registered category. The returned array is a snapshot;
 *  mutating it does not affect the registry. Order follows the
 *  registration order in the CATEGORY_REGISTRY object. */
export function listCategories(): readonly ThemeCategory[] {
  return Object.values(CATEGORY_REGISTRY);
}

/** True when `id` is a registered category id. Used by tests to guard
 *  against ThemePackages referencing nonexistent categories. */
export function isRegisteredCategory(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(CATEGORY_REGISTRY, id);
}

/** Deterministic resolution for a Theme World's category assignment.
 *
 *  · null · undefined · empty string → `EXPLORE_CATEGORY_ID`
 *  · registered id → that same id
 *  · unknown id → `EXPLORE_CATEGORY_ID` (safe default; the architecture
 *    guard that validates every code-registered package catches typos
 *    at CI time)
 *
 *  Never throws · never undefined · the Library adapter is safe to
 *  call this on every row.
 */
export function resolveCategoryId(
  categoryId: string | null | undefined,
): string {
  if (!categoryId) return EXPLORE_CATEGORY_ID;
  return isRegisteredCategory(categoryId) ? categoryId : EXPLORE_CATEGORY_ID;
}
