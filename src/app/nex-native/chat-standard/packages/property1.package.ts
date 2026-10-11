// src/app/nex-native/chat-standard/packages/property1.package.ts
//
// Property1 Theme Package · founder-authorised 2026-10-11.
// --------------------------------------------------------
// Founder creative seed:
//   name/concept  : Property · modern home · dusk · agent walk-through
//   personality   : drift (steady golden-hour calm · agent's pace)
//   colours       : terracotta · dusk clay · dusk cream · warm glow ·
//                   walnut night
//   intro         : "Woman gestures toward modern house" footage
//                   (sealed 2026-10-11 · lives in public/nex-themes/
//                   property1-intro.mp4). Plays with audio so the
//                   voice-over + ambient of the walk-through comes
//                   through. Policy "twice-then-skip" matches every
//                   other NEX video intro.
//   wallpaper     : property1 asset (sealed 2026-10-11 · lives in
//                   public/nex-themes/property1-wallpaper.png).
//                   Engine falls back to its layered CSS gradient
//                   when wallpaperUrl is null.
//
// Category assignment:
//   Lives in the "property" category · the keyword resolver also
//   routes 'property' / 'real-estate' / 'house' to Property, so the
//   explicit declaration + fallback both point the same way.
//
// Audio note (sealed 2026-10-11):
//   Standard-Experience intros autoplay MUTED to satisfy mobile
//   browser autoplay policies. Property1 declares `withAudio: true`
//   so the overlay flips `muted=false` on the video element · the
//   browser may still require a user gesture to actually hear the
//   track · the engine fades to chat regardless so the viewer never
//   gets stuck on a silent intro.

import type { ThemePackage } from "../_engine/types";

export const PROPERTY1_PACKAGE: ThemePackage = {
  identity: {
    id: "property1",
    name: "Property",
    tagline: "Real-estate · modern home · dusk walk-through",
    conceptOneLine: "Property · listing · agent · dusk",
    categoryId: "property",
  },
  colours: {
    primary: "#B45B3C", // terracotta
    secondary: "#D8A08A", // dusk clay
    highlight: "#F5E7D8", // dusk cream · light text on deep bg
    glow: "rgba(216,160,138,0.50)", // warm house-light glow
    deep: "#1E130C", // walnut night · stage anchor
  },
  personality: "drift",

  // 02 Intro · "Woman gestures toward modern house" footage (sealed
  // 2026-10-11). `withAudio: true` so the overlay unmutes the clip
  // and the viewer hears the walk-through voice-over + ambient.
  intro: {
    kind: "standard",
    videoUrl: "/nex-themes/property1-intro.mp4",
    scriptedAnimation: null,
    playPolicy: "twice-then-skip",
    withAudio: true,
  },

  // 03 Environment · property1 wallpaper (sealed 2026-10-11).
  wallpaperUrl: "/nex-themes/property1-wallpaper.png",
  wallpaperScrim: "default",

  // 06-09 Bubbles · pill-shaped glass bubbles over the dusk
  // wallpaper · the drift family's archetypal shape · slide-up
  // entrance reads as "stepping into the room".
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

  // 10 Emoji · card framing on the warm dusk surface.
  emoji: {
    tileSize: 36,
    framingKind: "card",
    bounceOnPick: false,
    colorShift: null,
  },

  // 11 Stickers · engine SVG generator renders a property-coherent set
  // from the colour system + personality. No explicit sticker art
  // shipped this round.
  stickers: {
    conceptKeywords: [
      "house",
      "key",
      "door",
      "window",
      "lamp",
      "roof",
      "sun",
      "garden",
    ],
  },

  // 12 Reactions · property / real-estate glyph set.
  reactions: {
    glyphs: ["🏡", "🔑", "👍", "❤️", "✨", "🤝"],
  },

  // 13 Composer · glass material + pill shape · matches bubble family.
  composer: {
    material: "glass",
    sendGlyph: "➤",
    shape: "pill",
  },

  // 16/17 Shop + Product cards · glass listing cards (property-grid)
  // with momentum scroll · coaster framing so each listing sits on a
  // round disc of warm light.
  shop: {
    cardStyle: "glass",
    scrollFeel: "momentum",
    productFraming: "coaster",
  },

  // 23 Ambient · sparse so the dusk wallpaper stays the visual focus.
  // Light rays + sparkles read as warm interior lights + reflections.
  ambient: {
    density: "sparse",
    families: ["light-rays", "sparkles"],
  },
};
