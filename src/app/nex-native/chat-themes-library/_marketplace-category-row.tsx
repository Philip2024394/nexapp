// src/app/nex-native/chat-themes-library/_marketplace-category-row.tsx
//
// NEX Themes · Browse by Category · 6 circular category chips.
// Owner-sealed 2026-10-18.
// -------------------------------------------------------------------
// Design mock (NEX Themes Neon Marketplace reference): 6 chips in a
// row · Nature · City · Space · Food · Animals · Luxury. Each chip
// is a circular icon + text label · tap navigates to the sealed
// per-category route at /nex-native/chat-themes-library/category/[id].
//
// The 6 display labels in the mock are a MARKETPLACE grouping · they
// do not 1:1 match the sealed CATEGORY_REGISTRY (food · bakery ·
// products · services · rentals · accommodation · haunted · waterworld
// · hollywood · vitamins · teddy · watches · property). The chips
// here are visual navigation ONLY · each links to the closest
// registered category OR to the Explore bucket when there is no
// direct match. Owners can wire a dedicated "nature" / "animals" /
// "luxury" bucket later via the registry if desired.
//
// Server Component.

import type * as React from "react";
import Link from "next/link";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const NEX = {
  text: "#F2F5F8",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
};

interface CategoryChip {
  readonly label: string;
  readonly categoryId: string;
  readonly icon: React.ReactElement;
}

// Marketplace display labels → closest sealed registry category.
// When no 1:1 exists, map to the registry's Explore bucket.
const CATEGORY_CHIPS: ReadonlyArray<CategoryChip> = [
  { label: "Nature",     categoryId: "waterworld",    icon: <LeafIcon /> },
  { label: "City",       categoryId: "property",      icon: <BuildingIcon /> },
  { label: "Space",      categoryId: "waterworld",    icon: <PlanetIcon /> },
  { label: "Food",       categoryId: "food",          icon: <ForkKnifeIcon /> },
  { label: "Animals",    categoryId: "teddy",         icon: <PawIcon /> },
  { label: "Luxury",     categoryId: "watches",       icon: <CrownIcon /> },
];

export function MarketplaceCategoryRow(): React.JSX.Element {
  return (
    <section
      data-nex-themes-category-row
      style={{
        padding: "0 14px",
        fontFamily: NEX_FONT_SANS,
      }}
    >
      <h2
        style={{
          margin: "0 0 10px",
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: NEX.cyan,
          fontWeight: 700,
        }}
      >
        Browse by Category
      </h2>
      <div
        role="list"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 8,
        }}
      >
        {CATEGORY_CHIPS.map((c) => (
          <CategoryChipLink key={c.label} chip={c} />
        ))}
      </div>
    </section>
  );
}

function CategoryChipLink({ chip }: { readonly chip: CategoryChip }): React.JSX.Element {
  return (
    <Link
      href={`/nex-native/chat-themes-library/category/${chip.categoryId}`}
      data-nex-themes-category-chip={chip.label}
      role="listitem"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        textDecoration: "none",
        color: NEX.text,
      }}
    >
      <div
        aria-hidden
        style={{
          display: "grid",
          placeItems: "center",
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: NEX.cyanFaint,
          border: `1px solid ${NEX.cyanSoft}`,
          color: NEX.cyan,
        }}
      >
        {chip.icon}
      </div>
      <span
        style={{
          fontSize: 11,
          color: NEX.textMuted,
          lineHeight: 1.2,
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: "100%",
        }}
      >
        {chip.label}
      </span>
    </Link>
  );
}

// ─── Icons (compact set · owner-replaceable with brand pack later) ───

function LeafIcon(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 20c0-6 6-12 14-12 0 8-6 14-14 14z" />
      <path d="M6 20c1-4 3-7 6-9" />
    </svg>
  );
}
function BuildingIcon(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="3" width="16" height="18" />
      <line x1="9" y1="7" x2="9" y2="7.01" />
      <line x1="15" y1="7" x2="15" y2="7.01" />
      <line x1="9" y1="11" x2="9" y2="11.01" />
      <line x1="15" y1="11" x2="15" y2="11.01" />
      <line x1="9" y1="15" x2="9" y2="15.01" />
      <line x1="15" y1="15" x2="15" y2="15.01" />
    </svg>
  );
}
function PlanetIcon(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="6" />
      <ellipse cx="12" cy="12" rx="11" ry="3" transform="rotate(-30 12 12)" />
    </svg>
  );
}
function ForkKnifeIcon(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3v18M6 3v6a2 2 0 0 0 4 0V3" />
      <path d="M16 3v18M16 3c-2 0-3 2-3 5s1 5 3 5" />
    </svg>
  );
}
function PawIcon(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="5" cy="10" r="2" />
      <circle cx="19" cy="10" r="2" />
      <circle cx="9" cy="5" r="2" />
      <circle cx="15" cy="5" r="2" />
      <path d="M12 14c-3 0-5 2-5 4a3 3 0 0 0 3 3h4a3 3 0 0 0 3-3c0-2-2-4-5-4z" />
    </svg>
  );
}
function CrownIcon(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 7l5 4 5-7 5 7 5-4-2 13H4L2 7z" />
    </svg>
  );
}
