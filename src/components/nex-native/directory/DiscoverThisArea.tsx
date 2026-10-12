// src/components/nex-native/directory/DiscoverThisArea.tsx
//
// "Discover this area" · richer area intelligence block for the
// business detail page. Shows per-category highlights (food, shopping,
// attractions, transport) with inline source attribution.
//
// Honesty contract:
//   · Renders ONLY categories that actually have evidence.
//   · Every claim links to its source URL · the visitor can audit.
//   · Shows the research date + method so freshness is visible.
//   · When no AreaIntelligence is passed, this component renders
//     NOTHING · the parent decides whether to show a "not researched
//     yet" fallback. No fabricated area description.

import type {
  AreaIntelligence,
  AreaIntelCategory,
} from "@/lib/nex-native/directory/area-intelligence-types";
import { nonEmptyCategories } from "@/lib/nex-native/directory/area-intelligence-types";

const PALETTE = {
  surface: "#0E1526",
  surfaceHi: "#182540",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  textSoft: "#4B6683",
  orange: "#FF7200",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0,175,255,0.08)",
  borderSoft: "rgba(255,255,255,0.08)",
} as const;

const CATEGORY_LABEL: Record<AreaIntelCategory, string> = {
  food: "Food and local specialities",
  shopping: "Shopping and markets",
  attractions: "Places to visit",
  transport: "Getting around and staying",
};

const CATEGORY_ICON: Record<AreaIntelCategory, string> = {
  food: "🍜",
  shopping: "🛍️",
  attractions: "🏛️",
  transport: "🚉",
};

export interface DiscoverThisAreaProps {
  readonly intel: AreaIntelligence | null;
}

export function DiscoverThisArea(
  props: DiscoverThisAreaProps,
): React.JSX.Element | null {
  const intel = props.intel;
  if (intel === null) return null;
  const cats = nonEmptyCategories(intel);
  if (cats.length === 0) return null;

  return (
    <section
      data-nex-discover-this-area
      data-nex-discover-this-area-area-id={intel.areaId}
      aria-labelledby="nex-discover-this-area-heading"
      style={{
        marginTop: 22,
        background: PALETTE.surface,
        border: `1px solid ${PALETTE.borderSoft}`,
        borderRadius: 16,
        padding: "18px 20px",
      }}
    >
      <h2
        id="nex-discover-this-area-heading"
        style={{
          margin: "0 0 4px 0",
          color: PALETTE.textDim,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Discover this area · {intel.areaName}
      </h2>
      {intel.shortSummary !== null ? (
        <p
          data-nex-discover-this-area-summary
          style={{
            margin: "6px 0 14px 0",
            color: PALETTE.text,
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          {intel.shortSummary}
        </p>
      ) : null}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {cats.map((cat) => (
          <CategoryBlock
            key={cat}
            category={cat}
            claims={intel.knownFor[cat]}
          />
        ))}
      </div>
      <AttributionFooter intel={intel} />
    </section>
  );
}

function CategoryBlock(props: {
  readonly category: AreaIntelCategory;
  readonly claims: AreaIntelligence["knownFor"][AreaIntelCategory];
}): React.JSX.Element {
  return (
    <div
      data-nex-discover-this-area-category={props.category}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: PALETTE.cyan,
          fontSize: 13.5,
          fontWeight: 700,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 16 }}>
          {CATEGORY_ICON[props.category]}
        </span>
        {CATEGORY_LABEL[props.category]}
      </div>
      <ul
        aria-label={CATEGORY_LABEL[props.category]}
        style={{
          margin: 0,
          padding: "0 0 0 2px",
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {props.claims.map((claim, i) => (
          <li
            key={claim.sourceUrl + i}
            data-nex-discover-this-area-claim
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: 13,
              lineHeight: 1.45,
              color: PALETTE.textDim,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                flexShrink: 0,
                marginTop: 6,
                width: 4,
                height: 4,
                borderRadius: 2,
                background: PALETTE.cyan,
              }}
            />
            <span>
              {claim.claim}{" "}
              <a
                href={claim.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-nex-discover-this-area-claim-source
                style={{
                  color: PALETTE.textSoft,
                  textDecoration: "underline",
                  fontSize: 11,
                  marginLeft: 2,
                }}
              >
                source
              </a>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AttributionFooter(props: {
  readonly intel: AreaIntelligence;
}): React.JSX.Element {
  const { intel } = props;
  const d = tryFormatDate(intel.researchedAt);
  return (
    <div
      data-nex-discover-this-area-attribution
      style={{
        marginTop: 16,
        paddingTop: 12,
        borderTop: `1px solid ${PALETTE.borderSoft}`,
        fontSize: 11,
        color: PALETTE.textSoft,
        lineHeight: 1.5,
      }}
    >
      Area intelligence researched {d}
      {" · "}
      method: <code style={{ color: PALETTE.textMuted }}>{intel.method}</code>
      {intel.methodNote !== null ? (
        <>
          <br />
          <span style={{ fontStyle: "italic" }}>{intel.methodNote}</span>
        </>
      ) : null}
      <br />
      Area-level content describes the surrounding neighbourhood ·
      claims are not about this specific business.
    </div>
  );
}

function tryFormatDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Date(ms).toISOString().slice(0, 10);
}
