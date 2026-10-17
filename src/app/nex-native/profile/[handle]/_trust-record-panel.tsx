// src/app/nex-native/profile/[handle]/_trust-record-panel.tsx
//
// NEX Safe Trade · Seller Trust Record panel · sealed 2026-10-17.
// -------------------------------------------------------------------
// Owner-sealed Phase 1 Trust Record (verbatim scope choice: "Phase 1
// minimum · reuse existing data honestly"). Replaces the Safe Trade
// sheet's prior A/B/C/D body for ELIGIBLE sellers and INELIGIBLE
// shops. Non-sellers (State B) and unknown status (State D) keep
// their sealed messages at the sheet level.
//
// FOUR SECTIONS (per the sealed spec):
//
//   1. ACCOUNT IDENTITY AND STANDING
//      · Account type        · "Premium" | "Standard"  (effectiveTier)
//      · Member since        · nex_account.created_at  (sealed)
//      · Shop active since   · nex_business.created_at (when !== account)
//      · Verification status · maps SafeTradeStatus NEW/VERIFIED to a
//                              labelled chip · never fabricated
//
//   2. ACTUAL TRADING BEHAVIOUR  (ALL honest-null today)
//      · Completed trades    · "Not enough data yet"
//      · Typical response time · "Not enough data yet"
//      · Dispatch performance  · "Not enough data yet"
//      These fields will light up when NEX ships dispute-tracking +
//      delivery event ingestion (sealed resolver's own TODO).
//
//   3. TRADING COVERAGE
//      · Local / Export / Both · from nex_business.market_reach
//                                (sealed migration 060) · plain text
//                                mapping · no fabricated regions
//
//   4. SAFE TRADE CASE HISTORY  (aggregate only · no public details)
//      · Reports on file · countPendingReportsAgainst(accountId)
//      · Always labelled "awaiting review · no findings determined"
//        when > 0 · "No reports on file" otherwise
//      · Per the owner's publication-rule choice today, the public
//        case list is DEFERRED until a formal publication policy
//        is ratified. Allegations ≠ findings.
//
// REPORT A TRADE ISSUE
//   Owner-sealed · a button at the bottom of the Trust Record panel
//   flips the container to the Report form (see
//   `_report-flip-card.tsx`). The form reuses the sealed
//   `nex_report` table + `createReport` service · existing 7 reasons
//   (scam / harassment / prohibited_goods / impersonation / spam /
//   off_doctrine_payment / other). The 4 owner-proposed reasons
//   (poor_response / late_dispatch / not_as_described / never_received)
//   are DEFERRED pending a separately-authorised migration.
//
// Server Component · pure presentation · no state.

import type * as React from "react";

const NEX = {
  bg: "#020914",
  panelHi: "#0A1A2D",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  green: "#16D66B",
  greenSoft: "rgba(22, 214, 107, 0.35)",
  amber: "#F2A33A",
  amberSoft: "rgba(242, 163, 58, 0.30)",
  borderSoft: "rgba(255, 255, 255, 0.07)",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export type TrustAccountTier = "Standard" | "Premium";
export type TrustMarketReach =
  | "Local only"
  | "Export only"
  | "Local and export"
  | null;
// Owner directive 2026-10-17 · Phase 1.1 · public labels narrowed
// to accurately reflect what the sealed Safe Trade resolver proves:
//   · "Eligible Directory seller" when a shop is claimed + active ·
//     NEVER implies identity verification or completed trade history
//   · "Eligible Directory seller · new on NEX" when the account has
//     no NEX trade history yet · communicates newness without
//     implying a verified track record
//   · "Shop currently restricted" / "Shop suspended" preserved
// The "Verified" wording is reserved for a FUTURE evidence model
// (identity verification subsystem) · not shipped today.
export type TrustVerificationStatus =
  | "Eligible Directory seller"
  | "Eligible Directory seller · new on NEX"
  | "Shop currently restricted"
  | "Shop suspended"
  | null;

export interface TrustRecordPanelProps {
  readonly accountTier: TrustAccountTier;
  readonly memberSinceIso: string | null;
  readonly shopActiveSinceIso: string | null;
  readonly verification: TrustVerificationStatus;
  readonly marketReach: TrustMarketReach;
  readonly reportsOnFile: number;
  readonly tradingSince: string | null;
}

export function TrustRecordPanel(props: TrustRecordPanelProps): React.JSX.Element {
  return (
    <div
      data-nex-trust-record-panel
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        fontFamily: SANS,
      }}
    >
      {/* Hero · "Seller Trust Record · NEX Directory" subtitle. */}
      <div
        style={{
          fontSize: 12,
          color: NEX.textMuted,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        Seller Trust Record · NEX Directory
      </div>

      <SectionGroup title="Account identity and standing">
        <FieldRow label="Account type" value={props.accountTier} />
        <FieldRow
          label="Member since"
          value={formatMonthYear(props.memberSinceIso) ?? "—"}
        />
        {props.shopActiveSinceIso ? (
          <FieldRow
            label="Shop active since"
            value={formatMonthYear(props.shopActiveSinceIso) ?? "—"}
          />
        ) : null}
        {props.verification ? (
          <FieldRow label="Verification" value={props.verification} />
        ) : null}
      </SectionGroup>

      <SectionGroup title="Trading activity">
        <HonestNullRow label="Completed trades" />
        <HonestNullRow label="Typical response time" />
        <HonestNullRow label="Dispatch performance" />
      </SectionGroup>

      <SectionGroup title="Trading coverage">
        <FieldRow
          label="Scope"
          value={props.marketReach ?? "—"}
        />
      </SectionGroup>

      <SectionGroup title="Safe Trade case history">
        {props.reportsOnFile > 0 ? (
          <div
            data-nex-trust-record-case-aggregate
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: NEX.text }}>
              {props.reportsOnFile}{" "}
              {props.reportsOnFile === 1 ? "report" : "reports"} on file
            </div>
            <div
              style={{
                fontSize: 11,
                lineHeight: 1.4,
                color: NEX.textMuted,
              }}
            >
              Awaiting review · no findings have been determined. Public
              case list and resolution outcomes will appear here once
              NEX ratifies the Safe Trade publication policy.
            </div>
          </div>
        ) : (
          <div
            data-nex-trust-record-case-empty
            style={{ fontSize: 13, color: NEX.textDim }}
          >
            No reports on file.
          </div>
        )}
      </SectionGroup>

      {props.tradingSince ? (
        <div
          style={{
            fontSize: 11,
            color: NEX.textMuted,
          }}
        >
          Trading on NEX since {formatMonthYear(props.tradingSince)}
        </div>
      ) : null}
    </div>
  );
}

function SectionGroup({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section
      data-nex-trust-record-section={title}
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: NEX.panelHi,
        border: `1px solid ${NEX.borderSoft}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: NEX.textMuted,
          fontWeight: 700,
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function FieldRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 12, color: NEX.textMuted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: NEX.text }}>
        {value}
      </span>
    </div>
  );
}

function HonestNullRow({ label }: { readonly label: string }): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 12, color: NEX.textMuted }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          fontStyle: "italic",
          color: NEX.textMuted,
        }}
      >
        Not enough data yet
      </span>
    </div>
  );
}

function formatMonthYear(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  } catch {
    return null;
  }
}
