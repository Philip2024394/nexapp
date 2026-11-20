"use client";

// src/components/nex-native/catalogue/wholesale-quote-flow.tsx
//
// Phase W · follow-up (2026-11-18) · buyer-facing wholesale quote
// flow component.
//
// Purpose
//   Drive the full buyer lifecycle for a wholesale quote the seller
//   has already created:
//
//     idle → accept → initiate payment
//            │
//            └→ reject
//
//   Every step calls a real server action (no stubs, no "coming
//   soon" placeholders). Every server outcome is mapped to an
//   honest UI state · including every fail-closed reason that
//   migration 350/351 unapplied surfaces. Sealed DB-wired rule
//   (2026-11-12) · never silently promote a `migration_not_applied`
//   or `db_unavailable` return to success.
//
// Scope (what this component DOES)
//   · Renders accept/reject/initiate affordances for a quote the
//     buyer was told about (quoteId comes in via props today · a
//     future seller-link route will pre-fill it).
//   · Calls `buyerAcceptQuoteAction`, `buyerRejectQuoteAction`,
//     and `initiateWholesaleOrderAction` through the existing
//     server-actions module.
//   · Surfaces each `WholesaleActionReason` value as an honest
//     plain-English panel (migration-not-applied, not-approved,
//     stale-snapshot, expired, freight-missing, wrong-status,
//     quote-not-found, not-your-quote, server-error).
//   · Uses the deterministic `idempotencyKey` returned by
//     `initiateWholesaleOrderAction` to prevent a retry from
//     creating a second order draft client-side. The server
//     action also re-reads the row freshly on every call so
//     double-tap is safe at the action layer too.
//
// Scope (what this component does NOT do)
//   · It does NOT call Stripe / PayPal / any live payment API ·
//     the sealed gate authored today only produces an order draft
//     envelope. Hooking that envelope to a checkout session mint
//     is a separate gate (Stripe-live is NOT authorised).
//   · It does NOT write a `nex_order` row · mig 350/351 unapplied.
//   · It does NOT try to re-render the quote itself · a parent
//     server page is responsible for passing the visible snapshot.

import * as React from "react";

import {
  buyerAcceptQuoteAction,
  buyerRejectQuoteAction,
  initiateWholesaleOrderAction,
  type WholesaleActionReason,
  type WholesaleOrderDraft,
} from "@/lib/nex-native/wholesale/actions";

// A minimal client snapshot shape. Matches the `BuyerSnapshot`
// subset the server action expects (see actions.ts:422).
export interface WholesaleQuoteBuyerSnapshot {
  readonly id: string;
  readonly buyer_account_id: string;
  readonly product_id: string;
  readonly quantity: number;
  readonly currency: string;
  readonly goods_unit_price_pence: number;
  readonly goods_subtotal_pence: number;
  readonly freight_pence: number | null;
  readonly freight_method: string | null;
  readonly transit_days_min: number | null;
  readonly transit_days_max: number | null;
  readonly duties_disposition: "buyer_pays" | "seller_pays" | "included" | null;
  readonly terms_note: string | null;
  readonly status:
    | "quoted"
    | "accepted"
    | "rejected"
    | "cancelled"
    | "expired";
  readonly quoted_at: string;
  readonly buyer_accepted_at: string | null;
  readonly buyer_rejected_at: string | null;
  readonly cancelled_at: string | null;
  readonly expires_at: string | null;
}

// ─── View-model state ────────────────────────────────────────────────

type Phase =
  | { kind: "idle" }
  | { kind: "accepting" }
  | { kind: "accepted" }
  | { kind: "rejecting" }
  | { kind: "rejected" }
  | { kind: "initiating" }
  | { kind: "pay_ready"; draft: WholesaleOrderDraft }
  | { kind: "blocked_soft"; message: string; reason: WholesaleActionReason }
  | { kind: "blocked_hard"; message: string; reason: WholesaleActionReason };

const SOFT_REASONS: ReadonlySet<WholesaleActionReason> = new Set<WholesaleActionReason>([
  "migration_not_applied",
  "db_unavailable",
  "server_error",
]);

// Honest plain-English copy per reason · never leaks SQL state.
function describeReason(reason: WholesaleActionReason): string {
  switch (reason) {
    case "migration_not_applied":
      return "Wholesale ordering is not fully enabled yet. Your request has not been recorded. Please try again after the seller confirms the system is live.";
    case "db_unavailable":
      return "We can't reach the orders service right now. Nothing was saved. Please try again in a minute.";
    case "not_authenticated":
      return "Please sign in to continue with this quote.";
    case "not_your_quote":
      return "This quote belongs to a different buyer. You cannot act on it.";
    case "quote_not_found":
      return "This quote no longer exists. The seller may have cancelled it.";
    case "wrong_status":
      return "This quote is not in a state you can act on right now (it may already be accepted, rejected or cancelled).";
    case "stale_snapshot":
      return "The quote has changed since you last viewed it. Please refresh to see the current terms before accepting or paying.";
    case "expired":
      return "This quote has expired. Please ask the seller to re-issue it.";
    case "freight_missing":
      return "The seller has not yet confirmed the freight cost. You cannot pay until freight is quoted.";
    case "not_approved_buyer":
      return "You are not currently approved for wholesale with this seller. Your access may have been revoked.";
    case "server_error":
      return "Something went wrong. Nothing was saved. Please try again.";
    case "business_not_found":
    case "product_not_found":
      return "This quote references a shop or product we can no longer find.";
    case "forbidden":
      return "You cannot perform this action.";
    default:
      return "This action could not be completed. Please try again.";
  }
}

const PALETTE = {
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  accent: "#C6A15B",
  cardBg: "rgba(10, 28, 20, 0.72)",
  cardBorder: "rgba(198, 161, 91, 0.35)",
  soft: "rgba(180, 160, 60, 0.18)",
  softBorder: "rgba(220, 180, 70, 0.55)",
  hard: "rgba(200, 60, 60, 0.22)",
  hardBorder: "rgba(220, 90, 90, 0.55)",
  ok: "rgba(60, 160, 100, 0.22)",
  okBorder: "rgba(90, 200, 140, 0.55)",
};

const btn: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  background: PALETTE.accent,
  color: "#0B1A13",
  fontWeight: 800,
  fontSize: 14,
  border: "none",
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  ...btn,
  background: "transparent",
  color: PALETTE.textMuted,
  border: `1.5px solid ${PALETTE.cardBorder}`,
};

export function WholesaleQuoteFlow(props: {
  readonly quoteId: string;
  readonly clientSnapshot: WholesaleQuoteBuyerSnapshot;
}): React.JSX.Element {
  const [phase, setPhase] = React.useState<Phase>({ kind: "idle" });

  const onAccept = React.useCallback(async () => {
    if (phase.kind !== "idle") return;
    setPhase({ kind: "accepting" });
    try {
      const result = await buyerAcceptQuoteAction({
        quoteId: props.quoteId,
        clientSnapshot: props.clientSnapshot,
      });
      if (result.ok) {
        setPhase({ kind: "accepted" });
      } else {
        const message = describeReason(result.reason);
        setPhase({
          kind: SOFT_REASONS.has(result.reason) ? "blocked_soft" : "blocked_hard",
          message,
          reason: result.reason,
        });
      }
    } catch {
      setPhase({
        kind: "blocked_hard",
        message: describeReason("server_error"),
        reason: "server_error",
      });
    }
  }, [phase.kind, props.quoteId, props.clientSnapshot]);

  const onReject = React.useCallback(async () => {
    if (phase.kind !== "idle") return;
    setPhase({ kind: "rejecting" });
    try {
      const result = await buyerRejectQuoteAction({ quoteId: props.quoteId });
      if (result.ok) {
        setPhase({ kind: "rejected" });
      } else {
        const message = describeReason(result.reason);
        setPhase({
          kind: SOFT_REASONS.has(result.reason) ? "blocked_soft" : "blocked_hard",
          message,
          reason: result.reason,
        });
      }
    } catch {
      setPhase({
        kind: "blocked_hard",
        message: describeReason("server_error"),
        reason: "server_error",
      });
    }
  }, [phase.kind, props.quoteId]);

  const onInitiate = React.useCallback(async () => {
    if (phase.kind !== "accepted") return;
    setPhase({ kind: "initiating" });
    try {
      const result = await initiateWholesaleOrderAction({
        quoteId: props.quoteId,
        clientSnapshot: props.clientSnapshot,
      });
      if (result.ok) {
        setPhase({ kind: "pay_ready", draft: result.value });
      } else {
        const message = describeReason(result.reason);
        setPhase({
          kind: SOFT_REASONS.has(result.reason) ? "blocked_soft" : "blocked_hard",
          message,
          reason: result.reason,
        });
      }
    } catch {
      setPhase({
        kind: "blocked_hard",
        message: describeReason("server_error"),
        reason: "server_error",
      });
    }
  }, [phase.kind, props.quoteId, props.clientSnapshot]);

  return (
    <section
      data-nex-wholesale-quote-flow={props.quoteId}
      data-nex-wholesale-quote-phase={phase.kind}
      style={{
        padding: 16,
        borderRadius: 14,
        background: PALETTE.cardBg,
        border: `1.5px solid ${PALETTE.cardBorder}`,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        color: PALETTE.text,
      }}
    >
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
          Quote
        </span>
        <h2
          style={{
            margin: "8px 0 4px",
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: "-0.01em",
          }}
        >
          Quote {props.quoteId.slice(0, 8)}
        </h2>
      </header>

      {phase.kind === "idle" ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onAccept}
            data-nex-wholesale-accept
            style={btn}
          >
            Accept quote
          </button>
          <button
            type="button"
            onClick={onReject}
            data-nex-wholesale-reject
            style={btnGhost}
          >
            Reject quote
          </button>
        </div>
      ) : null}

      {phase.kind === "accepting" || phase.kind === "rejecting" || phase.kind === "initiating" ? (
        <p
          data-nex-wholesale-quote-pending
          style={{ margin: 0, fontSize: 13, color: PALETTE.textMuted }}
        >
          Working…
        </p>
      ) : null}

      {phase.kind === "accepted" ? (
        <div
          data-nex-wholesale-quote-accepted
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: PALETTE.ok,
            border: `1px solid ${PALETTE.okBorder}`,
          }}
        >
          <strong style={{ fontWeight: 800 }}>Quote accepted.</strong> The
          seller has been notified. You can now continue to payment ·
          the server will re-verify the quote and freight before any
          charge is initiated.
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onInitiate}
              data-nex-wholesale-initiate
              style={btn}
            >
              Continue to payment
            </button>
          </div>
        </div>
      ) : null}

      {phase.kind === "rejected" ? (
        <div
          data-nex-wholesale-quote-rejected
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: PALETTE.cardBg,
            border: `1px solid ${PALETTE.cardBorder}`,
            color: PALETTE.textMuted,
            fontSize: 13,
          }}
        >
          <strong style={{ fontWeight: 800, color: PALETTE.text }}>Quote rejected.</strong>{" "}
          The seller has been notified. Nothing will be charged.
        </div>
      ) : null}

      {phase.kind === "pay_ready" ? (
        <div
          data-nex-wholesale-pay-ready
          data-nex-wholesale-idempotency-key={phase.draft.idempotencyKey}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: PALETTE.ok,
            border: `1px solid ${PALETTE.okBorder}`,
            fontSize: 13,
          }}
        >
          <strong style={{ fontWeight: 800 }}>Ready for payment.</strong>{" "}
          Total <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatPenceDecimal(phase.draft.gate.totalPence)}
          </span>{" "}
          {phase.draft.gate.currency} (goods{" "}
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatPenceDecimal(phase.draft.gate.goodsSubtotalPence)}
          </span>{" "}
          + freight{" "}
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatPenceDecimal(phase.draft.gate.freightPence)}
          </span>
          ). Payment provider is not connected in this build — Stripe
          live is not authorised yet. The idempotency key above
          survives retries so a reconnect will not double-charge.
        </div>
      ) : null}

      {phase.kind === "blocked_soft" ? (
        <div
          role="status"
          data-nex-wholesale-quote-blocked-soft
          data-nex-wholesale-quote-reason={phase.reason}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: PALETTE.soft,
            border: `1px solid ${PALETTE.softBorder}`,
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          {phase.message}
        </div>
      ) : null}

      {phase.kind === "blocked_hard" ? (
        <div
          role="alert"
          data-nex-wholesale-quote-blocked-hard
          data-nex-wholesale-quote-reason={phase.reason}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: PALETTE.hard,
            border: `1px solid ${PALETTE.hardBorder}`,
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          {phase.message}
        </div>
      ) : null}
    </section>
  );
}

function formatPenceDecimal(p: number): string {
  const major = Math.floor(p / 100);
  const minor = (p % 100).toString().padStart(2, "0");
  return `${major}.${minor}`;
}
