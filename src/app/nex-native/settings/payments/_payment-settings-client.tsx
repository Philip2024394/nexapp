"use client";

// src/app/nex-native/settings/payments/_payment-settings-client.tsx
//
// Interactive Payment-settings card · local state only. Persistence
// ships with Phase B (nex.payment_provider_config table + bucket
// authorisation). The owner approved building the UI as interactive
// ahead of persistence so sellers can see the real interaction.

import * as React from "react";

const PALETTE = {
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  panel: "rgba(27, 81, 56, 0.55)",
  borderSoft: "rgba(198, 161, 91, 0.35)",
};

type Method = "Stripe" | "PayPal" | "QR Code";
const METHODS: readonly Method[] = ["Stripe", "PayPal", "QR Code"];

export function PaymentSettingsClient(): React.ReactElement {
  const [preferred, setPreferred] = React.useState<Method>("Stripe");
  const [enabled, setEnabled] = React.useState<Record<Method, boolean>>({
    Stripe: true,
    PayPal: false,
    "QR Code": false,
  });

  const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 10,
    background: "rgba(0,0,0,0.2)",
    border: `1px solid ${PALETTE.borderSoft}`,
  };

  return (
    <section
      data-nex-payment-settings
      style={{
        margin: "0 0 14px",
        padding: "18px 20px",
        borderRadius: 16,
        background: PALETTE.panel,
        border: `1px solid ${PALETTE.borderSoft}`,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 800,
          color: PALETTE.textPrimary,
          letterSpacing: "-0.01em",
        }}
      >
        Payment settings
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: PALETTE.textMuted,
          lineHeight: 1.5,
        }}
      >
        Choose your preferred checkout method and enable or disable
        individual payment options.
      </p>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={row}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: PALETTE.textPrimary }}>
              Preferred at checkout
            </div>
            <div style={{ fontSize: 11, color: PALETTE.textMuted, marginTop: 2 }}>
              First seen by buyers
            </div>
          </div>
          <select
            value={preferred}
            onChange={(e) => setPreferred(e.target.value as Method)}
            data-nex-preferred-method
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              background: "rgba(0,0,0,0.5)",
              border: `1px solid ${PALETTE.borderSoft}`,
              color: PALETTE.textPrimary,
              fontFamily: "inherit",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <h3
          style={{
            margin: "6px 0 2px",
            fontSize: 11,
            fontWeight: 800,
            color: PALETTE.secondary,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Buyer checkout options
        </h3>

        {METHODS.map((name) => (
          <div
            key={name}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.2)",
              border: `1px solid ${PALETTE.borderSoft}`,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: PALETTE.textPrimary }}>
                {name}
              </div>
              <input
                type="checkbox"
                checked={enabled[name]}
                onChange={(e) => setEnabled((prev) => ({ ...prev, [name]: e.target.checked }))}
                data-nex-method-toggle={name}
                style={{
                  transform: "scale(1.2)",
                  cursor: "pointer",
                  accentColor: "#F6A623",
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: PALETTE.textMuted }}>
              Enable / Disable
            </div>
            <div style={{ fontSize: 11, color: PALETTE.textMuted }}>
              {enabled[name] ? "on" : "off"}
            </div>
          </div>
        ))}
      </div>

      <p
        style={{
          margin: "4px 0 0",
          fontSize: 10.5,
          color: PALETTE.textMuted,
          fontStyle: "italic",
          lineHeight: 1.5,
        }}
      >
        Phase B pending: nex.payment_provider_config table and storage
        bucket require separate owner authorisation.
      </p>
    </section>
  );
}
