// src/app/nex-native/dev/hotel-flow/_components/_icons.tsx
// Inline SVG line-icon library · 1.6px stroke · currentColor.
// Matches the Bumas Hotel reference mockup aesthetic.

"use client";

import type * as React from "react";

const ICON_PATHS: Readonly<Record<string, string>> = {
  // Facilities
  wifi: "M5 12.5a10 10 0 0 1 14 0 M8 16a6 6 0 0 1 8 0 M11 19.5a2 2 0 1 1 2 0",
  parking: "M6 4h8a5 5 0 0 1 0 10h-4v6H6zm4 2v6h4a3 3 0 0 0 0-6z",
  pool: "M3 15c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1 M3 19c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1 M8 11V5l4 3 4-3v6",
  ac: "M12 3v18 M4 7l16 10 M4 17l16-10 M9 5l3-2 3 2 M9 19l3 2 3-2",
  breakfast: "M3 11h14a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zm14 1h3a2 2 0 1 1 0 4h-1 M4 20h18 M8 7V4 M12 7V4 M16 7V4",
  bell: "M6 16a1 1 0 0 1 .4-1.5l1-.5V11a5 5 0 0 1 9.2 0v3l1 .5A1 1 0 0 1 18 16zm3.5 2a2.5 2.5 0 0 0 5 0",
  gym: "M6 4v16 M18 4v16 M3 8v8 M21 8v8 M6 12h12",
  pet: "M8 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4m8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4M4 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4m16 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4M12 22a5 5 0 0 1-5-5c0-3 2-5 5-5s5 2 5 5a5 5 0 0 1-5 5",
  // Local services
  motorbike: "M4 17a3 3 0 1 0 6 0 M14 17a3 3 0 1 0 6 0 M10 17h4l-2-6h4l1-3h3 M7 11h5",
  laundry: "M4 4h16v16H4zm0 5h16 M8 7h.01 M11 7h.01 M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  spa: "M12 11c-1-2.5-3-4-6-4 0 3 1.5 5 4 6 M12 11c1-2.5 3-4 6-4 0 3-1.5 5-4 6 M12 11v9",
  car: "M4 14h16l-2-5a3 3 0 0 0-3-2H9a3 3 0 0 0-3 2zm0 0v4h3v-2 M20 14v4h-3v-2 M8 11h8",
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zm0 0v14 M15 6v14",
  computer: "M3 5h18v12H3zm0 12 2 3h14l2-3 M11 20h2",
  // Nav / UI
  home: "M3 11 12 3l9 8v10h-6v-7h-6v7H3z",
  trips: "M4 7h16v13H4zm0-3h16v3H4zm4 6v3 M12 10v3 M16 10v3",
  message: "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9l-5 4v-4H5a2 2 0 0 1-2-2z",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8m-8 9a8 8 0 0 1 16 0",
  more: "M4 6h16 M4 12h16 M4 18h16",
  menu: "M4 7h16 M4 12h16 M4 17h16",
  back: "M15 6l-6 6 6 6",
  close: "M6 6l12 12 M18 6L6 18",
  search: "M11 4a7 7 0 1 1-0.001 14.001A7 7 0 0 1 11 4m6 11 5 5",
  filter: "M4 6h16 M7 12h10 M10 18h4",
  calendar: "M4 6h16v14H4zm0 4h16 M8 3v4 M16 3v4",
  users: "M4 20a5 5 0 0 1 10 0 M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7 M14 20a5 5 0 0 1 7 0 M17.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  pin: "M12 21s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  check: "M5 12l4 4L19 6",
  arrowRight: "M5 12h14 M13 6l6 6-6 6",
  arrowLeft: "M19 12H5 M11 6l-6 6 6 6",
  heart: "M12 20s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z",
  share: "M8 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4m8 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4m0-14a2 2 0 1 0 0-4 2 2 0 0 0 0 4M10 10l5-3 M10 14l5 3",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20m0-14v.01 M12 12v4",
  chevronRight: "M9 6l6 6-6 6",
  chevronDown: "M6 9l6 6 6-6",
  star: "M12 3l2.9 6 6.6.6-5 4.6 1.5 6.5L12 17.3 5.9 20.7l1.5-6.5-5-4.6 6.6-.6z",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20",
  plus: "M12 5v14 M5 12h14",
  minus: "M5 12h14",
  wallet: "M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm0 0V6a2 2 0 0 1 2-2h12 M16 13h.01",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  key: "M15 7a4 4 0 1 1-3.9 4.9L8 14l-2 2v2H3v-3l5-5a4 4 0 0 1 7-3z",
  wave: "M3 12c3-4 6-4 9 0s6 4 9 0",
};

export function Icon({
  name,
  size = 20,
  stroke = "currentColor",
  strokeWidth = 1.6,
}: {
  readonly name: string;
  readonly size?: number;
  readonly stroke?: string;
  readonly strokeWidth?: number;
}): React.ReactElement {
  const d = ICON_PATHS[name] ?? "";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ display: "block" }}
    >
      <path d={d} />
    </svg>
  );
}
