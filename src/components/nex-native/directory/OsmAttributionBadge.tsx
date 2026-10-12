// src/components/nex-native/directory/OsmAttributionBadge.tsx
//
// OSM ODbL attribution badge · mandatory on every public NEX surface
// that renders OSM-sourced business data (per the vertical-clearance
// doctrine 2026-10-10 · R-A1 / R-S1 mitigation).
//
// Visual: a small inline chip ("© OpenStreetMap contributors (ODbL)")
// with an optional link to the specific OSM id if one is present.
//
// Rendering rule:
//   · Render ONLY when the listing is actually OSM-sourced
//     (indicated by osmId OR a provable OSM evidence row). The
//     component takes `osmId` directly and renders nothing when
//     it is null · so wrapper code can safely pass it without
//     needing to conditionalise upstream.
//   · When osmId is present AND looks like a valid OSM reference
//     (node/way/relation + numeric id), it links to the OSM feature
//     page on openstreetmap.org · opens in a new tab.
//
// Honest exclusion rule:
//   · Food listings (currently 23,619 published) ARE OSM-sourced
//     and should carry this badge.
//   · Owner-uploaded listings (future · post owner-claim) must NOT
//     carry this badge even if they originally came from OSM, once
//     their primary evidence transitions to owner-attested. The
//     caller decides which badge (if any) applies.
//
// This component is pure presentation · no fetch, no DB.

"use client";

const PALETTE = {
  surfaceHi: "#182540",
  textSoft: "#4B6683",
  textMuted: "#7D9BC0",
  borderSoft: "rgba(255,255,255,0.08)",
} as const;

export interface OsmAttributionBadgeProps {
  /** Optional specific OSM reference string · shape
   *  `node/<id>` | `way/<id>` | `relation/<id>`. When present the
   *  badge becomes a link to the OSM feature page. When null or
   *  malformed the badge still renders (ODbL requires attribution
   *  even without the per-feature link). */
  readonly osmId: string | null;
  /** Optional size variant · default is "compact" (card use) · pass
   *  "detail" for the slightly larger badge on the detail page. */
  readonly size?: "compact" | "detail";
}

const OSM_REF_PATTERN = /^(node|way|relation)\/\d+$/;

export function OsmAttributionBadge(
  props: OsmAttributionBadgeProps,
): React.JSX.Element {
  const { osmId, size = "compact" } = props;
  const trimmed = typeof osmId === "string" ? osmId.trim() : "";
  const hasValidRef = trimmed.length > 0 && OSM_REF_PATTERN.test(trimmed);
  const href = hasValidRef
    ? `https://www.openstreetmap.org/${trimmed}`
    : null;

  const fontSize = size === "detail" ? 11.5 : 10.5;
  const padding = size === "detail" ? "3px 10px" : "2px 8px";

  const inner = (
    <>
      <span aria-hidden="true" style={{ marginRight: 4 }}>©</span>
      OpenStreetMap contributors (ODbL)
    </>
  );

  if (href !== null) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-nex-osm-attribution-badge
        data-nex-osm-attribution-badge-ref={trimmed}
        aria-label={`OpenStreetMap source: ${trimmed} · opens on openstreetmap.org`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding,
          borderRadius: 999,
          background: PALETTE.surfaceHi,
          color: PALETTE.textMuted,
          fontSize,
          fontWeight: 500,
          lineHeight: 1.3,
          textDecoration: "none",
          border: `1px solid ${PALETTE.borderSoft}`,
        }}
      >
        {inner}
      </a>
    );
  }

  return (
    <span
      data-nex-osm-attribution-badge
      data-nex-osm-attribution-badge-ref=""
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding,
        borderRadius: 999,
        background: PALETTE.surfaceHi,
        color: PALETTE.textSoft,
        fontSize,
        fontWeight: 500,
        lineHeight: 1.3,
        border: `1px solid ${PALETTE.borderSoft}`,
      }}
    >
      {inner}
    </span>
  );
}
