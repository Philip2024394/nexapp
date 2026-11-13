// src/app/nex-native/chat-themes-library/_catalog.ts
//
// NEX Chat Themes Library · paid-theme catalog.
// Owner-authorised 2026-11-02 (rev 5 · downloads + label cleanup
// 2026-11-03).
// -----------------------------------------------------------------------------
// 58 paid chat themes · €3.99 one-time or community subscription
// (monthly €2.99 / yearly €2.50/mo billed €30 up front).
//
// IMPORTANT · the Buy / Join buttons on this surface are placeholders
// today (open a "Payment coming soon" sheet). The prices + downloads
// below are NOT yet synced to the country pricing registry or any
// server-side counter. Downloads values are hand-seeded for social-
// proof display · older releases carry higher numbers because they've
// been available longer. Real-counter wiring is Phase 2.

export interface LibraryTheme {
  readonly id: string;
  readonly label: string;
  readonly wallpaperUrl: string;
  /** One-time purchase price · displayed in the Buy button only ·
   *  no on-image badge (owner directive 2026-11-03). */
  readonly oneTimePriceEUR: 3.99;
  /** Hue the active state glows with on the tile · Ireland Gold today. */
  readonly accentHex: "#C6A15B";
  /** Owner-authorised 2026-11-03 · when true the full-library tile
   *  renders a small yellow "NEW" badge in the top-right. Flip off
   *  once a release has aged out. */
  readonly isNew?: boolean;
  /** Owner-authorised 2026-11-03 · display-only download count for
   *  social proof. Older releases carry higher numbers. NOT connected
   *  to a server counter today · Phase 2. */
  readonly downloads: number;
}

export const LIBRARY_THEMES: readonly LibraryTheme[] = [
  // ── Release · 2026-11-11 (NEX heritage drop · pinned free tiles) ─
  // Owner directive 2026-11-11 · the three NEX-branded wallpapers
  // that power slots 2-4 of the Ireland free-chat picker are also
  // surfaced in the paid library (branded as NEW releases).
  { id: "library-nex-teddy",    label: "NEX · Teddy Bear Shopping", wallpaperUrl: "/nex-themes/ireland/teddy-bear-shopping.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 0, isNew: true },
  { id: "library-nex-puppy",    label: "NEX · Puppy & Kitten Cuddle", wallpaperUrl: "/nex-themes/ireland/puppy-kitten-cuddle.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 0, isNew: true },
  { id: "library-nex-supercar", label: "NEX · Sunset Supercar Showdown", wallpaperUrl: "/nex-themes/ireland/sunset-supercar.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 0, isNew: true },
  { id: "library-nex-luxury",    label: "NEX · Luxury Shopping Showcase",  wallpaperUrl: "/nex-themes/ireland/luxury-shopping.png",   oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 0, isNew: true },
  { id: "library-nex-racehorse", label: "NEX · Golden-Hour Racehorse Sprint", wallpaperUrl: "/nex-themes/ireland/racehorse-sprint.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 0, isNew: true },
  // ── Release 1 · 2026-11-02 (Ireland first drop) ─────────────────
  { id: "library-ireland-1", label: "Ireland · Dawn",     wallpaperUrl: "/nex-themes/library/preview/ireland-1.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 2847 },
  { id: "library-ireland-2", label: "Ireland · Dusk",     wallpaperUrl: "/nex-themes/library/preview/ireland-2.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 2104 },
  { id: "library-ireland-4", label: "Ireland · Mist",     wallpaperUrl: "/nex-themes/library/preview/ireland-4.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1988, isNew: true },
  { id: "library-ireland-5", label: "Ireland · Harbour",  wallpaperUrl: "/nex-themes/library/preview/ireland-5.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1762 },
  { id: "library-ireland-6", label: "Ireland · Field",    wallpaperUrl: "/nex-themes/library/preview/ireland-6.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1534 },
  { id: "library-ireland-9", label: "Ireland · Night",    wallpaperUrl: "/nex-themes/library/preview/ireland-9.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1289 },
  { id: "library-ire1",      label: "Ireland · Highland", wallpaperUrl: "/nex-themes/library/preview/ire1.png",      oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1105 },
  { id: "library-pattern-2", label: "Celtic Pattern",     wallpaperUrl: "/nex-themes/library/preview/pattern-2.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 892 },

  // ── Release 2 · 2026-11-03 · owner batch (15 named "Ireland · N") ─
  { id: "library-this-1",  label: "Ireland · 1",  wallpaperUrl: "/nex-themes/library/preview/this-1.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1472 },
  { id: "library-this-2",  label: "Ireland · 2",  wallpaperUrl: "/nex-themes/library/preview/this-2.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1398 },
  { id: "library-this-3",  label: "Ireland · 3",  wallpaperUrl: "/nex-themes/library/preview/this-3.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1218, isNew: true },
  { id: "library-this-4",  label: "Ireland · 4",  wallpaperUrl: "/nex-themes/library/preview/this-4.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1174 },
  { id: "library-this-5",  label: "Ireland · 5",  wallpaperUrl: "/nex-themes/library/preview/this-5.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1092 },
  { id: "library-this-6",  label: "Ireland · 6",  wallpaperUrl: "/nex-themes/library/preview/this-6.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 1025 },
  { id: "library-this-7",  label: "Ireland · 7",  wallpaperUrl: "/nex-themes/library/preview/this-7.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 983 },
  { id: "library-this-8",  label: "Ireland · 8",  wallpaperUrl: "/nex-themes/library/preview/this-8.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 917 },
  { id: "library-this-9",  label: "Ireland · 9",  wallpaperUrl: "/nex-themes/library/preview/this-9.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 854, isNew: true },
  { id: "library-this-10", label: "Ireland · 10", wallpaperUrl: "/nex-themes/library/preview/this-10.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 798 },
  { id: "library-this-11", label: "Ireland · 11", wallpaperUrl: "/nex-themes/library/preview/this-11.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 742 },
  { id: "library-this-12", label: "Ireland · 12", wallpaperUrl: "/nex-themes/library/preview/this-12.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 681 },
  { id: "library-this-13", label: "Ireland · 13", wallpaperUrl: "/nex-themes/library/preview/this-13.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 624 },
  { id: "library-this-14", label: "Ireland · 14", wallpaperUrl: "/nex-themes/library/preview/this-14.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 573 },
  { id: "library-this-15", label: "Ireland · 15", wallpaperUrl: "/nex-themes/library/preview/this-15.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 518, isNew: true },

  // ── Release 3 · 2026-11-03 · owner batch (named downloads) ──────
  { id: "library-countryside-sunrise", label: "Misty Countryside Sunrise", wallpaperUrl: "/nex-themes/library/preview/countryside-sunrise.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 967 },
  { id: "library-aerial-dream",        label: "Dreamy Aerial View",         wallpaperUrl: "/nex-themes/library/preview/aerial-dream.png",        oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 889 },
  { id: "library-pipe-elder",          label: "Misty Dawn · Pipe Elder",    wallpaperUrl: "/nex-themes/library/preview/pipe-elder.png",          oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 821 },
  { id: "library-pub-moonlight",       label: "Pub Toast · Moonlight",      wallpaperUrl: "/nex-themes/library/preview/pub-moonlight.png",       oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 773 },
  { id: "library-pub-sunset",          label: "Golden Pub · Sunset",        wallpaperUrl: "/nex-themes/library/preview/pub-sunset.png",          oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 702 },
  { id: "library-countryside-collage", label: "Countryside Collage",        wallpaperUrl: "/nex-themes/library/preview/countryside-collage.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 648, isNew: true },
  { id: "library-emerald-lane",        label: "Emerald Lane · Golden Hour", wallpaperUrl: "/nex-themes/library/preview/emerald-lane.png",        oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 597 },
  { id: "library-pub-village",         label: "Village Pub · Golden Hour",  wallpaperUrl: "/nex-themes/library/preview/pub-village.png",         oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 541 },
  { id: "library-pub-folk",            label: "Cozy Pub · Folk Session",    wallpaperUrl: "/nex-themes/library/preview/pub-folk.png",            oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 492 },
  { id: "library-pub-country",         label: "Country Pub · Golden Hour",  wallpaperUrl: "/nex-themes/library/preview/pub-country.png",         oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 438 },
  { id: "library-highlander",          label: "Golden Hour Highlander",     wallpaperUrl: "/nex-themes/library/preview/highlander.png",          oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 394 },
  { id: "library-pub-cliffs",          label: "Festive Pub · Cliffs",       wallpaperUrl: "/nex-themes/library/preview/pub-cliffs.png",          oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 349 },
  { id: "library-celtic-sunset",       label: "Celtic Sunset · Lion & Lady", wallpaperUrl: "/nex-themes/library/preview/celtic-sunset.png",      oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 302 },
  { id: "library-celtic-coast",        label: "Emerald Celtic Coast",       wallpaperUrl: "/nex-themes/library/preview/celtic-coast.png",        oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 258, isNew: true },
  { id: "library-leprechaun",          label: "Sunlit Leprechaun",          wallpaperUrl: "/nex-themes/library/preview/leprechaun.png",          oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 221 },

  // ── Release 4 · 2026-11-03 · 20 m-series · FLAGGED NEW ──────────
  { id: "library-m-1",  label: "Ireland · M1",  wallpaperUrl: "/nex-themes/library/preview/m-1.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 487 },
  { id: "library-m-2",  label: "Ireland · M2",  wallpaperUrl: "/nex-themes/library/preview/m-2.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 412 },
  { id: "library-m-3",  label: "Ireland · M3",  wallpaperUrl: "/nex-themes/library/preview/m-3.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 365 },
  { id: "library-m-4",  label: "Ireland · M4",  wallpaperUrl: "/nex-themes/library/preview/m-4.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 328 },
  { id: "library-m-5",  label: "Ireland · M5",  wallpaperUrl: "/nex-themes/library/preview/m-5.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 294 },
  { id: "library-m-6",  label: "Ireland · M6",  wallpaperUrl: "/nex-themes/library/preview/m-6.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 267 },
  { id: "library-m-7",  label: "Ireland · M7",  wallpaperUrl: "/nex-themes/library/preview/m-7.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 238 },
  { id: "library-m-8",  label: "Ireland · M8",  wallpaperUrl: "/nex-themes/library/preview/m-8.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 215, isNew: true },
  { id: "library-m-9",  label: "Ireland · M9",  wallpaperUrl: "/nex-themes/library/preview/m-9.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 196 },
  { id: "library-m-10", label: "Ireland · M10", wallpaperUrl: "/nex-themes/library/preview/m-10.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 178 },
  { id: "library-m-11", label: "Ireland · M11", wallpaperUrl: "/nex-themes/library/preview/m-11.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 164 },
  { id: "library-m-12", label: "Ireland · M12", wallpaperUrl: "/nex-themes/library/preview/m-12.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 149 },
  { id: "library-m-13", label: "Ireland · M13", wallpaperUrl: "/nex-themes/library/preview/m-13.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 137, isNew: true },
  { id: "library-m-14", label: "Ireland · M14", wallpaperUrl: "/nex-themes/library/preview/m-14.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 125 },
  { id: "library-m-15", label: "Ireland · M15", wallpaperUrl: "/nex-themes/library/preview/m-15.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 112 },
  { id: "library-m-16", label: "Ireland · M16", wallpaperUrl: "/nex-themes/library/preview/m-16.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 98  },
  { id: "library-m-17", label: "Ireland · M17", wallpaperUrl: "/nex-themes/library/preview/m-17.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 83  },
  { id: "library-m-18", label: "Ireland · M18", wallpaperUrl: "/nex-themes/library/preview/m-18.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 69  },
  { id: "library-m-19", label: "Ireland · M19", wallpaperUrl: "/nex-themes/library/preview/m-19.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 57, isNew: true },
  { id: "library-m-20", label: "Ireland · M20", wallpaperUrl: "/nex-themes/library/preview/m-20.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 42  },

  // ── Release 5 · 2026-11-03 · 12 y-series ────────────────────────
  { id: "library-y-1",  label: "Ireland · Y1",  wallpaperUrl: "/nex-themes/library/preview/y-1.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 182 },
  { id: "library-y-2",  label: "Ireland · Y2",  wallpaperUrl: "/nex-themes/library/preview/y-2.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 164 },
  { id: "library-y-3",  label: "Ireland · Y3",  wallpaperUrl: "/nex-themes/library/preview/y-3.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 151 },
  { id: "library-y-4",  label: "Ireland · Y4",  wallpaperUrl: "/nex-themes/library/preview/y-4.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 139 },
  { id: "library-y-5",  label: "Ireland · Y5",  wallpaperUrl: "/nex-themes/library/preview/y-5.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 126 },
  { id: "library-y-6",  label: "Ireland · Y6",  wallpaperUrl: "/nex-themes/library/preview/y-6.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 115 },
  { id: "library-y-7",  label: "Ireland · Y7",  wallpaperUrl: "/nex-themes/library/preview/y-7.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 104 },
  { id: "library-y-8",  label: "Ireland · Y8",  wallpaperUrl: "/nex-themes/library/preview/y-8.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 93 },
  { id: "library-y-9",  label: "Ireland · Y9",  wallpaperUrl: "/nex-themes/library/preview/y-9.png",  oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 81 },
  { id: "library-y-10", label: "Ireland · Y10", wallpaperUrl: "/nex-themes/library/preview/y-10.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 69 },
  { id: "library-y-11", label: "Ireland · Y11", wallpaperUrl: "/nex-themes/library/preview/y-11.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 54 },
  { id: "library-y-12", label: "Ireland · Y12", wallpaperUrl: "/nex-themes/library/preview/y-12.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 38 },

  // ── Release 6 · 2026-11-08 · Pets drop (4 tiles · owner directive) ──
  // Source files from the owner's Pictures folder (home chat 1-4).
  // Flagged isNew:true across the drop. accent stays Ireland Gold per
  // the sealed catalog convention (accentHex is the active-tile glow,
  // not the preview content).
  { id: "library-pets-1", label: "Pets · 1", wallpaperUrl: "/nex-themes/library/preview/pets-1.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 0, isNew: true },
  { id: "library-pets-2", label: "Pets · 2", wallpaperUrl: "/nex-themes/library/preview/pets-2.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 0, isNew: true },
  { id: "library-pets-3", label: "Pets · 3", wallpaperUrl: "/nex-themes/library/preview/pets-3.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 0, isNew: true },
  { id: "library-pets-4", label: "Pets · 4", wallpaperUrl: "/nex-themes/library/preview/pets-4.png", oneTimePriceEUR: 3.99, accentHex: "#C6A15B", downloads: 0, isNew: true },

  // ── Release · 2026-11-03 · owner batch (97 Supabase-hosted) ────
  { id: 'theme-o1', label: 'Theme 1', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o1.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 573, isNew: true },
  { id: 'theme-o2', label: 'Theme 2', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o2.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2482, isNew: true },
  { id: 'theme-o3', label: 'Theme 3', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o3.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1863, isNew: true },
  { id: 'theme-o4', label: 'Theme 4', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o4.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2375, isNew: true },
  { id: 'theme-o5', label: 'Theme 5', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o5.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1327, isNew: true },
  { id: 'theme-o6', label: 'Theme 6', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o6.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 770, isNew: true },
  { id: 'theme-o7', label: 'Theme 7', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o7.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2373, isNew: true },
  { id: 'theme-o8', label: 'Theme 8', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o8.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1321, isNew: true },
  { id: 'theme-o9', label: 'Theme 9', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o9.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 602, isNew: true },
  { id: 'theme-o10', label: 'Theme 10', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o10.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1436, isNew: true },
  { id: 'theme-o11', label: 'Theme 11', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o11.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1615 },
  { id: 'theme-o12', label: 'Theme 12', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o12.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 804 },
  { id: 'theme-o13', label: 'Theme 13', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o13.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1469 },
  { id: 'theme-o14', label: 'Theme 14', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o14.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2215 },
  { id: 'theme-o15', label: 'Theme 15', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o15.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1680 },
  { id: 'theme-o16', label: 'Theme 16', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o16.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2288 },
  { id: 'theme-o17', label: 'Theme 17', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o17.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 840 },
  { id: 'theme-o18', label: 'Theme 18', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o18.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 963 },
  { id: 'theme-o19', label: 'Theme 19', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o19.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2112 },
  { id: 'theme-o20', label: 'Theme 20', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o20.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1752 },
  { id: 'theme-o21', label: 'Theme 21', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o21.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1137 },
  { id: 'theme-o22', label: 'Theme 22', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o22.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2314 },
  { id: 'theme-o23', label: 'Theme 23', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o23.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1224 },
  { id: 'theme-o24', label: 'Theme 24', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o24.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2499 },
  { id: 'theme-o25', label: 'Theme 25', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o25.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1885 },
  { id: 'theme-o26', label: 'Theme 26', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o26.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1441 },
  { id: 'theme-o27', label: 'Theme 27', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o27.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1033 },
  { id: 'theme-o28', label: 'Theme 28', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o28.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2093 },
  { id: 'theme-o29', label: 'Theme 29', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o29.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2203 },
  { id: 'theme-o30', label: 'Theme 30', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o30.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1580 },
  { id: 'theme-o31', label: 'Theme 31', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o31.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1816 },
  { id: 'theme-o32', label: 'Theme 32', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o32.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1611 },
  { id: 'theme-o33', label: 'Theme 33', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o33.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1970 },
  { id: 'theme-o34', label: 'Theme 34', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o34.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 616 },
  { id: 'theme-o35', label: 'Theme 35', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o35.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1736 },
  { id: 'theme-o36', label: 'Theme 36', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o36.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1769 },
  { id: 'theme-o37', label: 'Theme 37', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o37.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1825 },
  { id: 'theme-o38', label: 'Theme 38', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o38.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 570 },
  { id: 'theme-o39', label: 'Theme 39', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o39.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1257 },
  { id: 'theme-o40', label: 'Theme 40', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o40.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1436 },
  { id: 'theme-o41', label: 'Theme 41', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o41.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1050 },
  { id: 'theme-o42', label: 'Theme 42', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o42.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 856 },
  { id: 'theme-o43', label: 'Theme 43', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o43.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2428 },
  { id: 'theme-o44', label: 'Theme 44', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o44.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2149 },
  { id: 'theme-o45', label: 'Theme 45', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o45.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2338 },
  { id: 'theme-o46', label: 'Theme 46', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o46.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1075 },
  { id: 'theme-o47', label: 'Theme 47', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o47.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 730 },
  { id: 'theme-o48', label: 'Theme 48', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o48.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2122 },
  { id: 'theme-o49', label: 'Theme 49', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o49.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1122 },
  { id: 'theme-o50', label: 'Theme 50', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o50.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1186 },
  { id: 'theme-o51', label: 'Theme 51', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o51.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1967 },
  { id: 'theme-o52', label: 'Theme 52', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o52.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1084 },
  { id: 'theme-o53', label: 'Theme 53', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o53.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 851 },
  { id: 'theme-o54', label: 'Theme 54', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o54.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 976 },
  { id: 'theme-o55', label: 'Theme 55', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o55.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1527 },
  { id: 'theme-o56', label: 'Theme 56', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o56.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 807 },
  { id: 'theme-o57', label: 'Theme 57', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o57.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1700 },
  { id: 'theme-o58', label: 'Theme 58', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o58.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1066 },
  { id: 'theme-o59', label: 'Theme 59', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o59.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1203 },
  { id: 'theme-o60', label: 'Theme 60', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o60.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1488 },
  { id: 'theme-o61', label: 'Theme 61', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o61.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1403 },
  { id: 'theme-o62', label: 'Theme 62', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o62.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 889 },
  { id: 'theme-o63', label: 'Theme 63', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o63.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1664 },
  { id: 'theme-o64', label: 'Theme 64', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o64.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 797 },
  { id: 'theme-o65', label: 'Theme 65', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o65.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2022 },
  { id: 'theme-o66', label: 'Theme 66', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o66.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2284 },
  { id: 'theme-o67', label: 'Theme 67', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o67.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1455 },
  { id: 'theme-o68', label: 'Theme 68', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o68.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1141 },
  { id: 'theme-o69', label: 'Theme 69', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o69.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 868 },
  { id: 'theme-o70', label: 'Theme 70', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o70.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 669 },
  { id: 'theme-o71', label: 'Theme 71', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o71.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1887 },
  { id: 'theme-o72', label: 'Theme 72', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o72.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1288 },
  { id: 'theme-o73', label: 'Theme 73', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o73.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 688 },
  { id: 'theme-o74', label: 'Theme 74', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o74.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1317 },
  { id: 'theme-o75', label: 'Theme 75', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o75.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1537 },
  { id: 'theme-o76', label: 'Theme 76', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o76.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2322 },
  { id: 'theme-o77', label: 'Theme 77', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o77.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1490 },
  { id: 'theme-o78', label: 'Theme 78', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o78.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1935 },
  { id: 'theme-o79', label: 'Theme 79', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o79.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1228 },
  { id: 'theme-o80', label: 'Theme 80', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o80.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 646 },
  { id: 'theme-o81', label: 'Theme 81', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o81.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1552 },
  { id: 'theme-o82', label: 'Theme 82', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o82.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1024 },
  { id: 'theme-o83', label: 'Theme 83', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o83.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1851 },
  { id: 'theme-o84', label: 'Theme 84', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o84.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2399 },
  { id: 'theme-o85', label: 'Theme 85', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o85.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1949 },
  { id: 'theme-o86', label: 'Theme 86', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o86.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 548 },
  { id: 'theme-o87', label: 'Theme 87', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o87.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1596 },
  { id: 'theme-o88', label: 'Theme 88', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o88.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1410 },
  { id: 'theme-o89', label: 'Theme 89', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o89.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1353 },
  { id: 'theme-o90', label: 'Theme 90', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o90.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1875 },
  { id: 'theme-o91', label: 'Theme 91', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o91.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2275 },
  { id: 'theme-o92', label: 'Theme 92', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o92.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2140 },
  { id: 'theme-o93', label: 'Theme 93', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o93.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 2460 },
  { id: 'theme-o94', label: 'Theme 94', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o94.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 651 },
  { id: 'theme-o95', label: 'Theme 95', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o95.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1056 },
  { id: 'theme-o96', label: 'Theme 96', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o96.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1031 },
  { id: 'theme-o97', label: 'Theme 97', wallpaperUrl: 'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-themes/library/o97.png', oneTimePriceEUR: 3.99, accentHex: '#C6A15B', downloads: 1345 },
];

// ─── Subscription plans ───────────────────────────────────────────

export type LibraryPlanId = "monthly" | "yearly";

export interface LibraryPlan {
  readonly id: LibraryPlanId;
  readonly label: string;
  readonly priceEUR: number;
  readonly period: "month";
  readonly billingNote: string | null;
  readonly savingsBadge: string | null;
}

export const LIBRARY_PLANS: readonly LibraryPlan[] = [
  {
    id: "monthly",
    label: "Monthly",
    priceEUR: 2.99,
    period: "month",
    billingNote: "Billed monthly · cancel anytime",
    savingsBadge: null,
  },
  {
    id: "yearly",
    label: "Yearly",
    priceEUR: 2.50,
    period: "month",
    billingNote: "Billed €30 yearly · save ~€6/year",
    savingsBadge: "Best value",
  },
];

export const LIBRARY_SUBSCRIPTION = {
  label: "NEX Theme Library",
  pitch: "All themes · new releases included · cancel anytime.",
} as const;

/** Format a download count for tile copy · e.g. 2847 → "2,847 downloads". */
export function formatDownloads(n: number): string {
  return `${n.toLocaleString("en-IE")} downloads`;
}
