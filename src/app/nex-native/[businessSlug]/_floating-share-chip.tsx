"use client";

// src/app/nex-native/[businessSlug]/_floating-share-chip.tsx
//
// Public-shop share chip · Phase V · P12 · 2026-11-05.
// -----------------------------------------------------------------
// A floating top-right chip visitors tap to share the shop's public
// URL. Rendered as a sibling of the 11 CoverLayoutSwitch layouts so
// it sits ABOVE the storefront chrome without needing a per-layout
// edit. Fixed position · safe-area aware · pointer-events scoped
// just to the chip so the rest of the shop stays interactive
// underneath.
//
// Pattern matches the sealed share-button family:
//   · cover-themes-library/_share-button.tsx
//   · manage/shop/_share-shop-button.tsx
//   · [businessSlug]/[productId]/_share-product-button.tsx
// Web Share API on mobile · clipboard fallback on desktop · brief
// Copied / Copy failed state confirmation.

import * as React from "react";

export function FloatingShareChip({
  shopName,
  shopHref,
}: {
  readonly shopName: string;
  readonly shopHref: string;
}): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  async function handleShare(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    setFailed(false);

    const absolute =
      typeof window !== "undefined"
        ? new URL(shopHref, window.location.origin).toString()
        : shopHref;

    const shareData = {
      title: `${shopName} on NEX`,
      text: `Visit ${shopName} on NEX`,
      url: absolute,
    };

    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }

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
      /* fall through */
    }
    setFailed(true);
    window.setTimeout(() => setFailed(false), 2200);
  }

  const tone = copied ? "ok" : failed ? "err" : "idle";
  const label = copied ? "Copied" : failed ? "Copy failed" : "Share";

  return (
    <div
      data-nex-shop-share-chip
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0) + 12px)",
        right: 14,
        zIndex: 40,
        pointerEvents: "none",
      }}
    >
      <button
        type="button"
        onClick={handleShare}
        aria-label={`Share ${shopName}`}
        aria-live="polite"
        style={{
          pointerEvents: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          borderRadius: 999,
          background:
            tone === "ok"
              ? "rgba(22, 214, 107, 0.22)"
              : tone === "err"
                ? "rgba(255, 51, 85, 0.22)"
                : "rgba(10, 17, 32, 0.68)",
          border:
            tone === "ok"
              ? "1px solid #16D66B"
              : tone === "err"
                ? "1px solid #FF3355"
                : "1px solid rgba(255, 255, 255, 0.22)",
          color:
            tone === "ok"
              ? "#16D66B"
              : tone === "err"
                ? "#FF3355"
                : "#F4F7FC",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          cursor: "pointer",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          boxShadow: "0 8px 20px rgba(0,0,0,0.42)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          transition: "background 120ms ease",
        }}
      >
        <ShareGlyph />
        {label}
      </button>
    </div>
  );
}

function ShareGlyph(): React.JSX.Element {
  return (
    <svg
      aria-hidden
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
