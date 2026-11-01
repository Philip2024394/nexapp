"use client";

// src/components/nex-native/nex-feed/CountryFeedSwitcher.tsx
//
// NEX Global Feed · right-side country switcher icon · owner directive
// 2026-11-01 (Batch E · Stage 3B).
// --------------------------------------------------------------------
// A small round icon mounted on the right-side action rail of the
// nex-feed viewer (both music and video slides). Toggles between
// Worldwide and the configured country feed via URL state.
//
// Owner directive 2026-11-01:
//   · Worldwide selected → globe icon
//   · Tap globe → switch to Ireland Feed → Irish flag icon shows
//   · Tap Irish flag → return to Worldwide → globe shows
//   · No dropdown · no extra page · no unnecessary navigation
//   · First entry defaults to Worldwide (server resolver enforces)
//   · Session selection remembered via URL state (shareable + browser
//     back/forward works)
//
// This component is DUMB: it reads the current mode from props (server
// resolves it), builds the toggle href from the current pathname +
// searchParams, and calls router.push to switch. No local state for
// the current mode — URL is the source of truth so refresh preserves
// selection.
//
// Scope: the icon only toggles between Worldwide and ONE country at a
// time (the first eligible country from the registry). Multi-country
// toggle (3+ options) is explicitly deferred to Stage 3B.1 when more
// countries come online — not in Batch E scope.

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export interface CountryFeedSwitcherProps {
  /** Current mode · server-resolved via `resolveCountryFeedMode`. */
  readonly currentMode:
    | { readonly kind: "worldwide" }
    | { readonly kind: "country"; readonly code: string; readonly displayName: string };
  /** Eligible country to toggle to when in Worldwide mode. Null when
   *  no country is yet registered + enabled · the switcher hides. */
  readonly toggleTarget: {
    readonly code: string;
    readonly displayName: string;
    readonly flagEmoji: string;
  } | null;
}

export function CountryFeedSwitcher(
  props: CountryFeedSwitcherProps,
): React.JSX.Element | null {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // No eligible country → hide the switcher entirely. Owner "no dead
  // buttons" rule.
  if (!props.toggleTarget) return null;

  const inCountryMode = props.currentMode.kind === "country";
  const target = props.toggleTarget;
  const nextLabel = inCountryMode
    ? "Worldwide"
    : `${target.displayName} feed`;
  const ariaLabel = inCountryMode
    ? `Currently showing ${props.currentMode.displayName} feed · tap to switch to Worldwide`
    : `Currently showing Worldwide feed · tap to switch to ${target.displayName}`;

  const onToggle = React.useCallback(() => {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    if (inCountryMode) {
      next.delete("country");
    } else {
      next.set("country", target.code);
    }
    // Owner-authorised 2026-11-01 · Batch E.2 · fire the feed-mode
    // entry overlay once on the destination route. FeedModeEntryOverlay
    // reads `entering=1`, triggers the country-flavoured burst + pill,
    // then router.replace strips the flag so refresh / back-forward
    // never retriggers.
    next.set("entering", "1");
    const q = next.toString();
    const href = q.length > 0 ? `${pathname}?${q}` : pathname;
    router.push(href);
  }, [inCountryMode, target.code, pathname, router, searchParams]);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={ariaLabel}
      title={`Switch to ${nextLabel}`}
      data-nex-country-feed-switcher
      data-nex-country-feed-mode={inCountryMode ? props.currentMode.code : "WW"}
      style={{
        width: 44,
        height: 44,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
        cursor: "pointer",
        padding: 0,
        fontSize: 22,
        lineHeight: 1,
        color: "#F2F5F8",
        fontFamily: "inherit",
        transition: "transform 150ms ease-out",
      }}
    >
      {inCountryMode ? (
        // Show the flag emoji for the active country.
        <span aria-hidden style={{ fontSize: 24, lineHeight: 1 }}>
          {target.flagEmoji}
        </span>
      ) : (
        // Globe glyph · pure SVG so it renders consistently across
        // devices (emoji globes vary wildly).
        <svg
          aria-hidden
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      )}
    </button>
  );
}
