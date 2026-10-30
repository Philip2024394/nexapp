// src/components/nex-native/directory/_market-badge.tsx
//
// Owner-authorised 2026-10-30 (Product Upload World-Class brief) ·
// market-visibility pill for product cards. Only renders when the
// enclosing ListingCardViewModel carries a non-null `marketScope`.
//
// Visual palette matches the Live Product Library tile exactly so a
// product looks the same whether a seller is picking it in Live or a
// buyer is browsing the Directory:
//
//   · "local"   → neutral ink chip (soft grey)
//   · "export"  → cyan accent chip
//   · "both"    → green growth chip
//
// Wording follows the sealed owner spec:
//
//   · Local            → "Local · Domestic sales"
//   · Export           → "Export · International sales"
//   · Local + Export   → "Local + Export · Both markets"
//
// Rendered mid-card below the price so a scanning buyer sees the
// market context next to the price, which is the most relevant pairing.

import type { CSSProperties } from "react";

export type MarketScope = "local" | "export" | "both";

export interface MarketBadgeProps {
  readonly scope: MarketScope | null;
}

export function MarketBadge({ scope }: MarketBadgeProps): React.JSX.Element | null {
  if (!scope) return null;
  const copy = COPY[scope];
  const palette = PALETTE[scope];
  return (
    <div
      style={{
        ...pillStyle,
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
      }}
      data-nex-market-badge={scope}
    >
      <span style={headingStyle}>{copy.heading}</span>
      <span style={subheadStyle}>{copy.subhead}</span>
    </div>
  );
}

const COPY: Record<MarketScope, { heading: string; subhead: string }> = {
  local:  { heading: "Local",          subhead: "Domestic sales" },
  export: { heading: "Export",         subhead: "International sales" },
  both:   { heading: "Local + Export", subhead: "Both markets" },
};

const PALETTE: Record<MarketScope, { bg: string; fg: string; border: string }> = {
  local:  { bg: "rgba(16, 32, 51, 0.06)",   fg: "#4A6080",  border: "rgba(16, 32, 51, 0.14)" },
  export: { bg: "rgba(0, 175, 255, 0.10)",  fg: "#007EC1",  border: "rgba(0, 175, 255, 0.28)" },
  both:   { bg: "rgba(16, 214, 107, 0.10)", fg: "#0E8A4A",  border: "rgba(16, 214, 107, 0.30)" },
};

const pillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 6,
  padding: "3px 8px",
  marginTop: 6,
  borderRadius: 999,
  lineHeight: 1.2,
  width: "fit-content",
};

const headingStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const subheadStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  opacity: 0.85,
};
