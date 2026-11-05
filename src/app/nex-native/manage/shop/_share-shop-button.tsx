"use client";

// src/app/nex-native/manage/shop/_share-shop-button.tsx
//
// Share-shop-URL button on /manage/shop · Phase V · P5 · 2026-11-05.
// -----------------------------------------------------------------
// Lets a seller copy or share their public shop URL
// (/nex-native/{slug}) to social media / messaging. Uses the Web
// Share API when available (mobile · native sheet) and falls back to
// a clipboard copy with a brief "Copied" confirmation on desktop.
// Pattern mirrors cover-themes-library/_share-button.tsx so the two
// share-button surfaces stay visually and behaviourally consistent.

import * as React from "react";

export function ShareShopButton({
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

  const stateLabel = copied
    ? "Copied to clipboard"
    : failed
      ? "Copy failed · try the link"
      : "Copy link / share shop";
  const tone = copied ? "ok" : failed ? "err" : "idle";

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 10,
        background:
          tone === "ok"
            ? "rgba(22, 214, 107, 0.12)"
            : tone === "err"
              ? "rgba(255, 51, 85, 0.12)"
              : "rgba(0,175,255,0.12)",
        border:
          tone === "ok"
            ? "1px solid #16D66B"
            : tone === "err"
              ? "1px solid #FF3355"
              : "1px solid rgba(0,175,255,0.5)",
        color:
          tone === "ok"
            ? "#16D66B"
            : tone === "err"
              ? "#FF3355"
              : "#F4F7FC",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background 120ms ease",
      }}
    >
      <ShareGlyph />
      {stateLabel}
    </button>
  );
}

function ShareGlyph(): React.JSX.Element {
  return (
    <svg
      aria-hidden
      width={14}
      height={14}
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
