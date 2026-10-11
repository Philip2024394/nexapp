// src/app/nex-native/chat-standard/packages/pizza.package.ts
//
// Pizza Theme Package · founder-authorised 2026-10-11.
// ----------------------------------------------------
// Founder creative seed:
//   name/concept  : Pizza · wood-fired · dough · tomato · basil
//   personality   : warm (same family as Food · ember-adjacent)
//   colours       : wood-fire orange / tomato red / cream crust /
//                   warm hearth glow / char-oven deep
//   intro         : wood-fired pizza oven burning (sealed 2026-10-11 ·
//                   lives in public/nex-themes/pizza-intro.mp4).
//                   No scripted fallback · engine fades to chat if the
//                   MP4 can't play.
//   wallpaper     : food 3 asset (sealed 2026-10-11 · lives in
//                   public/nex-themes/pizza-wallpaper.png). Engine
//                   falls back to its layered CSS gradient when the
//                   wallpaper is absent.
//
// Category assignment:
//   Lives in the "food" category · the keyword resolver would also
//   route it there via `pizza` → cooked-food heuristics, but the
//   explicit declaration keeps it sealed to Food.

import type { ThemePackage } from "../_engine/types";

export const PIZZA_PACKAGE: ThemePackage = {
  identity: {
    id: "pizza",
    name: "Pizza",
    tagline: "Wood-fired · dough · tomato · basil",
    conceptOneLine: "Pizza · wood-fired oven · hearth warmth",
    categoryId: "food",
  },
  colours: {
    primary: "#E85D2E", // wood-fire orange · the flame edge of the oven
    secondary: "#C9272F", // tomato red
    highlight: "#F7E1B6", // cream crust highlight
    glow: "rgba(255,145,70,0.60)", // warm hearth glow
    deep: "#1D0C06", // char-oven deep
  },
  personality: "warm",

  // 02 Intro · wood-fired pizza oven footage (sealed 2026-10-11).
  // The engine prefers videoUrl · if the MP4 fails to load the intro
  // resolver fades cleanly into the chat.
  intro: {
    kind: "standard",
    videoUrl: "/nex-themes/pizza-intro.mp4",
    scriptedAnimation: null,
    playPolicy: "twice-then-skip",
  },

  // 03 Environment · food-3 wallpaper (sealed 2026-10-11). The engine
  // falls back to its layered CSS gradient when wallpaperUrl is null.
  wallpaperUrl: "/nex-themes/pizza-wallpaper.png",
  wallpaperScrim: "default",

  // 06-09 Bubbles · domed vessel + warm-liquid interior · same shape
  // family as Food so the two worlds sit visually adjacent inside the
  // Food category showcase. Entrance warm-rise-in matches hearth-warmth.
  bubbles: {
    shape: "domed",
    material: "warm-liquid",
    motion: {
      entrance: "warm-rise-in",
      idle: "warm-pulse",
      reaction: "warm-glow-react",
      departure: "dissolve",
    },
    effects: {
      sendFlicker: false,
      receiveRipple: false,
      sparkleOnSend: true,
      bubbleTrailOnSend: false,
    },
  },

  // 10 Emoji · card framing with a warm backdrop so each emoji feels
  // placed on a terracotta tile.
  emoji: {
    tileSize: 38,
    framingKind: "card",
    bounceOnPick: false,
    colorShift: null,
  },

  // 11 Stickers · engine SVG generator renders a pizza-coherent set
  // from colour system + personality · no explicit sticker art shipped
  // this round. Future upload lands in nex-theme-sticker/pizza/.
  stickers: {
    conceptKeywords: [
      "pizza",
      "slice",
      "dough",
      "tomato",
      "basil",
      "oven",
      "cheese",
      "pepperoni",
    ],
  },

  // 12 Reactions · warm glyph set adjusted for pizza vocabulary.
  reactions: {
    glyphs: ["🍕", "🔥", "🤌", "🧄", "🧀", "🌿"],
  },

  // 13 Composer · ceramic material + rounded shape · pizza-tile vibe.
  // Send glyph is a slice to telegraph "warm pizza joint".
  composer: {
    material: "ceramic",
    sendGlyph: "🍕",
    shape: "rounded",
  },

  // 16/17 Shop + Product cards · ceramic-tile cards with momentum
  // scroll · coaster framing so each menu item sits on a round
  // terracotta disc like a bread plate.
  shop: {
    cardStyle: "ceramic-tile",
    scrollFeel: "momentum",
    productFraming: "coaster",
  },

  // 23 Ambient · dense warm atmosphere matching wood-fired oven.
  // Heat shimmer rising + warm glow (hearth light) + sparkles (ember
  // flecks catching light).
  ambient: {
    density: "dense",
    families: ["heat-shimmer", "sparkles"],
  },
};
