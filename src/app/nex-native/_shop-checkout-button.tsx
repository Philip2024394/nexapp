"use client";

// src/app/nex-native/_shop-checkout-button.tsx
//
// Owner-authorised 2026-11-08 round 29h · reusable client button that
// kicks off the NEX Shop subscription Checkout Session with 7-day
// trial. POSTs to /api/nex-native/billing/checkout/shop · follows the
// Stripe-hosted URL on success · surfaces a terse error on failure.
//
// Owner directive 2026-11-08 Option B · pre-trial disclosure is the
// responsibility of the parent surface (visible BEFORE the button is
// tapped). This component does NOT re-disclose the trial terms · it
// trusts the caller to have shown them.

import * as React from "react";

const NEX = {
  gold: "#C6A15B",
  dark: "#1A120A",
  inkMuted: "#7D9BC0",
  red: "#A60000",
};

export interface ShopCheckoutButtonProps {
  /** Button label · owner sealed 2026-11-08 "Start free 7-day trial". */
  readonly label?: string;
  /** Owner directive · disable with a tooltip instead of hiding, so
   *  the state is honest (e.g. "Sign in to upgrade"). */
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  /** Optional style override for the button container · callers
   *  wrap in the surface's palette. */
  readonly style?: React.CSSProperties;
}

export function ShopCheckoutButton({
  label = "Start free 7-day trial →",
  disabled = false,
  disabledReason,
  style,
}: ShopCheckoutButtonProps): React.JSX.Element {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onClick() {
    if (disabled || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/nex-native/billing/checkout/shop", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = (await res.json()) as {
        ok: boolean;
        url?: string;
        code?: string;
        reason?: string;
      };
      if (!res.ok || !data.ok || !data.url) {
        const message =
          data.code === "unauthenticated"
            ? "Please sign in first."
            : data.code === "missing_price_id"
              ? "Checkout price not configured for your region yet."
              : data.code === "config_error"
                ? "Checkout is not configured. Please try again later."
                : data.reason ?? data.code ?? "Could not start checkout.";
        setError(message);
        setLoading(false);
        return;
      }
      // Stripe-hosted Checkout URL · leave the SPA and let the browser
      // navigate · Stripe handles the rest + sends the user to our
      // success_url on completion.
      window.location.assign(data.url);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not reach the checkout service.",
      );
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        aria-disabled={disabled || loading}
        title={disabled ? disabledReason : undefined}
        style={{
          display: "inline-flex",
          alignSelf: "flex-start",
          alignItems: "center",
          padding: "10px 18px",
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: disabled || loading ? NEX.inkMuted : NEX.dark,
          background: disabled || loading ? "transparent" : NEX.gold,
          border: disabled || loading ? "1px solid rgba(198,161,91,0.25)" : "none",
          borderRadius: 999,
          cursor: disabled || loading ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          ...style,
        }}
      >
        {loading ? "Opening Stripe…" : label}
      </button>
      {error ? (
        <span
          role="alert"
          style={{
            fontSize: 10.5,
            color: NEX.red,
            marginTop: 2,
          }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
