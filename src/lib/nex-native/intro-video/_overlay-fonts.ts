// src/lib/nex-native/intro-video/_overlay-fonts.ts
//
// Compatibility re-export. The real module is `./overlay-fonts.ts`
// (without the underscore prefix). intro-video-client.tsx still
// imports the legacy path; this re-export keeps the build green
// without touching the 3248-line client file.

export {
  INTRO_OVERLAY_FONTS,
  INTRO_OVERLAY_FONTS_HREF,
  INTRO_OVERLAY_SIZES,
  fontById,
  sizeById,
  type IntroOverlayFont,
  type IntroOverlayFontId,
  type IntroOverlaySize,
  type IntroOverlaySizeId,
} from "./overlay-fonts";
