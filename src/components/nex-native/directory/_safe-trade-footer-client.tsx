"use client";

// src/components/nex-native/directory/_safe-trade-footer-client.tsx
//
// NEX Directory · Safe Trade footer button + lightweight info sheet.
// Owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Replaces the category-label footer on directory cards per the owner
// directive 2026-10-18. Two concerns in one primitive:
//
//   1. Trust-forward footer: a 🔒 Safe Trade label + chevron. Lives
//      INSIDE the card's enclosing <Link> but captures its own clicks
//      so a tap on the footer opens an info sheet instead of
//      navigating to the business cover page. Tapping the card body
//      / image still navigates (unchanged).
//
//   2. Lightweight info sheet: GENERIC "What is Safe Trade?" copy ·
//      not the sealed per-business trust-evaluation sheet at
//      /profile/[handle]/_safe-trade-sheet.tsx. Resolving the sealed
//      sheet per card would require N server-side snapshot fetches
//      per directory render (every business needs its own
//      SafeTradeSnapshot) · at feed scale that's prohibitive. The
//      honest alternative: a general-education popup here + a "View
//      this business" CTA that navigates to the business cover page
//      where the full sealed sheet is already wired.
//
// Honesty guarantees upheld:
//   · Never fabricate business-specific trust claims in this popup ·
//     no "verified" / "disputes" counts · no per-business status.
//   · "View this business" is the escape hatch · users who want
//     per-business trust data land on the business cover page where
//     the full sealed Safe Trade sheet operates on real snapshot data.

import * as React from "react";

const NEX = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  panel: "#071525",
  panelBorder: "rgba(0, 175, 255, 0.28)",
  bg: "rgba(2, 9, 20, 0.85)",
  divider: "rgba(0, 175, 255, 0.18)",
};

interface Props {
  /** The sealed destination the card already routes to · reused here
   *  as the sheet's "View This Business" CTA. */
  readonly businessHref: string;
}

export function SafeTradeFooterClient({ businessHref }: Props) {
  const [open, setOpen] = React.useState(false);

  // Esc closes the sheet.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Button handler · preventDefault + stopPropagation so the
  // enclosing <Link> doesn't navigate when the user taps the footer.
  const onButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  // Backdrop handler · same stop-propagation story so a tap outside
  // the sheet closes it without triggering the card's navigation.
  const onBackdropClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={onButtonClick}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-nex-safe-trade-footer
        style={footerButtonStyle}
      >
        <span style={lockGlyphStyle} aria-hidden>
          <LockGlyph />
        </span>
        <span style={labelStyle}>Safe Trade</span>
        <span style={chevronStyle} aria-hidden>
          ›
        </span>
      </button>

      {open ? (
        <>
          <div
            role="presentation"
            onClick={onBackdropClick}
            data-nex-safe-trade-sheet-backdrop
            style={backdropStyle}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="About NEX Safe Trade"
            data-nex-safe-trade-sheet
            onClick={(e) => e.stopPropagation()}
            style={sheetStyle}
          >
            <header style={sheetHeaderStyle}>
              <span style={sheetHeaderIconStyle} aria-hidden>
                <LockGlyph />
              </span>
              <h3 style={sheetTitleStyle}>Safe Trade on NEX</h3>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                }}
                aria-label="Close"
                style={closeButtonStyle}
                data-nex-safe-trade-sheet-close
              >
                ×
              </button>
            </header>

            <div style={sheetBodyStyle}>
              <p style={paragraphStyle}>
                NEX helps buyers and sellers trade with confidence.
                Businesses listed in the NEX Directory are visible,
                reachable, and chat-first · you talk to the seller
                before you buy.
              </p>
              <ul style={bulletListStyle}>
                <li style={bulletItemStyle}>
                  <span style={bulletBulletStyle}>•</span>
                  <span>
                    <strong style={bulletStrongStyle}>Chat first</strong> ·
                    message the seller to confirm details before any
                    payment.
                  </span>
                </li>
                <li style={bulletItemStyle}>
                  <span style={bulletBulletStyle}>•</span>
                  <span>
                    <strong style={bulletStrongStyle}>Open the shop</strong> ·
                    see verified identity, hours, and location on the
                    business profile.
                  </span>
                </li>
                <li style={bulletItemStyle}>
                  <span style={bulletBulletStyle}>•</span>
                  <span>
                    <strong style={bulletStrongStyle}>Report problems</strong> ·
                    tap the report flag on any business profile if
                    something feels off. We review every report.
                  </span>
                </li>
              </ul>
              <p style={footnoteStyle}>
                NEX never handles payments or escrow directly ·
                Safe Trade is about honest discovery, identity, and
                feedback. Full business-specific trust info lives on
                each business page.
              </p>
            </div>

            <div style={sheetActionsStyle}>
              {/* Owner directive 2026-10-18 (iteration) · CTA label
                  is simply "View This Business" with the arrow ·
                  the previous "· {businessName}" tail looked weird
                  because the title today often carries a product /
                  offering name (e.g. "Noise-Cancelling Pro"), not
                  a business name. Clean label, same destination. */}
              <a
                href={businessHref}
                style={primaryCtaStyle}
                data-nex-safe-trade-sheet-cta
              >
                View This Business
                <span aria-hidden style={ctaArrowStyle}>→</span>
              </a>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

function LockGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2"
        stroke={NEX.cyan}
        strokeWidth="1.8"
        fill="none"
      />
      <path
        d="M8 11 V8 a4 4 0 0 1 8 0 v3"
        stroke={NEX.cyan}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="12" cy="16" r="1.4" fill={NEX.cyan} />
    </svg>
  );
}

// Footer button styling · matches the retired CategoryFooter visual
// rhythm (same height, chevron on the right, hairline divider sits
// in the card body above it via existing cardShellStyle borders).
const footerButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  minHeight: 36,
  padding: "0 12px",
  background: "transparent",
  border: "none",
  borderTop: `1px solid ${NEX.divider}`,
  color: NEX.text,
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "left",
  WebkitTapHighlightColor: "transparent",
};
const lockGlyphStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 20,
  height: 20,
  flexShrink: 0,
};
const labelStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  color: NEX.cyan,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.3,
  textTransform: "none",
};
const chevronStyle: React.CSSProperties = {
  color: NEX.textDim,
  fontSize: 16,
  lineHeight: 1,
};

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  zIndex: 90,
};
const sheetStyle: React.CSSProperties = {
  position: "fixed",
  left: "50%",
  bottom: 0,
  transform: "translateX(-50%)",
  width: "100%",
  maxWidth: 420,
  background: NEX.panel,
  color: NEX.text,
  borderTop: `1px solid ${NEX.panelBorder}`,
  borderRadius: "16px 16px 0 0",
  padding: "14px 14px calc(env(safe-area-inset-bottom, 0px) + 14px)",
  zIndex: 91,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  boxShadow: "0 -20px 48px rgba(0,0,0,0.55)",
};
const sheetHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};
const sheetHeaderIconStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 8,
  background: NEX.cyanFaint,
};
const sheetTitleStyle: React.CSSProperties = {
  flex: 1,
  margin: 0,
  color: NEX.text,
  fontSize: 15,
  fontWeight: 800,
  letterSpacing: 0.2,
};
// Owner directive 2026-10-18 (iteration) · close button is now a
// solid NEX cyan chip · matches the sealed drawer-close affordance
// we shipped on the welcome-side drawer and keeps the visual
// language consistent across sliders.
const closeButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  borderRadius: 999,
  background: NEX.cyan,
  border: "none",
  color: "#0a0608",
  fontSize: 18,
  fontWeight: 800,
  lineHeight: 1,
  cursor: "pointer",
  fontFamily: "inherit",
  boxShadow: `0 6px 14px -6px ${NEX.cyan}`,
  WebkitTapHighlightColor: "transparent",
};
const sheetBodyStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};
const paragraphStyle: React.CSSProperties = {
  margin: 0,
  color: NEX.textDim,
  fontSize: 13,
  lineHeight: 1.5,
};
const bulletListStyle: React.CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};
const bulletItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  color: NEX.textDim,
  fontSize: 13,
  lineHeight: 1.4,
};
const bulletBulletStyle: React.CSSProperties = {
  color: NEX.cyan,
  fontSize: 16,
  lineHeight: 1,
  flexShrink: 0,
};
const bulletStrongStyle: React.CSSProperties = {
  color: NEX.text,
  fontWeight: 700,
};
const footnoteStyle: React.CSSProperties = {
  margin: 0,
  color: NEX.textMuted,
  fontSize: 11,
  lineHeight: 1.4,
  fontStyle: "italic",
};
const sheetActionsStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  paddingTop: 6,
  borderTop: `1px solid ${NEX.divider}`,
};
const primaryCtaStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: 44,
  padding: "0 16px",
  background: NEX.cyan,
  color: "#0a0608",
  borderRadius: 10,
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: 0.4,
};
const ctaArrowStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  lineHeight: 1,
};
