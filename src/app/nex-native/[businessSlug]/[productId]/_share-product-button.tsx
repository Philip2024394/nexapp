"use client";

// src/app/nex-native/[businessSlug]/[productId]/_share-product-button.tsx
//
// Share-product button on the public product detail page · Phase V ·
// P11 · 2026-11-05.
// -----------------------------------------------------------------
// Lets a visitor send a product's public URL to friends via the Web
// Share API (mobile native sheet) or copy to clipboard (desktop).
// Mirrors the pattern in manage/shop/_share-shop-button.tsx and
// cover-themes-library/_share-button.tsx so the three share
// surfaces share one visual + behavioural grammar.

import * as React from "react";

export function ShareProductButton({
  productName,
  productHref,
  shopName,
}: {
  readonly productName: string;
  readonly productHref: string;
  readonly shopName: string;
}): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  async function handleShare(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    setFailed(false);

    const absolute =
      typeof window !== "undefined"
        ? new URL(productHref, window.location.origin).toString()
        : productHref;

    const shareData = {
      title: `${productName} · ${shopName} on NEX`,
      text: `${productName} on NEX · ${shopName}`,
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
    ? "Copied"
    : failed
      ? "Copy failed"
      : "Share";
  const tone = copied ? "ok" : failed ? "err" : "idle";

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={`Share ${productName}`}
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 12px",
        borderRadius: 999,
        background:
          tone === "ok"
            ? "rgba(22, 214, 107, 0.14)"
            : tone === "err"
              ? "rgba(255, 51, 85, 0.14)"
              : "rgba(255, 255, 255, 0.06)",
        border:
          tone === "ok"
            ? "1px solid #16D66B"
            : tone === "err"
              ? "1px solid #FF3355"
              : "1px solid rgba(139, 169, 209, 0.24)",
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
