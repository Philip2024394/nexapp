// src/app/nex-native/manage/products/[productId]/interest/_interest-dashboard.tsx
//
// Phase 1 · Slice 1F · owner-authorised 2026-10-24.
// -----------------------------------------------------------------------------
// Presentational component for the per-product seller interest
// screen. Pure props → JSX · no data fetching · no session access ·
// no mutation. The page shell (page.tsx) performs the auth check +
// service call then hands the result to this component.
//
// Design posture (sealed by Owner Decision Q1 + Slice 1E):
//
//   · AGGREGATE metrics (views, taps) render as a count labelled
//     "events observed" · never "customers". These signals may
//     include retries from the writer side (documented limitation
//     from Slice 1D) · displaying them as event counts is honest.
//
//   · NAMED metrics (saves, enquiries, completed orders) render
//     "N enquiries from M customers" style · uniqueCustomers is
//     the authoritative dedup count sourced from the primary table.
//
//   · UNAVAILABLE metrics render "— data unavailable" with a short
//     reason hint (surfaced to the seller so they can tell their
//     data was not silently zeroed). No metric is ever faked.
//
//   · ZERO is a legitimate value · "0 enquiries" is honestly empty,
//     not an error.
//
//   · NO customer identity · no handles, no names, no account ids
//     rendered anywhere in this component. The service result
//     already excludes identity (Slice 1E).
//
// Marketing-consent boundary preserved: this screen does NOT render
// any "contact-these-customers" or "export-list" CTA. The seller
// learns aggregate interest, not a marketing audience.

import * as React from "react";
import Link from "next/link";
import type {
  MetricState,
  PerProductInterestSummary,
} from "@/lib/nex-native/seller-insights/seller-insight-types";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "#050f1e",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  orange: "#FF7200",
  green: "#16D66B",
  red: "#FF3355",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface InterestDashboardProps {
  readonly productId: string;
  readonly productName: string;
  readonly summary: PerProductInterestSummary;
}

export function InterestDashboard({
  productId,
  productName,
  summary,
}: InterestDashboardProps): React.JSX.Element {
  const backHref = `/nex-native/manage/products/${productId}`;
  return (
    <div
      data-nex-interest-dashboard
      data-nex-product-id={productId}
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        paddingBottom: 80,
      }}
    >
      <header
        style={{
          padding: "calc(env(safe-area-inset-top, 0) + 14px) 20px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: `1px solid ${NEX.border}`,
        }}
      >
        <Link
          href={backHref}
          aria-label="Back to product"
          style={{
            width: 40,
            height: 40,
            display: "grid",
            placeItems: "center",
            borderRadius: 999,
            color: NEX.text,
            textDecoration: "none",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          ←
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 700,
            }}
          >
            Customer interest
          </div>
          <h1
            style={{
              margin: "2px 0 0",
              fontSize: 18,
              fontWeight: 700,
              color: NEX.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {productName}
          </h1>
        </div>
      </header>

      <section
        aria-label="Window summary"
        style={{
          padding: "14px 20px 4px",
          color: NEX.textDim,
          fontSize: 12,
        }}
      >
        Showing the last {summary.windowDays} days.
      </section>

      <section
        aria-label="Customer interest metrics"
        style={{
          padding: "12px 20px 20px",
          display: "grid",
          gap: 12,
        }}
      >
        {/* Aggregate metrics · "events observed" never "customers" */}
        <AggregateCard
          label="Views"
          caption="Times this product appeared or was tapped. Anonymous aggregate · never identifies individual customers."
          metric={summary.views}
          unit="views"
          accent={NEX.textDim}
        />
        <AggregateCard
          label="Taps"
          caption="Times a customer tapped through to view the product. Anonymous aggregate."
          metric={summary.taps}
          unit="taps"
          accent={NEX.textDim}
        />

        {/* Named metrics · event + unique-customer counts */}
        <NamedCard
          label="Saved"
          caption="Customers who added this product to their saves. One row per customer."
          metric={summary.saves}
          singularEvent="save"
          pluralEvent="saves"
          accent={NEX.cyan}
        />
        <NamedCard
          label="Enquiries"
          caption="Customers who messaged you about this product. Counts message rows (deduped by send-intent at insert) and distinct customers."
          metric={summary.enquiries}
          singularEvent="enquiry"
          pluralEvent="enquiries"
          accent={NEX.cyan}
        />
        <NamedCard
          label="Confirmed orders"
          caption="Orders in a confirmed-sale state (paid or completed). Pending or cancelled orders are not counted."
          metric={summary.completedOrders}
          singularEvent="order"
          pluralEvent="orders"
          accent={NEX.green}
        />
      </section>

      <footer
        style={{
          padding: "0 20px 20px",
          color: NEX.textMute,
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        Views and taps are aggregated · never attached to a customer
        identity. Named metrics identify a customer only when that
        customer took an explicit action. Starting a conversation
        about this product remains the only way a customer&apos;s NEX
        identity is shared with you.
      </footer>
    </div>
  );
}

/* ─── Card primitives ────────────────────────────────────────── */

function AggregateCard(props: {
  readonly label: string;
  readonly caption: string;
  readonly metric: { readonly events: MetricState };
  readonly unit: string;
  readonly accent: string;
}): React.JSX.Element {
  const { label, caption, metric, unit, accent } = props;
  const state = metric.events;
  return (
    <article
      data-nex-metric-card={label.toLowerCase()}
      data-nex-metric-kind="aggregate"
      data-nex-metric-state={state.state}
      style={cardStyle(accent)}
    >
      <header style={cardHeaderStyle()}>
        <span style={cardLabelStyle(accent)}>{label}</span>
        <span style={cardScopeStyle()}>Aggregate · anonymous</span>
      </header>
      {state.state === "available" ? (
        <div style={cardValueStyle()}>
          <span style={bigNumberStyle()}>{state.count.toLocaleString()}</span>
          <span style={smallSuffixStyle()}>
            {state.count === 1 ? unit.replace(/s$/, "") : unit} observed
          </span>
        </div>
      ) : (
        <UnavailableMetric reason={state.reason} />
      )}
      <p style={cardCaptionStyle()}>{caption}</p>
    </article>
  );
}

function NamedCard(props: {
  readonly label: string;
  readonly caption: string;
  readonly metric: {
    readonly events: MetricState;
    readonly uniqueCustomers: MetricState;
  };
  readonly singularEvent: string;
  readonly pluralEvent: string;
  readonly accent: string;
}): React.JSX.Element {
  const { label, caption, metric, singularEvent, pluralEvent, accent } = props;
  const events = metric.events;
  const uniques = metric.uniqueCustomers;
  const bothAvailable =
    events.state === "available" && uniques.state === "available";
  return (
    <article
      data-nex-metric-card={label.toLowerCase().replace(/\s+/g, "-")}
      data-nex-metric-kind="named"
      data-nex-metric-state={events.state}
      style={cardStyle(accent)}
    >
      <header style={cardHeaderStyle()}>
        <span style={cardLabelStyle(accent)}>{label}</span>
        <span style={cardScopeStyle()}>Named · identifiable action</span>
      </header>
      {bothAvailable ? (
        <div style={cardValueStyle()}>
          <span style={bigNumberStyle()}>
            {(events as { count: number }).count.toLocaleString()}
          </span>
          <span style={smallSuffixStyle()}>
            {(events as { count: number }).count === 1
              ? singularEvent
              : pluralEvent}
            {" · from "}
            {(uniques as { count: number }).count.toLocaleString()}
            {" "}
            {(uniques as { count: number }).count === 1
              ? "customer"
              : "customers"}
          </span>
        </div>
      ) : events.state === "unavailable" ? (
        <UnavailableMetric reason={events.reason} />
      ) : (
        <UnavailableMetric
          reason={
            uniques.state === "unavailable"
              ? uniques.reason
              : "partial availability"
          }
        />
      )}
      <p style={cardCaptionStyle()}>{caption}</p>
    </article>
  );
}

function UnavailableMetric({
  reason,
}: {
  readonly reason: string;
}): React.JSX.Element {
  return (
    <div
      data-nex-metric-unavailable
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "6px 0 2px",
      }}
    >
      <span
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: NEX.textMute,
          letterSpacing: "0.02em",
        }}
      >
        — data unavailable
      </span>
      <span
        data-nex-metric-reason
        style={{
          fontSize: 10,
          color: NEX.textMute,
          fontFamily: "monospace",
        }}
      >
        {reason}
      </span>
    </div>
  );
}

/* ─── Style helpers ──────────────────────────────────────────── */

function cardStyle(accent: string): React.CSSProperties {
  return {
    background: NEX.panelSoft,
    border: `1px solid ${NEX.borderStrong}`,
    borderLeft: `3px solid ${accent}`,
    borderRadius: 12,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  };
}

function cardHeaderStyle(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
  };
}

function cardLabelStyle(accent: string): React.CSSProperties {
  return {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.04em",
    color: accent,
  };
}

function cardScopeStyle(): React.CSSProperties {
  return {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: NEX.textMute,
    fontWeight: 600,
  };
}

function cardValueStyle(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    padding: "4px 0 2px",
  };
}

function bigNumberStyle(): React.CSSProperties {
  return {
    fontSize: 26,
    fontWeight: 800,
    color: NEX.text,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.01em",
  };
}

function smallSuffixStyle(): React.CSSProperties {
  return {
    fontSize: 12,
    color: NEX.textDim,
    fontWeight: 500,
  };
}

function cardCaptionStyle(): React.CSSProperties {
  return {
    margin: 0,
    fontSize: 11,
    color: NEX.textMute,
    lineHeight: 1.4,
  };
}
