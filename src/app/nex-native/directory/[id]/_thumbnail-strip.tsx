// src/app/nex-native/directory/[id]/_thumbnail-strip.tsx
//
// NEX Directory · detail-page thumbnail strip.
// Founder-authorised 2026-10-13 · build-now milestone.
//
// Renders up to N approved + display-eligible images for the current
// listing · uses the sealed media resolver (both approval gates) · no
// bypass path · no fabrication.
//
// Three honest states (per founder decision 2026-10-13):
//
//   1. POPULATED · the API returned 1+ images · we render the strip
//      with horizontal scroll on mobile · wrap on larger viewports.
//
//   2. EMPTY · the API returned ok=true · images=[] · the business
//      has no approved images yet. We render a short honest line ·
//      NEVER a fake generic photo. The founder's "no fabrication"
//      rule applies here.
//
//      Caveat: if the hero image is already rendering (the first
//      approved image became `primaryImage` on the VM), the strip
//      component's EMPTY branch is suppressed by the parent so we
//      don't say "no additional photos" immediately below a photo.
//      The parent decides whether to render us at all when there is
//      exactly one image.
//
//   3. ERROR · ok=false · DB unreachable OR query failed · we
//      render an honest "Unable to load additional photos right now"
//      so the user knows the gap is a system state, not a business
//      saying "we have no photos." The caller may retry on next
//      navigation; we do NOT auto-retry in this component.
//
// NO loading state in this component · Next.js server-rendering
// means the data is already fetched when we render. If the parent
// wraps us in a <Suspense>, Next.js's loading.tsx handles the
// in-flight visual. This component only sees resolved data.

import type * as React from "react";
import type { ThumbnailStripResult } from "@/lib/nex-native/directory/media-resolver";

// Palette aligned with the detail page (same tokens as HeroImage).
const PALETTE = {
  surface: "#0E1526",
  surfaceHi: "#182540",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0,175,255,0.08)",
  amber: "#FBBF24",
  borderSoft: "rgba(255,255,255,0.06)",
} as const;

export interface ThumbnailStripProps {
  readonly result: ThumbnailStripResult;
  /** When true, the EMPTY branch is suppressed (parent is showing the
   *  single primary image elsewhere and doesn't want to say "no
   *  additional photos" directly below it). Default false. */
  readonly suppressEmpty?: boolean;
  /** Optional business name for alt-text generation. The resolver
   *  already carries name_canonical into DirectoryImage.altText; this
   *  prop is a safety net if the resolver returns an empty altText. */
  readonly businessName?: string;
  /** Layout:
   *   · "strip" (default) · horizontal scroll · 120×120 tiles · scroll-snap
   *   · "grid"            · 3-column full-width grid · each tile 1/3 of
   *                         the row width with a 1:1 aspect ratio. Wraps
   *                         onto additional rows for >3 images.
   *  Both layouts render the SAME SQL-gated images; the choice is purely
   *  presentation. */
  readonly layout?: "strip" | "grid";
  /** When true, the component's internal "PHOTOS" heading is omitted ·
   *  for callers that render their own section heading above. */
  readonly hideHeading?: boolean;
}

export function ThumbnailStrip(props: ThumbnailStripProps): React.ReactElement | null {
  const {
    result,
    suppressEmpty = false,
    businessName,
    layout = "strip",
    hideHeading = false,
  } = props;

  // ─── ERROR state ───────────────────────────────────────────────
  if (result.ok === false) {
    return (
      <section
        data-nex-thumbnail-strip="error"
        data-nex-thumbnail-strip-reason={result.reason}
        aria-label="Additional photos unavailable"
        style={{
          padding: "16px 20px",
          background: PALETTE.surfaceHi,
          borderRadius: 12,
          border: `1px solid ${PALETTE.borderSoft}`,
          margin: "16px 20px",
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: PALETTE.amber,
            fontWeight: 500,
            marginBottom: 4,
            letterSpacing: 0.2,
          }}
        >
          Unable to load additional photos right now
        </div>
        <div style={{ fontSize: 12, color: PALETTE.textMuted, lineHeight: 1.5 }}>
          NEX will retry when you reload the page. No additional photos are
          shown in the meantime.
        </div>
      </section>
    );
  }

  // ─── POPULATED state ───────────────────────────────────────────
  if (result.images.length > 0) {
    // Layout styles · "strip" = horizontal scroll · "grid" = 3-column
    // full-width grid (each tile is 1fr with a 1:1 aspect ratio).
    const containerStyle: React.CSSProperties =
      layout === "grid"
        ? {
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
          }
        : {
            display: "flex",
            gap: 10,
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            paddingBottom: 4,
          };
    const tileStyle: React.CSSProperties =
      layout === "grid"
        ? {
            width: "100%",
            aspectRatio: "1 / 1",
            borderRadius: 12,
            overflow: "hidden",
            background: PALETTE.surfaceHi,
            position: "relative",
          }
        : {
            flex: "0 0 auto",
            width: 120,
            height: 120,
            borderRadius: 12,
            overflow: "hidden",
            background: PALETTE.surfaceHi,
            scrollSnapAlign: "start",
            position: "relative",
          };
    return (
      <section
        data-nex-thumbnail-strip="populated"
        data-nex-thumbnail-strip-count={result.images.length}
        data-nex-thumbnail-strip-layout={layout}
        aria-label={
          businessName
            ? `Additional photos of ${businessName}`
            : "Additional photos"
        }
        style={{
          padding: "0 20px",
          margin: "20px 0 24px",
        }}
      >
        {hideHeading ? null : (
          <h2
            style={{
              fontSize: 11,
              color: PALETTE.textMuted,
              textTransform: "uppercase",
              letterSpacing: 1,
              margin: "0 0 10px",
              fontWeight: 600,
            }}
          >
            Photos
          </h2>
        )}
        <div style={containerStyle}>
          {result.images.map((img, i) => (
            <div
              key={`${img.sourceId ?? "n"}-${i}-${img.url}`}
              data-nex-thumbnail-strip-item
              data-nex-thumbnail-strip-source-id={img.sourceId ?? ""}
              style={tileStyle}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.altText || businessName || ""}
                data-nex-thumbnail-strip-item-src
                loading="lazy"
                decoding="async"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ─── EMPTY state ───────────────────────────────────────────────
  if (suppressEmpty) {
    // Parent is handling the "has photos" presentation elsewhere · stay silent.
    return null;
  }
  return (
    <section
      data-nex-thumbnail-strip="empty"
      aria-label="No additional photos yet"
      style={{
        padding: "16px 20px",
        margin: "16px 20px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.02)",
        border: `1px dashed ${PALETTE.borderSoft}`,
      }}
    >
      <div style={{ fontSize: 12, color: PALETTE.textMuted, lineHeight: 1.5 }}>
        No additional photos yet. NEX only shows photos that have been
        verified and approved.
      </div>
    </section>
  );
}
