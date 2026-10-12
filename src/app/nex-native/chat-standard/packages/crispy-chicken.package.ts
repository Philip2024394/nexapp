// src/app/nex-native/chat-standard/packages/crispy-chicken.package.ts
//
// Crispy Chicken Theme Package · founder-authorised 2026-10-11.
// -------------------------------------------------------------
// Founder creative seed:
//   name/concept  : Crispy Chicken · golden-fried · steam · comfort
//   personality   : drift (steady warmth · steam curling up)
//   colours       : crispy gold · caramel · buttermilk cream ·
//                   amber glow · dark hazelnut (page / stage anchor)
//   intro         : "Steam rises from fried chicken" footage
//                   (sealed 2026-10-11 · lives in public/nex-themes/
//                   crispy-chicken-intro.mp4).
//   wallpaper     : food-2 asset (sealed 2026-10-11 · lives in
//                   public/nex-themes/crispy-chicken-wallpaper.png).
//
// Category assignment:
//   Lives in the "food" category · the keyword resolver also routes
//   'chicken' via the "food" family (plus the explicit declaration
//   below), so the Food showcase room is where visitors meet it.

import type { ThemePackage } from "../_engine/types";

export const CRISPY_CHICKEN_PACKAGE: ThemePackage = {
  identity: {
    id: "crispy-chicken",
    name: "Crispy Chicken",
    tagline: "Golden-fried · steam · comfort food",
    conceptOneLine: "Crispy Chicken · golden · steam · comfort",
    categoryId: "food",
  },
  colours: {
    primary: "#D4A24C", // crispy gold
    secondary: "#B57438", // caramel crust
    highlight: "#FDF2DF", // buttermilk cream · light text on deep bg
    glow: "rgba(240,180,110,0.55)", // amber steam glow
    deep: "#2A170B", // dark hazelnut · page / stage anchor
  },
  personality: "drift",

  // 02 Intro · "Steam rises from fried chicken" footage · sealed
  // 2026-10-11 · plays with audio OFF (default) so autoplay works
  // on mobile. Policy "twice-then-skip" matches every other NEX
  // video intro.
  intro: {
    kind: "standard",
    videoUrl: "/nex-themes/crispy-chicken-intro.mp4",
    scriptedAnimation: null,
    playPolicy: "twice-then-skip",
  },

  // 03 Environment · crispy-chicken wallpaper · sealed 2026-10-11.
  wallpaperUrl: "/nex-themes/crispy-chicken-wallpaper.png",
  wallpaperScrim: "default",

  // 06-09 Bubbles · pill-shaped glass bubbles over the dusk-fryer
  // wallpaper · the drift family's archetypal shape · slide-up
  // entrance reads as "arriving warm".
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

  // 10 Emoji · card framing on the warm dark surface.
  emoji: {
    tileSize: 36,
    framingKind: "card",
    bounceOnPick: false,
    colorShift: null,
  },

  // 11 Stickers · engine SVG generator renders a chicken-coherent
  // set from the colour system + personality. No explicit sticker
  // art shipped this round.
  stickers: {
    conceptKeywords: [
      "chicken",
      "wing",
      "drumstick",
      "fryer",
      "steam",
      "basket",
      "spice",
      "flame",
    ],
  },

  // 12 Reactions · comfort-food glyph set.
  reactions: {
    glyphs: ["🍗", "🔥", "👍", "❤️", "✨", "🤤"],
  },

  // 13 Composer · glass material + pill shape · matches bubble family.
  composer: {
    material: "glass",
    sendGlyph: "➤",
    shape: "pill",
  },

  // 16/17 Shop + Product cards · glass menu cards with momentum
  // scroll · coaster framing so each menu item sits on a round
  // disc of warm light.
  shop: {
    // Unified 2026-10-13 · owner directive: every theme's shop slider
    // must use the EXACT same style and layout as the Joker/Hollywood
    // theme slider · glass cards · momentum scroll · coaster framing.
    cardStyle: "glass",
    scrollFeel: "momentum",
    productFraming: "coaster",
  },

  // 23 Ambient · sparse so the wallpaper + bubbles stay the focus.
  // Heat shimmer + sparkles read as warm oil hiss + steam flecks.
  ambient: {
    density: "sparse",
    families: ["heat-shimmer", "sparkles"],
  },
};
