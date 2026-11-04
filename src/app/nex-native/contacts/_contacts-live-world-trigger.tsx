"use client";

// src/app/nex-native/contacts/_contacts-live-world-trigger.tsx
//
// Gold-circle grid-icon button that opens the SAME 6-tile live-worlds
// overlay used by the free-chat header-search.
// -----------------------------------------------------------------------
// Owner directive 2026-11-03 · "the free chat page has button in
// header that opens page with buttons round · this page is the same
// page that should show when user selects the grid button in header
// of contacts page".
//
// Implementation: we import the sealed `SearchOverlay` from
// `/nex-native/free-chat/_header-search.tsx` and mount it under our
// own Gold grid-icon trigger. One source of truth for the 6-tile
// overlay (Live World · Live Ireland · Live Music · Live Food · Live
// Stays · Live Trades) · when the owner updates tiles there, this
// trigger inherits the change for free.

import * as React from "react";
import { SearchOverlay } from "@/components/nex-native/chat-chrome/header-search";

export function ContactsLiveWorldTrigger(): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback((): void => setOpen(false), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Browse live worlds"
        aria-expanded={open}
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "var(--nex-world-secondary, #C6A15B)",
          color: "var(--nex-world-drawer-bg, #123D2B)",
          border: "none",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          padding: 0,
        }}
      >
        <svg
          aria-hidden
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" rx="1.2" />
          <rect x="14" y="3" width="7" height="7" rx="1.2" />
          <rect x="3" y="14" width="7" height="7" rx="1.2" />
          <rect x="14" y="14" width="7" height="7" rx="1.2" />
        </svg>
      </button>

      {open ? <SearchOverlay onClose={close} /> : null}
    </>
  );
}
