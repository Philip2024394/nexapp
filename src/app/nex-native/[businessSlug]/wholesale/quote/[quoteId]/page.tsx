// src/app/nex-native/[businessSlug]/wholesale/quote/[quoteId]/page.tsx
//
// Buyer-facing wholesale quote-detail route · 2026-11-18 (R5).
//
// Purpose
//   Mounts the `WholesaleQuoteFlow` component against a REAL loaded
//   quote row. Preserves every seller/buyer boundary:
//
//     1 · anon → redirect to sign-in (with next=)
//     2 · seller's trade approval of this specific buyer is enforced
//         before the page renders any price. A buyer who merely has
//         the URL — but hasn't been approved by this seller — sees the
//         "not approved for trade buyer" refusal, NOT the quote.
//     3 · viewer must be the quote's buyer_account_id, else refuse.
//         (Owner-preview of their own quote is allowed as a read-only
//         view with action buttons disabled.)
//     4 · If `nex_wholesale_quote` doesn't exist yet (mig 350/351
//         unapplied → PostgREST PGRST205), the honest soft-blocked
//         "Wholesale ordering not enabled yet" panel renders in place
//         of the quote.
//
// Scope (what this page does NOT do)
//   · It does NOT touch Stripe — the flow component surfaces an
//     honest "Payment provider is not connected in this build" line
//     when it reaches the pay_ready state.
//   · It does NOT create / mutate quote rows — that's a seller
//     action handled from the manage surface.
//   · It does NOT geocode or ship delivery coords — wholesale is
//     freight-on-request, separate from the retail bike-delivery
//     G3-Server guard.

import type * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getBusinessBySlug } from "@/lib/nex-native/business-service";
import { resolveWholesaleApproval } from "@/lib/nex-native/wholesale/approval-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import type { QuoteRow } from "@/lib/nex-native/wholesale/quote-service";
import {
  WholesaleQuoteFlow,
  type WholesaleQuoteBuyerSnapshot,
} from "@/components/nex-native/catalogue/wholesale-quote-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const PALETTE = {
  bg: "#0B1A13",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  textDim: "#7D9BC0",
  accent: "#C6A15B",
  cardBg: "rgba(10, 28, 20, 0.72)",
  cardBorder: "rgba(198, 161, 91, 0.35)",
};

// PostgREST returns PGRST205 when the table itself is missing from the
// schema cache. Pre-migration (350/351 not applied) this is what the
// buyer sees · we must surface it honestly as "not enabled yet".
function isUndefinedTable(err: { code?: string } | null | undefined): boolean {
  return !!err && (err.code === "42P01" || err.code === "PGRST205");
}

/** Map the server `QuoteRow` into the client-safe snapshot shape the
 *  flow component accepts. duties_disposition "unspecified" collapses
 *  to null so the client union stays tight. Returns `null` when the
 *  row is a draft or lacks `quoted_at` (data integrity · caller must
 *  refuse safely rather than render a half-formed quote). */
function toSnapshot(row: QuoteRow): WholesaleQuoteBuyerSnapshot | null {
  if (row.status === "draft" || row.quoted_at === null) {
    return null;
  }
  const duties: WholesaleQuoteBuyerSnapshot["duties_disposition"] =
    row.duties_disposition === "unspecified" ? null : row.duties_disposition;
  return {
    id: row.id,
    buyer_account_id: row.buyer_account_id,
    product_id: row.product_id,
    quantity: row.quantity,
    currency: row.currency,
    goods_unit_price_pence: row.goods_unit_price_pence,
    goods_subtotal_pence: row.goods_subtotal_pence,
    freight_pence: row.freight_pence,
    freight_method: row.freight_method,
    transit_days_min: row.transit_days_min,
    transit_days_max: row.transit_days_max,
    duties_disposition: duties,
    terms_note: row.terms_note,
    status: row.status,
    quoted_at: row.quoted_at,
    buyer_accepted_at: row.buyer_accepted_at,
    buyer_rejected_at: row.buyer_rejected_at,
    cancelled_at: row.cancelled_at,
    expires_at: row.expires_at,
  };
}

export default async function BuyerWholesaleQuotePage(props: {
  params: Promise<{ businessSlug: string; quoteId: string }>;
}): Promise<React.JSX.Element> {
  const { businessSlug, quoteId } = await props.params;

  const business = await getBusinessBySlug(businessSlug).catch(() => null);
  if (!business) {
    return <NotFoundShell slug={businessSlug} />;
  }

  const session = await resolveSessionWithDevOverride();
  if (!session) {
    const next = encodeURIComponent(
      `/nex-native/${businessSlug}/wholesale/quote/${quoteId}`,
    );
    redirect(`/nex-native/sign-in?next=${next}`);
  }

  // Trade-buyer approval must still hold at render time. A link is
  // not an invitation · the seller's approval row is the gate. This
  // also protects against the case where the seller revokes between
  // the time the quote was emailed and the time the buyer opens it.
  const decision = await resolveWholesaleApproval({
    viewerAccountId: session.account.id,
    businessId: business.id,
    businessOwnerAccountId: business.owner_account_id,
  });
  const viewerIsOwner = decision.kind === "owner";
  const viewerIsApprovedBuyer = decision.kind === "approved";
  const migrationMissing =
    decision.kind === "db_unavailable" &&
    decision.reason === "migration_not_applied";

  if (!viewerIsOwner && !viewerIsApprovedBuyer) {
    if (migrationMissing) {
      // Honest fail-closed · mig 350 (approval table) not applied.
      // Do NOT silently render the quote · do NOT silently approve.
      return (
        <QuoteMigrationBlockedShell
          businessSlug={businessSlug}
          businessDisplayName={business.display_name}
          reason="approval_table_missing"
        />
      );
    }
    return (
      <NotApprovedShell
        businessSlug={businessSlug}
        businessDisplayName={business.display_name}
      />
    );
  }

  // Load the quote row. Mig 351 unapplied → PGRST205 → soft-blocked.
  const { data, error } = await nexSupabaseAdmin
    .from("nex_wholesale_quote")
    .select("*")
    .eq("id", quoteId)
    .maybeSingle();
  if (error) {
    if (isUndefinedTable(error)) {
      return (
        <QuoteMigrationBlockedShell
          businessSlug={businessSlug}
          businessDisplayName={business.display_name}
          reason="quote_table_missing"
        />
      );
    }
    return (
      <QuoteDbErrorShell
        businessSlug={businessSlug}
        businessDisplayName={business.display_name}
      />
    );
  }
  if (!data) {
    return (
      <QuoteNotFoundShell
        businessSlug={businessSlug}
        businessDisplayName={business.display_name}
      />
    );
  }
  const row = data as QuoteRow;

  // The URL business must own this quote · prevent cross-business
  // URL guessing from leaking a quote belonging to another shop.
  if (row.business_id !== business.id) {
    return (
      <QuoteNotFoundShell
        businessSlug={businessSlug}
        businessDisplayName={business.display_name}
      />
    );
  }

  // Row-level trust: the viewer must be the buyer for this quote.
  // Seller-owners may view their own quote as a read-only preview.
  const viewerIsRowBuyer = row.buyer_account_id === session.account.id;
  if (!viewerIsOwner && !viewerIsRowBuyer) {
    return (
      <QuoteNotYoursShell
        businessSlug={businessSlug}
        businessDisplayName={business.display_name}
      />
    );
  }

  const snapshot = toSnapshot(row);
  if (!snapshot) {
    // Draft-status or missing quoted_at · don't render a half-formed
    // quote to the buyer. Not-found is honest here: no quote has been
    // issued yet from the buyer's point of view.
    return (
      <QuoteNotFoundShell
        businessSlug={businessSlug}
        businessDisplayName={business.display_name}
      />
    );
  }

  return (
    <>
      <style>{`html, body { background: ${PALETTE.bg}; }`}</style>
      <main
        data-nex-buyer-wholesale-quote
        data-preview={viewerIsOwner && !viewerIsRowBuyer ? "true" : undefined}
        style={{
          minHeight: "100dvh",
          background: PALETTE.bg,
          color: PALETTE.text,
          fontFamily: SANS,
          padding: "calc(env(safe-area-inset-top, 0px) + 20px) 18px 48px",
        }}
      >
        <div
          style={{
            maxWidth: 560,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {viewerIsOwner && !viewerIsRowBuyer ? <PreviewBanner /> : null}

          <header>
            <span
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: 999,
                background: "rgba(198, 161, 91, 0.14)",
                border: `1px solid ${PALETTE.cardBorder}`,
                color: PALETTE.accent,
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Trade quote
            </span>
            <h1
              style={{
                margin: "10px 0 2px",
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: "-0.015em",
              }}
            >
              {business.display_name} · Quote
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                color: PALETTE.textMuted,
                wordBreak: "break-all",
              }}
            >
              Reference: {row.id}
            </p>
          </header>

          <section
            aria-label="Quote terms"
            style={{
              padding: 16,
              borderRadius: 12,
              background: PALETTE.cardBg,
              border: `1.5px solid ${PALETTE.cardBorder}`,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 13.5,
              lineHeight: 1.55,
            }}
          >
            <TermsRow label="Quantity" value={`${row.quantity}`} />
            <TermsRow
              label="Goods subtotal"
              value={`${row.currency} ${formatMajor(row.goods_subtotal_pence)}`}
            />
            <TermsRow
              label="Freight"
              value={
                row.freight_pence === null
                  ? "Not yet confirmed"
                  : `${row.currency} ${formatMajor(row.freight_pence)}${
                      row.freight_method ? ` · ${row.freight_method}` : ""
                    }`
              }
            />
            {row.transit_days_min !== null && row.transit_days_max !== null ? (
              <TermsRow
                label="Transit"
                value={`${row.transit_days_min}–${row.transit_days_max} days`}
              />
            ) : null}
            {row.duties_disposition && row.duties_disposition !== "unspecified" ? (
              <TermsRow
                label="Duties"
                value={row.duties_disposition === "seller_pays" ? "Seller pays" : "Buyer pays"}
              />
            ) : null}
            {row.terms_note ? (
              <TermsRow label="Terms note" value={row.terms_note} />
            ) : null}
            {row.expires_at ? (
              <TermsRow label="Valid until" value={row.expires_at} />
            ) : null}
          </section>

          {viewerIsOwner && !viewerIsRowBuyer ? (
            <OwnerPreviewFooter />
          ) : (
            <WholesaleQuoteFlow quoteId={row.id} clientSnapshot={snapshot} />
          )}
        </div>
      </main>
    </>
  );
}

// ─── Sub-views ──────────────────────────────────────────────────────

function TermsRow(props: { label: string; value: string }): React.JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        gap: 10,
      }}
    >
      <span
        style={{
          color: PALETTE.textDim,
          textTransform: "uppercase",
          fontSize: 11,
          letterSpacing: "0.08em",
          fontWeight: 700,
        }}
      >
        {props.label}
      </span>
      <span style={{ color: PALETTE.text, fontWeight: 600 }}>{props.value}</span>
    </div>
  );
}

function PreviewBanner(): React.JSX.Element {
  return (
    <div
      role="status"
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        background: "rgba(90, 120, 200, 0.18)",
        border: "1px solid rgba(130, 160, 220, 0.45)",
        color: PALETTE.text,
        fontSize: 12.5,
        lineHeight: 1.5,
      }}
    >
      <strong style={{ fontWeight: 800 }}>Owner preview.</strong> You are
      viewing a quote as the shop owner. Accept/reject buttons are hidden
      because only the buyer can act on the quote.
    </div>
  );
}

function OwnerPreviewFooter(): React.JSX.Element {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 12.5,
        color: PALETTE.textMuted,
        lineHeight: 1.55,
      }}
    >
      The buyer sees Accept and Reject buttons here. From there they can
      continue to payment · payment-provider wiring is not enabled in
      this build.
    </p>
  );
}

function formatMajor(p: number): string {
  // Whole-currency display · consistent with the catalogue card.
  const major = Math.floor(p / 100);
  const minor = (p % 100).toString().padStart(2, "0");
  return `${major}.${minor}`;
}

// ─── Error / blocked shells ─────────────────────────────────────────

function NotFoundShell(props: { slug: string }): React.JSX.Element {
  return (
    <ShellFrame title="Shop not found">
      <p style={{ margin: 0, fontSize: 13, color: PALETTE.textMuted }}>
        We couldn't find a shop at <code>{props.slug}</code>.
      </p>
    </ShellFrame>
  );
}

function QuoteNotFoundShell(props: {
  businessSlug: string;
  businessDisplayName: string;
}): React.JSX.Element {
  return (
    <ShellFrame title={`${props.businessDisplayName} · Quote not found`}>
      <p style={{ margin: 0, fontSize: 13, color: PALETTE.textMuted }}>
        That quote reference doesn't exist for this shop. Check the link
        with the seller, or return to the catalogue to request a new
        quote.
      </p>
    </ShellFrame>
  );
}

function QuoteNotYoursShell(props: {
  businessSlug: string;
  businessDisplayName: string;
}): React.JSX.Element {
  return (
    <ShellFrame
      title={`${props.businessDisplayName} · This quote isn't for your account`}
      dataAttr="data-nex-wholesale-quote-not-yours"
    >
      <p style={{ margin: 0, fontSize: 13, color: PALETTE.textMuted }}>
        Quotes are addressed to a specific trade buyer. If you were
        expecting to see this quote, sign in as the buyer it was issued
        to, or contact the seller.
      </p>
    </ShellFrame>
  );
}

function NotApprovedShell(props: {
  businessSlug: string;
  businessDisplayName: string;
}): React.JSX.Element {
  return (
    <ShellFrame
      title={`${props.businessDisplayName} · Trade access required`}
      dataAttr="data-nex-wholesale-quote-not-approved"
    >
      <p style={{ margin: 0, fontSize: 13, color: PALETTE.textMuted }}>
        You can't see this quote until the seller has approved you as a
        trade buyer. Request access from the wholesale catalogue, then
        reopen the link once the seller approves.
      </p>
    </ShellFrame>
  );
}

function QuoteMigrationBlockedShell(props: {
  businessSlug: string;
  businessDisplayName: string;
  reason: "approval_table_missing" | "quote_table_missing";
}): React.JSX.Element {
  return (
    <ShellFrame
      title={`${props.businessDisplayName} · Wholesale ordering not enabled yet`}
      dataAttr="data-nex-wholesale-quote-blocked-soft"
      dataReason={props.reason}
    >
      <p style={{ margin: 0, fontSize: 13, color: PALETTE.textMuted }}>
        The wholesale ordering system isn't fully enabled yet on this
        environment (
        {props.reason === "approval_table_missing"
          ? "trade-buyer approval table is pending"
          : "quote table is pending"}
        ). Your request is not lost · when the seller enables wholesale
        the quote will reopen at this link.
      </p>
    </ShellFrame>
  );
}

function QuoteDbErrorShell(props: {
  businessSlug: string;
  businessDisplayName: string;
}): React.JSX.Element {
  return (
    <ShellFrame
      title={`${props.businessDisplayName} · Can't load this quote right now`}
      dataAttr="data-nex-wholesale-quote-blocked-hard"
      dataReason="db_unavailable"
    >
      <p style={{ margin: 0, fontSize: 13, color: PALETTE.textMuted }}>
        Something went wrong reading the quote. Please try again in a
        few seconds. Nothing has been accepted or rejected.
      </p>
    </ShellFrame>
  );
}

function ShellFrame(props: {
  title: string;
  dataAttr?: string;
  dataReason?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  // data-attr is passed through as a plain attribute name so the
  // selector matches `document.querySelector("[data-nex-...]")`.
  const extra: Record<string, string> = {};
  if (props.dataAttr) extra[props.dataAttr] = "true";
  if (props.dataReason) extra["data-nex-wholesale-quote-reason"] = props.dataReason;
  return (
    <>
      <style>{`html, body { background: ${PALETTE.bg}; }`}</style>
      <main
        {...extra}
        style={{
          minHeight: "100dvh",
          background: PALETTE.bg,
          color: PALETTE.text,
          fontFamily: SANS,
          padding: "calc(env(safe-area-inset-top, 0px) + 40px) 18px 40px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <h1
            style={{
              margin: "0 0 10px",
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: "-0.015em",
            }}
          >
            {props.title}
          </h1>
          {props.children}
        </div>
      </main>
    </>
  );
}
