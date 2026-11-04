"use client";

// src/app/nex-native/chat/peer/[accountId]/_search-client.tsx
//
// Owner-authored 2026-11-05 later-same-day iter 11 · world-class chat
// parity · in-chat search (#2). Client overlay · zero Shell edit ·
// uses the sealed `data-nex-msg-id` anchor to locate bubbles.
//
// Activation:
//   · Cmd/Ctrl+K opens the search bar (universal keyboard pattern ·
//     avoids clashing with browser Cmd+F).
//   · `?search=1` on the URL opens it on mount (future drawer entry
//     routes via this trigger · zero drawer surgery needed for v1).
//   · Window event "nex-chat-search-open" (same for future triggers).
//
// Behaviour:
//   · Type to filter · case-insensitive substring match across every
//     bubble's visible text.
//   · Matches: bubble gets a gold ring + opacity 1 · non-matches dim
//     to opacity 0.25. Empty query = all bubbles opaque (no dim).
//   · ↑ / ↓ cycle through matches · scrolls the active one to centre.
//   · Esc or × closes · bubbles return to full opacity.

import * as React from "react";
import { createPortal } from "react-dom";

const HIGHLIGHT_RING =
  "0 0 0 2px var(--nex-world-secondary, #C6A15B), 0 0 20px color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 55%, transparent)";

export function SearchClient(): React.JSX.Element | null {
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [matches, setMatches] = React.useState<HTMLElement[]>([]);
  const [activeIdx, setActiveIdx] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => setMounted(true), []);

  // Open on URL ?search=1
  React.useEffect(() => {
    if (!mounted) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("search") === "1") setOpen(true);
  }, [mounted]);

  // Open on Cmd/Ctrl+K · listen for external event
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (open && e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("nex-chat-search-open", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("nex-chat-search-open", onOpenEvent);
    };
  }, [open]);

  // Focus the input on open
  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Recompute matches when query or open flips.
  React.useEffect(() => {
    if (!open) {
      // Restore all bubbles when the search closes.
      const all = Array.from(
        document.querySelectorAll<HTMLElement>("[data-nex-msg-id]"),
      );
      for (const el of all) {
        el.style.opacity = "";
        el.style.boxShadow = "";
        el.style.transition = "";
      }
      setMatches([]);
      setActiveIdx(0);
      return;
    }
    const q = query.trim().toLowerCase();
    const all = Array.from(
      document.querySelectorAll<HTMLElement>("[data-nex-msg-id]"),
    );
    if (q.length === 0) {
      for (const el of all) {
        el.style.opacity = "";
        el.style.boxShadow = "";
        el.style.transition = "opacity 180ms ease-out, box-shadow 180ms ease-out";
      }
      setMatches([]);
      setActiveIdx(0);
      return;
    }
    const matched: HTMLElement[] = [];
    for (const el of all) {
      const hay = (el.innerText ?? el.textContent ?? "").toLowerCase();
      const isMatch = hay.includes(q);
      el.style.transition = "opacity 180ms ease-out, box-shadow 180ms ease-out";
      el.style.opacity = isMatch ? "1" : "0.25";
      el.style.boxShadow = "";
      if (isMatch) matched.push(el);
    }
    setMatches(matched);
    setActiveIdx(0);
  }, [query, open]);

  // Scroll the active match into view + flash its ring.
  React.useEffect(() => {
    if (!open || matches.length === 0) return;
    const el = matches[Math.min(activeIdx, matches.length - 1)];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Flash the ring on the active match.
    for (const other of matches) {
      other.style.boxShadow = "";
    }
    el.style.boxShadow = HIGHLIGHT_RING;
  }, [activeIdx, matches, open]);

  if (!mounted || !open) return null;

  const close = () => setOpen(false);
  const stepNext = () => {
    if (matches.length === 0) return;
    setActiveIdx((i) => (i + 1) % matches.length);
  };
  const stepPrev = () => {
    if (matches.length === 0) return;
    setActiveIdx((i) => (i - 1 + matches.length) % matches.length);
  };

  const overlay = (
    <div
      data-nex-chat-search-bar
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 72px)",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9050,
        width: "min(560px, calc(100vw - 24px))",
        background: "#000000",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 14,
        boxShadow:
          "0 12px 36px rgba(0,0,0,0.6), inset 0 0 0 1px color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 24%, transparent)",
        padding: 8,
        display: "flex",
        alignItems: "center",
        gap: 8,
        color: "#F2F5F8",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <span
        aria-hidden
        style={{
          fontSize: 16,
          color: "var(--nex-world-secondary, #C6A15B)",
          paddingLeft: 6,
        }}
      >
        ⌕
      </span>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) stepPrev();
            else stepNext();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            close();
          }
        }}
        placeholder="Search this chat…"
        aria-label="Search this chat"
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
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: query.trim() && matches.length === 0 ? "#FF9494" : "#B5C3D6",
          fontVariantNumeric: "tabular-nums",
          padding: "0 6px",
        }}
      >
        {query.trim().length === 0
          ? ""
          : matches.length === 0
            ? "no matches"
            : `${activeIdx + 1}/${matches.length}`}
      </span>
      <button
        type="button"
        onClick={stepPrev}
        disabled={matches.length === 0}
        aria-label="Previous match"
        style={navBtnStyle(matches.length === 0)}
      >
        ↑
      </button>
      <button
        type="button"
        onClick={stepNext}
        disabled={matches.length === 0}
        aria-label="Next match"
        style={navBtnStyle(matches.length === 0)}
      >
        ↓
      </button>
      <button
        type="button"
        onClick={close}
        aria-label="Close search"
        style={navBtnStyle(false)}
      >
        ×
      </button>
    </div>
  );
  return createPortal(overlay, document.body);
}

function navBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#F2F5F8",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
    fontSize: 14,
    fontFamily: "inherit",
    padding: 0,
    lineHeight: 1,
  };
}
