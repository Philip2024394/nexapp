"use client";

// src/components/nex-native/chat-chrome/nex-live-search-button.tsx
//
// Owner-authored 2026-11-05 iter 22 · magnifier button in the chat
// header. Tap opens a dropdown search bar directly BELOW the header.
// Submit navigates to /nex-native/nex-feed?q=<term> so the viewer
// lands on the NEX Live feed filtered by their query.
//
// Server-side text-search on feed content is NOT wired in this
// commit (the q param is accepted but currently ignored by the
// feed route); the dropdown UI + submit flow ship first so the
// surface exists. Follow-up ships the filter query.

import * as React from "react";
import { createPortal } from "react-dom";

export function NexLiveSearchButton(): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [q, setQ] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const anchorRef = React.useRef<HTMLButtonElement | null>(null);
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    if (anchorRef.current) {
      setAnchorRect(anchorRef.current.getBoundingClientRect());
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = React.useCallback(() => {
    const trimmed = q.trim();
    const href = trimmed
      ? `/nex-native/nex-feed?q=${encodeURIComponent(trimmed)}`
      : "/nex-native/nex-feed";
    window.location.assign(href);
  }, [q]);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Search NEX Live"
        aria-expanded={open}
        data-nex-live-search-trigger
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          padding: 0,
          borderRadius: "50%",
          background: "#000000",
          border: "1px solid rgba(255,255,255,0.14)",
          color: "#FFFFFF",
          cursor: "pointer",
          boxShadow:
            "0 6px 18px rgba(0,0,0,0.55), inset 0 0 0 1px color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 24%, transparent)",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>
      {mounted && open && anchorRect
        ? createPortal(
            <>
              {/* Dismiss layer · tap outside closes. */}
              <div
                aria-hidden
                onClick={() => setOpen(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 1050,
                  background: "transparent",
                }}
              />
              <div
                role="search"
                aria-label="Search NEX Live"
                data-nex-live-search-dropdown
                style={{
                  position: "fixed",
                  top: anchorRect.bottom + 8,
                  right: Math.max(12, window.innerWidth - anchorRect.right),
                  width: "min(340px, calc(100vw - 24px))",
                  zIndex: 1051,
                  background: "#000000",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 14,
                  padding: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "#F2F5F8",
                  boxShadow:
                    "0 14px 36px rgba(0,0,0,0.65), inset 0 0 0 1px color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 24%, transparent)",
                  fontFamily:
                    "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    color: "var(--nex-world-secondary, #C6A15B)",
                    paddingLeft: 6,
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder="Search NEX Live…"
                  aria-label="Search NEX Live"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "inherit",
                    fontSize: 14,
                    fontFamily: "inherit",
                    padding: "8px 4px",
                  }}
                />
                <button
                  type="button"
                  onClick={submit}
                  aria-label="Go"
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: "#FF7200",
                    color: "#1A0808",
                    fontWeight: 800,
                    fontSize: 12,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Go
                </button>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
