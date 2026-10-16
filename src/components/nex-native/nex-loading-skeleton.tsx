// src/components/nex-native/nex-loading-skeleton.tsx
//
// NEX universal loading skeleton · sealed 2026-10-16.
// --------------------------------------------------------------------
// Owner directive 2026-10-16 · "I click a button on hosting and the
// app does not divert fast to the page". The root cause is that
// consumer-hub routes under /nex-native/* are server components with
// `export const dynamic = "force-dynamic"` which forces a full SSR
// round-trip on every navigation (plus a Supabase session resolver
// hit). Without a `loading.tsx` boundary, Next.js paints NOTHING
// between the click and the fully-rendered server response, so the
// surface feels frozen. The user retries, enqueuing more navigations
// and compounding the perceived latency.
//
// This primitive is mounted inside each route-level `loading.tsx` so
// the FIRST paint after a click is this skeleton · guaranteed under
// 50 ms. The real SSR response then replaces it. No fabrication: the
// skeleton never claims specific content exists · it is a neutral
// shimmer anchored to the phone frame.
//
// Design:
//   · Same navy background + cyan rim as the sealed NEX palette · the
//     skeleton feels like "the page is loading" not "something broke".
//   · Shimmer uses a pure-CSS keyframe · zero JS · zero layout thrash.
//   · 44 px touch targets preserved in placeholder header to match the
//     real surfaces · prevents layout jump when the real content lands.

import type { CSSProperties, ReactNode } from "react";

interface NexLoadingSkeletonProps {
  /** Optional eyebrow label · short string shown in cyan above the
   *  shimmer rows. Null = no label. */
  readonly label?: string | null;
  /** Number of shimmer card rows to render · defaults to 4. */
  readonly rows?: number;
  /** Optional slot for a custom header skeleton (e.g. two-column grid
   *  previews for the directory feed). Null = default header. */
  readonly header?: ReactNode;
}

const NAVY = "#020914";
const PANEL = "#0A1526";
const PANEL_BORDER = "rgba(0,175,255,0.18)";
const CYAN = "#00AFFF";
const MUTED = "#7D9BC0";

export function NexLoadingSkeleton({
  label = null,
  rows = 4,
  header = null,
}: NexLoadingSkeletonProps) {
  return (
    <main style={pageStyle} data-nex-loading-skeleton aria-busy="true" aria-live="polite">
      <div style={shellStyle}>
        {header ?? <DefaultHeader label={label} />}
        <div style={rowsStyle}>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} style={rowStyle(i)} />
          ))}
        </div>
      </div>
      {/* The shimmer keyframe lives inline so the primitive is
          self-contained · no stylesheet dependency. */}
      <style>{`
        @keyframes nex-shimmer {
          0%   { background-position: -200px 0; }
          100% { background-position: calc(200px + 100%) 0; }
        }
      `}</style>
    </main>
  );
}

function DefaultHeader({ label }: { readonly label: string | null }) {
  return (
    <div style={headerStyle}>
      <div style={headerBrandStyle} />
      {label ? <div style={headerLabelStyle}>{label}</div> : null}
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100%",
  background: NAVY,
  color: MUTED,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};
const shellStyle: CSSProperties = {
  padding: "16px 14px 24px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};
const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 4,
};
const headerBrandStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  background: `linear-gradient(135deg, ${CYAN}33 0%, ${CYAN}0A 100%)`,
  border: `1.5px solid ${CYAN}55`,
};
const headerLabelStyle: CSSProperties = {
  color: CYAN,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 1.1,
  textTransform: "uppercase",
};
const rowsStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginTop: 10,
};
function rowStyle(i: number): CSSProperties {
  // Vary the width slightly per row so the skeleton feels like real
  // content · the padding + accent border stay constant so the shape
  // reads as "a loading NEX surface".
  const widthPct = i % 3 === 0 ? "92%" : i % 3 === 1 ? "100%" : "84%";
  return {
    width: widthPct,
    height: 72,
    borderRadius: 14,
    background: `linear-gradient(90deg, ${PANEL} 0%, ${PANEL_BORDER} 50%, ${PANEL} 100%)`,
    backgroundSize: "200px 100%",
    backgroundRepeat: "no-repeat",
    animation: "nex-shimmer 1.4s ease-in-out infinite",
    border: `1px solid ${PANEL_BORDER}`,
  };
}
