// src/app/nex-native/creator/[handle]/_sponsor-slot.tsx
//
// Sponsor slot · owner directive 2026-11-04 later-same-day · Phase U.
//
// Compact sponsored-by banner sitting top-right under the page header on
// a Creator's public page. Below the banner, a click-through link to the
// sponsor's own page. When no active sponsorship, the slot renders
// NOTHING (no empty placeholder taking space).
//
// Phase U: sponsor data is MOCKED inline. Real sponsorship booking flow
// (nex_sponsorship_booking table · booking lifecycle · expiry
// enforcement · conflict resolution) is Phase 2 per the Phase 1
// decision doc §A.6. When Phase 2 lands, this component reads the
// active sponsor row for the handle and renders the real data. UI
// shape does not change.
//
// Rules this slot honours (from doc §B.5):
//   · Paid sponsor placements run to their booked end date regardless
//     of the Creator's membership state
//   · One active sponsor per Creator at any time (slot is single-tenant)
//   · Link routes to the sponsor's page · tracked via data attr for
//     future analytics

import Link from "next/link";

interface SponsorSlotProps {
  readonly creatorHandle: string;
}

const IRELAND = {
  secondary: "var(--nex-world-secondary, #C6A15B)",
  primaryInk: "var(--nex-world-primary-ink, #AFC5B5)",
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  panel: "rgba(27, 81, 56, 0.55)",
  borderSoft: "rgba(198, 161, 91, 0.35)",
};

// Phase U · mocked sponsor data. When Phase 2 arrives, replace this
// with a real query against nex_sponsorship_booking filtered by:
//   · creator_account_id = (resolved from creatorHandle)
//   · now() BETWEEN started_at AND expires_at
//   · status = 'active'
// Null result → no slot rendered.
function resolveMockSponsor(creatorHandle: string):
  | {
      readonly sponsorName: string;
      readonly sponsorHref: string;
      readonly sponsorTagline: string | null;
    }
  | null {
  // Phase U placeholder · only Irish Pride (nex-99901) shows a sponsor
  // so other creators don't accidentally display a fake. Owner can
  // demo the slot by viewing nex-99901's page.
  if (creatorHandle.toLowerCase() === "nex-99901") {
    return {
      sponsorName: "Craic & Co. · Cork",
      sponsorHref: "/nex-native/coming-soon?feature=sponsor-page",
      sponsorTagline: "Irish folk sessions · open every night",
    };
  }
  return null;
}

export function SponsorSlot({ creatorHandle }: SponsorSlotProps): React.ReactElement | null {
  const sponsor = resolveMockSponsor(creatorHandle);
  if (!sponsor) return null;

  return (
    <aside
      data-nex-creator-sponsor-slot
      data-nex-sponsor-name={sponsor.sponsorName}
      aria-label="Sponsored placement"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 6,
        minWidth: 0,
        maxWidth: 180,
      }}
    >
      {/* Compact sponsored-by badge */}
      <div
        data-nex-sponsor-badge
        style={{
          padding: "8px 10px",
          borderRadius: 10,
          background: IRELAND.panel,
          border: `1px solid ${IRELAND.borderSoft}`,
          boxShadow: `0 2px 8px rgba(0,0,0,0.15)`,
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: IRELAND.secondary,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          Sponsored
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: IRELAND.textPrimary,
            letterSpacing: "-0.01em",
            lineHeight: 1.25,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {sponsor.sponsorName}
        </div>
        {sponsor.sponsorTagline ? (
          <div
            style={{
              marginTop: 2,
              fontSize: 10,
              color: IRELAND.primaryInk,
              opacity: 0.85,
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as const,
            }}
          >
            {sponsor.sponsorTagline}
          </div>
        ) : null}
      </div>

      {/* Click-through link UNDER the badge */}
      <Link
        href={sponsor.sponsorHref}
        data-nex-sponsor-cta
        style={{
          padding: "6px 10px",
          textAlign: "center",
          color: IRELAND.secondary,
          textDecoration: "none",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          borderRadius: 999,
          border: `1px solid ${IRELAND.secondary}66`,
        }}
      >
        Visit sponsor →
      </Link>
    </aside>
  );
}
