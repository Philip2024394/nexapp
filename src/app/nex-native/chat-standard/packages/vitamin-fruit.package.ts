// src/app/nex-native/chat-standard/packages/vitamin-fruit.package.ts
//
// Vitamin Fruit Theme Package · founder-authorised 2026-10-11.
// ------------------------------------------------------------
// Founder creative seed:
//   name/concept  : Vitamin Fruit · water splash · fresh wellness
//   personality   : drift (steady splash cascade · water droplet
//                   motion)
//   colours       : citrus amber · fresh green · health cream ·
//                   amber glow · deep amber shadow (page)
//   intro         : "Water splashes around vitamin tubes" footage
//                   (sealed 2026-10-11 · lives in public/nex-themes/
//                   vitamin-fruit-intro.mp4).
//   wallpaper     : vitamins 2 asset (sealed 2026-10-11 · lives in
//                   public/nex-themes/vitamin-fruit-wallpaper.png).
//
// Category assignment:
//   Lives in the "vitamins" category · the keyword resolver also
//   routes 'vitamin' + 'vitamins' to Vitamins so the explicit
//   declaration + fallback both point the same way.

import type { ThemePackage } from "../_engine/types";

export const VITAMIN_FRUIT_PACKAGE: ThemePackage = {
  identity: {
    id: "vitamin-fruit",
    name: "Vitamin Fruit",
    tagline: "Water splash · fresh wellness · citrus",
    conceptOneLine: "Vitamin Fruit · splash · fresh · wellness",
    categoryId: "vitamins",
  },
  colours: {
    primary: "#F5A623", // citrus amber
    secondary: "#7ED957", // fresh green
    highlight: "#FFF8E1", // health cream · light text on deep bg
    glow: "rgba(245,166,35,0.52)",
    deep: "#1A1507", // deep amber shadow · page / stage anchor
  },
  personality: "drift",

  // 02 Intro · "Water splashes around vitamin tubes" footage · sealed
  // 2026-10-11. Audio off by default so autoplay works on mobile.
  // Policy "twice-then-skip" matches every other NEX video intro.
  intro: {
    kind: "standard",
    videoUrl: "/nex-themes/vitamin-fruit-intro.mp4",
    scriptedAnimation: null,
    playPolicy: "twice-then-skip",
  },

  // 03 Environment · vitamin-fruit wallpaper · sealed 2026-10-11.
  wallpaperUrl: "/nex-themes/vitamin-fruit-wallpaper.png",
  wallpaperScrim: "default",

  // 06-09 Bubbles · pill-shaped glass bubbles over the citrus
  // wallpaper · drift family archetype · slide-up entrance reads as
  // "fresh pour".
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
      receiveRipple: true,
      sparkleOnSend: true,
      bubbleTrailOnSend: false,
    },
  },

  emoji: {
    tileSize: 36,
    framingKind: "card",
    bounceOnPick: false,
    colorShift: null,
  },

  stickers: {
    conceptKeywords: [
      "vitamin",
      "fruit",
      "citrus",
      "splash",
      "droplet",
      "leaf",
      "tube",
      "wellness",
    ],
  },

  reactions: {
    glyphs: ["🍊", "💊", "✨", "💧", "👍", "❤️"],
  },

  composer: {
    material: "glass",
    sendGlyph: "➤",
    shape: "pill",
  },

  shop: {
    // Unified 2026-10-13 · owner directive: every theme's shop slider
    // must use the EXACT same style and layout as the Joker/Hollywood
    // theme slider · glass cards · momentum scroll · coaster framing.
    cardStyle: "glass",
    scrollFeel: "momentum",
    productFraming: "coaster",
  },

  // 23 Ambient · bubbles-rising + sparkles read as water droplets
  // + citrus flecks catching light. Sparse density keeps the
  // wallpaper the focus.
  ambient: {
    density: "sparse",
    families: ["bubbles-rising", "sparkles"],
  },
};
