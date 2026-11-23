// src/app/nex-native/switch/_switch-calculator-client.tsx
//
// Client-side switch cost calculator.
//
// Owner directive 2026-11-23:
//   · Accept manual rates (percent commission + fixed per-order fee).
//   · Presets are optional, user-selectable, each with a dated source
//     citation. They are NOT universal truth · the user's real contract
//     always wins.
//   · Single currency per calculation. No silent FX.
//   · Zero sales → "nothing to compare".
//   · Negative savings → honest "NEX costs more at this volume" copy.
//   · Monthly numbers projected to annual MUST be labelled "projected".
//   · 22.5% Lazada / 17.4% Shopee are dated examples only.
//
// The NEX monthly fee is passed in from the server as the user's
// detected country · they can override it (e.g. to compare the Rp 89,000
// price while in Europe).

"use client";

import * as React from "react";
import {
  PRESETS,
  clampNonNegative,
  computeSwitchComparison,
} from "./_calc-helpers";

const PALETTE = {
  bg: "#123D2B",
  cardBg: "rgba(10, 28, 20, 0.72)",
  cardBorder: "rgba(198, 161, 91, 0.35)",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  textDim: "#7D9BC0",
  accent: "#C6A15B",
  savings: "#7FD4A1",
  costMore: "#F5A97F",
};

// -----------------------------------------------------------------------------
// Formatters · single-currency rule
// -----------------------------------------------------------------------------

function formatMoney(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: amount >= 1000 ? 0 : 2,
    }).format(amount);
  } catch {
    // Fallback for unsupported ISO codes
    return `${currency} ${amount.toLocaleString(undefined, {
      maximumFractionDigits: amount >= 1000 ? 0 : 2,
    })}`;
  }
}

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

export interface SwitchCalculatorClientProps {
  readonly initialCurrency: string;
  readonly initialNexMonthlyAmount: number;
  readonly countryLabel: string;
}

export function SwitchCalculatorClient({
  initialCurrency,
  initialNexMonthlyAmount,
  countryLabel,
}: SwitchCalculatorClientProps): React.JSX.Element {
  // -- Inputs --------------------------------------------------------------
  const [currency, setCurrency] = React.useState<string>(initialCurrency || "USD");
  const [monthlyGmv, setMonthlyGmv] = React.useState<string>("");
  const [orderCount, setOrderCount] = React.useState<string>("");
  const [commissionPercent, setCommissionPercent] = React.useState<string>("");
  const [fixedPerOrder, setFixedPerOrder] = React.useState<string>("");
  const [nexMonthly, setNexMonthly] = React.useState<string>(
    initialNexMonthlyAmount > 0 ? String(initialNexMonthlyAmount) : "",
  );
  const [presetId, setPresetId] = React.useState<string>("manual");

  // -- Preset handler ------------------------------------------------------
  function applyPreset(id: string): void {
    setPresetId(id);
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    if (p.id === "manual") return; // leave current values alone
    setCommissionPercent(String(p.commissionPercent));
    setFixedPerOrder(String(p.fixedPerOrder));
    if (p.currency) setCurrency(p.currency);
  }

  // -- Derived math (delegated to pure helper for testability) --------------
  const gmv = clampNonNegative(parseFloat(monthlyGmv));
  const result = computeSwitchComparison({
    monthlyGmv: parseFloat(monthlyGmv),
    orderCount: parseFloat(orderCount),
    commissionPercent: parseFloat(commissionPercent),
    fixedPerOrder: parseFloat(fixedPerOrder),
    nexMonthly: parseFloat(nexMonthly),
  });
  const {
    hasAnySales,
    currentPlatformMonthlyCost,
    nexMonthlyCost,
    monthlySavings,
    annualSavingsProjected,
    nexCostsMore,
    effectiveTakeRatePercent,
    nexTakeRatePercent,
  } = result;

  const activePreset = PRESETS.find((p) => p.id === presetId);

  // -- Render --------------------------------------------------------------
  return (
    <section
      aria-label="Switch cost calculator"
      style={{
        padding: 16,
        borderRadius: 14,
        background: PALETTE.cardBg,
        border: `1px solid ${PALETTE.cardBorder}`,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <header>
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 800,
            color: PALETTE.text,
            letterSpacing: "-0.01em",
          }}
        >
          Your numbers
        </h2>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 11,
            color: PALETTE.textDim,
            lineHeight: 1.5,
          }}
        >
          Detected market: {countryLabel}. Change the currency if you bill
          elsewhere — this tool never auto-converts.
        </p>
      </header>

      {/* Preset picker */}
      <div>
        <Label>Reference rate (optional · dated example only)</Label>
        <select
          value={presetId}
          onChange={(e) => applyPreset(e.target.value)}
          style={inputStyle()}
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {activePreset && activePreset.id !== "manual" ? (
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 10,
              color: PALETTE.textDim,
              lineHeight: 1.5,
            }}
          >
            Source: {activePreset.sourceCitation}. Last verified{" "}
            {activePreset.lastVerified}. {activePreset.note}
          </p>
        ) : (
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 10,
              color: PALETTE.textDim,
              lineHeight: 1.5,
            }}
          >
            Presets are dated examples, not universal truth. Your real
            contract always wins.
          </p>
        )}
      </div>

      {/* Currency */}
      <Field label="Currency (ISO code · one currency per calculation)">
        <input
          type="text"
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 4))}
          placeholder="EUR"
          style={inputStyle()}
          inputMode="text"
        />
      </Field>

      {/* GMV */}
      <Field label="Monthly sales (GMV) in this currency">
        <input
          type="number"
          min="0"
          step="0.01"
          value={monthlyGmv}
          onChange={(e) => setMonthlyGmv(e.target.value)}
          placeholder="e.g. 5000"
          style={inputStyle()}
          inputMode="decimal"
        />
      </Field>

      {/* Orders */}
      <Field label="Monthly order count">
        <input
          type="number"
          min="0"
          step="1"
          value={orderCount}
          onChange={(e) => setOrderCount(e.target.value)}
          placeholder="e.g. 150"
          style={inputStyle()}
          inputMode="numeric"
        />
      </Field>

      {/* Commission */}
      <Field label="Your actual commission rate (%)">
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={commissionPercent}
          onChange={(e) => setCommissionPercent(e.target.value)}
          placeholder="e.g. 10"
          style={inputStyle()}
          inputMode="decimal"
        />
      </Field>

      {/* Fixed per order */}
      <Field label="Fixed fee per order (in this currency)">
        <input
          type="number"
          min="0"
          step="0.01"
          value={fixedPerOrder}
          onChange={(e) => setFixedPerOrder(e.target.value)}
          placeholder="e.g. 0.50"
          style={inputStyle()}
          inputMode="decimal"
        />
      </Field>

      {/* NEX monthly override */}
      <Field label="NEX Shop monthly subscription (in this currency)">
        <input
          type="number"
          min="0"
          step="0.01"
          value={nexMonthly}
          onChange={(e) => setNexMonthly(e.target.value)}
          placeholder="e.g. 4.99"
          style={inputStyle()}
          inputMode="decimal"
        />
      </Field>

      {/* Results */}
      <div
        style={{
          marginTop: 4,
          padding: 14,
          borderRadius: 12,
          background: "rgba(0,0,0,0.3)",
          border: `1px solid ${PALETTE.cardBorder}`,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 800,
            color: PALETTE.accent,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Comparison
        </h3>

        {!hasAnySales ? (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: PALETTE.textMuted,
              lineHeight: 1.6,
            }}
          >
            No sales entered yet — nothing to compare. Add your monthly GMV
            and order count above to see a cost comparison.
          </p>
        ) : (
          <>
            <ResultRow
              label="Current platform · monthly cost"
              value={formatMoney(currentPlatformMonthlyCost, currency)}
              sublabel={`Effective take-rate: ${effectiveTakeRatePercent.toFixed(2)}% of GMV`}
            />
            <ResultRow
              label="NEX Shop · monthly cost"
              value={formatMoney(nexMonthlyCost, currency)}
              sublabel={
                gmv > 0
                  ? `Effective take-rate: ${nexTakeRatePercent.toFixed(2)}% of GMV (flat fee, no commission)`
                  : "Flat monthly fee · no commission on sales"
              }
            />

            <hr
              style={{
                border: "none",
                borderTop: `1px solid ${PALETTE.cardBorder}`,
                margin: "4px 0",
              }}
            />

            {nexCostsMore ? (
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 800,
                    color: PALETTE.costMore,
                  }}
                >
                  NEX costs more at this volume
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 11,
                    color: PALETTE.textMuted,
                    lineHeight: 1.55,
                  }}
                >
                  Difference: {formatMoney(Math.abs(monthlySavings), currency)}{" "}
                  per month. At very low sales volume the flat NEX fee can
                  exceed what a percentage-based platform charges. NEX makes
                  sense once your GMV crosses the break-even point for your
                  platform's commission rate.
                </p>
              </div>
            ) : (
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 800,
                    color: PALETTE.savings,
                  }}
                >
                  Monthly savings · {formatMoney(monthlySavings, currency)}
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 11,
                    color: PALETTE.textMuted,
                    lineHeight: 1.55,
                  }}
                >
                  Projected annual savings:{" "}
                  <strong style={{ color: PALETTE.text }}>
                    {formatMoney(annualSavingsProjected, currency)}
                  </strong>
                  . "Projected" means 12× your current month — not a verified
                  12-month history.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Honesty footer */}
      <p
        style={{
          margin: 0,
          fontSize: 10,
          color: PALETTE.textDim,
          lineHeight: 1.6,
        }}
      >
        Platform charges only. This does not include payment-processor fees
        (Stripe, PayPal, local banks), paid promotion, logistics, warehousing,
        or buyer-protection schemes. Those costs vary by provider and are not
        auto-replaced by a NEX subscription.
      </p>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Small presentational helpers
// -----------------------------------------------------------------------------

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Label({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <label
      style={{
        display: "block",
        fontSize: 11,
        fontWeight: 700,
        color: PALETTE.textMuted,
        marginBottom: 6,
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </label>
  );
}

function ResultRow({
  label,
  value,
  sublabel,
}: {
  readonly label: string;
  readonly value: string;
  readonly sublabel?: string;
}): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 12, color: PALETTE.textMuted }}>{label}</span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: PALETTE.text,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
      </div>
      {sublabel ? (
        <span style={{ fontSize: 10, color: PALETTE.textDim, lineHeight: 1.5 }}>
          {sublabel}
        </span>
      ) : null}
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    fontSize: 14,
    fontFamily: "inherit",
    color: PALETTE.text,
    background: "rgba(0,0,0,0.35)",
    border: `1px solid ${PALETTE.cardBorder}`,
    borderRadius: 10,
    outline: "none",
  };
}
