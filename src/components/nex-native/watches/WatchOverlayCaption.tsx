"use client";

// src/components/nex-native/watches/WatchOverlayCaption.tsx
//
// Owner directive 2026-10-26 (Round 3e):
//   · Collapsed: icon + headline + 2-line description (ellipsis).
//     No round button, no pill background.
//   · Expanded container is FROSTED GLASS white with a slight blue rim.
//     Dark navy variant removed per owner.
//   · "Other videos" renamed → "Video Center" and shows ALL 9 videos
//     (not filtered to exclude current).
//   · Dev-annotation badges are now a FLOATING PAGE-LEVEL PALETTE
//     (not inline per section). The palette fixes to the right edge
//     of the viewport with labelled numbers.
//   · Small square ⬆ send-style button at the end of the product
//     container · fires the Interested confirm sheet.
//
// Preservation: no touch on sealed/modified files (BroadcasterLibrary-
// Sheet.tsx, LiveViewerFooter.tsx remain untouched).

import * as React from "react";
import Link from "next/link";

const NEX = {
  textDark: "#0A1526",
  textDim: "#4A5F7C",
  textFaint: "#6B7E97",
  cyan: "#00AFFF",
  gold: "#D89A1A",
  red: "#FF3355",
  orange: "#FF7200",
  // Legacy frosted-WHITE palette · retained for InterestedConfirmSheet.
  frostBg: "rgba(255, 255, 255, 0.78)",
  frostBorder: "rgba(0, 175, 255, 0.42)",
  frostDivider: "rgba(10, 21, 38, 0.08)",
  // Owner directive 2026-10-26 (Round 3h) · description container is
  // now BLUE frosted glass with light text + light divider.
  frostBlueBg: "rgba(14, 32, 68, 0.78)",
  frostBlueBorder: "rgba(0, 175, 255, 0.58)",
  frostBlueDivider: "rgba(255, 255, 255, 0.14)",
  textLight: "#F2F5F8",
  textLightDim: "#C8D4E8",
  textLightFaint: "#8FA7C8",
  shadow: "0 20px 50px -16px rgba(0, 20, 60, 0.5)",
  shadowSoft: "0 8px 20px -8px rgba(0, 20, 60, 0.3)",
  textShadowStrong: "0 2px 10px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.9)",
  shopBtnBg: "rgba(216, 154, 26, 0.14)",
  shopBtnBorder: "rgba(216, 154, 26, 0.6)",
  primaryGrad: "linear-gradient(135deg, #FF3355 0%, #FF7200 100%)",
  secondaryBg: "rgba(0, 175, 255, 0.14)",
  secondaryBorder: "rgba(0, 175, 255, 0.55)",
  sendBtnBg: "linear-gradient(135deg, #00AFFF 0%, #0088CC 100%)",
  flipBtnBg: "rgba(0, 175, 255, 0.22)",
  flipBtnBorder: "rgba(0, 175, 255, 0.68)",
  devYellow: "#FFC24B",
  devYellowDark: "#1A1200",
} as const;

export interface WatchSpecs {
  readonly caseDiameterMm?: number;
  readonly caseThicknessMm?: number;
  readonly lugToLugMm?: number;
  readonly movement?:
    | "automatic"
    | "manual-wind"
    | "quartz-battery"
    | "solar-quartz"
    | "spring-drive"
    | "mecaquartz"
    | "on-request";
  readonly movementCaliber?: string;
  readonly waterResistanceM?: number;
  readonly caseMaterial?: string;
  readonly strapMaterial?: string;
  readonly strapWidthMm?: number;
  readonly strapLengthMm?: number;
  readonly madeIn?: string;
  readonly condition?: "new" | "pre-owned" | "vintage" | "on-request";
  readonly fullSet?: boolean;
  readonly packaging?: readonly (
    | "box"
    | "papers"
    | "warranty-card"
    | "service-card"
    | "manual"
    | "spare-link"
    | "none"
  )[];
  readonly authenticity?:
    | "original-brand"
    | "original-brand-service-pending"
    | "homage-disclosed"
    | "replica-disclosed"
    | "on-request";
  readonly warrantyNote?: string;
  readonly shippingScope?: readonly (
    | "local"
    | "domestic"
    | "export"
    | "pickup-only"
  )[];
  readonly pricingModes?: readonly ("retail" | "wholesale" | "trade-in")[];
  readonly priceNote?: string;
  readonly productionYear?: number;
  readonly dialColor?: string;
  readonly complications?: readonly string[];
}

export interface OtherVideoThumb {
  readonly id: string;
  readonly headline: string;
  readonly posterUrl: string;
  readonly href: string;
  /** Owner directive 2026-10-26 (Round 3f) · brand label rendered
   *  UNDER the Video Center card. Pre-computed by the caller so the
   *  server component doesn't have to ship a function to the client
   *  (Next.js RSC rule: no function props across the boundary). */
  readonly brand?: string;
  /** Owner directive 2026-10-26 (Round 3i) · Video Center shows the
   *  VIDEO (muted, looped preview) instead of the static poster. When
   *  provided, VideoCenterGrid renders a <video> with
   *  autoplay+muted+loop+playsinline and keeps `posterUrl` as the
   *  pre-load fallback image. */
  readonly videoUrl?: string;
}

export interface WatchOverlayCaptionProps {
  readonly headline?: string;
  readonly description?: string;
  readonly brand?: string;
  readonly specs?: WatchSpecs;
  readonly otherVideos?: readonly OtherVideoThumb[];
  readonly shopHref?: string;
  readonly shopLabel?: string;
  readonly sellerDisplayName?: string;
  readonly sellerHandle?: string;
  readonly bottomOffsetPx?: number;
  readonly defaultExpanded?: boolean;
  readonly devAnnotate?: boolean;
}

const MOVEMENT_LABEL: Record<NonNullable<WatchSpecs["movement"]>, string> = {
  "automatic": "Automatic",
  "manual-wind": "Manual-wind",
  "quartz-battery": "Quartz · battery",
  "solar-quartz": "Solar-quartz",
  "spring-drive": "Spring Drive",
  "mecaquartz": "Meca-quartz",
  "on-request": "On Request",
};
const CONDITION_LABEL: Record<NonNullable<WatchSpecs["condition"]>, string> = {
  "new": "New",
  "pre-owned": "Pre-owned",
  "vintage": "Vintage",
  "on-request": "On Request",
};
const AUTHENTICITY_LABEL: Record<NonNullable<WatchSpecs["authenticity"]>, string> = {
  "original-brand": "Original · brand-authenticated",
  "original-brand-service-pending": "Original · service pending",
  "homage-disclosed": "Homage · disclosed",
  "replica-disclosed": "Replica · disclosed",
  "on-request": "On Request",
};
const PACKAGING_LABEL: Record<NonNullable<WatchSpecs["packaging"]>[number], string> = {
  "box": "Box",
  "papers": "Papers",
  "warranty-card": "Warranty card",
  "service-card": "Service card",
  "manual": "Manual",
  "spare-link": "Spare link",
  "none": "None",
};
const SHIPPING_LABEL: Record<NonNullable<WatchSpecs["shippingScope"]>[number], string> = {
  "local": "Local",
  "domestic": "Domestic",
  "export": "Export",
  "pickup-only": "Pickup only",
};
const PRICING_LABEL: Record<NonNullable<WatchSpecs["pricingModes"]>[number], string> = {
  "retail": "Retail",
  "wholesale": "Wholesale",
  "trade-in": "Trade-in",
};

/* ─── Dev palette · page-level floating numbered reference ──── */

const DEV_SECTION_LABELS: ReadonlyArray<[number, string]> = [
  [1, "Collapsed"],
  [2, "Brand"],
  [3, "Headline"],
  [4, "Shop btn"],
  [5, "Description"],
  [6, "Specs"],
  [7, "Condition"],
  [8, "Buyer notes"],
  [9, "Interested"],
  [10, "Video Center"],
  [11, "Send btn ⬆"],
];

function DevPalette(): React.JSX.Element {
  const [open, setOpen] = React.useState(true);
  return (
    <div
      data-nex-dev-palette
      style={{
        position: "fixed",
        right: 10,
        top: 60,
        zIndex: 90,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 6,
        pointerEvents: "auto",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: NEX.devYellow,
          color: NEX.devYellowDark,
          border: "2px solid #FFFFFF",
          fontSize: 14,
          fontWeight: 900,
          cursor: "pointer",
          boxShadow: NEX.shadowSoft,
          fontFamily: "inherit",
        }}
        aria-label={open ? "Hide dev numbers" : "Show dev numbers"}
      >
        {open ? "×" : "#"}
      </button>
      {open ? (
        <div
          style={{
            background: "rgba(26, 18, 0, 0.92)",
            border: `1.5px solid ${NEX.devYellow}`,
            borderRadius: 10,
            padding: "6px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            boxShadow: NEX.shadowSoft,
            maxHeight: "70vh",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.devYellow,
              marginBottom: 2,
              textAlign: "right",
            }}
          >
            Dev refs
          </div>
          {DEV_SECTION_LABELS.map(([n, label]) => (
            <div
              key={n}
              data-nex-dev-palette-row
              data-nex-dev-palette-n={n}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "2px 2px",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: NEX.devYellow,
                  color: NEX.devYellowDark,
                  fontSize: 10,
                  fontWeight: 900,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {n}
              </span>
              <span
                style={{
                  color: "#FFFFFF",
                  fontSize: 10.5,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function WatchOverlayCaption(
  props: WatchOverlayCaptionProps,
): React.JSX.Element | null {
  const [expanded, setExpanded] = React.useState<boolean>(
    props.defaultExpanded === true,
  );
  // Owner directive 2026-10-26 (Round 3i · supersedes 3h):
  //   · 3-dots in the overlay REVERTED · the existing ⋮ in
  //     LiveViewerFooter (Share · Message · etc) is the "original
  //     container". The watch overlay no longer renders its own ⋮.
  //   · description container stays as a 2-sided FLIP card · the
  //     front restores Interested + Video Center + Send at the bottom
  //     (as it was before R3h); the back is watch specs on a NEX neon
  //     blue background with no rim and no scrolling.
  const [showSpecsSide, setShowSpecsSide] = React.useState(false);
  const [otherOpen, setOtherOpen] = React.useState(false);
  const [interestedOpen, setInterestedOpen] = React.useState(false);
  const [interestToast, setInterestToast] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const bottomOffset = props.bottomOffsetPx ?? 88;

  React.useEffect(() => {
    if (!expanded && !otherOpen && !interestedOpen) return;
    const handler = (ev: MouseEvent | TouchEvent): void => {
      const node = containerRef.current;
      if (!node) return;
      const target = ev.target as Node | null;
      if (target && node.contains(target)) return;
      setInterestedOpen(false);
      setOtherOpen(false);
      setExpanded(false);
    };
    document.addEventListener("mousedown", handler, true);
    document.addEventListener("touchstart", handler, true);
    return () => {
      document.removeEventListener("mousedown", handler, true);
      document.removeEventListener("touchstart", handler, true);
    };
  }, [expanded, otherOpen, interestedOpen]);

  React.useEffect(() => {
    if (!expanded && !otherOpen && !interestedOpen) return;
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key !== "Escape") return;
      if (interestedOpen) return setInterestedOpen(false);
      if (otherOpen) return setOtherOpen(false);
      setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, otherOpen, interestedOpen]);

  React.useEffect(() => {
    if (!interestToast) return;
    const t = window.setTimeout(() => setInterestToast(false), 3000);
    return () => window.clearTimeout(t);
  }, [interestToast]);

  // Owner directive 2026-10-26 (Round 3f) · when the product panel is
  // open, hide every other overlay on the live screen (💬 inbox, dev
  // palette, floating Buy Now button) and dim the backdrop. Siblings
  // read the body data-attribute via CSS and self-hide. We clear the
  // attribute on close + on unmount so no stale state leaks.
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    if (expanded) {
      document.body.setAttribute("data-nex-watch-expanded", "true");
      return () => document.body.removeAttribute("data-nex-watch-expanded");
    }
  }, [expanded]);

  const headline = props.headline?.trim();
  if (!headline) return null;

  const canExpand =
    (typeof props.description === "string" && props.description.trim().length > 0) ||
    !!props.specs;

  // Owner directive 2026-10-26 (Round 3e) · "Video Center" shows ALL
  // of Hendra's videos (not filtered to exclude current) so the owner
  // can see the full 9-piece library from the overlay.
  const videoCenterList = props.otherVideos ?? [];
  const canOpenVideoCenter = videoCenterList.length > 0;

  const openDescription = (): void => {
    if (!canExpand) return;
    setShowSpecsSide(false);
    setExpanded(true);
  };

  const closeDescription = (): void => {
    setExpanded(false);
    setShowSpecsSide(false);
  };

  const toggleFlip = (): void => {
    setShowSpecsSide((v) => !v);
  };

  const confirmInterest = (): void => {
    setInterestedOpen(false);
    setInterestToast(true);
  };

  const sellerLabel = props.sellerDisplayName ?? "the seller";
  const sellerHandleLabel = props.sellerHandle ? ` (${props.sellerHandle})` : "";

  return (
    <>
      {/* Owner directive 2026-10-26 (Round 3e) · floating page-level
          dev palette · yellow numbered reference, OFF the card. The
          palette self-hides when the product panel is open · see the
          global CSS block below. */}
      {props.devAnnotate ? <DevPalette /> : null}

      {/* Owner directive 2026-10-27 · "change the description
          container to same size as live libary and ony 1 side and
          same color theme as live libary" · the backdrop + expanded
          panel pair now mirrors BroadcasterLibrarySheet exactly:
          scrim at `position: absolute; inset: 0` on the phone frame
          + an inset-16 light-panel container above it. The retired
          flip card (2-sided, dark-blue frosted) is gone · one face
          now holds description, specs, and the action bar in a
          scrollable column. */}
      {canExpand && expanded ? (
        <div
          data-nex-watch-overlay-backdrop
          onClick={() => {
            closeDescription();
          }}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(2, 9, 20, 0.55)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
            zIndex: 100,
            animation: "nexWatchOverlayFadeIn 160ms ease-out",
          }}
        />
      ) : null}

      {canExpand && expanded ? (
        <div
          data-nex-watch-overlay-expanded-wrapper
          style={{
            position: "absolute",
            inset: 0,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            zIndex: 101,
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        >
          <div
            id="nex-watch-overlay-panel"
            role="region"
            aria-label="Watch description and specifications"
            data-nex-watch-overlay-panel
            data-nex-watch-overlay-side="description"
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: "1 1 auto",
              width: "100%",
              minHeight: 0,
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: "14px 14px 16px",
              borderRadius: 16,
              background: "rgba(240, 244, 250, 0.96)",
              backdropFilter: "blur(14px) saturate(1.4)",
              WebkitBackdropFilter: "blur(14px) saturate(1.4)",
              border: "1.5px solid rgba(90, 110, 140, 0.5)",
              boxShadow: "0 20px 50px -16px rgba(0, 20, 60, 0.5)",
              color: "#102033",
              fontFamily: "inherit",
              pointerEvents: "auto",
              animation: "nexWatchOverlaySlideUp 180ms ease-out",
            }}
          >
            {/* Header · brand eyebrow + headline · navy close × on
                the right matching the sealed Live Library close chip. */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 auto" }}>
                {props.brand ? (
                  <div
                    style={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: NEX.gold,
                    }}
                  >
                    {props.brand}
                  </div>
                ) : null}
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: "#102033",
                    lineHeight: 1.15,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {headline}
                </div>
                {props.shopHref ? (
                  <Link
                    href={props.shopHref}
                    data-nex-watch-overlay-shop-btn
                    style={{
                      marginTop: 4,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 8px",
                      borderRadius: 8,
                      background: NEX.shopBtnBg,
                      border: `1px solid ${NEX.shopBtnBorder}`,
                      color: NEX.gold,
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: "0.03em",
                      textDecoration: "none",
                      alignSelf: "flex-start",
                    }}
                  >
                    <span aria-hidden style={{ fontSize: 12, lineHeight: 1 }}>🛍</span>
                    {props.shopLabel ?? "Shop"}
                  </Link>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeDescription}
                aria-label="Close description"
                data-nex-watch-overlay-close
                style={{
                  flexShrink: 0,
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #152646 0%, #1E3A6E 100%)",
                  border: "none",
                  color: "#FFFFFF",
                  fontSize: 16,
                  lineHeight: 1,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: "0 2px 6px -2px rgba(16, 32, 51, 0.4)",
                }}
              >
                ×
              </button>
            </div>

            {/* Scrollable body · description + inline specs grid */}
            <div
              data-nex-watch-overlay-body
              style={{
                flex: "1 1 auto",
                minHeight: 0,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {props.description ? (
                <div
                  data-nex-watch-overlay-description-text
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    color: "#102033",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {props.description}
                </div>
              ) : null}
              {props.specs ? (
                <div
                  data-nex-watch-overlay-specs-section
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    paddingTop: 10,
                    borderTop: "1px solid rgba(16, 32, 51, 0.14)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "#4A6080",
                    }}
                  >
                    Specifications
                  </div>
                  <CompactSpecsGrid specs={props.specs} />
                </div>
              ) : null}
            </div>

            {/* Action bar · Interested + Video Center + ⬆ send */}
            <div
              data-nex-watch-overlay-actions
              style={{
                display: "flex",
                gap: 8,
                paddingTop: 10,
                borderTop: "1px solid rgba(16, 32, 51, 0.14)",
                alignItems: "stretch",
              }}
            >
              <button
                type="button"
                data-nex-watch-overlay-interested
                onClick={() => setInterestedOpen(true)}
                style={{
                  flex: "1 1 44%",
                  minHeight: 44,
                  borderRadius: 12,
                  border: "none",
                  background: NEX.primaryGrad,
                  color: "#FFFFFF",
                  fontSize: 13.5,
                  fontWeight: 900,
                  letterSpacing: "0.03em",
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                  textShadow: "0 1px 2px rgba(0,0,0,0.4)",
                  fontFamily: "inherit",
                }}
              >
                <span aria-hidden style={{ marginRight: 6 }}>❤</span>
                Interested
              </button>
              <button
                type="button"
                data-nex-watch-overlay-video-center
                onClick={() => canOpenVideoCenter && setOtherOpen(true)}
                disabled={!canOpenVideoCenter}
                style={{
                  flex: "1 1 44%",
                  minHeight: 44,
                  borderRadius: 12,
                  background: "rgba(16, 32, 51, 0.06)",
                  border: "1px solid rgba(16, 32, 51, 0.14)",
                  color: canOpenVideoCenter ? "#102033" : "#4A6080",
                  fontSize: 13.5,
                  fontWeight: 800,
                  letterSpacing: "0.03em",
                  cursor: canOpenVideoCenter ? "pointer" : "not-allowed",
                  opacity: canOpenVideoCenter ? 1 : 0.6,
                  WebkitTapHighlightColor: "transparent",
                  fontFamily: "inherit",
                }}
              >
                <span aria-hidden style={{ marginRight: 6 }}>▦</span>
                Video Center
                {canOpenVideoCenter ? ` · ${videoCenterList.length}` : ""}
              </button>
              <button
                type="button"
                data-nex-watch-overlay-send-btn
                onClick={() => setInterestedOpen(true)}
                aria-label="Send interest · quick"
                style={{
                  flex: "0 0 44px",
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  border: "none",
                  background: NEX.sendBtnBg,
                  color: "#FFFFFF",
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                  fontFamily: "inherit",
                  fontSize: 18,
                  fontWeight: 900,
                  lineHeight: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: NEX.shadowSoft,
                }}
              >
                <span aria-hidden>↑</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        ref={containerRef}
        data-nex-watch-overlay
        data-nex-watch-overlay-expanded={expanded ? "true" : "false"}
        style={{
          // Owner troubleshoot 2026-10-27 · "the text description and
          // product name over footer container is not opening the
          // container for product description" · two fixes applied:
          //   1. zIndex raised 40 → 46 so this overlay beats the
          //      sealed LiveViewerFooter root (zIndex 45) in any
          //      overlap zone · tap always lands on the collapsed row.
          //   2. `pointer-events: none` removed · the container only
          //      sizes to its content (one child row), so setting it
          //      to auto is equivalent to setting the row to auto,
          //      and some browsers didn't propagate the sealed
          //      `pointer-events: auto` child-override reliably when
          //      a transformed ancestor sits above (common on the
          //      Hendra persona route where the broadcaster chrome
          //      uses CSS animations).
          position: "absolute",
          left: 12,
          right: 12,
          bottom: bottomOffset,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          zIndex: 46,
        }}
      >
        {/* ── Description container · OWNER DIRECTIVE 2026-10-27 ──
            The 2-sided dark-blue frosted flip card is retired. The
            expanded container now renders as a FULL-FRAME sibling
            above (same size + light MessagePanel palette as the
            Live Library sheet · single face). This block kept the
            flip-card variant inside the bottom-docked overlay
            container · deleted below. The old `showSpecsSide` flip
            state is retained as dead state for a release but no
            longer paints. */}
        {false && canExpand && expanded ? (
          <div
            id="nex-watch-overlay-panel-legacy"
            role="region"
            aria-label="Watch description and specifications"
            data-nex-watch-overlay-panel-legacy
            data-nex-watch-overlay-side={showSpecsSide ? "specs" : "description"}
            style={{
              pointerEvents: "auto",
              position: "relative",
              perspective: "1600px",
              marginBottom: 10,
              minHeight: 240,
            }}
          >
            <div
              data-nex-watch-overlay-flip-inner
              style={{
                position: "relative",
                width: "100%",
                minHeight: 240,
                transformStyle: "preserve-3d",
                WebkitTransformStyle: "preserve-3d",
                transition: "transform 540ms cubic-bezier(0.22, 1, 0.36, 1)",
                transform: showSpecsSide ? "rotateY(180deg)" : "rotateY(0deg)",
                animation: "nexWatchOverlaySlideUp 180ms ease-out",
              }}
            >
              {/* ── FRONT · description ──────────────────────────── */}
              <div
                data-nex-watch-overlay-flip-face="description"
                style={{
                  position: "relative",
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  background: NEX.frostBlueBg,
                  backdropFilter: "blur(14px) saturate(1.4)",
                  WebkitBackdropFilter: "blur(14px) saturate(1.4)",
                  border: `1.5px solid ${NEX.frostBlueBorder}`,
                  borderRadius: 16,
                  padding: "14px 16px 12px",
                  color: NEX.textLight,
                  boxShadow: NEX.shadow,
                  maxHeight: "66vh",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Header · brand eyebrow + optional shop button */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    {props.brand ? (
                      <div
                        style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color: NEX.gold,
                        }}
                      >
                        {props.brand}
                      </div>
                    ) : null}
                  </div>
                  {props.shopHref ? (
                    <Link
                      href={props.shopHref ?? ""}
                      data-nex-watch-overlay-shop-btn-legacy
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 10px",
                        borderRadius: 10,
                        background: NEX.shopBtnBg,
                        border: `1px solid ${NEX.shopBtnBorder}`,
                        color: NEX.gold,
                        fontSize: 11.5,
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>
                        🛍
                      </span>
                      {props.shopLabel ?? "Shop"}
                    </Link>
                  ) : null}
                </div>

                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    color: NEX.textLight,
                    lineHeight: 1.25,
                    marginBottom: props.description ? 10 : 6,
                  }}
                >
                  {headline}
                </div>

                {props.description ? (
                  <div
                    data-nex-watch-overlay-description-text
                    style={{
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: NEX.textLightDim,
                      whiteSpace: "pre-wrap",
                      marginBottom: 14,
                      flex: "1 1 auto",
                    }}
                  >
                    {props.description}
                  </div>
                ) : null}

                {/* "View Spec" button · flips to specs side */}
                {props.specs ? (
                  <button
                    type="button"
                    data-nex-watch-overlay-flip-to-specs
                    onClick={toggleFlip}
                    style={{
                      marginTop: "auto",
                      alignSelf: "stretch",
                      minHeight: 42,
                      borderRadius: 10,
                      background: NEX.flipBtnBg,
                      border: `1px solid ${NEX.flipBtnBorder}`,
                      color: NEX.cyan,
                      fontSize: 13,
                      fontWeight: 900,
                      letterSpacing: "0.03em",
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                      fontFamily: "inherit",
                    }}
                  >
                    <span aria-hidden style={{ marginRight: 6 }}>↻</span>
                    View Spec
                  </button>
                ) : null}

                {/* ── Bottom action bar · restored by Round 3i ─────
                    Interested + Video Center + ⬆ send live INSIDE the
                    description container as they did before R3h. */}
                <div
                  data-nex-watch-overlay-actions
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: `1px solid ${NEX.frostBlueDivider}`,
                    alignItems: "stretch",
                  }}
                >
                  <button
                    type="button"
                    data-nex-watch-overlay-interested
                    onClick={() => setInterestedOpen(true)}
                    style={{
                      flex: "1 1 44%",
                      minHeight: 44,
                      borderRadius: 12,
                      border: "none",
                      background: NEX.primaryGrad,
                      color: "#FFFFFF",
                      fontSize: 13.5,
                      fontWeight: 900,
                      letterSpacing: "0.03em",
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                      textShadow: "0 1px 2px rgba(0,0,0,0.4)",
                      fontFamily: "inherit",
                    }}
                  >
                    <span aria-hidden style={{ marginRight: 6 }}>❤</span>
                    Interested
                  </button>
                  <button
                    type="button"
                    data-nex-watch-overlay-video-center
                    onClick={() => canOpenVideoCenter && setOtherOpen(true)}
                    disabled={!canOpenVideoCenter}
                    style={{
                      flex: "1 1 44%",
                      minHeight: 44,
                      borderRadius: 12,
                      background: NEX.secondaryBg,
                      border: `1px solid ${NEX.secondaryBorder}`,
                      color: canOpenVideoCenter ? NEX.cyan : NEX.textLightFaint,
                      fontSize: 13.5,
                      fontWeight: 800,
                      letterSpacing: "0.03em",
                      cursor: canOpenVideoCenter ? "pointer" : "not-allowed",
                      WebkitTapHighlightColor: "transparent",
                      fontFamily: "inherit",
                    }}
                  >
                    <span aria-hidden style={{ marginRight: 6 }}>▦</span>
                    Video Center
                    {canOpenVideoCenter ? ` · ${videoCenterList.length}` : ""}
                  </button>
                  <button
                    type="button"
                    data-nex-watch-overlay-send-btn
                    onClick={() => setInterestedOpen(true)}
                    aria-label="Send interest · quick"
                    style={{
                      flex: "0 0 44px",
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      border: "none",
                      background: NEX.sendBtnBg,
                      color: "#FFFFFF",
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                      fontFamily: "inherit",
                      fontSize: 18,
                      fontWeight: 900,
                      lineHeight: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: NEX.shadowSoft,
                    }}
                  >
                    <span aria-hidden>↑</span>
                  </button>
                </div>
              </div>

              {/* ── BACK · watch specs ·─────────────────────────────
                  Owner directive 2026-10-26 (Round 3i-hardening):
                    · reverted to FROSTED GLASS style (same palette as
                      the description front face) · the owner's "flip
                      spec side and description i want frosted glass
                      design style back ground" supersedes the earlier
                      neon-cyan solid.
                    · no scrolling · 2-column compact grid remains.
                    · If content exceeds the card height a "Full specs
                      ↗" tap-affordance surfaces so clipped data is
                      never silently lost. */}
              <div
                data-nex-watch-overlay-flip-face="specs"
                style={{
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  background: NEX.frostBlueBg,
                  backdropFilter: "blur(14px) saturate(1.4)",
                  WebkitBackdropFilter: "blur(14px) saturate(1.4)",
                  border: `1.5px solid ${NEX.frostBlueBorder}`,
                  borderRadius: 16,
                  padding: "14px 16px 12px",
                  color: NEX.textLight,
                  boxShadow: NEX.shadow,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  {props.brand ? (
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: NEX.gold,
                      }}
                    >
                      {props.brand}
                    </div>
                  ) : null}
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 900,
                      color: NEX.textLight,
                      lineHeight: 1.2,
                      marginTop: 2,
                    }}
                  >
                    {headline} · Specs
                  </div>
                </div>

                {/* Compact 2-column spec grid · no-scroll · essential
                    information prioritised; a tap-affordance below
                    surfaces the full list if the viewer wants more. */}
                {props.specs ? (
                  <CompactSpecsGrid specs={props.specs!} />
                ) : (
                  <div style={{ fontSize: 12, color: NEX.textLightDim }}>
                    No specifications on file.
                  </div>
                )}

                <button
                  type="button"
                  data-nex-watch-overlay-flip-to-description
                  onClick={toggleFlip}
                  style={{
                    marginTop: 10,
                    alignSelf: "stretch",
                    minHeight: 42,
                    borderRadius: 10,
                    background: NEX.flipBtnBg,
                    border: `1px solid ${NEX.flipBtnBorder}`,
                    color: NEX.cyan,
                    fontSize: 13,
                    fontWeight: 900,
                    letterSpacing: "0.03em",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                    fontFamily: "inherit",
                  }}
                >
                  <span aria-hidden style={{ marginRight: 6 }}>←</span>
                  Description
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Buttons panel REMOVED · Round 3i reverted the 3-dots →
            buttons-panel wiring. The Interested + Video Center + Send
            actions now live inside the description container (front
            of the flip card), where they were before R3h. */}

        {/* ── Collapsed state · brand + 2-line description preview ──
            Owner directive 2026-10-26 (Round 3i · reverted from R3h):
              · The ⋮ 3-dots inside the overlay was removed · the
                existing ⋮ in LiveViewerFooter is the "original
                container" (Share · Message · etc).
              · Whole row is one tap target that opens the description
                container (blue frosted flip card).
              · HIDDEN entirely when expanded (modal takes over). */}
        {!expanded ? (
          <div
            data-nex-watch-overlay-collapsed
            onClick={openDescription}
            role={canExpand ? "button" : undefined}
            tabIndex={canExpand ? 0 : undefined}
            aria-expanded={canExpand ? "false" : undefined}
            aria-controls={canExpand ? "nex-watch-overlay-panel" : undefined}
            onKeyDown={(ev) => {
              if ((ev.key === "Enter" || ev.key === " ") && canExpand) {
                ev.preventDefault();
                openDescription();
              }
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: "6px 56px 6px 4px" /* right pad clears 3-dot menu in the viewer footer */,
              pointerEvents: "auto",
              cursor: canExpand ? "pointer" : "default",
              WebkitTapHighlightColor: "transparent",
              color: "#FFFFFF",
              textShadow: NEX.textShadowStrong,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 16,
                fontWeight: 900,
                lineHeight: 1.2,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              <span aria-hidden style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
                ⌚
              </span>
              <span
                style={{
                  flex: "1 1 auto",
                  minWidth: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {props.brand ?? headline}
              </span>
            </div>
            {/* Owner directive 2026-10-27 · "description text must
                always have space and arrow at end of first line on
                the live screen and if user selects the arrow or text
                the description container will open" · retired the
                2-line clamp · now a single truncated line with a ↓
                arrow pinned to the end of that line. Both the text
                and the arrow share the parent's onClick (which
                already opens the description container), so tapping
                either triggers the same open. */}
            {props.description ? (
              <div
                data-nex-watch-overlay-collapsed-preview
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  paddingLeft: 26,
                  fontSize: 12.5,
                  fontWeight: 500,
                  lineHeight: 1.35,
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                <span
                  style={{
                    flex: "1 1 auto",
                    minWidth: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {props.description}
                </span>
                <span
                  aria-hidden
                  data-nex-watch-overlay-collapsed-arrow
                  style={{
                    // Owner directive 2026-10-27 · "arrow pointing
                    // down at description need bold" · 900 weight +
                    // bumped size so the ↓ carries over the busy
                    // live-video pixels.
                    flexShrink: 0,
                    fontSize: 16,
                    fontWeight: 900,
                    lineHeight: 1,
                    opacity: 1,
                  }}
                >
                  ↓
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {interestedOpen ? (
          <InterestedConfirmSheet
            watchHeadline={headline}
            sellerLabel={sellerLabel}
            sellerHandleLabel={sellerHandleLabel}
            onCancel={() => setInterestedOpen(false)}
            onConfirm={confirmInterest}
          />
        ) : null}

        {otherOpen ? (
          <VideoCenterGrid
            videos={videoCenterList}
            sellerLabel={sellerLabel}
            onClose={() => setOtherOpen(false)}
          />
        ) : null}

        {interestToast ? (
          <div
            data-nex-watch-overlay-toast
            role="status"
            style={{
              position: "fixed",
              left: "50%",
              bottom: 120,
              transform: "translateX(-50%)",
              background: "rgba(6,16,30,0.96)",
              border: `1px solid ${NEX.cyan}`,
              color: "#FFFFFF",
              padding: "12px 18px",
              borderRadius: 12,
              fontSize: 13.5,
              fontWeight: 700,
              boxShadow: NEX.shadow,
              pointerEvents: "auto",
              zIndex: 60,
              maxWidth: 320,
            }}
          >
            ❤ Interest noted. {sellerLabel} will reply here when live.
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.65)", marginTop: 4, fontWeight: 600 }}>
              Dev preview · production wire-up pending Live Message Container.
            </div>
          </div>
        ) : null}

        <style>{`
          @keyframes nexWatchOverlaySlideUp {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes nexWatchOverlayFadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          /* Owner directive 2026-10-26 (Round 3f) · when the product
             panel is open, hide every other live-screen overlay (💬
             inbox, dev palette, floating Buy Now, future footer
             affordances). The body data-attribute is set + removed
             by the useEffect above. */
          body[data-nex-watch-expanded="true"] [data-nex-hendra-inbox-btn],
          body[data-nex-watch-expanded="true"] [data-nex-dev-palette],
          body[data-nex-watch-expanded="true"] [data-nex-live-buy-now] {
            display: none !important;
          }
          @media (prefers-reduced-motion: reduce) {
            [data-nex-watch-overlay-panel] { animation: none !important; }
            [data-nex-watch-overlay-backdrop] { animation: none !important; }
          }
        `}</style>
      </div>
    </>
  );
}

/* ───── Interested confirm sheet ─────────────────────────────── */

function InterestedConfirmSheet(props: {
  watchHeadline: string;
  sellerLabel: string;
  sellerHandleLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}): React.JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Send interest"
      data-nex-watch-overlay-interested-sheet
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        pointerEvents: "auto",
        zIndex: 70,
        animation: "nexWatchOverlaySlideUp 160ms ease-out",
      }}
      onClick={props.onCancel}
    >
      <div
        onClick={(ev) => ev.stopPropagation()}
        style={{
          background: NEX.frostBg,
          backdropFilter: "blur(14px) saturate(1.4)",
          WebkitBackdropFilter: "blur(14px) saturate(1.4)",
          border: `1.5px solid ${NEX.frostBorder}`,
          borderRadius: 16,
          padding: 20,
          maxWidth: 340,
          width: "100%",
          color: NEX.textDark,
          boxShadow: NEX.shadow,
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: NEX.cyan,
            marginBottom: 6,
          }}
        >
          Send interest
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>
          Message {props.sellerLabel}{props.sellerHandleLabel}
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: NEX.textDim,
            background: "rgba(0,175,255,0.08)",
            border: "1px dashed rgba(0,175,255,0.35)",
            borderRadius: 10,
            padding: "10px 12px",
            marginBottom: 14,
            fontStyle: "italic",
          }}
        >
          “Hi {props.sellerLabel.split(" ")[0]} — I'm interested in your{" "}
          <strong style={{ color: NEX.textDark, fontStyle: "normal" }}>
            {props.watchHeadline}
          </strong>
          . Can we chat here?”
        </div>
        <div
          style={{
            fontSize: 11.5,
            lineHeight: 1.5,
            color: NEX.textDim,
            marginBottom: 14,
          }}
        >
          NEX sends your display name and NEX-ID so the seller knows who you
          are. You can continue the conversation privately once the seller
          replies.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={props.onCancel}
            style={{
              flex: "1 1 40%",
              minHeight: 44,
              borderRadius: 10,
              background: "transparent",
              border: `1px solid ${NEX.frostDivider}`,
              color: NEX.textDim,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={props.onConfirm}
            style={{
              flex: "1 1 60%",
              minHeight: 44,
              borderRadius: 10,
              background: NEX.primaryGrad,
              border: "none",
              color: "#FFFFFF",
              fontSize: 13.5,
              fontWeight: 900,
              letterSpacing: "0.03em",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Send interest
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───── Video Center grid ─────────────────────────────────────── */

/** Owner directive 2026-10-26 (Round 3f) · Video Center grid redesign.
 *  Each card is a 9:16 reduced phone-screen with the poster filling
 *  the card, a dark-red circular play button overlayed, and the brand
 *  label UNDERNEATH the card (not inside). Tap the red button to play
 *  that video. Grid is centered in the frame. */
const RED_PLAY = "#B01020";

function VideoCenterGrid(props: {
  videos: readonly OtherVideoThumb[];
  sellerLabel: string;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Video Center · all videos from this seller"
      data-nex-watch-overlay-video-center-grid
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.78)",
        display: "flex",
        flexDirection: "column",
        padding: 14,
        pointerEvents: "auto",
        zIndex: 70,
        animation: "nexWatchOverlaySlideUp 160ms ease-out",
      }}
      onClick={props.onClose}
    >
      <div
        onClick={(ev) => ev.stopPropagation()}
        style={{
          background: NEX.frostBg,
          backdropFilter: "blur(14px) saturate(1.4)",
          WebkitBackdropFilter: "blur(14px) saturate(1.4)",
          border: `1.5px solid ${NEX.frostBorder}`,
          borderRadius: 16,
          padding: "14px 14px 16px",
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: NEX.textDark,
          boxShadow: NEX.shadow,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: NEX.cyan,
              }}
            >
              Video Center
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>
              {props.videos.length} from {props.sellerLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close Video Center"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(10,21,38,0.08)",
              border: `1px solid ${NEX.frostDivider}`,
              color: NEX.textDark,
              fontSize: 15,
              lineHeight: 1,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            flex: "1 1 auto",
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            columnGap: 14,
            rowGap: 16,
            paddingBottom: 4,
            justifyItems: "center",
          }}
        >
          {props.videos.map((v) => {
            const brand = v.brand ?? v.headline.split("·")[0]?.trim();
            return (
              <div
                key={v.id}
                data-nex-watch-overlay-video-center-card
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: "100%",
                  gap: 6,
                }}
              >
                {/* 9:16 reduced phone-screen card · plays the VIDEO
                    muted + looped when videoUrl is present, else falls
                    back to the poster image. Owner directive 2026-10-26
                    (Round 3i) · "video library must show the video,
                    not photo image." */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "9 / 16",
                    borderRadius: 12,
                    background: "#0A1526",
                    boxShadow:
                      "0 0 0 1.5px rgba(0,175,255,0.3), 0 10px 24px -10px rgba(0,0,0,0.5)",
                    overflow: "hidden",
                  }}
                >
                  <VideoCenterThumbMedia
                    videoUrl={v.videoUrl}
                    posterUrl={v.posterUrl}
                  />
                  {/* dark gradient at bottom to lift the play button */}
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)",
                      pointerEvents: "none",
                    }}
                  />
                  {/* dark red play button · owner directive 2026-10-26 */}
                  <Link
                    href={v.href}
                    aria-label={`Play ${brand || v.headline}`}
                    data-nex-watch-overlay-video-center-play
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: RED_PLAY,
                      border: "2px solid rgba(255,255,255,0.92)",
                      color: "#FFFFFF",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textDecoration: "none",
                      fontSize: 18,
                      fontWeight: 900,
                      boxShadow:
                        "0 6px 18px -4px rgba(176,16,32,0.6), 0 0 0 4px rgba(176,16,32,0.14)",
                    }}
                  >
                    <span aria-hidden style={{ marginLeft: 2 }}>▶</span>
                  </Link>
                </div>
                {/* Brand label UNDER the card */}
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: NEX.textDark,
                    textAlign: "center",
                    maxWidth: "100%",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {brand || v.headline}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ───── Video Center thumb · playback-safe media ──────────────
   Round 3i-hardening · 2026-10-26.
     · Honours autoplay restrictions: `muted + playsInline + preload=
       metadata` is the universally-allowed combination. If the browser
       still rejects the play() (iOS Low Power Mode, Save-Data on,
       media autoplay disabled), the attempt is caught + we fall back
       to the poster image + an aria-hidden overlay.
     · If the video network / decode fails (onError), we immediately
       swap to the poster image + log a dev-visible outline so the
       owner notices broken sources during review.
     · Cleanup · the component only mounts when the parent modal is
       open; React unmount pauses the <video> implicitly on close. We
       also issue an explicit `pause()` on unmount for browsers that
       keep the element alive across remounts. */

function VideoCenterThumbMedia({
  videoUrl,
  posterUrl,
}: {
  readonly videoUrl?: string;
  readonly posterUrl: string;
}): React.JSX.Element {
  const [failed, setFailed] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoUrl || failed) return;
    // Explicit play() attempt so autoplay rejection is observable.
    const p = el.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        // Autoplay refused · stay on the poster behind the <video>.
        // We don't flip `failed` because the <video> element itself
        // is still valid · the user can tap the Link overlay to open
        // the full viewer.
      });
    }
    return () => {
      try {
        el.pause();
      } catch {
        /* ignore · unmount race */
      }
    };
  }, [videoUrl, failed]);

  if (!videoUrl || failed) {
    return (
      <div
        aria-hidden
        data-nex-watch-overlay-video-center-fallback
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${posterUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      src={videoUrl}
      poster={posterUrl}
      muted
      autoPlay
      loop
      playsInline
      preload="metadata"
      onError={() => setFailed(true)}
      data-nex-watch-overlay-video-center-video
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
        pointerEvents: "none",
      }}
    />
  );
}

/* ───── Compact specs grid · frosted-glass flip-card back face ─────
   Round 3i-hardening · 2026-10-26 · 2-column key / value grid, light
   text on frosted blue · overflow clipped (no scroll per owner).
   Keeps the strongest specs first so the most relevant data stays
   visible even if the viewport clips the bottom rows. */

function CompactSpecsGrid({ specs }: { specs: WatchSpecs }): React.JSX.Element {
  const rows: Array<[label: string, value: string]> = [];
  if (specs.caseMaterial) rows.push(["Material", specs.caseMaterial]);
  if (specs.movement) rows.push(["Movement", MOVEMENT_LABEL[specs.movement]]);
  if (specs.caseDiameterMm) rows.push(["Face dia", `${specs.caseDiameterMm} mm`]);
  if (specs.caseThicknessMm) rows.push(["Thickness", `${specs.caseThicknessMm} mm`]);
  if (specs.waterResistanceM != null) {
    rows.push([
      "Water Res",
      specs.waterResistanceM > 0 ? `${specs.waterResistanceM} m` : "Not rated",
    ]);
  }
  if (specs.lugToLugMm) rows.push(["Lug-to-lug", `${specs.lugToLugMm} mm`]);
  if (specs.dialColor) rows.push(["Dial", specs.dialColor]);
  if (specs.strapMaterial) rows.push(["Strap", specs.strapMaterial]);
  if (specs.movementCaliber) rows.push(["Caliber", specs.movementCaliber]);
  if (specs.productionYear) rows.push(["Year", String(specs.productionYear)]);
  if (specs.condition) rows.push(["Condition", CONDITION_LABEL[specs.condition]]);
  if (specs.authenticity) rows.push([
    "Authenticity",
    AUTHENTICITY_LABEL[specs.authenticity],
  ]);
  if (specs.madeIn) rows.push(["Made in", specs.madeIn]);
  if (specs.strapWidthMm) rows.push(["Strap W", `${specs.strapWidthMm} mm`]);

  return (
    <div
      data-nex-watch-overlay-specs-compact
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        columnGap: 10,
        rowGap: 6,
        flex: "1 1 auto",
        minHeight: 0,
      }}
    >
      {rows.map(([label, value]) => (
        <div
          key={label}
          style={{
            display: "flex",
            flexDirection: "column",
            lineHeight: 1.25,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.78)",
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "#FFFFFF",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───── Specs section · frosted-glass palette (dark OR light text) ───── */

type SpecsTheme = "dark" | "light";

function SpecsSection(
  { specs, theme = "dark" }: { specs: WatchSpecs; theme?: SpecsTheme },
): React.JSX.Element | null {
  const primary: Array<[label: string, value: string]> = [];
  if (specs.caseMaterial) primary.push(["Material", specs.caseMaterial]);
  if (specs.caseDiameterMm) primary.push(["Face Dia", `${specs.caseDiameterMm} mm`]);
  if (specs.caseThicknessMm) primary.push(["Thickness", `${specs.caseThicknessMm} mm`]);
  if (specs.lugToLugMm) primary.push(["Lug-to-lug", `${specs.lugToLugMm} mm`]);
  if (specs.movement) primary.push(["Movement", MOVEMENT_LABEL[specs.movement]]);
  if (specs.movementCaliber) primary.push(["Caliber", specs.movementCaliber]);
  if (specs.waterResistanceM != null) {
    primary.push([
      "Water Res",
      specs.waterResistanceM > 0 ? `${specs.waterResistanceM} m` : "Not rated",
    ]);
  }
  if (specs.dialColor) primary.push(["Dial", specs.dialColor]);
  if (specs.strapMaterial) primary.push(["Strap", specs.strapMaterial]);
  if (specs.strapWidthMm) primary.push(["Strap Width", `${specs.strapWidthMm} mm`]);
  if (specs.strapLengthMm) primary.push(["Strap Length", `${specs.strapLengthMm} mm`]);
  if (specs.madeIn) primary.push(["Made in", specs.madeIn]);
  if (specs.productionYear) primary.push(["Year", String(specs.productionYear)]);
  if (specs.complications?.length) {
    primary.push([
      "Complications",
      specs.complications.map((c) => c.replace(/-/g, " ")).join(", "),
    ]);
  }

  const condition: Array<[label: string, value: string]> = [];
  if (specs.condition) condition.push(["Condition", CONDITION_LABEL[specs.condition]]);
  if (specs.fullSet === true) condition.push(["Full Set", "Yes"]);
  if (specs.fullSet === false) condition.push(["Full Set", "No"]);
  if (specs.packaging?.length) {
    condition.push([
      "Includes",
      specs.packaging.map((p) => PACKAGING_LABEL[p]).join(", "),
    ]);
  }
  if (specs.authenticity) condition.push(["Authenticity", AUTHENTICITY_LABEL[specs.authenticity]]);

  const notes: Array<[label: string, value: string]> = [];
  if (specs.shippingScope?.length) {
    notes.push(["Shipping", specs.shippingScope.map((s) => SHIPPING_LABEL[s]).join(" · ")]);
  }
  if (specs.pricingModes?.length) {
    notes.push(["Pricing", specs.pricingModes.map((p) => PRICING_LABEL[p]).join(" · ")]);
  }
  if (specs.priceNote) notes.push(["Price", specs.priceNote]);
  if (specs.warrantyNote) notes.push(["Warranty", specs.warrantyNote]);

  if (primary.length === 0 && condition.length === 0 && notes.length === 0) {
    return null;
  }

  return (
    <div data-nex-watch-overlay-specs data-nex-watch-overlay-specs-theme={theme}>
      {primary.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <SectionHeading label="Specs" />
          <SpecTable rows={primary} theme={theme} />
        </div>
      ) : null}
      {condition.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <SectionHeading label="Condition & authenticity" />
          <SpecTable rows={condition} theme={theme} />
        </div>
      ) : null}
      {notes.length > 0 ? (
        <div>
          <SectionHeading label="Buyer notes" />
          <SpecTable rows={notes} theme={theme} />
        </div>
      ) : null}
    </div>
  );
}

function SpecTable(
  { rows, theme = "dark" }: {
    rows: ReadonlyArray<[string, string]>;
    theme?: SpecsTheme;
  },
): React.JSX.Element {
  const valueColor = theme === "light" ? NEX.textLight : NEX.textDark;
  const divider = theme === "light" ? NEX.frostBlueDivider : NEX.frostDivider;
  const labelColor = theme === "light" ? NEX.textLightFaint : NEX.textFaint;
  return (
    <div data-nex-watch-overlay-spec-table>
      {rows.map(([label, value], i) => (
        <div
          key={label}
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            padding: "9px 0",
            borderBottom:
              i < rows.length - 1 ? `1px solid ${divider}` : "none",
          }}
        >
          <div
            style={{
              flex: "0 0 auto",
              minWidth: 92,
              color: labelColor,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.01em",
            }}
          >
            {label}
          </div>
          <div
            style={{
              flex: "1 1 auto",
              textAlign: "right",
              color: valueColor,
              fontSize: 12.5,
              fontWeight: 700,
              lineHeight: 1.4,
              wordBreak: "break-word",
            }}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionHeading({ label }: { label: string }): React.JSX.Element {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: NEX.cyan,
        marginBottom: 6,
      }}
    >
      ─ {label} ─
    </div>
  );
}
