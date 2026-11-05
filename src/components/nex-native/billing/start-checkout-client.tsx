"use client";

// src/components/nex-native/billing/start-checkout-client.tsx
//
// Owner-authorised 2026-11-05 iter 29 · Ship B3 · client-side helper
// that POSTs to the sealed /api/nex-native/billing/checkout endpoint
// and redirects the viewer to the Stripe Checkout Session URL.
//
// Scope:
//   · SUBSCRIPTION checkout only today · product="shop" · tier
//     ∈ { "standard", "unlimited" }.
//   · One-time Starter Pack (€5 for 10 products) is NOT covered here ·
//     the sealed endpoint only supports mode="subscription" today.
//     Starter Pack is a separate authorised commit (B3b) that
//     extends the model with mode="payment" + a new `starter_pack`
//     product type.
//
// Honest failure modes:
//   · Unauthenticated (401) → routes to /create-account?claim=<id>
//   · config_error (500) → toast "Billing not configured yet"
//   · stripe_error (500) → toast "Payment service unavailable"
//   · 422 known refusals → toast "Can't start checkout: <reason>"

import * as React from "react";

type ShopTier = "standard" | "unlimited";

export interface StartCheckoutButtonProps {
  readonly tier: ShopTier;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly dataAttrs?: Record<string, string>;
}

/** Small button component · wraps whatever children you pass · owns
 *  the POST + redirect flow + a disabled/loading state. */
export function StartCheckoutButton({
  tier,
  children,
  className,
  style,
  dataAttrs,
}: StartCheckoutButtonProps): React.JSX.Element {
  const [submitting, setSubmitting] = React.useState(false);

  const onClick = React.useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const origin = window.location.origin;
      const body = {
        product: "shop" as const,
        intendedTier: tier,
        successUrl: `${origin}/nex-native/packages?checkout=success`,
        cancelUrl: `${origin}/nex-native/packages?checkout=cancel`,
      };
      const res = await fetch("/api/nex-native/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok: true; url: string }
        | { ok: false; code: string; reason?: string }
        | null;
      if (json && json.ok && json.url) {
        window.location.assign(json.url);
        return;
      }
      // Fail paths · toast via the sealed ActionToastHost event
      const code = json && !json.ok ? json.code : "stripe_error";
      if (code === "unauthenticated") {
        window.location.assign(
          `/nex-native/create-account?next=${encodeURIComponent(
            window.location.pathname,
          )}`,
        );
        return;
      }
      const message =
        code === "config_error"
          ? "Billing not configured yet · try again soon"
          : code === "missing_price_id"
            ? "This tier isn't available for your region yet"
            : code === "blocked_by_adverse_event"
              ? "Your account has an open billing issue · contact support"
              : code === "unknown_tier"
                ? "Unknown subscription tier"
                : "Payment service unavailable · try again";
      window.dispatchEvent(
        new CustomEvent("nex-action-toast", {
          detail: { message, kind: "error" },
        }),
      );
    } catch {
      window.dispatchEvent(
        new CustomEvent("nex-action-toast", {
          detail: {
            message: "Couldn't start checkout · check your connection",
            kind: "error",
          },
        }),
      );
    } finally {
      setSubmitting(false);
    }
  }, [submitting, tier]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={submitting}
      className={className}
      data-nex-start-checkout-tier={tier}
      {...(dataAttrs ?? {})}
      style={{
        ...(style ?? {}),
        cursor: submitting ? "default" : "pointer",
        opacity: submitting ? 0.6 : 1,
      }}
    >
      {submitting ? "Starting…" : children}
    </button>
  );
}
