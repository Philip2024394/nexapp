"use client";

// src/components/nex-native/product-create/MarketSelector.tsx
//
// Progressive-disclosure market selector for the shared Create Product
// form. Owner-authorised 2026-10-30 as part of the world-class upload
// brief.
//
// Visual contract:
//   · Three radio tiles side-by-side: Local · Export · Both
//   · Fields reveal below based on the current scope:
//       - Local        → LocalMarketFields
//       - Export       → ExportMarketFields
//       - Both         → Local then Export sections
//   · Compact fields grid · one column on narrow widths · two on wide.
//
// This component is a pure value-in/value-out primitive. It knows
// nothing about the server action. The parent form bundles the market
// value with the category spec and calls createProductAction.

import * as React from "react";
import {
  LocalMarketFields,
  ExportMarketFields,
  type SalesScope,
} from "@/lib/nex-native/catalogue/market-spec";
import type { SpecFieldConfig } from "@/lib/nex-native/catalogue/specs/types";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const INK = "#102033";
const INK_DIM = "#4A6080";
const ACCENT = "#00AFFF";
const RIM = "rgba(0, 175, 255, 0.18)";
const RIM_STRONG = "rgba(0, 175, 255, 0.55)";
const BG = "#FFFFFF";

export interface MarketSelectorValue {
  readonly scope: SalesScope;
  readonly local: Record<string, unknown>;
  readonly export: Record<string, unknown>;
}

export const EMPTY_MARKET_VALUE: MarketSelectorValue = {
  scope: "local",
  local: {},
  export: {},
};

export interface MarketSelectorProps {
  readonly value: MarketSelectorValue;
  readonly onChange: (next: MarketSelectorValue) => void;
}

export function MarketSelector(props: MarketSelectorProps): React.JSX.Element {
  const { value, onChange } = props;

  const setScope = (scope: SalesScope) => onChange({ ...value, scope });
  const setLocal = (next: Record<string, unknown>) =>
    onChange({ ...value, local: next });
  const setExport = (next: Record<string, unknown>) =>
    onChange({ ...value, export: next });

  const showLocal = value.scope === "local" || value.scope === "both";
  const showExport = value.scope === "export" || value.scope === "both";

  return (
    <section aria-labelledby="nex-market-heading" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h2 id="nex-market-heading" style={{ fontSize: 15, fontWeight: 800, margin: 0, color: INK }}>
          Sales markets
        </h2>
        <p style={{ fontSize: 12.5, color: INK_DIM, margin: "4px 0 0", lineHeight: 1.5 }}>
          Choose where you sell this product. One product · one record · multiple sales capabilities.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <ScopeTile active={value.scope === "local"} label="Local" blurb="Domestic sales only" onClick={() => setScope("local")} />
        <ScopeTile active={value.scope === "export"} label="Export" blurb="International only" onClick={() => setScope("export")} />
        <ScopeTile active={value.scope === "both"} label="Both" blurb="Local + export" onClick={() => setScope("both")} />
      </div>

      {showLocal ? (
        <MarketSection title="Local sales details" value={value.local} fields={LocalMarketFields} onChange={setLocal} />
      ) : null}
      {showExport ? (
        <MarketSection title="Export sales details" value={value.export} fields={ExportMarketFields} onChange={setExport} note="NEX does not verify legal export compliance · all fields seller-declared." />
      ) : null}
    </section>
  );
}

function ScopeTile(props: { active: boolean; label: string; blurb: string; onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.active}
      style={{
        padding: "12px 10px",
        borderRadius: 12,
        border: `1.5px solid ${props.active ? ACCENT : RIM}`,
        background: props.active ? "rgba(0, 175, 255, 0.08)" : BG,
        color: INK,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        textAlign: "left",
        fontFamily: NEX_FONT_SANS,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 800, color: props.active ? ACCENT : INK }}>{props.label}</span>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: INK_DIM }}>{props.blurb}</span>
    </button>
  );
}

interface MarketSectionProps {
  readonly title: string;
  readonly fields: readonly SpecFieldConfig[];
  readonly value: Record<string, unknown>;
  readonly onChange: (next: Record<string, unknown>) => void;
  readonly note?: string;
}

function MarketSection(props: MarketSectionProps): React.JSX.Element {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        border: `1.5px solid ${RIM}`,
        background: BG,
      }}
    >
      <h3 style={{ fontSize: 13, fontWeight: 800, margin: 0, marginBottom: 10, color: INK }}>
        {props.title}
      </h3>
      {props.note ? (
        <p style={{ fontSize: 11.5, color: INK_DIM, margin: "0 0 10px", lineHeight: 1.5 }}>{props.note}</p>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
        {props.fields.map((f) => (
          <MarketField
            key={f.key}
            field={f}
            value={props.value[f.key]}
            onChange={(v) => props.onChange({ ...props.value, [f.key]: v })}
          />
        ))}
      </div>
    </div>
  );
}

function MarketField(props: {
  field: SpecFieldConfig;
  value: unknown;
  onChange: (next: unknown) => void;
}): React.JSX.Element {
  const { field, value, onChange } = props;
  const inputStyle: React.CSSProperties = {
    padding: "9px 11px",
    borderRadius: 10,
    border: `1.5px solid ${RIM_STRONG}`,
    background: BG,
    color: INK,
    fontFamily: NEX_FONT_SANS,
    fontSize: 13,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>{field.label}</span>
      {field.kind === "textarea" ? (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          rows={2}
          style={{ ...inputStyle, resize: "vertical", minHeight: 54 }}
        />
      ) : field.kind === "select" ? (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          style={inputStyle}
        >
          <option value="">—</option>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : field.kind === "number" ? (
        <input
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          step="any"
          style={inputStyle}
        />
      ) : (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          style={inputStyle}
        />
      )}
      {field.helpText ? (
        <span style={{ fontSize: 11, color: INK_DIM, lineHeight: 1.4 }}>{field.helpText}</span>
      ) : null}
    </label>
  );
}
