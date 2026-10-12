// src/app/nex-native/chat-standard/packages/bike-rental.package.ts
//
// Bike Rental Theme Package · founder-authorised 2026-10-11.
// ----------------------------------------------------------
// Founder creative seed:
//   name/concept  : Bike Rental · coastal road · motorcycle · wind
//   personality   : drift (steady forward motion · road-wind rhythm)
//   colours       : coastal teal / asphalt steel / foam cream /
//                   headlight glow / tarmac deep
//   intro         : motorcycle parked on coastal road (sealed
//                   2026-10-11 · lives in public/nex-themes/
//                   bike-rental-intro.mp4). No scripted fallback ·
//                   engine fades to chat if the MP4 can't play.
//   wallpaper     : rentals 1 asset (sealed 2026-10-11 · lives in
//                   public/nex-themes/bike-rental-wallpaper.png).
//                   Engine falls back to its layered CSS gradient
//                   when wallpaperUrl is null.
//
// Category assignment:
//   Lives in the "rentals" category · the Step 1E keyword resolver
//   also routes 'bike' + 'rental' to Rentals, so the explicit
//   declaration + fallback both point the same way.

import type { ThemePackage } from "../_engine/types";

export const BIKE_RENTAL_PACKAGE: ThemePackage = {
  identity: {
    id: "bike-rental",
    name: "Bike Rental",
    tagline: "Coastal road · motorcycle · wind",
    conceptOneLine: "Bike Rental · ride · coast · freedom",
    categoryId: "rentals",
  },
  colours: {
    primary: "#2A8E96", // coastal teal
    secondary: "#4D6B7A", // asphalt steel
    highlight: "#E8F4F2", // foam cream · light text on deep bg
    glow: "rgba(85,185,195,0.50)", // headlight glow
    deep: "#0A1C22", // tarmac deep
  },
  personality: "drift",

  // 02 Intro · coastal-road motorcycle footage (sealed 2026-10-11).
  intro: {
    kind: "standard",
    videoUrl: "/nex-themes/bike-rental-intro.mp4",
    scriptedAnimation: null,
    playPolicy: "twice-then-skip",
  },

  // 03 Environment · rentals-1 wallpaper (sealed 2026-10-11).
  wallpaperUrl: "/nex-themes/bike-rental-wallpaper.png",
  wallpaperScrim: "default",

  // 06-09 Bubbles · pill-shaped glass bubbles · the drift family's
  // archetypal shape. Entrance slide-up reads as "arriving at pace".
  bubbles: {
    shape: "pill",
    material: "glass",
    motion: {
      entrance: "slide-up",
      idle: "drift-in",
      reaction: "pop",
      departure: "fade-in",
    },
    effects: {
      sendFlicker: false,
      receiveRipple: false,
      sparkleOnSend: false,
      bubbleTrailOnSend: false,
    },
  },

  // 10 Emoji · card framing on the dark road surface.
  emoji: {
    tileSize: 36,
    framingKind: "card",
    bounceOnPick: false,
    colorShift: null,
  },

  // 11 Stickers · engine SVG generator renders a rental-coherent set
  // from colour system + personality · no explicit sticker art shipped
  // this round.
  stickers: {
    conceptKeywords: [
      "helmet",
      "motorcycle",
      "bike",
      "road",
      "wind",
      "coast",
      "key",
      "map",
    ],
  },

  // 12 Reactions · ride-friendly glyph set.
  reactions: {
    glyphs: ["🏍️", "🛵", "👍", "⚡", "🌊", "🗺️"],
  },

  // 13 Composer · glass material + pill shape · matches bubble family.
  composer: {
    material: "glass",
    sendGlyph: "➤",
    shape: "pill",
  },

  // 16/17 Shop + Product cards · glass cards (bike-specs grid) with
  // momentum scroll · coaster framing so each bike/accessory sits on
  // a round disc.
  shop: {
    // Unified 2026-10-13 · owner directive: every theme's shop slider
    // must use the EXACT same style and layout as the Joker/Hollywood
    // theme slider · glass cards · momentum scroll · coaster framing.
    cardStyle: "glass",
    scrollFeel: "momentum",
    productFraming: "coaster",
  },

  // 23 Ambient · sparse so the coastal-road wallpaper remains the
  // visual focus. Light rays + sparkles read as sun on water.
  ambient: {
    density: "sparse",
    families: ["light-rays", "sparkles"],
  },
};
