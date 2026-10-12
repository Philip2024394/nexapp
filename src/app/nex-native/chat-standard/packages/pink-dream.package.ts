// src/app/nex-native/chat-standard/packages/pink-dream.package.ts
//
// Pink Dream Theme Package · founder-authorised 2026-10-11.
// ---------------------------------------------------------
// Palette mirrors the signature pink/plum identity of the sealed
// `/nex-native/themes/pink-dream/page.tsx` bespoke shell. Lives in
// the Teddy category because its visual language (pink + plush soft-
// baby-pink highlights) is cuddle/toy adjacent, per founder direction
// 2026-10-11.
//
// Note on routing: the hard-coded page at
// `/nex-native/themes/pink-dream/page.tsx` takes precedence over the
// dynamic `/themes/[id]` live-world route (Next.js static-page
// precedence), so visitors clicking a Pink Dream tile land on that
// bespoke page with its signature "bubbles connected to the sides of
// the screen for both users" design intact. This package exists so
// Pink Dream appears in the Theme Library (category + palette) with
// a theme-authentic preview tile.

import type { ThemePackage } from "../_engine/types";

export const PINK_DREAM_PACKAGE: ThemePackage = {
  identity: {
    id: "pink-dream",
    name: "Pink Dream",
    tagline: "Hot pink · plush soft-baby-pink · deep plum",
    conceptOneLine: "Pink Dream · plush · neon pink glow · dream",
    // Founder-sealed 2026-10-11 · Pink Dream files into Teddy ·
    // soft-plush visual family · its palette is cuddle-coded.
    categoryId: "teddy",
  },
  colours: {
    primary: "#FF4FA3", // signature hot pink
    secondary: "#FF8BC5", // light pink
    highlight: "#FFC1DF", // soft baby pink (used for mine-bubble text)
    glow: "rgba(255,79,163,0.45)", // neon pink glow
    deep: "#17121F", // deep plum night · page / stage anchor
  },
  personality: "drift",

  // 02 Intro · sealed 2026-10-11 · dedicated video intro shipped at
  // `/public/nex-themes/pink-dream-intro.mp4`. Audio off by default
  // so autoplay works on mobile. Policy "twice-then-skip" matches
  // every other NEX video intro · scripted animation name retained
  // as a fallback token the overlay would use if the video fails to
  // load.
  intro: {
    kind: "standard",
    videoUrl: "/nex-themes/pink-dream-intro.mp4",
    scriptedAnimation: "pink-dream-shimmer",
    playPolicy: "twice-then-skip",
  },

  // 03 Environment · pink-dream wallpaper asset (sealed Bridge 24 ·
  // shipped at `/public/nex-themes/pink-dream.png`). Mini-phone
  // library tile paints this behind the chat bubbles so the Teddy
  // row surfaces the real theme identity. Live chat tap-through
  // still goes to the SEALED bespoke page at
  // `/nex-native/themes/pink-dream/page.tsx` which has its own
  // hero chrome.
  wallpaperUrl: "/nex-themes/pink-dream.png",
  wallpaperScrim: "default",

  // 06-09 Bubbles · square shape mirrors the bespoke page's
  // "connected to the sides" aesthetic (the live `/themes/pink-dream`
  // page extends message rows to the viewport edges · the Library
  // tile approximates this via square-material bubbles with no soft
  // rim rounding).
  bubbles: {
    shape: "square",
    material: "solid",
    motion: {
      entrance: "slide-up",
      idle: "shimmer",
      reaction: "pop",
      departure: "fade-in",
    },
    effects: {
      sendFlicker: true,
      receiveRipple: true,
      sparkleOnSend: true,
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
      "heart",
      "sparkle",
      "cloud",
      "dream",
      "pink",
      "plush",
    ],
  },

  reactions: {
    glyphs: ["💗", "✨", "👍", "❤️", "🥰", "💖"],
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

  ambient: {
    density: "medium",
    families: ["sparkles", "pollen-float"],
  },
};
