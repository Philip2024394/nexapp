// src/app/nex-native/billing/_customer-controls.tsx
//
// NEX Billing · customer-side billing controls · client component.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED to
// a real Stripe account yet).
//
// Buttons that invoke the server actions in _actions.ts. Kept small +
// framework-free · no form library · a single useTransition.

"use client";

import { useState, useTransition } from "react";
import type { NexProduct } from "@/lib/nex-native/billing/types";
import {
  cancelProductSubscriptionAction,
  changeProductTierAction,
  type ActionResult,
} from "./_actions";

const NEX = {
  cyan: "#00AFFF",
  red: "#D33A3A",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  bg: "#020914",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  green: "#22E37A",
  amber: "#FFB700",
};

export interface CustomerControlsProps {
  readonly product: NexProduct;
  readonly currentTier: string | null;
  /** True iff a real subscription exists · otherwise show "no sub" copy. */
  readonly hasSubscription: boolean;
}

interface Feedback {
  readonly tone: "ok" | "warn" | "error";
  readonly message: string;
}

function tiersFor(product: NexProduct): string[] {
  if (product === "shop") return ["standard", "unlimited"];
  return ["5gb", "25gb", "50gb", "100gb"];
}

function tierLabel(product: NexProduct, tier: string): string {
  if (product === "shop") {
    return tier === "standard"
      ? "Shop Standard"
      : tier === "unlimited"
        ? "Shop Unlimited"
        : tier;
  }
  if (tier === "5gb") return "Vault 5 GB";
  if (tier === "25gb") return "Vault 25 GB";
  if (tier === "50gb") return "Vault 50 GB";
  if (tier === "100gb") return "Vault 100 GB";
  return tier;
}

function describeFailure(code: string): string {
  switch (code) {
    case "no_subscription":
      return "You don't have an active subscription for this product yet.";
    case "same_tier":
      return "You're already on that tier.";
    case "unknown_tier":
      return "That plan isn't available for this product.";
    case "missing_price_id":
      return "This plan isn't configured yet · please try again later.";
    case "blocked_by_adverse_event":
      return "Account on hold · resolve the open billing issue before changing plan.";
    case "config_error":
      return "Billing is temporarily unavailable.";
    case "stripe_error":
      return "Payment processor error · please try again shortly.";
    case "unauthenticated":
      return "Please sign in again.";
    default:
      return `Unexpected: ${code}`;
  }
}

export function CustomerBillingControls({
  product,
  currentTier,
  hasSubscription,
}: CustomerControlsProps): React.ReactNode {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [chosenTier, setChosenTier] = useState<string>(currentTier ?? "");
  const [isPending, startTransition] = useTransition();
  const tiers = tiersFor(product);

  function handleCancel() {
    if (!hasSubscription) return;
    const ok = window.confirm(
      `Cancel ${product === "shop" ? "NEX Shop" : "NEX Vault"} at the end of the current billing period? Access continues until period end, then enters a 30-day read-only grace.`,
    );
    if (!ok) return;
    setFeedback(null);
    startTransition(async () => {
      const res: ActionResult<{
        accessUntil: string | null;
        graceUntil: string | null;
      }> = await cancelProductSubscriptionAction({ product });
      if (res.ok) {
        setFeedback({
          tone: "ok",
          message: res.accessUntil
            ? `Cancelled · access continues until ${res.accessUntil.slice(0, 10)}, read-only grace until ${res.graceUntil?.slice(0, 10)}.`
            : "Cancellation scheduled.",
        });
      } else {
        setFeedback({ tone: "error", message: describeFailure(res.code) });
      }
    });
  }

  function handleChangePlan() {
    if (!chosenTier || chosenTier === currentTier) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await changeProductTierAction({
        product,
        intendedTier: chosenTier,
      });
      if (res.ok) {
        setFeedback({
          tone: "ok",
          message: `Plan change submitted · the new tier will apply on your next renewal.`,
        });
      } else {
        setFeedback({ tone: "error", message: describeFailure(res.code) });
      }
    });
  }

  if (!hasSubscription) {
    return (
      <p
        style={{
          margin: "16px 0 0",
          color: NEX.textDim,
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        You don&apos;t have an active {product === "shop" ? "Shop" : "Vault"}{" "}
        subscription yet. Visit <strong style={{ color: NEX.cyan }}>Plans</strong>{" "}
        to choose one.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            flex: "1 1 180px",
          }}
        >
          <span style={{ fontSize: 11, textTransform: "uppercase", color: NEX.textMute }}>
            Change plan
          </span>
          <select
            value={chosenTier}
            onChange={(e) => setChosenTier(e.target.value)}
            disabled={isPending}
            style={{
              minHeight: 44,
              padding: "0 12px",
              background: NEX.panelSoft,
              border: `1px solid ${NEX.border}`,
              borderRadius: 10,
              color: NEX.text,
              fontSize: 14,
            }}
          >
            {tiers.map((t) => (
              <option key={t} value={t}>
                {tierLabel(product, t)}
                {t === currentTier ? " · current" : ""}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={handleChangePlan}
          disabled={isPending || !chosenTier || chosenTier === currentTier}
          style={{
            minHeight: 44,
            padding: "0 20px",
            background: "transparent",
            color: NEX.cyan,
            border: `1px solid ${NEX.cyan}`,
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 14,
            cursor: isPending ? "wait" : "pointer",
            opacity:
              !chosenTier || chosenTier === currentTier || isPending ? 0.5 : 1,
          }}
        >
          {isPending ? "Working…" : "Apply plan change"}
        </button>

        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          style={{
            minHeight: 44,
            padding: "0 20px",
            background: "transparent",
            color: NEX.red,
            border: `1px solid ${NEX.red}`,
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 14,
            cursor: isPending ? "wait" : "pointer",
            opacity: isPending ? 0.5 : 1,
          }}
        >
          Cancel at period end
        </button>
      </div>

      {feedback ? (
        <p
          style={{
            marginTop: 12,
            fontSize: 13,
            color:
              feedback.tone === "ok"
                ? NEX.green
                : feedback.tone === "warn"
                  ? NEX.amber
                  : NEX.red,
          }}
        >
          {feedback.message}
        </p>
      ) : null}

      <p style={{ marginTop: 12, color: NEX.textMute, fontSize: 11, lineHeight: 1.4 }}>
        Plan changes use Stripe for payment. We never store your card details.
      </p>
    </div>
  );
}
