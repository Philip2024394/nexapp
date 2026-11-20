// src/app/nex-native/manage/orders/[orderId]/_dispatch-panel-client.tsx
//
// Seller dispatch editor · PROPOSAL ARTEFACT · 2026-11-17
// -----------------------------------------------------------------------------
// Cream-background world-class panel the seller uses to record dispatch
// details and advance fulfilment state. Pure UI · all mutations go through
// sellerSaveOrderDispatchAction which derives seller identity from the
// verified session (the browser cannot supply seller_account_id).
//
// Gated at render time: the parent server component must only mount this
// when isDispatchFeatureEnabled() is true AND loadOrderDispatchSnapshot()
// returned ok. When the feature flag is off the parent renders a labelled
// BLOCKED placeholder without reading dispatch_* columns.
//
// Design rules:
//   · payment vs fulfilment are separate · we never change payment here
//   · "tracking added" is a separate event from "dispatched"
//   · provider_custom only enabled for postal / sea_freight / other
//   · qty+unit paired · days 1..365 · months 1..12 · sea_freight supported
//   · HTTPS-only tracking URL input
//   · cancellation / refund rules not shown here · payment surface owns them

"use client";

import * as React from "react";
import type {
  DispatchAction,
  DispatchProvider,
  DispatchSaveResult,
  DispatchSnapshot,
} from "@/lib/nex-native/manage-orders/dispatch-service";
import type { TransitUnit } from "@/lib/nex-native/manage-orders/dispatch-eta";
import { sellerSaveOrderDispatchAction } from "./_dispatch-action";

export interface SellerDispatchPanelClientProps {
  readonly snapshot: DispatchSnapshot;
}

const PROVIDERS: readonly {
  value: DispatchProvider;
  label: string;
  custom: boolean;
}[] = [
  { value: "dhl", label: "DHL", custom: false },
  { value: "ups", label: "UPS", custom: false },
  { value: "fedex", label: "FedEx", custom: false },
  { value: "postal", label: "Postal service", custom: true },
  { value: "sea_freight", label: "Sea freight", custom: true },
  { value: "other", label: "Other carrier", custom: true },
];

export function SellerDispatchPanelClient(
  props: SellerDispatchPanelClientProps,
): React.ReactElement {
  const s = props.snapshot;

  const [provider, setProvider] = React.useState<DispatchProvider | "">(
    s.dispatch_provider ?? "",
  );
  const [providerCustom, setProviderCustom] = React.useState<string>(
    s.dispatch_provider_custom ?? "",
  );
  const [trackingNumber, setTrackingNumber] = React.useState<string>(
    s.dispatch_tracking_number ?? "",
  );
  const [trackingUrl, setTrackingUrl] = React.useState<string>(
    s.dispatch_tracking_url ?? "",
  );
  const [qty, setQty] = React.useState<string>(
    s.estimated_transit_qty != null ? String(s.estimated_transit_qty) : "",
  );
  const [unit, setUnit] = React.useState<TransitUnit | "">(
    s.estimated_transit_unit ?? "",
  );
  const [pending, setPending] = React.useState<boolean>(false);
  const [feedback, setFeedback] = React.useState<DispatchSaveResult | null>(
    null,
  );

  const providerMeta = PROVIDERS.find((p) => p.value === provider);
  const providerCustomEnabled = providerMeta?.custom === true;

  const submit = React.useCallback(
    async (action: DispatchAction) => {
      setPending(true);
      try {
        const fd = new FormData();
        fd.set("order_id", s.order_id);
        fd.set("action", action);
        if (provider) fd.set("provider", provider);
        if (providerCustomEnabled && providerCustom.trim().length > 0) {
          fd.set("provider_custom", providerCustom.trim());
        }
        if (trackingNumber.trim().length > 0) {
          fd.set("tracking_number", trackingNumber.trim());
        }
        if (trackingUrl.trim().length > 0) {
          fd.set("tracking_url", trackingUrl.trim());
        }
        if (qty.trim().length > 0 && unit) {
          fd.set("estimated_transit_qty", qty.trim());
          fd.set("estimated_transit_unit", unit);
        }
        const result = await sellerSaveOrderDispatchAction(fd);
        setFeedback(result);
      } finally {
        setPending(false);
      }
    },
    [
      s.order_id,
      provider,
      providerCustom,
      providerCustomEnabled,
      trackingNumber,
      trackingUrl,
      qty,
      unit,
    ],
  );

  return (
    <section
      data-nex-seller-dispatch-panel={s.order_id}
      style={{
        background: "#FAF6EC",
        border: "1px solid #E8DFC4",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <header style={{ fontSize: 15, fontWeight: 600, color: "#3F3A2A" }}>
        Dispatch &amp; tracking
      </header>

      {/* Provider */}
      <label style={labelStyle}>
        <span style={labelTextStyle}>Carrier</span>
        <select
          data-testid="nex-dispatch-provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value as DispatchProvider)}
          disabled={pending}
          style={inputStyle}
        >
          <option value="">(none)</option>
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      {providerCustomEnabled ? (
        <label style={labelStyle}>
          <span style={labelTextStyle}>Carrier name</span>
          <input
            data-testid="nex-dispatch-provider-custom"
            value={providerCustom}
            onChange={(e) => setProviderCustom(e.target.value)}
            maxLength={80}
            disabled={pending}
            placeholder="e.g. Pos Indonesia · 1..80 chars"
            style={inputStyle}
          />
        </label>
      ) : null}

      {/* Tracking number */}
      <label style={labelStyle}>
        <span style={labelTextStyle}>Tracking number</span>
        <input
          data-testid="nex-dispatch-tracking-number"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          maxLength={128}
          disabled={pending}
          placeholder="Optional"
          style={inputStyle}
        />
      </label>

      {/* Tracking URL */}
      <label style={labelStyle}>
        <span style={labelTextStyle}>Tracking URL (https only)</span>
        <input
          data-testid="nex-dispatch-tracking-url"
          type="url"
          inputMode="url"
          value={trackingUrl}
          onChange={(e) => setTrackingUrl(e.target.value)}
          maxLength={1024}
          disabled={pending}
          placeholder="https://…"
          style={inputStyle}
        />
      </label>

      {/* Transit estimate */}
      <div style={{ display: "flex", gap: 8 }}>
        <label style={{ ...labelStyle, flex: "1 1 0" }}>
          <span style={labelTextStyle}>Estimate qty</span>
          <input
            data-testid="nex-dispatch-estimate-qty"
            type="number"
            min={1}
            max={unit === "months" ? 12 : 365}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            disabled={pending}
            style={inputStyle}
          />
        </label>
        <label style={{ ...labelStyle, flex: "1 1 0" }}>
          <span style={labelTextStyle}>Unit</span>
          <select
            data-testid="nex-dispatch-estimate-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value as TransitUnit)}
            disabled={pending}
            style={inputStyle}
          >
            <option value="">(none)</option>
            <option value="days">days</option>
            <option value="months">months</option>
          </select>
        </label>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <ActionButton
          testId="nex-dispatch-save"
          label="Save details"
          onClick={() => submit("save")}
          disabled={pending}
          variant="secondary"
        />
        <ActionButton
          testId="nex-dispatch-mark-preparing"
          label="Mark preparing"
          onClick={() => submit("mark_preparing")}
          disabled={
            pending ||
            !(
              s.dispatch_state === "not_dispatched" ||
              s.dispatch_state === "preparing"
            )
          }
          variant="secondary"
        />
        <ActionButton
          testId="nex-dispatch-mark-dispatched"
          label="Mark dispatched"
          onClick={() => submit("mark_dispatched")}
          disabled={
            pending ||
            !(
              s.dispatch_state === "not_dispatched" ||
              s.dispatch_state === "preparing" ||
              s.dispatch_state === "dispatched"
            )
          }
          variant="primary"
        />
        <ActionButton
          testId="nex-dispatch-mark-delivered"
          label="Mark delivered"
          onClick={() => submit("mark_delivered")}
          disabled={
            pending ||
            !(s.dispatch_state === "dispatched" || s.dispatch_state === "delivered")
          }
          variant="primary"
        />
      </div>

      {feedback ? (
        <div
          data-testid="nex-dispatch-feedback"
          role="status"
          aria-live="polite"
          style={{
            fontSize: 12,
            color: feedback.ok ? "#2B6B2B" : "#A1340A",
            background: feedback.ok ? "#EAF2DC" : "#FBE7DB",
            borderRadius: 8,
            padding: "6px 10px",
          }}
        >
          {feedback.ok ? (
            <>
              Saved. State is now <strong>{feedback.dispatch_state}</strong>.
              {feedback.notified_buyer
                ? " Buyer notified."
                : ""}
            </>
          ) : (
            <>Error: {feedback.reason}{feedback.message ? ` · ${feedback.message}` : ""}</>
          )}
        </div>
      ) : null}
    </section>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const labelTextStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#6E6756",
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #D9CFAF",
  background: "#FFFDF6",
  fontSize: 13,
  fontFamily: "inherit",
  color: "#3F3A2A",
};

function ActionButton(props: {
  testId: string;
  label: string;
  onClick: () => void;
  disabled: boolean;
  variant: "primary" | "secondary";
}): React.ReactElement {
  const base: React.CSSProperties = {
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid transparent",
    fontSize: 13,
    fontWeight: 600,
    cursor: props.disabled ? "not-allowed" : "pointer",
    opacity: props.disabled ? 0.5 : 1,
  };
  const variant: React.CSSProperties =
    props.variant === "primary"
      ? { background: "#6F8F3D", color: "#FFFFFF" }
      : { background: "#FFFDF6", color: "#3F3A2A", borderColor: "#D9CFAF" };
  return (
    <button
      type="button"
      data-testid={props.testId}
      onClick={props.onClick}
      disabled={props.disabled}
      style={{ ...base, ...variant }}
    >
      {props.label}
    </button>
  );
}
