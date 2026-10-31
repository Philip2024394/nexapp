// src/app/nex-native/search/_discover-controls.tsx
//
// Search box for NEX Discover · now chip-free.
// --------------------------------------------
// Writes `?q=` to the URL; the server page reads it to filter the
// business feed. Keeps a controlled search input so the X-close +
// typing feel immediate while scrolling the server response in.
//
// Right-side slot: when the viewer has a resolved location with a
// countryIso, the flag emoji is shown there instead of the clear-X
// (clear-X still shows when there's an active query).

"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "#07152A",
  pillBg: "#0E1F39",
  text: "#F2F5F8",
  textDim: "#8BA9D1",
  textMuted: "#6B82A5",
  orange: "#FF7200",
  cyan: "#00AFFF",
  border: "rgba(255,255,255,0.08)",
};

export interface DiscoverControlsProps {
  readonly initialQuery: string;
  /** Country ISO 3166-1 alpha-2 (e.g. "ID"). When present the flag
   *  emoji renders on the right side of the search field. */
  readonly countryFlagEmoji: string | null;
  /** Human-readable country name used as the flag's aria-label. */
  readonly countryName: string | null;
}

export function DiscoverControls({
  initialQuery,
  countryFlagEmoji,
  countryName,
}: DiscoverControlsProps): React.JSX.Element {
  const [query, setQuery] = useState<string>(initialQuery);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function pushNext(next: URLSearchParams): void {
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`);
    });
  }

  function commitQuery(value: string): void {
    const next = new URLSearchParams(sp.toString());
    const trimmed = value.trim();
    if (trimmed.length === 0) next.delete("q");
    else next.set("q", trimmed);
    pushNext(next);
  }

  function clearQuery(): void {
    setQuery("");
    commitQuery("");
  }

  const hasQuery = query.length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commitQuery(query);
      }}
      role="search"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        background: NEX.pillBg,
        border: `1px solid ${NEX.border}`,
        borderRadius: 999,
      }}
    >
      <SearchIcon />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => {
          if (query !== initialQuery) commitQuery(query);
        }}
        placeholder="Find food, shops, local services…"
        aria-label="Search NEX Discover"
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          background: "transparent",
          fontSize: 15,
          color: NEX.text,
          outline: "none",
          fontFamily: "inherit",
        }}
      />
      {hasQuery ? (
        <button
          type="button"
          onClick={clearQuery}
          aria-label="Clear search"
          style={{
            background: "transparent",
            border: "none",
            padding: 4,
            color: NEX.textMuted,
            cursor: "pointer",
            display: "inline-flex",
          }}
        >
          <CloseIcon />
        </button>
      ) : countryFlagEmoji ? (
        <span
          role="img"
          aria-label={countryName ? `Viewing ${countryName}` : "Viewing country"}
          title={countryName ?? undefined}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: NEX.bg,
            border: `1.5px solid rgba(0,175,255,0.45)`,
            fontSize: 15,
            lineHeight: 1,
            overflow: "hidden",
            boxShadow: "0 0 0 1px rgba(0,175,255,0.15) inset",
          }}
        >
          {countryFlagEmoji}
        </span>
      ) : null}
    </form>
  );
}

function SearchIcon(): React.JSX.Element {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke={NEX.cyan}
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

function CloseIcon(): React.JSX.Element {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 6l12 12 M18 6L6 18" />
    </svg>
  );
}
