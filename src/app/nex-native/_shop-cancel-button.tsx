"use client";

// src/app/nex-native/_shop-cancel-button.tsx
//
// Owner-authorised 2026-11-08 round 29i · customer-facing cancel
// button for the NEX Shop subscription. Honors Option B guardrail
// #3 (1-click in-app cancel) + guardrail #4 (keep access until the
// end of the paid or trial period · no immediate cutoff).
//
// Design:
//   · First tap opens an in-flow confirm · never cancels on a single
//     accidental click.
//   · Confirm body shows "access until <date>" explicitly so the
//     subscriber sees exactly when they'll lose Shop features.
//   · On confirm, POSTs to /api/nex-native/billing/cancel/shop ·
//     the server-side endpoint schedules Stripe cancel_at_period_end.
//   · Idempotent · a second tap on an already-scheduled cancel just
//     reports back the existing end date.

import * as React from "react";

const NEX = {
  gold: "#C6A15B",
  cream: "#FAF8F4",
  ink: "#F2F5F8",
  inkDim: "#B5C3D6",
  inkMuted: "#7D9BC0",
  red: "#A60000",
  redSoft: "rgba(166,0,0,0.12)",
  border: "rgba(198,161,91,0.25)",
  panel: "rgba(5, 15, 28, 0.72)",
};

interface CancelResponse {
  ok: boolean;
  code?: string;
  reason?: string;
  subscriptionId?: string;
  status?: string;
  cancels_at?: number;
  already_pending?: boolean;
}

function formatDate(epochSeconds: number): string {
  try {
    return new Date(epochSeconds * 1000).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "unknown date";
  }
}

export function ShopCancelButton(): React.JSX.Element {
  const [phase, setPhase] = React.useState<
    | "idle"
    | "confirming"
    | "submitting"
    | "done"
    | "error"
  >("idle");
  const [cancelsAt, setCancelsAt] = React.useState<number | null>(null);
  const [alreadyPending, setAlreadyPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function doCancel() {
    setPhase("submitting");
    setError(null);
    try {
      const res = await fetch("/api/nex-native/billing/cancel/shop", {
        method: "POST",
      });
      const data = (await res.json()) as CancelResponse;
      if (!res.ok || !data.ok) {
        const msg =
          data.code === "no_active_subscription"
            ? "No active Shop subscription found to cancel."
            : data.code === "unauthenticated"
              ? "Please sign in first."
              : data.code === "config_error"
                ? "Cancel service is not configured. Please try again later."
                : data.reason ?? data.code ?? "Could not cancel.";
        setError(msg);
        setPhase("error");
        return;
      }
      setCancelsAt(data.cancels_at ?? null);
      setAlreadyPending(data.already_pending ?? false);
      setPhase("done");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not reach the cancel service.",
      );
      setPhase("error");
    }
  }

  if (phase === "done") {
    return (
      <div
        role="status"
        style={{
          marginTop: 10,
          padding: "10px 12px",
          background: NEX.panel,
          border: `1px solid ${NEX.border}`,
          borderRadius: 10,
          fontSize: 11.5,
          color: NEX.inkDim,
          lineHeight: 1.5,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: NEX.gold,
            marginBottom: 2,
          }}
        >
          {alreadyPending ? "Cancellation already scheduled" : "Cancel scheduled"}
        </div>
        You keep NEX Shop access until{" "}
        <span style={{ color: NEX.cream, fontWeight: 800 }}>
          {cancelsAt ? formatDate(cancelsAt) : "the end of your current period"}
        </span>
        . After that, your plan reverts to NEX Chat (free). No further
        charges.
      </div>
    );
  }

  if (phase === "confirming") {
    return (
      <div
        style={{
          marginTop: 10,
          padding: "12px 14px",
          background: NEX.redSoft,
          border: `1px solid ${NEX.red}`,
          borderRadius: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: NEX.cream,
            lineHeight: 1.4,
          }}
        >
          Cancel NEX Shop?
        </div>
        <div style={{ fontSize: 11, color: NEX.inkDim, lineHeight: 1.5 }}>
          You keep all Shop features until the end of your current
          paid or trial period. Nothing is deleted. You can re-subscribe
          any time.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={doCancel}
            disabled={(phase as string) === "submitting"}
            style={{
              padding: "8px 14px",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: NEX.cream,
              background: NEX.red,
              border: "none",
              borderRadius: 999,
              cursor: (phase as string) === "submitting" ? "wait" : "pointer",
              fontFamily:
                "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            {(phase as string) === "submitting" ? "Cancelling…" : "Yes, cancel"}
          </button>
          <button
            type="button"
            onClick={() => setPhase("idle")}
            disabled={(phase as string) === "submitting"}
            style={{
              padding: "8px 14px",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: NEX.inkMuted,
              background: "transparent",
              border: `1px solid ${NEX.border}`,
              borderRadius: 999,
              cursor: "pointer",
              fontFamily:
                "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            Keep Shop
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
      <button
        type="button"
        onClick={() => setPhase("confirming")}
        style={{
          padding: "8px 14px",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: NEX.inkMuted,
          background: "transparent",
          border: `1px solid ${NEX.border}`,
          borderRadius: 999,
          cursor: "pointer",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          alignSelf: "flex-start",
        }}
      >
        Cancel subscription
      </button>
      {error ? (
        <span role="alert" style={{ fontSize: 10.5, color: NEX.red }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
