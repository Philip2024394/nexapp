// src/app/nex-native/chat-standard/packages/watches-rolex.package.ts
//
// Watches · Rolex Theme Package · founder-authorised 2026-10-13.
// --------------------------------------------------------------
// Founder creative seed:
//   name/concept  : Watches · luxury · chronograph · dial close-up
//   personality   : drift (steady · unhurried · precision)
//   colours       : Rolex green · champagne gold · ivory dial cream ·
//                   polished-bezel gold glow · deep forest vitrine
//   intro         : "Camera pushes past luxury watches" footage
//                   (owner asset · lives in public/nex-themes/
//                   watches-rolex-intro.mp4). The clip arrives with
//                   motion sound · policy "twice-then-skip" matches
//                   every other NEX video intro so a repeat visitor
//                   is never trapped on the same intro.
//   wallpaper     : owner-supplied Rolex-themed image (lives in
//                   public/nex-themes/watches-rolex-wallpaper.png).
//                   Engine falls back to its layered CSS gradient
//                   when wallpaperUrl is null.
//
// Category assignment:
//   Lives in the "watches" category · the keyword resolver also
//   routes 'watch' / 'rolex' / 'chronograph' / 'timepiece' / 'dial'
//   / 'bezel' / 'horology' / 'wristwatch' / 'omega' to Watches, so
//   the explicit declaration + fallback both point the same way.
//
// Audio note (2026-10-13):
//   Standard-Experience intros autoplay MUTED to satisfy mobile
//   browser autoplay policies. Watches·Rolex declares `withAudio:
//   true` so the overlay flips `muted=false` on the video element ·
//   the browser may still require a user gesture to actually hear
//   the track · the engine fades to chat regardless so the viewer
//   never gets stuck on a silent intro.

import type { ThemePackage } from "../_engine/types";

export const WATCHES_ROLEX_PACKAGE: ThemePackage = {
  identity: {
    id: "watches-rolex",
    name: "Rolex",
    tagline: "Luxury · chronograph · dial",
    conceptOneLine: "Watches · Rolex · champagne gold · vitrine",
    categoryId: "watches",
  },
  colours: {
    primary: "#006039", // Rolex green anchor
    secondary: "#C9A961", // champagne gold
    highlight: "#F5F0E6", // ivory dial cream · light text on deep bg
    glow: "rgba(201,169,97,0.52)", // polished-bezel gold glow
    deep: "#0A1F15", // deep forest · vitrine shadow background
  },
  personality: "drift",

  // 02 Intro · "Camera pushes past luxury watches" footage. withAudio
  // so the overlay unmutes the clip and the viewer hears the motion
  // through the display case.
  intro: {
    kind: "standard",
    videoUrl: "/nex-themes/watches-rolex-intro.mp4",
    scriptedAnimation: null,
    playPolicy: "twice-then-skip",
    withAudio: true,
  },

  // 03 Environment · the Rolex-themed wallpaper lives behind the chat
  // · the engine's layered gradient fallback would also work if this
  // asset were missing.
  wallpaperUrl: "/nex-themes/watches-rolex-wallpaper.png",
  wallpaperScrim: "default",

  // 06-09 Bubbles · pill-shaped glass bubbles over the vitrine
  // wallpaper · the drift family's archetypal shape · slide-up
  // entrance reads as "setting the piece down on the counter".
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

  // 10 Emoji · card framing on the champagne surface.
  emoji: {
    tileSize: 36,
    framingKind: "card",
    bounceOnPick: false,
    colorShift: null,
  },

  // 11 Stickers · engine SVG generator renders a watch-coherent set
  // from the colour system + personality. No explicit sticker art
  // shipped this round.
  stickers: {
    conceptKeywords: [
      "watch",
      "clock",
      "dial",
      "bezel",
      "crown",
      "strap",
      "gold",
      "gear",
    ],
  },

  // 12 Reactions · timepiece / jewellery glyph set.
  reactions: {
    glyphs: ["⌚", "⏱️", "✨", "👑", "❤️", "👍"],
  },

  // 13 Composer · glass material + pill shape · matches bubble family.
  composer: {
    material: "glass",
    sendGlyph: "➤",
    shape: "pill",
  },

  // 16/17 Shop + Product cards · glass vitrine cards with momentum
  // scroll · coaster framing so each product sits on a round disc of
  // champagne-coloured light (reads as a watch pad under spotlight).
  shop: {
    // Unified 2026-10-13 · owner directive: every theme's shop slider
    // must use the EXACT same style and layout as the Joker/Hollywood
    // theme slider · glass cards · momentum scroll · coaster framing.
    cardStyle: "glass",
    scrollFeel: "momentum",
    productFraming: "coaster",
  },

  // 23 Ambient · sparse so the wallpaper stays the visual focus.
  // Light rays + sparkles read as directional vitrine lighting +
  // bezel reflections.
  ambient: {
    density: "sparse",
    families: ["light-rays", "sparkles"],
  },
};
