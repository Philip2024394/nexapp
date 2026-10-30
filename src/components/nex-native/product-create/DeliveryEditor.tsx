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
  readonly deliveryDays: string; // owner directive 2026-10-31
}

export interface ExportCountryDraft {
  readonly iso: string;
  readonly priceMajor: string;
  readonly currency: string;
  readonly deliveryDays: string; // owner directive 2026-10-31
}

export interface PackageDraft {
  readonly dimensions: string;
  readonly weightKg: string;
}

export interface DeliveryEditorValue {
  readonly packageInfo: PackageDraft;
  readonly local: readonly LocalRadiusDraft[];
  readonly export: readonly ExportCountryDraft[];
}

export const EMPTY_LOCAL_RADIUS: LocalRadiusDraft = { km: "", priceMajor: "", currency: "IDR", deliveryDays: "" };
export const EMPTY_EXPORT_COUNTRY: ExportCountryDraft = { iso: "", priceMajor: "", currency: "USD", deliveryDays: "" };
export const EMPTY_PACKAGE: PackageDraft = { dimensions: "", weightKg: "" };
export const EMPTY_DELIVERY: DeliveryEditorValue = { packageInfo: EMPTY_PACKAGE, local: [], export: [] };

export interface DeliveryEditorProps {
  readonly scope: "local" | "export" | "both";
  readonly value: DeliveryEditorValue;
  readonly onChange: (next: DeliveryEditorValue) => void;
  /** Product-level currency chosen at the top of the form. Delivery
   *  rows no longer carry their own currency dropdown · they all
   *  inherit this. Owner directive 2026-10-31: "we know currency at
   *  top of page so we dont need more than 1 currency on the page". */
  readonly productCurrency: string;
  /** Optional display label for the seller's set shop location. */
  readonly sellerLocationLabel?: string | null;
}

export function DeliveryEditor({ scope, value, onChange, productCurrency, sellerLocationLabel }: DeliveryEditorProps): React.JSX.Element {
  const showLocal  = scope === "local"  || scope === "both";
  const showExport = scope === "export" || scope === "both";

  return (
    <section aria-labelledby="nex-delivery-heading" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h2 id="nex-delivery-heading" style={{ fontSize: 15, fontWeight: 800, margin: 0, color: INK }}>
          Delivery
        </h2>
        <p style={{ fontSize: 12, color: INK_DIM, margin: "4px 0 0", lineHeight: 1.5 }}>
          Set a price per local distance ring and a price per export country.
        </p>
      </div>

      <PackageBlock
        value={value.packageInfo}
        onChange={(next) => onChange({ ...value, packageInfo: next })}
      />

      {showLocal ? (
        <LocalBlock
          value={value.local}
          onChange={(next) => onChange({ ...value, local: next })}
          productCurrency={productCurrency}
          sellerLocationLabel={sellerLocationLabel ?? null}
        />
      ) : null}

      {showExport ? (
        <ExportBlock
          value={value.export}
          onChange={(next) => onChange({ ...value, export: next })}
          productCurrency={productCurrency}
        />
      ) : null}
    </section>
  );
}

function PackageBlock(props: {
  value: PackageDraft;
  onChange: (next: PackageDraft) => void;
}): React.JSX.Element {
  const set = <K extends keyof PackageDraft>(k: K, v: PackageDraft[K]) => props.onChange({ ...props.value, [k]: v });
  return (
    <div style={blockStyle}>
      <SectionHeading
        title="Package size & weight"
        subtitle="One parcel per product."
      />
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <Field label="Dimensions (L × W × H)">
          <input
            type="text"
            value={props.value.dimensions}
            onChange={(e) => set("dimensions", e.target.value)}
            placeholder="e.g. 30 × 20 × 10 cm"
            maxLength={80}
            style={inputStyle}
          />
        </Field>
        <Field label="Weight (kg)">
          <input
            type="number"
            min={0}
            step="0.01"
            value={props.value.weightKg}
            onChange={(e) => set("weightKg", e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>
    </div>
  );
}

// ─── Local block ────────────────────────────────────────────────────

function LocalBlock(props: {
  value: readonly LocalRadiusDraft[];
  onChange: (next: readonly LocalRadiusDraft[]) => void;
  productCurrency: string;
  sellerLocationLabel: string | null;
}): React.JSX.Element {
  const addRow = () => props.onChange([...props.value, { ...EMPTY_LOCAL_RADIUS, currency: props.productCurrency }]);
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
              productCurrency={props.productCurrency}
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
  productCurrency: string;
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
        <Field label="Price">
          <input type="number" min={0} step="0.01" value={props.value.priceMajor} onChange={(e) => set("priceMajor", e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Delivery (days)">
          <input type="number" min={1} value={props.value.deliveryDays} onChange={(e) => set("deliveryDays", e.target.value)} placeholder="e.g. 2" style={inputStyle} />
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
  productCurrency: string;
}): React.JSX.Element {
  const addRow = () => props.onChange([...props.value, { ...EMPTY_EXPORT_COUNTRY, currency: props.productCurrency }]);
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
        subtitle="Pick a country and set the shipping price. Weight comes from Package size & weight above."
      />
      {props.value.length === 0 ? (
        <div style={emptyStyle}>No export countries yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {props.value.map((r, i) => (
            <ExportRow
              key={i}
              value={r}
              productCurrency={props.productCurrency}
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
  productCurrency: string;
  used: Set<string>;
  onChange: (next: ExportCountryDraft) => void;
  onRemove: () => void;
}): React.JSX.Element {
  const set = <K extends keyof ExportCountryDraft>(k: K, v: ExportCountryDraft[K]) => props.onChange({ ...props.value, [k]: v });

  return (
    <div style={rowStyle}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
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
        <Field label="Delivery (days)">
          <input type="number" min={1} value={props.value.deliveryDays} onChange={(e) => set("deliveryDays", e.target.value)} placeholder="e.g. 7" style={inputStyle} />
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
