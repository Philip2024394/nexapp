// src/app/nex-native/profile/[handle]/_safe-trade-sheet.tsx
//
// NEX canonical profile · Safe Trade 4-state bottom sheet · sealed
// 2026-10-17.
// -------------------------------------------------------------------
// Owner-sealed per the build prompt verbatim. Four and only four
// states · determined server-side at render time by the parent action
// buttons component and passed in as props:
//
//   STATE A · Eligible NEX Directory seller
//     snapshot != null AND business.slug != null AND
//     status ∈ {NEW, VERIFIED}
//     Shows: shop name · "Trade with confidence on NEX" · View Shop
//     link to the sealed /{businessSlug} surface.
//
//   STATE B · The person does not sell on the NEX Directory
//     business == null (no nex_business row with owner_account_id)
//     Exact message required by the spec:
//       "This person does not sell on the NEX Directory.
//        Safe Trade is available for eligible sellers on the NEX Directory.
//        You can still chat with this person on NEX."
//     Buttons: Back to Profile · Chat with this Person.
//
//   STATE C · Shop exists but is NOT currently eligible
//     snapshot != null AND status ∈ {FLAGGED, SUSPENDED}
//     Shows: "This shop is not currently eligible for Safe Trade."
//     NEVER leaks the specific suspension reason to the viewer.
//     View Shop link only when the Directory's actual visibility rules
//     would still show it (slug present + not suspended visibility).
//
//   STATE D · Eligibility cannot be confirmed
//     snapshot == null BUT business != null
//     (resolver returned null · service-layer error · fail-closed)
//     Shows: "Seller status is currently unavailable. Please try again
//     shortly."
//
// SAFE-TRADE DOCTRINE PRESERVED
//   · Zero fabricated trust claims · counts stay honest-null (NEX
//     dispute schema not yet shipped).
//   · Zero payment / escrow / dispute-resolution UI · the sealed
//     doctrine (doctrine_nex_never_handles_payments_2026_09_28) is
//     unmodified.
//   · "Verified" badge appears ONLY when snapshot.status === "VERIFIED"
//     via the sealed resolveSafeTradeStatus · never derived from
//     anything the client can forge.
//
// Client Component · open/close + body is pure render-by-props.

"use client";

import * as React from "react";
import Link from "next/link";
import type { SafeTradeSnapshot } from "@/lib/nex-native/safe-trade-status";
import {
  TrustRecordPanel,
  type TrustAccountTier,
  type TrustMarketReach,
  type TrustVerificationStatus,
} from "./_trust-record-panel";
import { ReportFlipCard } from "./_report-flip-card";
// Owner-authorised 2026-10-20 · Phase 1 of the Verified-Directory
// wedge · the EvidencePanel surfaces the user's TrustScoreResult
// right below the TrustRecordPanel so Safe Trade is the one place
// users see every trust signal we have.
import { EvidencePanel } from "./_evidence-panel";
import type { TrustScoreResult } from "@/lib/nex-native/trust/trust-score-shared";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "#071525",
  panelHi: "#0A1A2D",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  cyanRim: "rgba(0, 175, 255, 0.60)",
  orange: "#FF7200",
  orangeSoft: "rgba(255, 114, 0, 0.35)",
  orangeFaint: "rgba(255, 114, 0, 0.14)",
  green: "#16D66B",
  amber: "#F2A33A",
  red: "#F46A6A",
  borderSoft: "rgba(255, 255, 255, 0.07)",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface SafeTradeSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly snapshot: SafeTradeSnapshot | null;
  readonly business: {
    readonly id: string;
    readonly slug: string | null;
    readonly displayName: string;
  } | null;
  readonly profileDisplayName: string;
  readonly chatHref: string;
  /** Trust Record data · sealed 2026-10-17 Phase 1 · passed from
   *  the profile page's server-side resolution. All fields are
   *  honest · pre-resolved from real DB state (no fabrication). */
  readonly trust?: {
    readonly profileAccountId: string;
    readonly accountTier: TrustAccountTier;
    readonly memberSinceIso: string | null;
    readonly shopActiveSinceIso: string | null;
    readonly verification: TrustVerificationStatus;
    readonly marketReach: TrustMarketReach;
    readonly reportsOnFile: number;
    readonly tradingSince: string | null;
    readonly reportAction: (formData: FormData) => Promise<void> | Promise<never>;
    /** True when the viewer is signed in (gate for the Report button ·
     *  anonymous viewers see "Sign in to report" instead). */
    readonly viewerIsSignedIn: boolean;
    /** True when viewer === the profile owner (hides Report button ·
     *  cannot report self per sealed CHECK constraint). */
    readonly viewerIsOwner: boolean;
  };
  /** Owner-authorised 2026-10-20 · the computed Trust Score for the
   *  business attached to this profile. When present AND tier !==
   *  "unknown" the EvidencePanel renders inside the sheet with the
   *  reasons the score was earned (sources agree · owner claimed on
   *  date · last confirmed days). Null / undefined / unknown-tier
   *  hides the panel entirely so the first impression stays clean. */
  readonly trustScore?: TrustScoreResult | null;
  /** ISO · when the business owner first claimed the listing · fed
   *  into the EvidencePanel's "Owner claimed on <date>" line. */
  readonly ownerClaimedAtIso?: string | null;
}

type ResolvedState = "A" | "B" | "C" | "D";

function resolveState(
  snapshot: SafeTradeSnapshot | null,
  business: SafeTradeSheetProps["business"],
): ResolvedState {
  if (!business) return "B";
  if (!snapshot) return "D";
  if (snapshot.status === "FLAGGED" || snapshot.status === "SUSPENDED") return "C";
  if (snapshot.status === "UNCLAIMED") {
    // UNCLAIMED means the directory listing has no owner_account_id.
    // On a user-profile surface we only ever enter here when a business
    // IS owned by the profile account, so UNCLAIMED is unexpected. Treat
    // as State D (status unavailable) rather than claim eligibility.
    return "D";
  }
  // NEW and VERIFIED are eligible seller states.
  return "A";
}

export function SafeTradeSheet(props: SafeTradeSheetProps): React.JSX.Element | null {
  const state = resolveState(props.snapshot, props.business);
  // Flip-to-report subview · owner directive 2026-10-17 · stays
  // within the same Safe Trade container · no page navigation.
  const [reportOpen, setReportOpen] = React.useState(false);
  React.useEffect(() => {
    // Reset the flip whenever the sheet closes so re-opening lands
    // on the Trust Record (not stale Report form state).
    if (!props.open) setReportOpen(false);
  }, [props.open]);

  // ESC key dismissal · parity with the sealed ControlDrawer convention.
  React.useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);

  // Body-scroll lock while open · prevents mobile background scroll
  // leaking under the sheet.
  React.useEffect(() => {
    if (!props.open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [props.open]);

  if (!props.open) return null;

  return (
    <div
      data-nex-safe-trade-sheet-root
      role="dialog"
      aria-modal="true"
      aria-label="Safe Trade"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      {/* Backdrop · tap to dismiss. */}
      <button
        type="button"
        aria-label="Close Safe Trade"
        data-nex-safe-trade-sheet-backdrop
        onClick={props.onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.72)",
          border: 0,
          padding: 0,
          cursor: "pointer",
        }}
      />
      {/* Panel. */}
      <section
        data-nex-safe-trade-sheet-panel
        data-nex-safe-trade-sheet-state={state}
        style={{
          position: "relative",
          background: NEX.panel,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTop: `1px solid ${NEX.borderSoft}`,
          padding: "18px 18px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          fontFamily: SANS,
          color: NEX.text,
          maxHeight: "80dvh",
          overflowY: "auto",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
        }}
      >
        <HandleGrip />
        <Header onClose={props.onClose} state={state} snapshot={props.snapshot} />
        {/* Trust Record panel · owner-sealed Phase 1 · renders for
            ELIGIBLE sellers (A) and INELIGIBLE shops (C) when the
            parent passes `trust` data. State B (non-sellers) and D
            (unknown) keep their sealed short messages. The flip
            subview (Report form) shares the same container. */}
        {reportOpen && props.trust && !props.trust.viewerIsOwner ? (
          <ReportFlipCard
            reportedDisplayName={props.profileDisplayName}
            reportedAccountId={props.trust.profileAccountId}
            reportAction={props.trust.reportAction}
            onCancel={() => setReportOpen(false)}
          />
        ) : (state === "A" || state === "C") && props.trust ? (
          <>
            <TrustRecordPanel
              accountTier={props.trust.accountTier}
              memberSinceIso={props.trust.memberSinceIso}
              shopActiveSinceIso={props.trust.shopActiveSinceIso}
              verification={props.trust.verification}
              marketReach={props.trust.marketReach}
              reportsOnFile={props.trust.reportsOnFile}
              tradingSince={props.trust.tradingSince}
            />
            {props.trustScore && props.trustScore.tier !== "unknown" ? (
              <EvidencePanel
                result={props.trustScore}
                ownerClaimedAtIso={props.ownerClaimedAtIso ?? null}
              />
            ) : null}
            {!props.trust.viewerIsOwner ? (
              <button
                type="button"
                onClick={() =>
                  props.trust!.viewerIsSignedIn
                    ? setReportOpen(true)
                    : (window.location.href = "/nex-native/sign-in")
                }
                data-nex-safe-trade-report-flip-trigger
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 44,
                  padding: "0 20px",
                  borderRadius: 999,
                  background: "transparent",
                  border: `1px solid rgba(244, 106, 106, 0.60)`,
                  color: "#F46A6A",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: SANS,
                }}
              >
                Report a trade issue
              </button>
            ) : null}
          </>
        ) : (
          <Body
            state={state}
            snapshot={props.snapshot}
            business={props.business}
            profileDisplayName={props.profileDisplayName}
          />
        )}
        {!reportOpen ? (
          <Footer
            state={state}
            business={props.business}
            chatHref={props.chatHref}
            onClose={props.onClose}
          />
        ) : null}
      </section>
    </div>
  );
}

function HandleGrip(): React.JSX.Element {
  return (
    <div
      aria-hidden
      style={{
        alignSelf: "center",
        width: 44,
        height: 4,
        borderRadius: 999,
        background: NEX.textMuted,
        opacity: 0.5,
      }}
    />
  );
}

function Header({
  onClose,
  state,
  snapshot,
}: {
  onClose: () => void;
  state: ResolvedState;
  snapshot: SafeTradeSnapshot | null;
}): React.JSX.Element {
  // Owner directive 2026-10-17 · Phase 1.1 · hero chip renders the
  // "Eligible Directory seller" label for EVERY state-A eligible
  // seller (both NEW and VERIFIED in the sealed resolver vocab) ·
  // previously it gated on VERIFIED only, which is UNREACHABLE in
  // production code (resolver never returns VERIFIED today). Now
  // the chip matches the Trust Record panel's label for consistency.
  const isEligibleSeller =
    state === "A" &&
    (snapshot?.status === "VERIFIED" || snapshot?.status === "NEW");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <ShieldBig color={state === "A" ? NEX.orange : NEX.textMuted} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: state === "A" ? NEX.orange : NEX.textMuted,
            fontWeight: 700,
          }}
        >
          Safe Trade
        </div>
        {isEligibleSeller ? (
          <div
            data-nex-safe-trade-verified
            style={{
              marginTop: 2,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: NEX.green,
              fontWeight: 700,
            }}
          >
            <CheckIcon color={NEX.green} />
            Eligible Directory seller
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        data-nex-safe-trade-close
        style={{
          all: "unset",
          cursor: "pointer",
          width: 32,
          height: 32,
          display: "grid",
          placeItems: "center",
          borderRadius: "50%",
          border: `1px solid ${NEX.cyanSoft}`,
          color: NEX.cyan,
        }}
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function Body({
  state,
  snapshot,
  business,
  profileDisplayName,
}: {
  state: ResolvedState;
  snapshot: SafeTradeSnapshot | null;
  business: SafeTradeSheetProps["business"];
  profileDisplayName: string;
}): React.JSX.Element {
  if (state === "A" && business) {
    return (
      <div data-nex-safe-trade-body="A" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: NEX.text }}>
          Trade with confidence on NEX
        </div>
        <div style={{ fontSize: 13, color: NEX.textDim, lineHeight: 1.4 }}>
          {profileDisplayName} sells through the NEX Directory.
        </div>
        <div
          style={{
            marginTop: 4,
            padding: "12px 14px",
            borderRadius: 12,
            background: NEX.panelHi,
            border: `1px solid ${NEX.borderSoft}`,
          }}
        >
          <div style={{ fontSize: 11, color: NEX.textMuted, letterSpacing: 0.5 }}>
            NEX DIRECTORY SHOP
          </div>
          <div style={{ marginTop: 2, fontSize: 15, fontWeight: 700, color: NEX.text }}>
            {business.displayName}
          </div>
          {snapshot?.tradingSince ? (
            <div style={{ marginTop: 4, fontSize: 11, color: NEX.textMuted }}>
              On NEX since {formatTradingSince(snapshot.tradingSince)}
            </div>
          ) : null}
        </div>
        <HonestNullDisclosure snapshot={snapshot} />
      </div>
    );
  }

  if (state === "B") {
    return (
      <div data-nex-safe-trade-body="B" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: NEX.text }}>
          This person does not sell on the NEX Directory.
        </div>
        <div style={{ fontSize: 13, color: NEX.textDim, lineHeight: 1.5 }}>
          Safe Trade is available for eligible sellers on the NEX Directory.
          You can still chat with this person on NEX.
        </div>
      </div>
    );
  }

  if (state === "C") {
    return (
      <div data-nex-safe-trade-body="C" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: NEX.text }}>
          This shop is not currently eligible for Safe Trade.
        </div>
        <div style={{ fontSize: 13, color: NEX.textDim, lineHeight: 1.5 }}>
          The shop may still appear in the NEX Directory, but Safe Trade
          protection is not available for new transactions right now.
        </div>
        {/* No internal suspension reasons leaked to the viewer, per spec. */}
      </div>
    );
  }

  // State D · unknown.
  return (
    <div data-nex-safe-trade-body="D" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: NEX.text }}>
        Seller status is currently unavailable.
      </div>
      <div style={{ fontSize: 13, color: NEX.textDim, lineHeight: 1.5 }}>
        Please try again shortly.
      </div>
    </div>
  );
}

function Footer({
  state,
  business,
  chatHref,
  onClose,
}: {
  state: ResolvedState;
  business: SafeTradeSheetProps["business"];
  chatHref: string;
  onClose: () => void;
}): React.JSX.Element {
  if (state === "A" && business?.slug) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
        <Link
          href={`/nex-native/${business.slug}`}
          data-nex-safe-trade-cta="view-shop"
          style={pillPrimary(NEX.orange, NEX.bg)}
        >
          View Shop
        </Link>
        <button type="button" onClick={onClose} data-nex-safe-trade-cta="close" style={pillGhost()}>
          Back to Profile
        </button>
      </div>
    );
  }

  if (state === "B") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
        <Link
          href={chatHref}
          data-nex-safe-trade-cta="chat"
          style={pillPrimary(NEX.cyan, NEX.bg)}
        >
          Chat with this Person
        </Link>
        <button type="button" onClick={onClose} data-nex-safe-trade-cta="close" style={pillGhost()}>
          Back to Profile
        </button>
      </div>
    );
  }

  // States C and D · neutral · single Back to Profile only.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
      <button type="button" onClick={onClose} data-nex-safe-trade-cta="close" style={pillGhost()}>
        Back to Profile
      </button>
    </div>
  );
}

function HonestNullDisclosure({ snapshot }: { snapshot: SafeTradeSnapshot | null }): React.JSX.Element | null {
  if (!snapshot) return null;
  // Explicitly show the honest-null state the sealed resolver returns.
  if (snapshot.completedTrades === null && snapshot.openDisputes === null) {
    return (
      <div
        style={{
          fontSize: 11,
          color: NEX.textMuted,
          lineHeight: 1.4,
          marginTop: 4,
        }}
      >
        Transaction counts will appear here once the NEX dispute-tracking
        system ships. The current eligibility signal is based on the
        seller's Directory status alone.
      </div>
    );
  }
  return null;
}

function pillPrimary(bg: string, fg: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "0 20px",
    borderRadius: 999,
    background: bg,
    color: fg,
    fontSize: 14,
    fontWeight: 700,
    textDecoration: "none",
    cursor: "pointer",
    border: 0,
    fontFamily: SANS,
  };
}

function pillGhost(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "0 20px",
    borderRadius: 999,
    background: "transparent",
    border: `1px solid ${NEX.cyanSoft}`,
    color: NEX.cyan,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: SANS,
  };
}

function formatTradingSince(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function CloseIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckIcon({ color }: { readonly color: string }): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ShieldBig({ color }: { readonly color: string }): React.JSX.Element {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
