// src/app/nex-native/chat-standard/packages/nex-bubbles.package.ts
//
// NEX Bubbles · founder-authorised free NEX-brand theme · 2026-10-11.
// -------------------------------------------------------------------
// One of the two "free NEX themes" offered during the first-open
// experience. Shows what NEX looks like when you leave the chrome
// alone and let the brand speak:
//
//   · NEX cyan + navy palette · the sealed brand identity
//   · Pill-shaped bubbles with a cyan rim glow + subtle glass material
//   · drift personality so the room feels alive without being busy
//   · sparkle-on-send for the small moment of satisfaction
//   · dense wallpaper-null fallback so the engine's own gradient paints
//     the stage · no large hero image dependency
//
// Lives under the "explore" category · NEX themes are the universal
// bucket · they do not belong to Food / Products / Services. The
// signup flow's "pick-theme" wall activates this id via the sealed
// post-signup-apply intercept.

import type { ThemePackage } from "../_engine/types";

export const NEX_BUBBLES_PACKAGE: ThemePackage = {
  identity: {
    id: "nex-bubbles",
    name: "NEX Original",
    tagline: "The default NEX chat · off-white · orange · gray",
    conceptOneLine: "NEX Original · the default NEX chat theme",
    // Free NEX themes live in Explore · they're the universal brand
    // bucket, not a visual family like Food / Products / Services.
    categoryId: "explore",
  },
  colours: {
    // Step 1J (2026-10-11) · founder-sealed palette flip. NEX
    // Original is the DEFAULT chat · it uses the exact app colour
    // system: NEX orange accents + NEX gray secondary + off-white
    // text over the sealed navy stage. Previous cyan-primary was
    // not matching app chrome.
    primary: "#FF7200", // NEX orange · accent / bubble rim / send
    secondary: "#7D9BC0", // NEX gray · structural secondary
    highlight: "#F2F5F8", // NEX off-white · bubble text + composer text
    glow: "rgba(255, 114, 0, 0.45)", // orange rim glow
    deep: "#020914", // NEX navy stage
  },
  personality: "drift",

  // 02 Intro · engine's standard scripted intro · no video dependency.
  intro: {
    kind: "standard",
    videoUrl: null,
    scriptedAnimation: "nex-cyan-drift",
    playPolicy: "twice-then-skip",
  },

  // 03 Environment · owner-supplied Earth-from-space wallpaper
  // (2026-10-15 · "nex chat screen.png"). The deep-navy gradient
  // still shows through the sealed scrim so bubble + text contrast
  // stays legible on top of the planet artwork.
  wallpaperUrl: "/nex-native/chat-wallpaper-earth.png",
  wallpaperScrim: "default",

  // 06-09 Bubbles · pill-shaped glass bubbles · the drift family's
  // archetypal shape. Rim-light + inner glass highlight + shimmer
  // idle so bubbles catch the ambient light.
  // Step 1I polish (2026-10-11) · idle flipped from "drift-in" to
  // "shimmer" and ripple-on-receive enabled so inbound messages
  // feel alive.
  bubbles: {
    shape: "pill",
    material: "glass",
    motion: {
      entrance: "slide-up",
      idle: "shimmer",
      reaction: "pop",
      departure: "fade-in",
    },
    effects: {
      sendFlicker: false,
      receiveRipple: true,
      sparkleOnSend: true,
      bubbleTrailOnSend: false,
    },
  },

  // 10 Emoji · simple card framing on the NEX dark surface.
  emoji: {
    tileSize: 36,
    framingKind: "card",
    bounceOnPick: false,
    colorShift: null,
  },

  // 11 Stickers · engine SVG generator renders a NEX-identity set from
  // the colour system + personality. No explicit sticker art shipped;
  // the generator covers it so the theme is fully self-contained.
  stickers: {
    conceptKeywords: ["bubble", "spark", "wave", "pulse", "orbit", "nex"],
  },

  // 12 Reactions · universal glyph set, no theme-specific overrides.
  reactions: {
    glyphs: ["👍", "❤️", "😂", "✨", "🔥", "👏"],
  },

  // 13 Composer · glass material + pill shape · matches the bubbles.
  composer: {
    material: "glass",
    sendGlyph: "➤",
    shape: "pill",
  },

  // 16/17 Shop + Product cards · clean glass cards with momentum scroll.
  shop: {
    // Unified 2026-10-13 · owner directive: every theme's shop slider
    // must use the EXACT same style and layout as the Joker/Hollywood
    // theme slider · glass cards · momentum scroll · coaster framing.
    cardStyle: "glass",
    scrollFeel: "momentum",
    productFraming: "coaster",
  },

  // 23 Ambient · Step 1I polish · denser cinematic treatment with
  // light-rays catching the cyan rim + sparkles + a slow pollen
  // drift so the chat feels alive without competing with messages.
  ambient: {
    density: "medium",
    families: ["light-rays", "sparkles", "pollen-float"],
  },
};
