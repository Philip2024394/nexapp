"use client";

// src/components/nex-native/billing/starter-pack-checkout-client.tsx
//
// Owner-authorised 2026-11-05 iter 29 · Ship B3b · client-side helper
// for the ONE-TIME Starter Pack checkout (€5 · +10 products · 60-day
// window). Parallel to StartCheckoutButton · uses the dedicated
// /api/nex-native/billing/starter-pack-checkout endpoint.
//
// Honest failure modes (same vocabulary as subscription checkout):
//   · unauthenticated → routes to /create-account?next=<path>
//   · config_error    → toast "Starter Pack not available yet"
//   · stripe_error    → toast "Payment service unavailable"

import * as React from "react";

export interface StarterPackCheckoutButtonProps {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

export function StarterPackCheckoutButton({
  children,
  className,
  style,
}: StarterPackCheckoutButtonProps): React.JSX.Element {
  const [submitting, setSubmitting] = React.useState(false);

  const onClick = React.useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const origin = window.location.origin;
      const res = await fetch(
        "/api/nex-native/billing/starter-pack-checkout",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            successUrl: `${origin}/nex-native/packages?checkout=success&pack=1`,
            cancelUrl: `${origin}/nex-native/packages?checkout=cancel`,
          }),
        },
      );
      const json = (await res.json().catch(() => null)) as
        | { ok: true; url: string }
        | { ok: false; code: string }
        | null;
      if (json && json.ok && json.url) {
        window.location.assign(json.url);
        return;
      }
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
          ? "Starter Pack not available yet · try again soon"
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
  }, [submitting]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={submitting}
      className={className}
      data-nex-starter-pack-checkout
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
