#!/usr/bin/env node
// scripts/verify-palette-flow.mjs
//
// NEX preview-palette parity verifier · sealed 2026-10-11.
// --------------------------------------------------------
// Runs the real live-world adapter and the shared palette inferrer
// against every registered theme and prints each theme's resolved
// ColourSystem. Used to verify that the SHARED mini-phone
// treatment (`src/app/nex-native/chat-standard/_engine/preview-
// mini-phone.ts`) receives the full palette the live Standard
// Experience shell uses · without requiring a browser.
//
// How to run:
//   npx tsx scripts/verify-palette-flow.mjs
//
// What this proves:
//   · Live-world themes round-trip pkg.colours through the adapter
//     (full fidelity · deep + highlight match the ThemePackage).
//   · DB-ish rows with only accent_hex fall back to NEX chrome
//     defaults for deep + highlight (correct behaviour · the DB
//     doesn't carry those columns yet · the fallback never
//     overrides a configured value).
//   · When a future DB row carries deep_hex / highlight_hex, the
//     inferrer picks them up verbatim (ready for a nex_chat_theme
//     migration that adds those columns · no code change needed
//     at that point).
//
// What this does NOT prove:
//   · Pixel-level visual parity in a real browser · the formulas
//     match the live engine by construction (same hexToRgba +
//     same material formulas), but a real-browser screenshot
//     comparison was not performed in this session.

import { liveWorldAsBrowserRow } from "../src/app/nex-native/chat-themes-library/_live-worlds-adapter.ts";
import { inferPaletteFromRow } from "../src/app/nex-native/chat-standard/_engine/preview-mini-phone.ts";
import { LIVE_WORLD_IDS } from "../src/app/nex-native/chat-standard/_live-worlds.ts";

console.log(
  "== Live-world palette round-trip (pkg.colours → BrowserThemeRow.palette) ==",
);
for (const id of LIVE_WORLD_IDS) {
  const row = liveWorldAsBrowserRow(id);
  const p = row.palette;
  console.log(
    `${id.padEnd(18)} primary=${p.primary} secondary=${p.secondary.padEnd(9)} deep=${p.deep} highlight=${p.highlight}`,
  );
}

console.log(
  "\n== DB fallback inferrer (nex_chat_theme row with no deep_hex column yet) ==",
);
console.log(
  "accent-only (Bakery berry):",
  JSON.stringify(
    inferPaletteFromRow({
      accent_hex: "#C66988",
      bubble_rim_hex: null,
      composer_rim_hex: null,
    }),
  ),
);
console.log(
  "accent+rim (Haunted indigo + fog):",
  JSON.stringify(
    inferPaletteFromRow({
      accent_hex: "#5A3A8E",
      bubble_rim_hex: "#8FB89C",
      composer_rim_hex: null,
    }),
  ),
);
console.log(
  "full-explicit (future DB migration that adds deep_hex + highlight_hex):",
  JSON.stringify(
    inferPaletteFromRow({
      accent_hex: "#D4A24C",
      bubble_rim_hex: "#B57438",
      composer_rim_hex: null,
      deep_hex: "#2A170B",
      highlight_hex: "#FDF2DF",
    }),
  ),
);
