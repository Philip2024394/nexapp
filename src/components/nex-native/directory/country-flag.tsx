// src/components/nex-native/directory/country-flag.tsx
//
// NEX · shared circular country-flag badge · sealed 2026-10-16.
// --------------------------------------------------------------------
// Extracted from the FlagBadge primitive that previously lived inside
// `CountryPicker.tsx`. Owner directive 2026-10-16 · the directory
// listing card needs the same flag primitive beside the authoritative
// seller price. Extracting to a dedicated module keeps one source of
// truth · zero new dependencies.
//
// Flag source priority:
//   1. If a `flagSrcFor(isoAlpha2)` function is supplied AND it
//      returns a non-null URL, the circular image is rendered.
//   2. Otherwise the ISO alpha-2 code (e.g. "ID", "GB") is painted
//      as a text badge inside the circle. Reliable fallback across
//      every browser including Windows (where regional-indicator
//      emoji flags don't render natively).
//
// This file was extracted intact · identical rendering · identical
// props shape · `CountryPicker.tsx` now re-exports FlagBadge from
// here to avoid duplication.

import type * as React from "react";

export interface CountryFlagProps {
  readonly isoAlpha2: string;
  readonly size: number;
  readonly flagSrcFor?: (isoAlpha2: string) => string | null;
}

export function CountryFlag({
  isoAlpha2,
  size,
  flagSrcFor,
}: CountryFlagProps) {
  const src = flagSrcFor ? flagSrcFor(isoAlpha2) : null;
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    overflow: "hidden",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1300",
    color: "#F2F5F8",
    fontSize: Math.max(10, Math.floor(size * 0.42)),
    fontWeight: 600,
    letterSpacing: 0,
    userSelect: "none",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    flexShrink: 0,
  };
  if (src) {
    return (
      <span style={style} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </span>
    );
  }
  return (
    <span style={style} aria-hidden="true">
      {isoAlpha2}
    </span>
  );
}

// Legacy alias retained so the existing CountryPicker import keeps
// working without a wider rename.
export const FlagBadge = CountryFlag;
