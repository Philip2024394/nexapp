// src/app/nex-native/chat-themes-library/_marketplace-search-bar.tsx
//
// NEX Themes · search bar · sealed 2026-10-18.
// -------------------------------------------------------------------
// Visual-only for v1 · submitting the form navigates to the sealed
// category filter page with the query string preserved. Live client-
// side filtering is a follow-up (the existing theme loader is
// server-side only · a live filter would need a client-side theme
// list surface or an API route).
//
// Server Component · the form POSTs to a GET-based category search.

import type * as React from "react";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const NEX = {
  panel: "#07152A",
  panelHi: "#0A1A2D",
  text: "#F2F5F8",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  borderSoft: "rgba(255, 255, 255, 0.07)",
};

export function MarketplaceSearchBar(): React.JSX.Element {
  return (
    <form
      data-nex-themes-search-bar
      action="/nex-native/chat-themes-library"
      method="get"
      style={{
        padding: "0 14px",
        fontFamily: NEX_FONT_SANS,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 12px",
          height: 46,
          borderRadius: 999,
          background: NEX.panelHi,
          border: `1px solid ${NEX.cyanSoft}`,
          boxSizing: "border-box",
        }}
      >
        <SearchIcon color={NEX.cyan} />
        <input
          type="search"
          name="q"
          placeholder="Search themes, styles, categories..."
          data-nex-themes-search-input
          style={{
            all: "unset",
            flex: 1,
            minWidth: 0,
            height: "100%",
            color: NEX.text,
            fontSize: 13,
            caretColor: NEX.cyan,
          }}
        />
        <button
          type="button"
          aria-label="Filter options"
          data-nex-themes-filter-trigger
          style={{
            all: "unset",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: NEX.cyanFaint,
            color: NEX.cyan,
          }}
        >
          <FilterIcon />
        </button>
      </div>
    </form>
  );
}

function SearchIcon({ color }: { readonly color: string }): React.JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function FilterIcon(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}
