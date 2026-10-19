"use client";

// src/app/nex-native/cover-themes-library/_share-button.tsx
//
// Small share-link button rendered on each cover theme card in the
// Cover Themes Library. Uses the Web Share API when available
// (mobile · tap "Share" → native sheet) and falls back to a
// clipboard copy with a brief "Copied" confirmation on desktop.
// -------------------------------------------------------------------
// Owner-authorised 2026-10-18 · built alongside the Cover Themes
// Library page. No analytics · no network · pure client UI.

import * as React from "react";

export function ShareButton({
  layoutId,
  label,
  shareHref,
}: {
  readonly layoutId: string;
  readonly label: string;
  readonly shareHref: string;
}): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  async function handleShare(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    setFailed(false);

    // Resolve the absolute URL at click-time so the button works
    // regardless of where the page is hosted.
    const absolute =
      typeof window !== "undefined"
        ? new URL(shareHref, window.location.origin).toString()
        : shareHref;

    const shareData = {
      title: `NEX Cover · ${label}`,
      text: `NEX Cover theme · ${label}`,
      url: absolute,
    };

    // Prefer the Web Share API on supporting devices.
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User cancelled or share errored · fall through to clipboard.
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }

    // Clipboard fallback.
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(absolute);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
        return;
      }
    } catch {
      // Fall through to failure state.
    }
    setFailed(true);
    window.setTimeout(() => setFailed(false), 2200);
  }

  const stateLabel = copied ? "Copied" : failed ? "Copy failed" : "Share";
  const stateColor = copied
    ? "#22C55E"
    : failed
      ? "#F87171"
      : undefined;

  return (
    <button
      type="button"
      onClick={handleShare}
      data-nex-cover-share
      data-nex-cover-share-layout={layoutId}
      aria-label={`Share ${label} cover theme link`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid ${stateColor ?? "rgba(0, 175, 255, 0.55)"}`,
        background: "rgba(0, 175, 255, 0.08)",
        color: stateColor ?? "#00AFFF",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <svg
        width={12}
        height={12}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {copied ? (
          <polyline points="5 12 10 17 20 7" />
        ) : (
          <>
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </>
        )}
      </svg>
      {stateLabel}
    </button>
  );
}
