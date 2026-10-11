// src/app/nex-native/chat-standard/packages/teddy-play.package.ts
//
// TeddyPlay Theme Package · founder-authorised 2026-10-11.
// --------------------------------------------------------
// Founder creative seed:
//   name/concept  : TeddyPlay · plush · walking + waving · playful
//   personality   : drift (steady friendly motion · teddy stroll)
//   colours       : honey plush · caramel cuddle · butter cream ·
//                   warm plush glow · toasted walnut (page / stage)
//   intro         : "Teddy walking and waving" footage
//                   (sealed 2026-10-11 · lives in public/nex-themes/
//                   teddy-play-intro.mp4).
//   wallpaper     : theme2 asset (sealed 2026-10-11 · lives in
//                   public/nex-themes/teddy-play-wallpaper.png).
//
// Category assignment:
//   Lives in the "teddy" category · the keyword resolver also routes
//   'teddy' / 'plush' to Teddy, so the explicit declaration + fallback
//   both point the same way.

import type { ThemePackage } from "../_engine/types";

export const TEDDY_PLAY_PACKAGE: ThemePackage = {
  identity: {
    id: "teddy-play",
    name: "TeddyPlay",
    tagline: "Plush · playful · walking + waving",
    conceptOneLine: "TeddyPlay · plush · play · hug",
    categoryId: "teddy",
  },
  colours: {
    primary: "#C68246", // warm honey · plush fur
    secondary: "#F0C597", // peach cream · stuffing cotton
    highlight: "#FEF3DE", // buttermilk · light text on deep bg
    glow: "rgba(240,197,151,0.52)",
    deep: "#2B1A0C", // toasted walnut · page / stage anchor
  },
  personality: "drift",

  // 02 Intro · "Teddy walking and waving" footage · sealed 2026-10-11.
  // Audio off by default so autoplay works on mobile. Policy "twice-
  // then-skip" matches every other NEX video intro.
  intro: {
    kind: "standard",
    videoUrl: "/nex-themes/teddy-play-intro.mp4",
    scriptedAnimation: null,
    playPolicy: "twice-then-skip",
  },

  // 03 Environment · teddy-play wallpaper · sealed 2026-10-11.
  wallpaperUrl: "/nex-themes/teddy-play-wallpaper.png",
  wallpaperScrim: "default",

  // 06-09 Bubbles · pill-shaped glass bubbles over the plush
  // wallpaper · the drift family's archetypal shape · slide-up
  // entrance reads as "arriving to play".
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

  emoji: {
    tileSize: 36,
    framingKind: "card",
    bounceOnPick: true,
    colorShift: null,
  },

  stickers: {
    conceptKeywords: [
      "teddy",
      "bear",
      "plush",
      "hug",
      "wave",
      "paw",
      "heart",
      "ribbon",
    ],
  },

  reactions: {
    glyphs: ["🧸", "💗", "👍", "❤️", "✨", "🤗"],
  },

  composer: {
    material: "glass",
    sendGlyph: "➤",
    shape: "pill",
  },

  shop: {
    cardStyle: "glass",
    scrollFeel: "momentum",
    productFraming: "coaster",
  },

  // 23 Ambient · sparse so the plush wallpaper stays the focus.
  // Sparkles + pollen-float read as warm dust catching light in a
  // nursery.
  ambient: {
    density: "sparse",
    families: ["sparkles", "pollen-float"],
  },
};
