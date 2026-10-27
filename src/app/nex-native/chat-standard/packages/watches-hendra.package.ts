// src/app/nex-native/chat-standard/packages/watches-hendra.package.ts
//
// Watches · Hendra Theme Package · founder-authorised 2026-10-28.
// --------------------------------------------------------------
// Founder creative seed:
//   name/concept  : Watches · Hendra · luxury on stone · brand grid
//   personality   : drift (same unhurried-precision family as the
//                   sealed `watches-rolex` world · the two share the
//                   personality but diverge on palette + wallpaper)
//   colours       : cosmic navy (deep sky over watches) · brass gold
//                   (bezel + hour marker) · pale moonlight (text on
//                   dark) · amber vitrine glow · near-black vitrine
//                   shadow
//   intro         : owner-supplied "Luxury watches on rock surfaces"
//                   footage at public/nex-themes/watches-hendra-intro
//                   .mp4 · twice-then-skip policy matches every other
//                   NEX video intro so a repeat visitor is never
//                   trapped. withAudio OMITTED (muted autoplay only) ·
//                   the stock clip has no vocal track worth unmuting.
//   wallpaper     : owner-supplied watches showcase at public/nex-
//                   themes/watches-hendra-wallpaper.png · the engine's
//                   layered gradient falls back when the asset is 404.
//
// IP note (2026-10-28):
//   The wallpaper displays ~20 third-party brand logos (Rolex, Omega,
//   Patek Philippe, Cartier, TAG Heuer, Breitling, IWC, Longines,
//   Tissot, Seiko, Casio, Tudor, Hamilton, Rado, Citizen, Orient,
//   Fossil, Tommy Hilfiger, Michael Kors, Audemars Piguet). Owner
//   acknowledged the exposure before this file was authored and
//   accepted shipping as a built-in NEX theme wallpaper.
//
// Category assignment:
//   Lives in the "watches" category alongside watches-rolex. The two
//   are distinct worlds · same keyword resolver (watch / rolex /
//   chronograph / timepiece / dial / bezel / horology / wristwatch /
//   omega) ·  the Library surface shows them as sibling tiles under
//   the Watches section.
//
// Audio note (2026-10-28):
//   Standard-Experience intros autoplay MUTED to satisfy mobile
//   browser autoplay policies. withAudio is OMITTED on this package
//   (sibling watches-rolex sets it true for its own motion sound · we
//   do not want to inherit that behaviour here because the source clip
//   is ambient-only).

import type { ThemePackage } from "../_engine/types";

export const WATCHES_HENDRA_PACKAGE: ThemePackage = {
  identity: {
    id: "watches-hendra",
    name: "Hendra's Watches",
    tagline: "Luxury · brass · moonlight",
    conceptOneLine: "Watches · Hendra · luxury on stone · brand grid",
    categoryId: "watches",
  },
  colours: {
    primary: "#0B1A33", // cosmic navy · dominant backdrop sky
    secondary: "#C98F49", // brass gold · bezel + hour marker accent
    highlight: "#E8E1D1", // pale moonlight · readable light-text on dark
    glow: "rgba(212, 160, 87, 0.52)", // warm amber vitrine glow halo
    deep: "#050B18", // near-black · vitrine shadow background
  },
  personality: "drift",

  // 02 Intro · "Luxury watches on rock surfaces" footage. Muted
  // autoplay (withAudio omitted) · twice-then-skip. The theme viewer
  // falls back to the scripted-animation when the asset is missing;
  // we leave scriptedAnimation null here so a 404 produces an honest
  // "no intro" state (overlay dismisses, chat begins).
  intro: {
    kind: "standard",
    videoUrl: "/nex-themes/watches-hendra-intro.mp4",
    scriptedAnimation: null,
    playPolicy: "twice-then-skip",
  },

  // 03 Environment · the owner-supplied watches wallpaper lives behind
  // the chat · the engine's layered gradient falls back if the asset
  // is missing (404) · scrim "default" ensures the chat remains
  // readable on top of the busy image.
  wallpaperUrl: "/nex-themes/watches-hendra-wallpaper.png",
  wallpaperScrim: "default",

  // 06-09 Bubbles · pill-shaped glass bubbles over the vitrine
  // wallpaper · same shape+material pairing as watches-rolex so the
  // Watches category reads as a coherent family. Entrance slide-up
  // feels like placing a piece under the display light. Idle drift-in
  // is the signature `drift` personality movement.
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

  // 10 Emoji · card framing on the brass + navy surface. Same tile
  // size as the sibling Rolex package.
  emoji: {
    tileSize: 36,
    framingKind: "card",
    bounceOnPick: false,
    colorShift: null,
  },

  // 11 Stickers · engine SVG generator renders a watch-coherent set
  // from the colour system + personality. Shared concept keywords
  // with watches-rolex keep the Watches category's sticker vocabulary
  // consistent across the two worlds.
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

  // 12 Reactions · timepiece + luxury glyph set.
  reactions: {
    glyphs: ["⌚", "⏱️", "✨", "👑", "❤️", "👍"],
  },

  // 13 Composer · glass material + pill shape · matches bubble family.
  // ➤ send glyph (same as watches-rolex) rather than a theme-specific
  // icon so the composer action affordance stays universal.
  composer: {
    material: "glass",
    sendGlyph: "➤",
    shape: "pill",
  },

  // 16/17 Shop + Product cards · glass vitrine cards with momentum
  // scroll · coaster framing (owner directive 2026-10-13 · every theme
  // shop slider shares the Joker/Hollywood layout).
  shop: {
    cardStyle: "glass",
    scrollFeel: "momentum",
    productFraming: "coaster",
  },

  // 23 Ambient · sparse so the wallpaper stays the visual focus (the
  // owner-supplied image is already busy). Light rays + sparkles read
  // as directional vitrine lighting + bezel reflections.
  ambient: {
    density: "sparse",
    families: ["light-rays", "sparkles"],
  },
};
