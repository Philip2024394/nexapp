"use client";

// src/app/nex-native/contacts/_contacts-search-bar.tsx
//
// Full-width search pill. Client component · owns the input value
// state locally. Phase 1 scope: the input filters the currently-
// rendered contact list via a simple string match passed through
// window.CustomEvent. The ContactsList component listens.
//
// This keeps the Server Component boundary intact · the contact
// data is server-fetched + rendered; the search is a pure client-
// side filter over what's already on screen.

import * as React from "react";

const NEX = {
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.18)",
  panel: "rgba(3, 16, 29, 0.72)",
};

const SEARCH_EVENT = "nex-contacts-search" as const;

export function ContactsSearchBar() {
  const [value, setValue] = React.useState("");

  React.useEffect(() => {
    // Debounce slightly so a fast typer doesn't thrash on every keystroke.
    const id = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(SEARCH_EVENT, { detail: value }));
    }, 120);
    return () => window.clearTimeout(id);
  }, [value]);

  return (
    <div
      id="contacts-search"
      data-nex-contacts-search-bar
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        height: 48,
        padding: "0 16px",
        borderRadius: 999,
        background: NEX.panel,
        border: `1px solid ${NEX.cyanSoft}`,
      }}
    >
      <SearchIcon color={NEX.cyan} />
      <input
        type="search"
        placeholder="Search contacts, groups..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Search contacts"
        style={{
          all: "unset",
          flex: 1,
          minWidth: 0,
          fontSize: 15,
          color: NEX.textPrimary,
          caretColor: NEX.cyan,
        }}
      />
      {value.length > 0 ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setValue("")}
          style={{
            all: "unset",
            cursor: "pointer",
            width: 24,
            height: 24,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            color: NEX.textSecondary,
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export const CONTACTS_SEARCH_EVENT = SEARCH_EVENT;

function SearchIcon({ color }: { readonly color: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
