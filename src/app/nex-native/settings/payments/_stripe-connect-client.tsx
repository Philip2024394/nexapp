"use client";

// src/app/nex-native/settings/payments/_stripe-connect-client.tsx
//
// NEX seller Stripe Connect · onboarding button + status chip ·
// owner-authorised 2026-11-09 Round 31a.
// -----------------------------------------------------------------------------
// Replaces the Phase-U "coming-soon" placeholder on the Stripe provider
// card with a real connect flow. On tap:
//   1. POST /api/nex-native/billing/connect/stripe/create
//   2. On success · navigate to the returned Stripe-hosted AccountLink URL
//   3. Seller completes Stripe onboarding
//   4. Stripe redirects back to /settings/payments?connected=1
//   5. Component GETs /api/nex-native/billing/connect/stripe/status?refresh=1
//      to pull the fresh status from Stripe + update local DB
//
// Fail-closed · if migration 311 isn't applied the create call returns
// 422 'columns_not_applied' and the UI surfaces that honestly rather
// than silently redirecting to a broken Stripe flow.

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface StatusShape {
  readonly accountId: string | null;
  readonly chargesEnabled: boolean;
  readonly payoutsEnabled: boolean;
  readonly country: string | null;
  readonly requirementsCurrentlyDue: ReadonlyArray<string>;
  readonly onboardedAt: string | null;
  readonly lastWebhookAt: string | null;
}

export interface StripeConnectClientProps {
  readonly initialStatus: StatusShape;
  readonly gold: string;
  readonly inkDim: string;
  readonly inkPrimary: string;
  readonly red: string;
}

export function StripeConnectClient({
  initialStatus,
  gold,
  inkDim,
  inkPrimary,
  red,
}: StripeConnectClientProps): React.JSX.Element {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = React.useState<StatusShape>(initialStatus);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // On mount · if the URL has ?connected=1 or ?refresh=1 (Stripe
  // redirect) · refresh status from Stripe once.
  const sawRefreshQuery = params?.get("connected") === "1" || params?.get("refresh") === "1";
  const refreshedOnMount = React.useRef(false);
  React.useEffect(() => {
    if (!sawRefreshQuery || refreshedOnMount.current) return;
    refreshedOnMount.current = true;
    (async () => {
      setBusy(true);
      try {
        const res = await fetch("/api/nex-native/billing/connect/stripe/status", {
          method: "POST",
        });
        const data = (await res.json()) as {
          ok: boolean;
          status?: StatusShape;
          reason?: string;
        };
        if (data.ok && data.status) {
          setStatus(data.status);
        } else if (data.reason) {
          setError(`Status refresh: ${data.reason}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Status refresh failed");
      } finally {
        setBusy(false);
        // Remove the ?connected=1 flag from the URL so the refresh
        // doesn't re-fire on a reload.
        router.replace("/nex-native/settings/payments", { scroll: false });
      }
    })();
  }, [router, sawRefreshQuery]);

  async function onConnect() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/nex-native/billing/connect/stripe/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = (await res.json()) as {
        ok: boolean;
        url?: string;
        accountId?: string;
        reused?: boolean;
        code?: string;
        reason?: string;
      };
      if (!res.ok || !data.ok || !data.url) {
        const msg =
          data.code === "columns_not_applied"
            ? "Payment connect schema is not yet applied to this environment."
            : data.code === "unauthenticated"
              ? "Please sign in first."
              : data.code === "no_business"
                ? "Open a NEX Shop first, then connect Stripe."
                : data.code === "stripe_init_failed"
                  ? "Stripe is not configured on this NEX environment."
                  : data.reason ?? data.code ?? "Could not start Stripe onboarding.";
        setError(msg);
        setBusy(false);
        return;
      }
      window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach Stripe.");
      setBusy(false);
    }
  }

  const connected = Boolean(status.accountId);
  const ready = status.chargesEnabled && status.payoutsEnabled;
  const needsWork = connected && !ready;

  // Status chip label + colour
  const chipLabel = !connected
    ? "Not connected"
    : ready
      ? "Connected · ready for payments"
      : status.chargesEnabled
        ? "Connected · setting up payouts"
        : "Connected · finishing verification";
  const chipColor = !connected ? inkDim : ready ? "#16D66B" : "#E67A3C";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        role="status"
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: chipColor,
          letterSpacing: "0.04em",
        }}
      >
        {chipLabel}
      </div>

      {connected && status.country ? (
        <div style={{ fontSize: 11, color: inkDim }}>
          Country: {status.country}
        </div>
      ) : null}

      {needsWork && status.requirementsCurrentlyDue.length > 0 ? (
        <div
          style={{
            padding: "8px 10px",
            background: "rgba(230,122,60,0.1)",
            border: "1px solid rgba(230,122,60,0.35)",
            borderRadius: 8,
            fontSize: 11,
            color: inkPrimary,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 2 }}>
            Stripe still needs:
          </div>
          <ul style={{ margin: "4px 0 0 16px", padding: 0, lineHeight: 1.4 }}>
            {status.requirementsCurrentlyDue.map((req) => (
              <li key={req}>{req}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          style={{
            padding: "8px 10px",
            background: "rgba(166,0,0,0.12)",
            border: `1px solid ${red}`,
            borderRadius: 8,
            fontSize: 11,
            color: inkPrimary,
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onConnect}
          disabled={busy}
          style={{
            padding: "10px 16px",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#1A120A",
            background: gold,
            border: "none",
            borderRadius: 999,
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.7 : 1,
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          {busy
            ? "Opening Stripe…"
            : !connected
              ? "Connect Stripe"
              : needsWork
                ? "Continue Stripe onboarding"
                : "Manage on Stripe"}
        </button>
        {connected ? (
          <DisconnectButton
            busy={busy}
            setBusy={setBusy}
            setStatus={setStatus}
            setError={setError}
            red={red}
            inkDim={inkDim}
          />
        ) : null}
      </div>

      <div style={{ fontSize: 10.5, color: inkDim, lineHeight: 1.5 }}>
        NEX never holds funds · Stripe pays sellers directly · NEX takes
        0% commission on sales · any Stripe account or payment issue is
        between you and Stripe.
      </div>
    </div>
  );
}

function DisconnectButton({
  busy,
  setBusy,
  setStatus,
  setError,
  red,
  inkDim,
}: {
  busy: boolean;
  setBusy: (b: boolean) => void;
  setStatus: (s: StatusShape) => void;
  setError: (e: string | null) => void;
  red: string;
  inkDim: string;
}): React.JSX.Element {
  const [confirming, setConfirming] = React.useState(false);

  async function doDisconnect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/nex-native/billing/connect/stripe/disconnect", {
        method: "POST",
      });
      const data = (await res.json()) as { ok: boolean; code?: string };
      if (!res.ok || !data.ok) {
        setError(`Disconnect failed: ${data.code ?? "unknown"}`);
        setBusy(false);
        return;
      }
      setStatus({
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        country: null,
        requirementsCurrentlyDue: [],
        onboardedAt: null,
        lastWebhookAt: new Date().toISOString(),
      });
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={busy}
        style={{
          padding: "10px 14px",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: inkDim,
          background: "transparent",
          border: `1px solid ${inkDim}`,
          borderRadius: 999,
          cursor: busy ? "wait" : "pointer",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        Disconnect
      </button>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "8px 10px",
        background: "rgba(166,0,0,0.08)",
        border: `1px solid ${red}`,
        borderRadius: 10,
      }}
    >
      <span style={{ fontSize: 11, color: inkDim }}>
        Disconnect clears the NEX↔Stripe link. Your Stripe account stays
        on Stripe (you can reconnect later).
      </span>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={doDisconnect}
          disabled={busy}
          style={{
            padding: "6px 12px",
            fontSize: 10.5,
            fontWeight: 900,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#FAF8F4",
            background: red,
            border: "none",
            borderRadius: 999,
            cursor: busy ? "wait" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {busy ? "Disconnecting…" : "Yes, disconnect"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          style={{
            padding: "6px 12px",
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: inkDim,
            background: "transparent",
            border: `1px solid ${inkDim}`,
            borderRadius: 999,
            cursor: busy ? "wait" : "pointer",
            fontFamily: "inherit",
          }}
        >
          Keep connected
        </button>
      </div>
    </div>
  );
}
