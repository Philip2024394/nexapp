// src/app/nex-native/chat-standard/packages/ac-service.package.ts
//
// AC Service Theme Package · founder-authorised 2026-10-11.
// ---------------------------------------------------------
// Founder creative seed:
//   name/concept  : AC Service · cool · fresh · technician on-site
//   personality   : drift (steady calm motion · cool breeze rhythm)
//   colours       : fresh teal / cool sky / breeze white /
//                   mist glow / deep slate
//   intro         : technician repairing an air-conditioner (sealed
//                   2026-10-11 · lives in public/nex-themes/
//                   ac-service-intro.mp4). No scripted fallback ·
//                   engine fades to chat if the MP4 can't play.
//   wallpaper     : ac 1 asset (sealed 2026-10-11 · lives in
//                   public/nex-themes/ac-service-wallpaper.png).
//                   Engine falls back to its layered CSS gradient
//                   when wallpaperUrl is null.
//
// Category assignment:
//   Lives in the "services" category · the Step 1E keyword resolver
//   also routes 'service' to Services, so the explicit declaration
//   + fallback both point the same way.

import type { ThemePackage } from "../_engine/types";

export const AC_SERVICE_PACKAGE: ThemePackage = {
  identity: {
    id: "ac-service",
    name: "AC Service",
    tagline: "Cool · fresh · on-site",
    conceptOneLine: "AC Service · cool · fresh · install · repair",
    categoryId: "services",
  },
  colours: {
    primary: "#2DB8C6", // fresh teal · the AC exhaust-mist colour
    secondary: "#7FD3DC", // cool sky · soft contrast
    highlight: "#EAFAFC", // breeze white · light text on deep bg
    glow: "rgba(127,211,220,0.55)", // mist glow
    deep: "#0B1F26", // deep slate · page background
  },
  personality: "drift",

  // 02 Intro · technician footage (sealed 2026-10-11).
  intro: {
    kind: "standard",
    videoUrl: "/nex-themes/ac-service-intro.mp4",
    scriptedAnimation: null,
    playPolicy: "twice-then-skip",
  },

  // 03 Environment · ac-1 wallpaper (sealed 2026-10-11).
  wallpaperUrl: "/nex-themes/ac-service-wallpaper.png",
  wallpaperScrim: "default",

  // 06-09 Bubbles · pill-shaped glass · the drift family's archetypal
  // shape · reads as "cool clean service" without being clinical.
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

  // 10 Emoji · card framing · pure glyphs on a cool surface.
  emoji: {
    tileSize: 36,
    framingKind: "card",
    bounceOnPick: false,
    colorShift: null,
  },

  // 11 Stickers · engine SVG generator · service-tech vocabulary.
  stickers: {
    conceptKeywords: [
      "snowflake",
      "ac",
      "fan",
      "cool",
      "mist",
      "technician",
      "spanner",
      "home",
    ],
  },

  // 12 Reactions · service-shop glyph set · fresh + practical.
  reactions: {
    glyphs: ["❄️", "🧰", "👍", "✅", "🌬️", "🏠"],
  },

  // 13 Composer · glass + pill · matches the bubble family.
  composer: {
    material: "glass",
    sendGlyph: "➤",
    shape: "pill",
  },

  // 16/17 Shop + Product cards · glass cards · momentum scroll ·
  // coaster framing so service packages sit on tidy round discs.
  shop: {
    // Unified 2026-10-13 · owner directive: every theme's shop slider
    // must use the EXACT same style and layout as the Joker/Hollywood
    // theme slider · glass cards · momentum scroll · coaster framing.
    cardStyle: "glass",
    scrollFeel: "momentum",
    productFraming: "coaster",
  },

  // 23 Ambient · sparse so the wallpaper + service identity stay the
  // focal point. Light-rays + mist read as "cool breeze catching sun".
  ambient: {
    density: "sparse",
    families: ["light-rays", "mist"],
  },
};
