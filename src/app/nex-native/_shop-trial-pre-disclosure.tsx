// src/app/nex-native/_shop-trial-pre-disclosure.tsx
//
// Owner-sealed 2026-11-08 Option B · Guardrail 1 of 4 · pre-trial
// disclosure that MUST be visible to the user before any surface
// initiates Stripe Checkout (/api/nex-native/billing/checkout/shop).
// ShopCheckoutButton itself deliberately does NOT re-disclose the
// trial terms (see _shop-checkout-button.tsx lines 10-13) · it trusts
// the parent surface to have shown the terms first. This component
// is that disclosure.
//
// A05 · 2026-11-18 · Introduced after audit found settings/tier/page
// mounted the checkout button with only the short hint
// "start a 7-day free Shop trial" · which omits card-required,
// day-8 charge, and the actual price.
//
// Non-interactive by design · it is a visible-above-the-button notice
// rather than a blocking modal. The companion server endpoint
// (src/app/api/nex-native/billing/checkout/shop/route.ts lines 164-180)
// independently enforces trial_period_days=7 and
// payment_method_collection="always" so this component is not a
// client-side gate · it is a transparency surface.
//
// Prices are taken verbatim from the owner-sealed quad already
// visible on /nex-native/settings/tier (EUR 4.99 / GBP 4.99 /
// USD 4.99 / IDR 89,000). This component does not invent new
// commercial terms.

import * as React from "react";

const PALETTE = {
  panel: "rgba(5, 15, 28, 0.72)",
  panelInset: "rgba(0, 0, 0, 0.3)",
  border: "rgba(198, 161, 91, 0.35)",
  gold: "#C6A15B",
  ink: "#F2F5F8",
  inkDim: "#B5C3D6",
  inkMuted: "#7D9BC0",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface ShopTrialPreDisclosureProps {
  /** Optional heading level override · defaults to h3 so the
   *  component slots under an h1/h2 page header without breaking
   *  document outline. */
  readonly headingLevel?: 2 | 3 | 4;
  /** Supply when the caller already knows the viewer's billing
   *  country · currently only used to bold the matching line. If
   *  null the panel lists all four launch currencies neutrally. */
  readonly highlightCurrency?: "EUR" | "GBP" | "USD" | "IDR" | null;
  /** Optional id so the companion ShopCheckoutButton can be
   *  wired with aria-describedby for screen readers. */
  readonly id?: string;
  /** Optional style override · callers typically pass nothing. */
  readonly style?: React.CSSProperties;
}

const PRICE_LINES: ReadonlyArray<{
  readonly code: "EUR" | "GBP" | "USD" | "IDR";
  readonly text: string;
}> = [
  { code: "EUR", text: "EUR 4.99 / month" },
  { code: "GBP", text: "GBP 4.99 / month" },
  { code: "USD", text: "USD 4.99 / month" },
  { code: "IDR", text: "IDR 89,000 / month" },
];

export function ShopTrialPreDisclosure({
  headingLevel = 3,
  highlightCurrency = null,
  id,
  style,
}: ShopTrialPreDisclosureProps): React.JSX.Element {
  const Heading = (`h${headingLevel}` as unknown) as keyof React.JSX.IntrinsicElements;
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section
      data-nex-shop-trial-pre-disclosure
      aria-labelledby={headingId}
      id={id}
      style={{
        padding: "12px 14px",
        background: PALETTE.panelInset,
        border: `1px solid ${PALETTE.border}`,
        borderRadius: 10,
        fontFamily: SANS,
        ...style,
      }}
    >
      <Heading
        id={headingId}
        style={{
          margin: 0,
          fontSize: 12,
          fontWeight: 900,
          color: PALETTE.ink,
          letterSpacing: "0.02em",
        }}
      >
        7 days free · card required
      </Heading>
      <p
        data-nex-shop-trial-pre-disclosure-body
        style={{
          margin: "6px 0 0",
          fontSize: 11.5,
          color: PALETTE.inkDim,
          lineHeight: 1.5,
        }}
      >
        You won&apos;t be charged during the trial. On day 8, your NEX
        Shop subscription begins automatically unless you cancel from
        Settings → Package &amp; billing. The exact price is set by
        your card&apos;s billing country at checkout:
      </p>
      <ul
        data-nex-shop-trial-pre-disclosure-prices
        style={{
          listStyle: "none",
          padding: 0,
          margin: "8px 0 0",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {PRICE_LINES.map((row) => {
          const highlighted = highlightCurrency === row.code;
          return (
            <li
              key={row.code}
              data-nex-shop-trial-pre-disclosure-price={row.code}
              data-highlighted={highlighted ? "true" : "false"}
              style={{
                fontSize: 11,
                lineHeight: 1.45,
                color: highlighted ? PALETTE.gold : PALETTE.ink,
                fontWeight: highlighted ? 900 : 600,
                display: "flex",
                gap: 6,
              }}
            >
              <span aria-hidden style={{ color: PALETTE.gold }}>·</span>
              <span>{row.text}</span>
            </li>
          );
        })}
      </ul>
      <p
        data-nex-shop-trial-pre-disclosure-cancel-note
        style={{
          margin: "8px 0 0",
          fontSize: 10.5,
          color: PALETTE.inkMuted,
          lineHeight: 1.5,
        }}
      >
        Cancelling during the trial keeps your NEX Shop access until
        day 7 ends. No refund is offered for started billing periods ·
        see &ldquo;How refunds work&rdquo; below.
      </p>
    </section>
  );
}
