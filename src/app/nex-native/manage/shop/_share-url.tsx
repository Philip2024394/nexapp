"use client";

// src/app/nex-native/manage/shop/_share-url.tsx
//
// Public shop share-URL chip · Owner-authorised 2026-11-12.
// -----------------------------------------------------------------------------
// Renders the owner's public shop link under the shop-name heading
// on /manage/shop · pairs with the live preview on the Shop Setup
// identity step. One-tap copy with a short "Copied" confirmation.
// Read-only · the slug comes from nex_business via the page server
// component · no client-side slug generation here.

import * as React from "react";

export function ShopShareUrl({ slug }: { slug: string }): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);
  const [host, setHost] = React.useState("");
  React.useEffect(() => {
    setHost(window.location.host);
  }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/nex-native/${slug}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard denied · ignore silently */
    }
  }
  return (
    <div
      data-nex-shop-share-url
      style={{
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        background: "rgba(198, 161, 91, 0.08)",
        border: "1px solid rgba(198, 161, 91, 0.45)",
        borderRadius: 10,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#C6A15B",
            marginBottom: 3,
          }}
        >
          Your share link
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#FAF8F4",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          }}
        >
          {host || "nexapp.app"}/nex-native/
          <span style={{ color: "#C6A15B" }}>{slug}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy share link"
        style={{
          flexShrink: 0,
          padding: "6px 12px",
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: copied ? "#1A120A" : "#C6A15B",
          background: copied ? "#FFD600" : "transparent",
          border: `1px solid ${copied ? "#E6B800" : "#C6A15B"}`,
          borderRadius: 999,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
