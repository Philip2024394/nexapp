"use client";

// src/app/nex-native/contacts/_group-discovery-search.tsx
//
// Owner directive 2026-10-23 · "add search bar under the header
// over the banner with country round map on the outside at right
// side · the country flag is selected will drop down with all
// other countries with flag beside". Groups-tab discovery UI.
//
// Mock-only · drives a client-side callback (country + query) that
// `_contacts-list.tsx` consumes to filter the OPEN groups list.
// Zero backend · the dropdown country set is derived from countries
// that actually have an open group in the mock store (plus a short
// default list so the dropdown isn't empty on first paint).
//
// Layout:
//   [ search input ..................... ][ 🇮🇩 ]  ← flag OUTSIDE the bar
//
// The flag chip is positioned absolutely on the right rim of the
// search container so the input text doesn't collide with it. Tap
// the flag → floating popover lists countries with flag + name ·
// pick one and the parent re-filters.

import * as React from "react";
import {
  flagEmojiForIso,
  countryNameForIso,
} from "@/lib/nex-native/user-location/country-labels";
import { listOpenGroupCountries } from "./_mock-private-groups";
import {
  getGroupDiscoveryFilterState,
  setGroupDiscoveryFilterState,
  subscribeGroupDiscoveryFilterState,
} from "./_group-discovery-filter-state";
import {
  getCreateGroupFlipped,
  subscribeCreateGroupFlipped,
} from "./_create-group-flip-state";

const NEX = {
  bgPanel: "rgba(2,9,20,0.92)",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  cyan: "var(--nex-world-secondary, #00AFFF)",
};

// Default country set surfaced in the dropdown even when the mock
// store has no groups in that country yet · users can still pick
// one so the discovery UI reads non-empty.
const DEFAULT_COUNTRIES: ReadonlyArray<string> = [
  "ID", "SG", "MY", "TH", "VN", "PH",
  "US", "GB", "CA", "AU",
  "DE", "FR", "ES", "IT",
  "JP", "KR", "IN", "BR",
];

/**
 * Standalone search chrome · mounts at page level under the
 * ContactsHeader, above the Create Group banner. Subscribes to
 * the shared singleton so the Groups-tab results list (which lives
 * further down the page) stays in sync with any country/query
 * change the user makes up here.
 *
 * Takes NO props · the singleton is the single source of truth.
 * Owner directive 2026-10-23 · "search bar and country flag round
 * under the header area".
 */
export function GroupDiscoverySearch(): React.ReactElement | null {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  const [filter, setFilter] = React.useState(getGroupDiscoveryFilterState);
  React.useEffect(() => {
    return subscribeGroupDiscoveryFilterState(setFilter);
  }, []);
  // Owner directive 2026-10-23 · "when the create group page is
  // open · we don't need the search bar or country round flag" ·
  // the chrome hides while the Create Group hero is flipped. All
  // hooks still run above this subscription · the hide-gate is at
  // the JSX return below (Rules of Hooks compliance).
  const [flipped, setFlipped] = React.useState<boolean>(getCreateGroupFlipped);
  React.useEffect(() => subscribeCreateGroupFlipped(setFlipped), []);
  const country = filter.country;
  const query = filter.query;
  const onCountryChange = (iso: string): void =>
    setGroupDiscoveryFilterState({ country: iso });
  const onQueryChange = (q: string): void =>
    setGroupDiscoveryFilterState({ query: q });

  // Close dropdown when tapping outside.
  React.useEffect(() => {
    if (!dropdownOpen) return;
    const onDocPointer = (e: PointerEvent) => {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, [dropdownOpen]);

  // Country set · default list merged with any country the mock
  // store has at least one open group in, deduped + sorted so
  // familiar markets stay near the top.
  const [availableCountries, setAvailableCountries] = React.useState<
    ReadonlyArray<string>
  >(DEFAULT_COUNTRIES);
  React.useEffect(() => {
    const seeded = listOpenGroupCountries();
    const merged = Array.from(new Set([...DEFAULT_COUNTRIES, ...seeded]));
    setAvailableCountries(merged);
  }, [dropdownOpen]);

  const flag = flagEmojiForIso(country) ?? "🏳️";

  // Hide-while-flipped gate · AFTER all hooks (Rules of Hooks).
  if (flipped) return null;

  return (
    <div
      data-nex-group-discovery-search
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {/* Search bar · reserves 56px right-pad so the flag chip
          sits over the end without collapsing the input. */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          position: "relative",
          display: "flex",
          alignItems: "center",
          height: 40,
          borderRadius: 10,
          background: NEX.bgPanel,
          border: `1px solid ${NEX.cyan}55`,
          paddingLeft: 36,
          paddingRight: 12,
        }}
      >
        <SearchIcon color={NEX.textMute} />
        <input
          type="text"
          inputMode="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="Search open groups…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          data-nex-group-discovery-input
          style={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            padding: 0,
            background: "transparent",
            border: "none",
            color: NEX.text,
            fontSize: 13,
            outline: "none",
            letterSpacing: 0.2,
          }}
        />
      </div>

      {/* Round country flag chip · sits OUTSIDE the search bar on
          the right · tap opens the dropdown. */}
      <button
        type="button"
        onClick={() => setDropdownOpen((prev) => !prev)}
        aria-label={`Change country · currently ${countryNameForIso(country) ?? country}`}
        aria-expanded={dropdownOpen}
        data-nex-group-discovery-flag
        style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: NEX.bgPanel,
          border: `2px solid ${NEX.cyan}`,
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          padding: 0,
          boxShadow: `0 2px 8px rgba(0,0,0,0.5)`,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span
          aria-hidden
          style={{
            fontSize: 22,
            lineHeight: 1,
          }}
        >
          {flag}
        </span>
      </button>

      {/* Dropdown · absolute popover · right-anchored under the flag */}
      {dropdownOpen ? (
        <div
          ref={popoverRef}
          role="listbox"
          aria-label="Pick a country"
          data-nex-group-discovery-dropdown
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 240,
            maxHeight: 280,
            overflowY: "auto",
            padding: 6,
            background: NEX.bgPanel,
            border: `1.5px solid ${NEX.cyan}`,
            borderRadius: 12,
            boxShadow: `0 8px 28px rgba(0,0,0,0.6), 0 0 20px ${NEX.cyan}22`,
            zIndex: 60,
          }}
        >
          {availableCountries.map((iso) => {
            const isActive = iso === country;
            const name = countryNameForIso(iso) ?? iso;
            return (
              <button
                key={iso}
                type="button"
                role="option"
                aria-selected={isActive}
                data-nex-group-discovery-option={iso}
                onClick={() => {
                  onCountryChange(iso);
                  setDropdownOpen(false);
                }}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: isActive ? `${NEX.cyan}22` : "transparent",
                  border: isActive
                    ? `1px solid ${NEX.cyan}`
                    : "1px solid transparent",
                  color: isActive ? NEX.text : NEX.textMute,
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>
                  {flagEmojiForIso(iso) ?? "🏳️"}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: isActive ? 800 : 600,
                    letterSpacing: 0.2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {name}
                </span>
                {isActive ? (
                  <span
                    aria-hidden
                    style={{
                      color: NEX.cyan,
                      fontSize: 14,
                      fontWeight: 900,
                      lineHeight: 1,
                    }}
                  >
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SearchIcon({ color }: { readonly color: string }): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ position: "absolute", left: 12, pointerEvents: "none" }}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
