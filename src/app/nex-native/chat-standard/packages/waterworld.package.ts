// src/app/nex-native/chat-standard/packages/waterworld.package.ts
//
// Waterworld Theme Package · Step 1G rename (2026-10-11).
// -------------------------------------------------------
// This is the former "ocean" world, renamed to Waterworld and moved
// into its own Waterworld category. The sealed Step O test in
// `_category-grid.test.ts` was designed to flip at exactly this
// moment · the "no 'waterworld' package exists" assertion is now
// retired and the opposite "waterworld package exists" assertion
// takes its place.
//
// Content:
//   name/concept  : Waterworld · underwater · peaceful · premium
//   personality   : drift (float · ripple · shimmer)
//   colours       : deep blue / turquoise / white / aqua glow
//   intro         : fish + turtle underwater footage · asset reused
//                   from the ocean era · lives in public/nex-themes/
//                   ocean-intro.mp4. File NAME retained for history ·
//                   the package references it by path.
//   wallpaper     : ship.png (same ocean-era asset) · lives in
//                   public/nex-themes/ocean-ship.png.
//
// Engine behaviour is unchanged · the vocabulary tokens still
// resolve to the same drift/water treatments. If the id ever needs
// to be migrated in nex_account.chat_theme rows, the migration path
// is a one-liner UPDATE from 'ocean' to 'waterworld'. Scheduled
// separately when founder authorises · for now any lingering
// nex_account rows carrying chat_theme='ocean' simply fall back to
// NEX chrome (safe default · no visible break).

import type { ThemePackage } from "../_engine/types";

export const WATERWORLD_PACKAGE: ThemePackage = {
  identity: {
    id: "waterworld",
    name: "Waterworld",
    tagline: "Peaceful underwater · drift · shimmer",
    conceptOneLine: "Waterworld · underwater · peaceful · premium",
    categoryId: "waterworld",
  },
  colours: {
    primary: "#2E90B5", // deep blue
    secondary: "#4FC3DC", // turquoise
    highlight: "#E8F7FF", // white foam
    glow: "rgba(130,210,255,0.55)", // aqua glow
    deep: "#0A2535", // abyss
  },
  personality: "drift",

  // 02 Intro · fish-and-turtle underwater footage (asset shared with
  // the retired ocean package). Engine prefers videoUrl ·
  // scriptedAnimation stays as the fallback.
  intro: {
    kind: "standard",
    videoUrl: "/nex-themes/ocean-intro.mp4",
    scriptedAnimation: "ocean-drift",
    playPolicy: "twice-then-skip",
  },

  // 03 Environment · ship wallpaper (shared asset).
  wallpaperUrl: "/nex-themes/ocean-ship.png",
  wallpaperScrim: "default",

  // 06-09 Bubbles · the single most important Waterworld choice.
  bubbles: {
    shape: "water-droplet",
    material: "water",
    motion: {
      entrance: "drift-in",
      idle: "shimmer",
      reaction: "ripple-in",
      departure: "dissolve",
    },
    effects: {
      sendFlicker: false,
      receiveRipple: true,
      sparkleOnSend: false,
      bubbleTrailOnSend: true, // rising-bubble trail (water-exclusive)
    },
  },

  // 10 Emoji · water-ring framing so every emoji feels like it sits
  // in a tiny droplet of its own.
  emoji: {
    tileSize: 38,
    framingKind: "water-ring",
    bounceOnPick: false,
    colorShift: null,
  },

  // 11 Stickers · engine generates SVG stickers from these keywords.
  stickers: {
    conceptKeywords: ["fish", "shell", "octopus", "wave", "treasure", "diver", "bubble"],
  },

  // 12 Reactions · water-themed glyphs instead of the generic set.
  reactions: {
    glyphs: ["💙", "🫧", "🐚", "🐟", "✨", "🐙"],
  },

  // 13 Composer · "water" shape (asymmetric soft curve) + bubble send
  // glyph so the composer feels integrated with the sea.
  composer: {
    material: "water",
    sendGlyph: "🫧",
    shape: "water",
  },

  // 16/17 Shop + Product cards · driftwood-board treatment with slow
  // "current" scroll feel and buoy framing so products feel like
  // they belong underwater.
  shop: {
    cardStyle: "driftwood-board",
    scrollFeel: "current",
    productFraming: "buoy",
  },

  // 23 Ambient animation · dense bubbles-rising + light-rays + mist.
  ambient: {
    density: "dense",
    families: ["bubbles-rising", "light-rays", "mist"],
  },
};
