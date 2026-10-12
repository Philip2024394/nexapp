// src/app/nex-native/chat-standard/packages/hollywood.package.ts
//
// Hollywood Theme Package · founder-authorised 2026-10-11.
// --------------------------------------------------------
// Founder creative seed:
//   name/concept  : Hollywood · red carpet · spotlights · premiere
//   personality   : drift (steady spotlight pan · camera dolly)
//   colours       : hollywood gold · red-carpet crimson · champagne
//                   cream · spotlight glow · cinematic black (page)
//   intro         : "Camera moving along red carpet" footage
//                   (sealed 2026-10-11 · lives in public/nex-themes/
//                   hollywood-intro.mp4).
//   wallpaper     : hollywood 1 asset (sealed 2026-10-11 · lives in
//                   public/nex-themes/hollywood-wallpaper.png).
//
// Category assignment:
//   Lives in the "hollywood" category. The keyword resolver also
//   routes 'hollywood' / 'cinema' / 'redcarpet' / 'premiere' /
//   'spotlight' / 'star' / 'joker' to Hollywood, so DB-backed themes
//   (e.g. the sealed `theme-0` Joker) auto-file into the room via
//   their name/tagline/id signals.

import type { ThemePackage } from "../_engine/types";

export const HOLLYWOOD_PACKAGE: ThemePackage = {
  identity: {
    id: "hollywood",
    name: "Hollywood",
    tagline: "Red carpet · spotlights · premiere",
    conceptOneLine: "Hollywood · star · premiere · spotlight",
    categoryId: "hollywood",
  },
  colours: {
    primary: "#D4A542", // hollywood gold
    secondary: "#E85E5E", // red carpet crimson
    highlight: "#FFF4D6", // champagne cream · light text on deep bg
    glow: "rgba(255,210,100,0.52)", // spotlight glow
    deep: "#0D0608", // cinematic black · page / stage anchor
  },
  personality: "drift",

  // 02 Intro · "Camera moving along red carpet" footage · sealed
  // 2026-10-11. Audio off by default so autoplay works on mobile.
  // Policy "twice-then-skip" matches every other NEX video intro.
  intro: {
    kind: "standard",
    videoUrl: "/nex-themes/hollywood-intro.mp4",
    scriptedAnimation: null,
    playPolicy: "twice-then-skip",
  },

  // 03 Environment · hollywood wallpaper · sealed 2026-10-11.
  wallpaperUrl: "/nex-themes/hollywood-wallpaper.png",
  wallpaperScrim: "default",

  // 06-09 Bubbles · pill-shaped glass bubbles over the red-carpet
  // wallpaper · drift family archetype · slide-up entrance reads as
  // "stepping onto the carpet".
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
      "star",
      "spotlight",
      "camera",
      "clapperboard",
      "popcorn",
      "ticket",
      "crown",
      "award",
    ],
  },

  reactions: {
    glyphs: ["⭐", "🎬", "👏", "❤️", "✨", "🏆"],
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

  // 23 Ambient · light-rays + sparkles read as spotlights catching
  // the room · sparse density keeps the wallpaper the focus.
  ambient: {
    density: "sparse",
    families: ["light-rays", "sparkles"],
  },
};
