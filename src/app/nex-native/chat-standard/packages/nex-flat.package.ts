// src/app/nex-native/chat-standard/packages/nex-flat.package.ts
//
// NEX Flat · founder-authorised free NEX-brand theme · 2026-10-11.
// ----------------------------------------------------------------
// Sibling to NEX Bubbles · the "clean" option. Minimalist chat with:
//
//   · square-outlined chat shape · no bubble container
//   · solid material · clear text hierarchy over navy
//   · drift personality kept subtle · idle is `none`
//   · no sparkle · no ambient · all weight on type + rim
//
// Lives alongside NEX Bubbles in Explore. Shipped as a live-world
// package so it has zero DB dependency and ships cleanly for first-
// time users during the first-open experience.

import type { ThemePackage } from "../_engine/types";

export const NEX_FLAT_PACKAGE: ThemePackage = {
  identity: {
    id: "nex-flat",
    name: "NEX Orange Centre",
    tagline: "Navy canvas · glowing orange centre · bubbles floating up",
    conceptOneLine:
      "NEX Orange Centre · navy stage · orange centre · orange bubbles rising",
    categoryId: "explore",
  },
  colours: {
    // Step 1J re-seal (2026-10-11) · NEX Orange Centre is the signature
    // free NEX experience. Everything orange: the central moon-glow,
    // the rising bubble particles, the bubble rims, the send button.
    // Navy stage, off-white text. The real-chat overlay (moonGlow +
    // particleDrift) is attached in chat-theme-service.getThemeById
    // when the theme is synthesised from this live-world package.
    primary: "#FF7200", // NEX orange · bubble rim + send + centre glow
    secondary: "#FF9033", // NEX orange highlight · rising bubbles
    highlight: "#F2F5F8", // NEX off-white · bubble text
    glow: "rgba(255, 114, 0, 0.55)", // orange centre glow
    deep: "#020914", // NEX navy stage
  },
  personality: "drift",

  // 02 Intro · same NEX scripted intro · emphasises coherence between
  // the two free themes (same brand family, different presentation).
  intro: {
    kind: "standard",
    videoUrl: null,
    scriptedAnimation: "nex-cyan-drift",
    playPolicy: "twice-then-skip",
  },

  // 03 Environment · no wallpaper · engine's deep-navy gradient.
  wallpaperUrl: null,
  wallpaperScrim: "default",

  // 06-09 Bubbles · square outlined · the "no bubble container" look.
  // The outlined material still provides a thin rim so sender boundary
  // is readable without a filled container.
  // Step 1I polish (2026-10-11) · idle fades up to a subtle shimmer
  // (previously "none" which read as dead) + warm-pulse reactions
  // reinforce the orange identity on tap.
  bubbles: {
    shape: "square",
    material: "solid",
    motion: {
      entrance: "fade-in",
      idle: "shimmer",
      reaction: "warm-glow-react",
      departure: "fade-in",
    },
    effects: {
      sendFlicker: true,
      receiveRipple: false,
      sparkleOnSend: false,
      bubbleTrailOnSend: false,
    },
  },

  // 10 Emoji · smaller tiles · no framing · pure glyphs.
  emoji: {
    tileSize: 32,
    framingKind: "none",
    bounceOnPick: false,
    colorShift: null,
  },

  // 11 Stickers · same brand set as NEX Bubbles · generator-rendered.
  stickers: {
    conceptKeywords: ["pulse", "orbit", "wave", "spark", "nex", "cyan"],
  },

  // 12 Reactions · minimal glyph set · universal faces.
  reactions: {
    glyphs: ["👍", "❤️", "😂", "✨", "🔥", "🙏"],
  },

  // 13 Composer · pill shape even in Flat so the input stays tappable
  // and distinct from the square message bodies. Glass composer rim
  // reads as "the only glowing element on the stage".
  composer: {
    material: "glass",
    sendGlyph: "➤",
    shape: "pill",
  },

  // 16/17 Shop + Product cards · glass cards with momentum scroll.
  // Same as NEX Bubbles · the product grid is a shared surface.
  shop: {
    // Unified 2026-10-13 · owner directive: every theme's shop slider
    // must use the EXACT same style and layout as the Joker/Hollywood
    // theme slider · glass cards · momentum scroll · coaster framing.
    cardStyle: "glass",
    scrollFeel: "momentum",
    productFraming: "coaster",
  },

  // 23 Ambient · Step 1I polish · dense floating blue bubbles are
  // the dominant visual · heat-shimmer pulses behind them so the
  // orange primary gets its own heartbeat (orange center · blue
  // bubbles floating). Sparkles catch stray light.
  ambient: {
    density: "dense",
    families: ["bubbles-rising", "heat-shimmer", "sparkles"],
  },
};
