// src/lib/nex-native/vertical-presets/accommodation.ts
//
// NEX Vertical Presets · Accommodation (Villa · Homestay · Kost).
// Owner-authorised 2026-10-20 · Phase A1.
// -----------------------------------------------------------------------------
// Three sealed accommodation sub-type presets. All referenced chat
// theme ids are verified against LIVE_WORLD_PACKAGES · the cover
// layout id "accommodation" is verified against COVER_LAYOUT_IDS
// (added 2026-10-20 earlier this session).
//
// Demo room designs are STATIC VISUAL GUIDANCE only · they never
// persist · they never route to the product form · they never imply
// booking or availability. The owner's product/room creation path
// via /manage/products stays unchanged.
//
// Honest copy discipline:
//   · Price values are illustrative numbers in IDR, displayed with
//     an "Example" chip and an honest-copy footer that reads
//     "NEX room availability + booking lands in Phase B."
//   · No photos · no owner names · no verified claims.

import type { VerticalPreset } from "./types";

export const VILLA_PRESET: VerticalPreset = {
  category: "accommodation",
  subtype: "villa",
  labelId: "Villa",
  labelEn: "Villa",
  suggestedChatThemes: ["waterworld", "botanical-cafe", "coffee"],
  suggestedCoverLayout: "accommodation",
  demoRooms: [
    { nameId: "Villa Deluxe", nameEn: "Deluxe Villa", priceIdr: 850_000 },
    { nameId: "Villa Keluarga", nameEn: "Family Villa", priceIdr: 1_200_000 },
    { nameId: "Villa Kolam Pribadi", nameEn: "Pool Villa", priceIdr: 1_800_000 },
  ],
  amenities: [
    "Wi-Fi",
    "Kolam renang",
    "Dapur",
    "BBQ",
    "Taman",
    "Parkir",
    "AC",
  ],
};

export const HOMESTAY_PRESET: VerticalPreset = {
  category: "accommodation",
  subtype: "homestay",
  labelId: "Homestay",
  labelEn: "Homestay",
  suggestedChatThemes: ["botanical-cafe", "coffee", "waterworld"],
  suggestedCoverLayout: "accommodation",
  demoRooms: [
    { nameId: "Kamar Pribadi", nameEn: "Private Room", priceIdr: 250_000 },
    { nameId: "Kamar Keluarga", nameEn: "Family Room", priceIdr: 400_000 },
    { nameId: "Kamar Berbagi", nameEn: "Shared Room", priceIdr: 150_000 },
  ],
  amenities: [
    "Wi-Fi",
    "Sarapan",
    "Laundry",
    "Dapur bersama",
    "Air panas",
    "Tuan rumah lokal",
  ],
};

export const KOST_PRESET: VerticalPreset = {
  category: "accommodation",
  subtype: "kost",
  labelId: "Kost",
  labelEn: "Kost (Boarding)",
  suggestedChatThemes: ["nex-flat", "coffee", "botanical-cafe"],
  suggestedCoverLayout: "accommodation",
  demoRooms: [
    { nameId: "Kamar Standard", nameEn: "Standard Room", priceIdr: 800_000 },
    { nameId: "Kamar AC", nameEn: "AC Room", priceIdr: 1_200_000 },
    { nameId: "Kamar Premium", nameEn: "Premium Room", priceIdr: 1_500_000 },
  ],
  amenities: [
    "Wi-Fi",
    "Parkir",
    "Dapur bersama",
    "Laundry",
    "Keamanan 24 jam",
    "Kamar mandi dalam",
  ],
};

export const ACCOMMODATION_PRESETS: readonly VerticalPreset[] = [
  VILLA_PRESET,
  HOMESTAY_PRESET,
  KOST_PRESET,
];
