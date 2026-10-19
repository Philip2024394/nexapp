// src/lib/nex-native/trust/trust-shield.tsx
//
// NEX · Trust Shield · the small badge that signals verified status
// on business names across the app.
// Owner-authorised 2026-10-20 · Phase 1 of the Verified-Directory
// wedge.
// ----------------------------------------------------------------
// Visual rules (sealed):
//
//   tier === "high"    → green shield  (#1EC77A)  "Verified"
//   tier === "medium"  → yellow shield (#FFC94A)  "Partly verified"
//   tier === "low"     → grey  shield  (#7D9BC0)  "Lightly known"
//   tier === "unknown" → renders NULL  (hidden per owner directive)
//
// Three sizes:
//   "sm"  → 12px   icon-only · fits inside chip rows
//   "md"  → 16px   icon with optional label · default
//   "lg"  → 20px   icon with label · hero use
//
// The component is a plain inline-block · no popovers · tapping it
// is the caller's responsibility (typically opens the Safe Trade
// sheet which already carries the full evidence detail).

import type { CSSProperties } from "react";
import type { TrustTier } from "./trust-score-shared";

export interface TrustShieldProps {
  readonly tier: TrustTier;
  readonly size?: "sm" | "md" | "lg";
  /** Default true · shows the short label next to the icon on md/lg. */
  readonly showLabel?: boolean;
  /** Extra text to prepend to the tooltip · e.g. "Crispy Chicken ·" */
  readonly titlePrefix?: string;
  readonly onClick?: () => void;
  readonly ariaLabel?: string;
  /** Rare override · the shield uses its own styling by default. */
  readonly style?: CSSProperties;
}

const COLORS: Record<Exclude<TrustTier, "unknown">, { fill: string; text: string }> = {
  high:   { fill: "#1EC77A", text: "#07241A" },
  medium: { fill: "#FFC94A", text: "#2A1A00" },
  low:    { fill: "#7D9BC0", text: "#0E1A28" },
};

const LABELS: Record<Exclude<TrustTier, "unknown">, string> = {
  high: "Verified",
  medium: "Partly verified",
  low: "Lightly known",
};

const SIZE_SPEC: Record<"sm" | "md" | "lg", {
  iconPx: number;
  fontPx: number;
  padX: number;
  padY: number;
  radius: number;
  gap: number;
}> = {
  sm: { iconPx: 12, fontPx: 9.5,  padX: 5, padY: 2, radius: 6,  gap: 3 },
  md: { iconPx: 16, fontPx: 11,   padX: 7, padY: 3, radius: 8,  gap: 5 },
  lg: { iconPx: 20, fontPx: 12.5, padX: 9, padY: 4, radius: 10, gap: 6 },
};

export function TrustShield({
  tier,
  size = "md",
  showLabel = true,
  titlePrefix,
  onClick,
  ariaLabel,
  style,
}: TrustShieldProps): React.JSX.Element | null {
  // Sealed · unknown tier renders nothing. See owner directive
  // 2026-10-20 in trust-score-shared.ts.
  if (tier === "unknown") return null;

  const palette = COLORS[tier];
  const label = LABELS[tier];
  const spec = SIZE_SPEC[size];
  const tooltip = titlePrefix ? `${titlePrefix} ${label}` : label;
  const effectiveLabel = ariaLabel ?? tooltip;

  const Comp = onClick ? "button" : "span";
  const commonStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: showLabel ? spec.gap : 0,
    padding: showLabel ? `${spec.padY}px ${spec.padX}px` : 0,
    borderRadius: spec.radius,
    background: showLabel ? palette.fill : "transparent",
    color: palette.text,
    fontSize: spec.fontPx,
    fontWeight: 700,
    letterSpacing: "0.02em",
    lineHeight: 1,
    fontFamily: "inherit",
    verticalAlign: "middle",
    cursor: onClick ? "pointer" : "default",
    border: "none",
    whiteSpace: "nowrap",
    ...style,
  };

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-label={effectiveLabel}
      title={tooltip}
      data-nex-trust-shield={tier}
      data-nex-trust-shield-size={size}
      style={commonStyle}
    >
      <ShieldIcon size={spec.iconPx} fill={palette.fill} ink={palette.text} />
      {showLabel && <span>{label}</span>}
    </Comp>
  );
}

function ShieldIcon({
  size,
  fill,
  ink,
}: {
  size: number;
  fill: string;
  ink: string;
}): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      style={{ display: "block" }}
    >
      {/* Shield silhouette */}
      <path
        d="M12 2 L4 5 v6 c0 5 3.5 9 8 11 c4.5 -2 8 -6 8 -11 V5 z"
        fill={fill}
      />
      {/* Inner check mark · darker ink so the shield reads clearly
          over coloured container backgrounds */}
      <path
        d="M8.5 12.5 l2.5 2.5 l4.5 -5"
        stroke={ink}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
