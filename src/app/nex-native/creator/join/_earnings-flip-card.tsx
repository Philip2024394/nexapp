"use client";

// src/app/nex-native/creator/join/_earnings-flip-card.tsx
//
// Flip card on the Creator join landing. Owner directive 2026-11-04
// later-same-day · Phase U Option A.
//
// Front  · "Earn from what you love" · 8 bullets · "See monetisation & rates" trigger
// Back   · "Creator monetisation" · three clearly separated categories
//          (membership fee TO NEX · Creator earnings FROM fans · sponsorship
//          bookings FROM businesses) · condensed cancellation rules ·
//          "Back to overview" trigger
//
// Three distinctions preserved from the owner note:
//   1. "Keep 100%" is attached to NEX commission only · Stripe/PayPal
//      processing fees may still apply (surfaced on both sides).
//   2. "Sponsorship placement" (not "banner") throughout.
//   3. NEX sets standardised rates to keep opportunities fair.
//
// Legal note surfaced: the EU/Irish 14-day withdrawal period for digital
// services applies to the annual membership · not a blanket "no refunds".
//
// Sponsorship-after-cancel rule: once a sponsor's booking is paid, the
// placement runs to its booked end date even if the Creator cancels
// their membership. Business commercial agreement is independent of
// Creator membership state.

import { useState } from "react";

const IRELAND = {
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  primary: "var(--nex-world-primary, #1B5138)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  primaryInk: "var(--nex-world-primary-ink, #AFC5B5)",
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  panel: "rgba(27, 81, 56, 0.55)",
  borderSoft: "rgba(198, 161, 91, 0.35)",
};

const INCLUDED: readonly string[] = [
  "Receive support from fans during your live streams.",
  "Earn from company sponsorships displayed on your feeds.",
  "Let fans pay to use your music tracks and videos on NEX.",
  "Earn your Creator badge when you reach 5 published tracks or 5 published videos.",
  "Receive payments directly through your connected Stripe or PayPal account.",
  "0% NEX commission on Creator earnings.",
  "NEX sets standard sponsorship rates to keep opportunities fair for every Creator.",
  // Owner directive 2026-11-04 later-same-day (fourth pass) · "Cancel
  // renewal at any time" makes clear that cancellation does NOT
  // immediately end paid benefits. Full cancellation + refund rules
  // live in the Terms & Conditions.
  "Cancel renewal at any time.",
];

// Sponsor price table retired from this surface 2026-11-04 later-same-day
// (eighth pass). The rates + prohibited-content eligibility live on the
// Creator Terms & Conditions page instead. Keeping them off the pitch
// surface keeps the copy commercial and lets the legal detail sit where
// the solicitor has control.

const PANEL_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  padding: "20px 22px",
  borderRadius: 16,
  background: IRELAND.panel,
  border: `1px solid ${IRELAND.borderSoft}`,
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
  overflowY: "auto",
  boxSizing: "border-box",
};

const SECTION_HEADER: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 11,
  fontWeight: 800,
  color: IRELAND.secondary,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

const SUB_HEADER: React.CSSProperties = {
  margin: "14px 0 6px",
  fontSize: 12,
  fontWeight: 800,
  color: IRELAND.textPrimary,
  letterSpacing: "0.02em",
};

const TRIGGER_STYLE: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 14,
  padding: "11px 16px",
  borderRadius: 999,
  background: "transparent",
  color: IRELAND.secondary,
  border: `1.5px solid ${IRELAND.secondary}66`,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  cursor: "pointer",
  fontFamily: "inherit",
};

export function EarningsFlipCard(): React.ReactElement {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      data-nex-creator-flip-card
      data-nex-flip-state={flipped ? "back" : "front"}
      style={{
        margin: "20px 0 0",
        perspective: "1400px",
      }}
    >
      <div
        role="group"
        aria-label="Creator overview · tap to flip for monetisation details"
        style={{
          position: "relative",
          minHeight: 620,
          transformStyle: "preserve-3d",
          WebkitTransformStyle: "preserve-3d",
          transition: "transform 650ms cubic-bezier(0.16, 0.84, 0.44, 1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* ─── Front · Earn from what you love ─── */}
        <section
          data-nex-flip-side="front"
          aria-hidden={flipped}
          style={PANEL_STYLE}
        >
          <h2 style={SECTION_HEADER}>Earn from what you love</h2>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {INCLUDED.map((t) => (
              <li
                key={t}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  fontSize: 14,
                  color: IRELAND.textPrimary,
                  lineHeight: 1.45,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    color: IRELAND.secondary,
                    fontWeight: 900,
                    flexShrink: 0,
                  }}
                >
                  •
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setFlipped(true)}
            data-nex-flip-trigger="to-back"
            style={TRIGGER_STYLE}
            tabIndex={flipped ? -1 : 0}
          >
            See monetisation & rates →
          </button>
        </section>

        {/* ─── Back · Creator monetisation ─── */}
        <section
          data-nex-flip-side="back"
          aria-hidden={!flipped}
          style={{
            ...PANEL_STYLE,
            transform: "rotateY(180deg)",
          }}
        >
          <h2 style={SECTION_HEADER}>Creator monetisation</h2>

          {/* Earnings streams · owner directive 2026-11-04 later-same-day
              (twelfth pass) · the three numbered sections (membership
              pricing · earnings mechanics with rates · sponsorship
              rates) are retired from this surface. Back side now shows
              just the earning streams Creators can make money from.
              Full detail lives on the Creator Terms & Conditions page
              (§23 of /about/terms) · pricing and legal mechanics stay
              with the solicitor-reviewed document. */}
          <p
            style={{
              margin: "0 0 12px",
              fontSize: 13,
              color: IRELAND.primaryInk,
              lineHeight: 1.5,
            }}
          >
            What you can earn from on NEX:
          </p>
          <ul
            data-nex-earning-streams
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              fontSize: 14,
              color: IRELAND.textPrimary,
              lineHeight: 1.5,
            }}
          >
            {[
              "Fan support · Buy me a coffee",
              "Live streaming income",
              "Fans paying to use your audio or video on NEX",
              "Sponsorship for ads on your feed",
            ].map((t) => (
              <li
                key={t}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    color: IRELAND.secondary,
                    fontWeight: 900,
                    flexShrink: 0,
                  }}
                >
                  •
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>

          {/* Income-potential summary · owner directive 2026-11-04 later-
              same-day (eleventh pass) · displayed at the end of the
              container · reinforces the headline value prop before the
              flip-back trigger. */}
          <div
            data-nex-creator-income-summary
            style={{
              margin: "22px 0 0",
              padding: "14px 16px",
              borderRadius: 12,
              background: `${IRELAND.secondary}14`,
              border: `1.5px solid ${IRELAND.secondary}66`,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: IRELAND.secondary,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Creator accounts
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: IRELAND.textPrimary,
                letterSpacing: "-0.01em",
                lineHeight: 1.35,
              }}
            >
              €4.99 per month · <span style={{ color: IRELAND.secondary }}>Keep 100% of your earnings</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setFlipped(false)}
            data-nex-flip-trigger="to-front"
            style={TRIGGER_STYLE}
            tabIndex={flipped ? 0 : -1}
          >
            ← Back to overview
          </button>
        </section>
      </div>
    </div>
  );
}
