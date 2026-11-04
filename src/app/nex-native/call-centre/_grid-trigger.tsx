"use client";

// src/app/nex-native/call-centre/_grid-trigger.tsx
//
// Gold grid-icon button in the Call Centre header · opens the same
// 6-tile Live-worlds overlay used by the free-chat and contacts
// headers. Owner directive 2026-11-04 later-same-day · "beside the
// header plus button should be the grid button like is on header
// free chat header opens the live now page with button".
//
// Reuses the sealed SearchOverlay from
// /nex-native/free-chat/_header-search.tsx so when the owner adjusts
// the live-worlds tile set there, this surface inherits for free.

import * as React from "react";
import { SearchOverlay } from "@/components/nex-native/chat-chrome/header-search";

export function CallCentreGridTrigger(): React.JSX.Element {
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
        data-nex-call-centre-grid-trigger
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
          WebkitTapHighlightColor: "transparent",
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
