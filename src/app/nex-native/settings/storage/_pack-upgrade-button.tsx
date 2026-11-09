"use client";

// src/app/nex-native/settings/storage/_pack-upgrade-button.tsx
//
// NEX storage pack upgrade button · R33b · owner-authorised 2026-11-09.
// -----------------------------------------------------------------------------
// Client component · replaces the sealed "Payment setup pending"
// disabled stub on the StoragePlanCard. On tap, POSTs the chosen pack
// key to /api/nex-native/billing/checkout/pack and redirects to
// Stripe hosted Checkout. Fail-closed for signed-out viewers +
// viewers without a shop (shows explanatory copy inline rather
// than silently redirecting to a broken flow).

import * as React from "react";

type PackKey = "pack_5gb" | "pack_10gb" | "pack_25gb";
type ViewerKind = "signed_out" | "signed_in_no_shop" | "signed_in_with_shop";

export interface PackUpgradeButtonProps {
  readonly packKey: PackKey;
  readonly viewerKind: ViewerKind;
  readonly inkMuted: string;
  readonly border: string;
  readonly gold: string;
  readonly cream: string;
  readonly red: string;
}

export function PackUpgradeButton({
  packKey,
  viewerKind,
  inkMuted,
  border,
  gold,
  cream,
  red,
}: PackUpgradeButtonProps): React.JSX.Element {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const disabled = viewerKind !== "signed_in_with_shop" || busy;
  const title =
    viewerKind === "signed_out"
      ? "Sign in to upgrade"
      : viewerKind === "signed_in_no_shop"
        ? "Open your shop first"
        : undefined;

  async function onClick() {
    if (disabled) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/nex-native/billing/checkout/pack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packKey }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        url?: string;
        code?: string;
        reason?: string;
      };
      if (!res.ok || !data.ok || !data.url) {
        const msg =
          data.code === "unauthenticated"
            ? "Please sign in first."
            : data.code === "no_price_for_region"
              ? "Pack price not yet configured for your region."
              : data.code === "unknown_pack"
                ? "Unknown upgrade pack selected."
                : data.code === "config_error"
                  ? "Checkout is not configured. Please try again later."
                  : data.reason ?? data.code ?? "Could not start upgrade.";
        setError(msg);
        setBusy(false);
        return;
      }
      window.location.assign(data.url);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not reach the checkout service.",
      );
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-disabled={disabled}
        title={title}
        style={{
          padding: "8px 14px",
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: disabled ? inkMuted : "#1A120A",
          background: disabled ? "transparent" : gold,
          border: disabled ? `1px solid ${border}` : "none",
          borderRadius: 999,
          cursor: disabled ? "not-allowed" : busy ? "wait" : "pointer",
          opacity: disabled ? 0.6 : 1,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {busy ? "Opening Stripe…" : "Upgrade"}
      </button>
      {error ? (
        <span
          role="alert"
          style={{
            fontSize: 10.5,
            color: red,
            maxWidth: 180,
            textAlign: "right",
          }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
