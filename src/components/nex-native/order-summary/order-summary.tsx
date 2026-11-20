// src/components/nex-native/order-summary/order-summary.tsx
//
// Shared buyer+seller order summary · PROPOSAL ARTEFACT · 2026-11-17
// -----------------------------------------------------------------------------
// Renders the two INDEPENDENT status lines required by the dispatch spec:
//   · Payment status   — authoritative from nex_order.state
//   · Fulfilment status — authoritative from nex_order.dispatch_state
//
// These must never collapse into a single pill. Payment and fulfilment are
// orthogonal: a seller can mark preparing/dispatched BEFORE payment is
// confirmed (owner rule "do NOT add a hard rule blocking unpaid dispatch").
// The animated journey is clearly labelled "illustrative" and never implies
// GPS. Genuine tracking link (if any) is presented separately.
//
// This component is purely presentational · no data fetching, no side
// effects. The parent passes a DispatchSnapshot plus display labels.

"use client";

import * as React from "react";
import type {
  DispatchSnapshot,
} from "@/lib/nex-native/manage-orders/dispatch-service";
import { computeIllustrativeProgress } from "@/lib/nex-native/manage-orders/dispatch-eta";

export interface OrderSummaryProps {
  readonly snapshot: DispatchSnapshot;
  /** When true, renders the cream-background illustrative slider. When
   *  false, renders a compact 2-line status pill pair only. The buyer
   *  tracking sheet sets this true; the seller order detail sets this
   *  false (the seller has their own editor). */
  readonly showIllustrativeSlider?: boolean;
}

const PAYMENT_LABEL: Record<string, string> = {
  created: "Awaiting payment",
  pending: "Payment pending",
  paid: "Paid",
  completed: "Paid · completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const DISPATCH_LABEL: Record<string, string> = {
  not_dispatched: "Not dispatched",
  preparing: "Preparing",
  dispatched: "Dispatched",
  delivered: "Delivered (seller-reported)",
};

/** Cream background · world-class slider shape required by owner.
 *  Colours chosen to stay inside the sealed NEX phone-frame palette.
 *  Progress bar is capped at 95% from elapsed-time alone · only a
 *  seller-confirmed delivered state can show the full line. */
export function OrderSummary(props: OrderSummaryProps): React.ReactElement {
  const s = props.snapshot;

  const progress = React.useMemo(
    () =>
      computeIllustrativeProgress(
        {
          dispatched_at: s.dispatched_at,
          estimated_transit_qty: s.estimated_transit_qty,
          estimated_transit_unit: s.estimated_transit_unit,
        },
        new Date(),
      ),
    [s.dispatched_at, s.estimated_transit_qty, s.estimated_transit_unit],
  );

  // If the seller marked delivered, show the full line regardless of
  // elapsed-time cap. "delivered" alone is seller-attributed — the
  // copy below says so explicitly.
  const effectiveProgress =
    s.dispatch_state === "delivered" ? 1 : progress;

  const showEta =
    s.eta.can_compute_absolute_eta && s.dispatch_state !== "delivered";

  const etaLabel = s.eta.estimated_arrival_at
    ? formatIsoDay(s.eta.estimated_arrival_at.toISOString())
    : null;

  const transitLabel =
    s.eta.transit_duration_label ?? null;

  return (
    <div
      data-nex-order-summary={s.order_id}
      style={{
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        borderRadius: 12,
        background: "#FAF6EC", // cream · world-class slider background
        border: "1px solid #E8DFC4",
        fontFamily: "inherit",
      }}
    >
      {/* Two-line status · payment + fulfilment · independent */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <StatusLine
          testId="nex-order-summary-payment"
          label="Payment"
          value={PAYMENT_LABEL[s.payment_state] ?? s.payment_state}
          emphasis={s.payment_state === "paid" || s.payment_state === "completed" ? "paid" : "muted"}
        />
        <StatusLine
          testId="nex-order-summary-dispatch"
          label="Fulfilment"
          value={DISPATCH_LABEL[s.dispatch_state] ?? s.dispatch_state}
          emphasis={
            s.dispatch_state === "dispatched" || s.dispatch_state === "delivered"
              ? "moving"
              : "muted"
          }
        />
      </div>

      {props.showIllustrativeSlider ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            aria-hidden="true"
            data-nex-order-summary-slider={s.order_id}
            style={{
              width: "100%",
              height: 10,
              borderRadius: 999,
              background: "#F0E8D1",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.round(effectiveProgress * 100)}%`,
                height: "100%",
                background: "#6F8F3D",
                transition: "width 400ms ease",
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: "#8A7A4E", lineHeight: 1.3 }}>
            Illustrative journey · based on the seller&apos;s estimate. Not live GPS.
            {s.dispatch_tracking_url ? (
              <>
                {" "}
                See{" "}
                <a
                  href={s.dispatch_tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-nex-order-summary-tracking-link
                  style={{ color: "#4E6B1E", textDecoration: "underline" }}
                >
                  carrier tracking
                </a>{" "}
                for the real location.
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Transit estimate + ETA (independent of slider visibility) */}
      {transitLabel || showEta ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
          {transitLabel ? (
            <div data-nex-order-summary-transit style={{ color: "#5A5444" }}>
              <strong style={{ fontWeight: 600 }}>Seller estimate:</strong>{" "}
              {transitLabel}
            </div>
          ) : null}
          {showEta && etaLabel ? (
            <div data-nex-order-summary-eta style={{ color: "#5A5444" }}>
              <strong style={{ fontWeight: 600 }}>Estimated arrival:</strong>{" "}
              {etaLabel}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StatusLine(props: {
  testId: string;
  label: string;
  value: string;
  emphasis: "paid" | "moving" | "muted";
}): React.ReactElement {
  const color =
    props.emphasis === "paid"
      ? "#2B6B2B"
      : props.emphasis === "moving"
        ? "#4E6B1E"
        : "#6E6756";
  return (
    <div
      data-testid={props.testId}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 8,
        fontSize: 13,
      }}
    >
      <span style={{ color: "#6E6756" }}>{props.label}</span>
      <span style={{ color, fontWeight: 600 }}>{props.value}</span>
    </div>
  );
}

function formatIsoDay(iso: string): string {
  // UTC-stable · same format everywhere. We do not localise this to
  // the viewer's timezone because the ETA math is UTC-anchored to
  // dispatched_at. Showing it in UTC-day form avoids a confusing
  // "one day off" between seller and buyer in different TZ.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} (UTC)`;
}
