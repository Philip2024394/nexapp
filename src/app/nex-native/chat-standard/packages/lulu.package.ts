// src/app/nex-native/chat-standard/packages/lulu.package.ts
//
// LuLu Theme Package · owner-authorised 2026-10-16.
// --------------------------------------------------
// Owner creative seed (confirmed inputs only · everything else is a
// safe default modelled on the Teddy family · owner can override any
// field without changing the asset or category decisions):
//
//   name/concept  : LuLu · plush · hush gesture · quiet little moment
//   category      : teddy (owner directive 2026-10-16)
//   intro         : "Cartoon girl making hush gesture"
//                   (sealed 2026-10-16 · lives in public/nex-themes/
//                   lulu-intro.mp4 · 2.9 MB)
//   wallpaper     : plush-teddy backdrop (teddy 3.png source)
//                   (sealed 2026-10-16 · lives in public/nex-themes/
//                   lulu-wallpaper.png · 3.1 MB)
//
// Fields marked "// DEFAULT ·" below are safe values picked by the
// implementation to match the teddy-family aesthetic. Owner is free
// to replace any of them in a follow-up edit without affecting the
// asset paths, the category, or the slug.
//
// Registration path: this package is wired into LIVE_WORLD_PACKAGES in
// src/app/nex-native/chat-standard/_live-worlds.ts, so the sealed
// updateChatTheme account-service validator accepts "lulu" via the
// isLiveWorldId() fallback branch (same path as teddy-play) · NO new
// DB migration is required for this theme to be selectable.

import type { ThemePackage } from "../_engine/types";

export const LULU_PACKAGE: ThemePackage = {
  identity: {
    id: "lulu",
    name: "LuLu",
    // DEFAULT · tagline tuned to the "hush gesture" intro.
    tagline: "Hush · plush · quiet",
    // DEFAULT · one-line concept.
    conceptOneLine: "LuLu · hush · plush · tiny secret",
    categoryId: "teddy",
  },

  // DEFAULT · dusty-pink plush palette · pairs with the teddy wallpaper
  // and reads as a warm, soft-feminine sister to TeddyPlay's honey
  // palette. Replace with the exact LuLu palette when owner specifies.
  colours: {
    primary: "#E8B4C8", // dusty pink · plush
    secondary: "#F5D6E0", // soft rose · gentle
    highlight: "#FEF3F8", // barely-blush · readable text on deep bg
    glow: "rgba(245,214,224,0.52)",
    deep: "#2A1A24", // warm plum-brown · page / stage anchor
  },

  // DEFAULT · matches the teddy family. "drift" reads as calm, friendly
  // motion · appropriate to the hush intro.
  personality: "drift",

  // 02 Intro · "Cartoon girl making hush gesture" footage · owner-
  // supplied 2026-10-16. Audio off by default so autoplay works on
  // mobile. Policy "twice-then-skip" matches every other NEX video
  // intro per sealed intro doctrine.
  intro: {
    kind: "standard",
    videoUrl: "/nex-themes/lulu-intro.mp4",
    scriptedAnimation: null,
    playPolicy: "twice-then-skip",
  },

  // 03 Environment · teddy-themed wallpaper · owner-supplied
  // 2026-10-16 (source filename: "teddy 3.png").
  wallpaperUrl: "/nex-themes/lulu-wallpaper.png",
  wallpaperScrim: "default",

  // DEFAULT · pill-glass bubbles with the drift family's archetypal
  // motion. Same as teddy-play (same category · consistency doctrine).
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

  // DEFAULT · same emoji framing as teddy-play.
  emoji: {
    tileSize: 36,
    framingKind: "card",
    bounceOnPick: true,
    colorShift: null,
  },

  // DEFAULT · hush + plush sticker vocabulary. The sticker-search
  // keyword set drives the server-side theme-sticker lookup; owner can
  // extend with more terms later.
  stickers: {
    conceptKeywords: [
      "teddy",
      "lulu",
      "hush",
      "quiet",
      "whisper",
      "secret",
      "plush",
      "cuddle",
    ],
  },

  // DEFAULT · hush-themed reaction palette. 6 glyphs · same count as
  // every other theme in the catalogue.
  reactions: {
    glyphs: ["🤫", "💗", "🧸", "✨", "🌸", "🫧"],
  },

  // DEFAULT · glass composer with pill shape · matches the bubble
  // material + shape so the composer belongs visually.
  composer: {
    material: "glass",
    sendGlyph: "➤",
    shape: "pill",
  },

  // Shop UI · unified 2026-10-13 · owner directive: every theme's shop
  // slider must use the EXACT same style and layout as the Joker /
  // Hollywood theme slider · glass cards · momentum scroll · coaster
  // framing. (Not a per-theme choice.)
  shop: {
    cardStyle: "glass",
    scrollFeel: "momentum",
    productFraming: "coaster",
  },

  // DEFAULT · sparse ambient so the plush wallpaper stays the focus.
  // Sparkles + pollen-float read as soft dust catching light · same as
  // teddy-play.
  ambient: {
    density: "sparse",
    families: ["sparkles", "pollen-float"],
  },
};
