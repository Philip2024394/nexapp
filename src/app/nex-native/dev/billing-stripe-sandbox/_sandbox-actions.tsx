// src/app/nex-native/dev/billing-stripe-sandbox/_sandbox-actions.tsx
//
// NEX Billing · Stripe sandbox checkout trigger (dev-only client UI).
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT).
//
// Four buttons · each POSTs to /api/nex-native/billing/checkout with a
// specific (product, tier) · surfaces the resulting URL + error. On
// success the user clicks the URL to continue to the Stripe-hosted
// checkout page.

"use client";

import { useState, useTransition } from "react";
import type { NexProduct } from "@/lib/nex-native/billing/types";

const NEX = {
  cyan: "#00AFFF",
  green: "#22E37A",
  amber: "#FFB700",
  red: "#D33A3A",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  panel: "#03101D",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
};

interface Choice {
  readonly label: string;
  readonly product: NexProduct;
  readonly intendedTier: string;
}

const CHOICES: Choice[] = [
  { label: "Shop Standard · €19.99/mo", product: "shop", intendedTier: "standard" },
  { label: "Shop Unlimited · €29.99/mo", product: "shop", intendedTier: "unlimited" },
  { label: "Vault 5 GB · €9.99/mo", product: "vault", intendedTier: "5gb" },
  { label: "Vault 25 GB", product: "vault", intendedTier: "25gb" },
];

type Outcome =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "ok"; url: string; internalSessionId: string }
  | { kind: "err"; code: string; reason?: string };

export function StripeSandboxActions(): React.ReactNode {
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  function trigger(choice: Choice) {
    setOutcome({ kind: "pending" });
    startTransition(async () => {
      try {
        const res = await fetch("/api/nex-native/billing/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            product: choice.product,
            intendedTier: choice.intendedTier,
            successUrl: `${window.location.origin}/nex-native/billing?checkout=success`,
            cancelUrl: `${window.location.origin}/nex-native/dev/billing-stripe-sandbox?checkout=cancel`,
          }),
        });
        const body = await res.json();
        if (body.ok) {
          setOutcome({
            kind: "ok",
            url: body.url,
            internalSessionId: body.internalSessionId,
          });
        } else {
          setOutcome({
            kind: "err",
            code: body.code ?? "unknown",
            reason: body.reason,
          });
        }
      } catch (err) {
        setOutcome({
          kind: "err",
          code: "network_error",
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  return (
    <section
      style={{
        padding: 16,
        borderRadius: 12,
        background: NEX.panel,
        border: `1px solid ${NEX.border}`,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 15 }}>Trigger Checkout</h2>
      <p style={{ margin: "6px 0 10px", color: NEX.textMute, fontSize: 12 }}>
        Each button goes through the real checkout endpoint using the configured
        price IDs. Requires a signed-in NEX session.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        {CHOICES.map((c) => (
          <button
            key={`${c.product}:${c.intendedTier}`}
            type="button"
            onClick={() => trigger(c)}
            disabled={isPending}
            style={{
              minHeight: 44,
              padding: "0 14px",
              borderRadius: 10,
              background: NEX.panelSoft,
              color: NEX.cyan,
              border: `1px solid ${NEX.cyan}`,
              fontWeight: 700,
              fontSize: 13,
              cursor: isPending ? "wait" : "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {outcome.kind === "ok" ? (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 10,
            border: `1px solid ${NEX.green}`,
          }}
        >
          <p style={{ margin: 0, color: NEX.green, fontSize: 13 }}>
            Checkout session created · internal id{" "}
            <code>{outcome.internalSessionId}</code>
          </p>
          <a
            href={outcome.url}
            style={{
              display: "inline-block",
              marginTop: 8,
              color: NEX.cyan,
              textDecoration: "underline",
              fontSize: 14,
              wordBreak: "break-all",
            }}
          >
            Continue to Stripe checkout →
          </a>
        </div>
      ) : outcome.kind === "err" ? (
        <p
          style={{
            marginTop: 14,
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${NEX.red}`,
            color: NEX.red,
            fontSize: 13,
          }}
        >
          <strong>{outcome.code}</strong>
          {outcome.reason ? ` · ${outcome.reason}` : ""}
        </p>
      ) : outcome.kind === "pending" ? (
        <p style={{ marginTop: 14, color: NEX.amber, fontSize: 13 }}>
          Creating session…
        </p>
      ) : null}
    </section>
  );
}
