"use client";

// src/components/nex-native/product-create/DeliveryEditor.tsx
//
// Owner-authorised 2026-10-31 (SIMPLIFIED per owner directive):
//   LOCAL  = km-radius dropdown + price (anchored from the seller's
//            set shop location · nex_business.location_lat/lng).
//   EXPORT = country dropdown + price + parcel weight (kg).
//
// No dispatch days, no delivery-time range, no COD toggle, no min-
// order, no cities/areas, no HS codes. The owner intentionally
// stripped these back. Future expansion goes through its own owner-
// approved iteration.
//
// Scope-aware: shows only the block(s) the parent form's market
// scope demands.

import * as React from "react";
import {
  COUNTRIES,
  LOCAL_DELIVERY_RADIUS_KM,
  countryName,
} from "@/lib/nex-native/catalogue/countries";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const INK = "#102033";
const INK_DIM = "#4A6080";
const INK_MUTE = "#8BA9D1";
const ACCENT = "#00AFFF";
const RIM = "rgba(0, 175, 255, 0.18)";
const BG = "#FFFFFF";
const RED = "#C8102E";

const CURRENCIES = ["IDR", "USD", "EUR", "GBP", "MYR", "SGD", "AUD", "JPY", "CNY"] as const;

// ─── UI draft shapes (strings for inputs, converted to numbers on save) ──

export interface LocalRadiusDraft {
  readonly km: string;           // one of LOCAL_DELIVERY_RADIUS_KM
  readonly priceMajor: string;
  readonly currency: string;
}

export interface ExportCountryDraft {
  readonly iso: string;
  readonly priceMajor: string;
  readonly currency: string;
  readonly weightKg: string;
}

export interface DeliveryEditorValue {
  readonly local: readonly LocalRadiusDraft[];
  readonly export: readonly ExportCountryDraft[];
}

export const EMPTY_LOCAL_RADIUS: LocalRadiusDraft = { km: "", priceMajor: "", currency: "IDR" };
export const EMPTY_EXPORT_COUNTRY: ExportCountryDraft = { iso: "", priceMajor: "", currency: "USD", weightKg: "" };
export const EMPTY_DELIVERY: DeliveryEditorValue = { local: [], export: [] };

export interface DeliveryEditorProps {
  readonly scope: "local" | "export" | "both";
  readonly value: DeliveryEditorValue;
  readonly onChange: (next: DeliveryEditorValue) => void;
  /** Optional display label for the seller's set shop location
   *  (e.g. "Yogyakarta · (-7.80, 110.37)"). When supplied, the
   *  local block surfaces it so the seller can see what the km
   *  radius is anchored to. */
  readonly sellerLocationLabel?: string | null;
}

export function DeliveryEditor({ scope, value, onChange, sellerLocationLabel }: DeliveryEditorProps): React.JSX.Element {
  const showLocal  = scope === "local"  || scope === "both";
  const showExport = scope === "export" || scope === "both";

  return (
    <section aria-labelledby="nex-delivery-heading" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h2 id="nex-delivery-heading" style={{ fontSize: 15, fontWeight: 800, margin: 0, color: INK }}>
          Delivery
        </h2>
        <p style={{ fontSize: 12, color: INK_DIM, margin: "4px 0 0", lineHeight: 1.5 }}>
          Set a price per local distance ring and a price per export country. Keep it simple — add as many as you want.
        </p>
      </div>

      {showLocal ? (
        <LocalBlock
          value={value.local}
          onChange={(next) => onChange({ ...value, local: next })}
          sellerLocationLabel={sellerLocationLabel ?? null}
        />
      ) : null}

      {showExport ? (
        <ExportBlock
          value={value.export}
          onChange={(next) => onChange({ ...value, export: next })}
        />
      ) : null}
    </section>
  );
}

// ─── Local block ────────────────────────────────────────────────────

function LocalBlock(props: {
  value: readonly LocalRadiusDraft[];
  onChange: (next: readonly LocalRadiusDraft[]) => void;
  sellerLocationLabel: string | null;
}): React.JSX.Element {
  const addRow = () => props.onChange([...props.value, EMPTY_LOCAL_RADIUS]);
  const updateAt = (i: number, next: LocalRadiusDraft) => {
    const copy = [...props.value];
    copy[i] = next;
    props.onChange(copy);
  };
  const removeAt = (i: number) => props.onChange(props.value.filter((_, idx) => idx !== i));

  return (
    <div style={blockStyle}>
      <SectionHeading
        title="Local delivery"
        subtitle={
          props.sellerLocationLabel
            ? `Anchored from your set location: ${props.sellerLocationLabel}`
            : "Prices extend out from the shop location you set on Manage → Shop."
        }
      />
      {props.value.length === 0 ? (
        <div style={emptyStyle}>No local rings yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {props.value.map((r, i) => (
            <LocalRow
              key={i}
              value={r}
              used={new Set(props.value.map((x) => x.km).filter((km, j) => j !== i && km !== ""))}
              onChange={(next) => updateAt(i, next)}
              onRemove={() => removeAt(i)}
            />
          ))}
        </div>
      )}
      <button type="button" onClick={addRow} style={addBtnStyle}>+ Add local ring</button>
    </div>
  );
}

function LocalRow(props: {
  value: LocalRadiusDraft;
  used: Set<string>;
  onChange: (next: LocalRadiusDraft) => void;
  onRemove: () => void;
}): React.JSX.Element {
  const set = <K extends keyof LocalRadiusDraft>(k: K, v: LocalRadiusDraft[K]) => props.onChange({ ...props.value, [k]: v });

  return (
    <div style={rowStyle}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
        <Field label="Radius">
          <select value={props.value.km} onChange={(e) => set("km", e.target.value)} style={inputStyle}>
            <option value="">— pick —</option>
            {LOCAL_DELIVERY_RADIUS_KM.map((km) => {
              const str = String(km);
              const alreadyUsed = props.used.has(str) && props.value.km !== str;
              return (
                <option key={km} value={str} disabled={alreadyUsed}>
                  Within {km} km{alreadyUsed ? " (set)" : ""}
                </option>
              );
            })}
          </select>
        </Field>
        <Field label="Delivery price">
          <input type="number" min={0} step="0.01" value={props.value.priceMajor} onChange={(e) => set("priceMajor", e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Currency">
          <select value={props.value.currency} onChange={(e) => set("currency", e.target.value)} style={inputStyle}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <button type="button" onClick={props.onRemove} aria-label="Remove radius" style={xBtnStyle}>×</button>
      </div>
    </div>
  );
}

// ─── Export block ───────────────────────────────────────────────────

function ExportBlock(props: {
  value: readonly ExportCountryDraft[];
  onChange: (next: readonly ExportCountryDraft[]) => void;
}): React.JSX.Element {
  const addRow = () => props.onChange([...props.value, EMPTY_EXPORT_COUNTRY]);
  const updateAt = (i: number, next: ExportCountryDraft) => {
    const copy = [...props.value];
    copy[i] = next;
    props.onChange(copy);
  };
  const removeAt = (i: number) => props.onChange(props.value.filter((_, idx) => idx !== i));

  return (
    <div style={blockStyle}>
      <SectionHeading
        title="Export destinations"
        subtitle="Pick a country from the dropdown, set a price and the parcel weight. Repeat for every country you ship to."
      />
      {props.value.length === 0 ? (
        <div style={emptyStyle}>No export countries yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {props.value.map((r, i) => (
            <ExportRow
              key={i}
              value={r}
              used={new Set(props.value.map((x) => x.iso).filter((iso, j) => j !== i && iso !== ""))}
              onChange={(next) => updateAt(i, next)}
              onRemove={() => removeAt(i)}
            />
          ))}
        </div>
      )}
      <button type="button" onClick={addRow} style={addBtnStyle}>+ Add country</button>
    </div>
  );
}

function ExportRow(props: {
  value: ExportCountryDraft;
  used: Set<string>;
  onChange: (next: ExportCountryDraft) => void;
  onRemove: () => void;
}): React.JSX.Element {
  const set = <K extends keyof ExportCountryDraft>(k: K, v: ExportCountryDraft[K]) => props.onChange({ ...props.value, [k]: v });

  return (
    <div style={rowStyle}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
        <Field label="Country">
          <select value={props.value.iso} onChange={(e) => set("iso", e.target.value)} style={inputStyle}>
            <option value="">— pick a country —</option>
            {COUNTRIES.map((c) => {
              const alreadyUsed = props.used.has(c.iso) && props.value.iso !== c.iso;
              return (
                <option key={c.iso} value={c.iso} disabled={alreadyUsed}>
                  {c.name}{alreadyUsed ? " (set)" : ""}
                </option>
              );
            })}
          </select>
        </Field>
        <Field label="Price">
          <input type="number" min={0} step="0.01" value={props.value.priceMajor} onChange={(e) => set("priceMajor", e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Currency">
          <select value={props.value.currency} onChange={(e) => set("currency", e.target.value)} style={inputStyle}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Weight (kg)">
          <input type="number" min={0} step="0.01" value={props.value.weightKg} onChange={(e) => set("weightKg", e.target.value)} style={inputStyle} />
        </Field>
        <button type="button" onClick={props.onRemove} aria-label={`Remove ${countryName(props.value.iso)}`} style={xBtnStyle}>×</button>
      </div>
    </div>
  );
}

// ─── Shared primitives ──────────────────────────────────────────────

function SectionHeading(props: { title: string; subtitle: string }): React.JSX.Element {
  return (
    <div>
      <h3 style={{ fontSize: 12, fontWeight: 800, margin: 0, color: INK_DIM, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {props.title}
      </h3>
      <p style={{ fontSize: 11.5, color: INK_DIM, margin: "2px 0 0", lineHeight: 1.5 }}>{props.subtitle}</p>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: INK_DIM, textTransform: "uppercase", letterSpacing: "0.04em" }}>{props.label}</span>
      {props.children}
    </label>
  );
}

const blockStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: `1.5px solid ${RIM}`,
  background: BG,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};
const rowStyle: React.CSSProperties = {
  padding: 8,
  borderRadius: 10,
  border: `1.5px solid ${RIM}`,
  background: "rgba(0, 175, 255, 0.03)",
};
const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: `1.5px solid ${RIM}`,
  background: BG,
  color: INK,
  fontSize: 13,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: NEX_FONT_SANS,
};
const emptyStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: `1.5px dashed ${RIM}`,
  color: INK_MUTE,
  fontSize: 12,
  fontStyle: "italic",
};
const addBtnStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  padding: "8px 14px",
  borderRadius: 999,
  border: `1.5px solid ${ACCENT}`,
  background: "transparent",
  color: ACCENT,
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: NEX_FONT_SANS,
};
const xBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  padding: 0,
  borderRadius: "50%",
  border: "none",
  background: "rgba(200, 16, 46, 0.1)",
  color: RED,
  fontSize: 18,
  fontWeight: 900,
  cursor: "pointer",
  lineHeight: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  alignSelf: "end",
};
