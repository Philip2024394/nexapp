// src/app/nex-native/library/backgrounds/_shop-preview.tsx
//
// Shop-card preview · shows how the selected asset would look as the
// shop cover. Owner directive 2026-11-11.

import type * as React from "react";

interface Props {
  readonly imageUrl: string;
  readonly tintHex: string | null;
}

export function ShopPreview({ imageUrl, tintHex }: Props): React.JSX.Element {
  return (
    <div
      aria-label="Shop preview"
      data-nex-library-preview="shop"
      style={{
        position: "relative",
        aspectRatio: "16 / 9",
        borderRadius: 12,
        overflow: "hidden",
        background: "#0A1526",
        boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: tintHex
            ? `linear-gradient(180deg, transparent 50%, ${tintHex}44 100%)`
            : "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.35) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 10,
          color: "#FFFFFF",
          fontSize: 14,
          fontWeight: 900,
          letterSpacing: "0.04em",
          textShadow: "0 2px 8px rgba(0,0,0,0.65)",
        }}
      >
        Your Shop Name
      </div>
      <div
        style={{
          position: "absolute",
          right: 10,
          top: 10,
          padding: "3px 8px",
          borderRadius: 999,
          background: tintHex ?? "#C6A15B",
          color: "#FFFFFF",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
        }}
      >
        Preview
      </div>
    </div>
  );
}
