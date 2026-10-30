"use client";

// src/components/nex-native/product-create/DeliveryEditor.tsx
//
// Owner-authorised 2026-10-30 (Product Upload World-Class brief ·
// expansion §1 Local delivery + §2 Export).
//
// Progressive-disclosure delivery editor driven by the parent product's
// sales-market scope:
//
//   · scope === "local"   → local zones block visible
//   · scope === "export"  → export destinations block visible
//   · scope === "both"    → both blocks visible
//
// Local zones + export destinations are each a repeatable list with
// per-row add/remove. The row keys mirror LocalZoneFields +
// ExportDestinationFields in delivery-spec.ts so the storage layer
// stays in sync with the UI.
//
// Owner distinction preserved everywhere (sealed):
//   · Dispatch days  = seller's prep time
//   · Delivery days  = carrier's transit time
// Separate inputs · separate labels · separate help copy. No conflation.

import * as React from "react";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const INK = "#102033";
const INK_DIM = "#4A6080";
const ACCENT = "#00AFFF";
const RIM = "rgba(0, 175, 255, 0.18)";
const BG = "#FFFFFF";
const RED = "#C8102E";

/** Local zone draft (UI shape · major-currency price strings). */
export interface LocalZoneDraft {
  readonly label: string;
  readonly cities: string;         // comma-separated
  readonly areas: string;          // comma-separated
  readonly priceMajor: string;
  readonly currency: string;
  readonly freeAboveMajor: string; // optional
  readonly dispatchDays: string;
  readonly deliveryMinDays: string;
  readonly deliveryMaxDays: string;
  readonly codEnabled: boolean;
  readonly codMinOrderMajor: string;
  readonly pickupAvailable: boolean;
  readonly notes: string;
}

/** Export destination draft (UI shape · major-currency price strings). */
export interface ExportDestDraft {
  readonly iso: string;              // ISO alpha-2
  readonly enabled: boolean;
  readonly priceMajor: string;       // optional
  readonly currency: string;
  readonly shippingCostMajor: string;
  readonly shippingCurrency: string;
  readonly dispatchMinDays: string;
  readonly dispatchMaxDays: string;
  readonly deliveryMinDays: string;
  readonly deliveryMaxDays: string;
  readonly minOrderMajor: string;    // optional
  readonly notes: string;
}

export interface DeliveryEditorValue {
  readonly local: readonly LocalZoneDraft[];
  readonly export: readonly ExportDestDraft[];
}

export const EMPTY_LOCAL_ZONE: LocalZoneDraft = {
  label: "", cities: "", areas: "", priceMajor: "", currency: "IDR", freeAboveMajor: "",
  dispatchDays: "", deliveryMinDays: "", deliveryMaxDays: "",
  codEnabled: false, codMinOrderMajor: "", pickupAvailable: false, notes: "",
};

export const EMPTY_EXPORT_DEST: ExportDestDraft = {
  iso: "", enabled: true, priceMajor: "", currency: "USD",
  shippingCostMajor: "", shippingCurrency: "USD",
  dispatchMinDays: "", dispatchMaxDays: "",
  deliveryMinDays: "", deliveryMaxDays: "",
  minOrderMajor: "", notes: "",
};

export const EMPTY_DELIVERY: DeliveryEditorValue = { local: [], export: [] };

export interface DeliveryEditorProps {
  readonly scope: "local" | "export" | "both";
  readonly sellerCountryIso?: string | null;
  readonly value: DeliveryEditorValue;
  readonly onChange: (next: DeliveryEditorValue) => void;
}

export function DeliveryEditor(props: DeliveryEditorProps): React.JSX.Element {
  const { scope, sellerCountryIso, value, onChange } = props;
  const showLocal  = scope === "local"  || scope === "both";
  const showExport = scope === "export" || scope === "both";

  const setLocal  = (next: readonly LocalZoneDraft[])  => onChange({ ...value, local: next });
  const setExport = (next: readonly ExportDestDraft[]) => onChange({ ...value, export: next });

  return (
    <section aria-labelledby="nex-delivery-heading" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h2 id="nex-delivery-heading" style={{ fontSize: 15, fontWeight: 800, margin: 0, color: INK }}>
          Delivery &amp; dispatch
        </h2>
        <p style={{ fontSize: 12.5, color: INK_DIM, margin: "4px 0 0", lineHeight: 1.5 }}>
          <strong>Dispatch</strong> is your own prep time. <strong>Delivery</strong> is the carrier&rsquo;s transit time. Fill both honestly — buyers see them separately.
        </p>
      </div>

      {showLocal ? (
        <LocalZonesBlock value={value.local} onChange={setLocal} />
      ) : null}

      {showExport ? (
        <ExportDestinationsBlock
          value={value.export}
          onChange={setExport}
          sellerCountryIso={sellerCountryIso}
        />
      ) : null}
    </section>
  );
}

// ─── Local zones block ──────────────────────────────────────────────

function LocalZonesBlock(props: {
  readonly value: readonly LocalZoneDraft[];
  readonly onChange: (next: readonly LocalZoneDraft[]) => void;
}): React.JSX.Element {
  const { value, onChange } = props;
  const addZone = () => onChange([...value, EMPTY_LOCAL_ZONE]);
  const updateAt = (i: number, next: LocalZoneDraft) => {
    const copy = [...value];
    copy[i] = next;
    onChange(copy);
  };
  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div style={blockStyle}>
      <SectionHeading
        title="Local delivery zones"
        subtitle="Add one zone per area where terms differ (e.g. a central zone with COD vs an outer zone without)."
        countLabel={`${value.length} zone${value.length === 1 ? "" : "s"}`}
      />
      {value.length === 0 ? (
        <div style={emptyStyle}>No zones yet.</div>
      ) : (
        value.map((z, i) => (
          <LocalZoneRow key={i} index={i} value={z} onChange={(n) => updateAt(i, n)} onRemove={() => removeAt(i)} />
        ))
      )}
      <AddButton onClick={addZone} label="+ Add local zone" />
    </div>
  );
}

function LocalZoneRow(props: {
  readonly index: number;
  readonly value: LocalZoneDraft;
  readonly onChange: (next: LocalZoneDraft) => void;
  readonly onRemove: () => void;
}): React.JSX.Element {
  const { value, onChange, onRemove, index } = props;
  const set = <K extends keyof LocalZoneDraft>(k: K, v: LocalZoneDraft[K]) => onChange({ ...value, [k]: v });

  return (
    <div style={rowStyle}>
      <div style={rowHeadStyle}>
        <strong>Zone {index + 1}</strong>
        <button type="button" onClick={onRemove} style={removeBtnStyle}>Remove</button>
      </div>
      <div style={gridStyle}>
        <Field label="Zone name"><Input value={value.label} onChange={(v) => set("label", v)} placeholder="e.g. Central Yogyakarta" maxLength={80} /></Field>
        <Field label="Cities (comma-separated)"><Input value={value.cities} onChange={(v) => set("cities", v)} placeholder="Yogyakarta, Sleman" /></Field>
      </div>
      <div style={gridStyle}>
        <Field label="Areas / districts"><Input value={value.areas} onChange={(v) => set("areas", v)} placeholder="Umbulharjo, Mergangsan" /></Field>
        <Field label="Delivery price">
          <PriceCurrencyRow
            price={value.priceMajor} currency={value.currency}
            onPrice={(v) => set("priceMajor", v)} onCurrency={(v) => set("currency", v)}
            currencyOptions={["IDR","USD","EUR","GBP","MYR","SGD","AUD"]}
          />
        </Field>
      </div>
      <div style={gridStyle}>
        <Field label="Dispatch time (days)" help="How long YOU take to prepare the parcel.">
          <Input type="number" value={value.dispatchDays} onChange={(v) => set("dispatchDays", v)} min={0} />
        </Field>
        <Field label="Est. delivery (days)" help="Carrier transit range — seller-declared.">
          <RangeInputs min={value.deliveryMinDays} max={value.deliveryMaxDays} onMin={(v) => set("deliveryMinDays", v)} onMax={(v) => set("deliveryMaxDays", v)} />
        </Field>
      </div>
      <div style={gridStyle}>
        <Field label="Free delivery above order value (optional)"><Input type="number" value={value.freeAboveMajor} onChange={(v) => set("freeAboveMajor", v)} min={0} /></Field>
        <Field label="Collection / pickup available"><Checkbox checked={value.pickupAvailable} onChange={(v) => set("pickupAvailable", v)} /></Field>
      </div>
      <div style={gridStyle}>
        <Field label="Cash on Delivery (COD)"><Checkbox checked={value.codEnabled} onChange={(v) => set("codEnabled", v)} /></Field>
        <Field label="COD minimum order (optional)">
          <Input type="number" value={value.codMinOrderMajor} onChange={(v) => set("codMinOrderMajor", v)} min={0} disabled={!value.codEnabled} />
        </Field>
      </div>
      <Field label="Notes"><Textarea value={value.notes} onChange={(v) => set("notes", v)} rows={2} maxLength={400} /></Field>
    </div>
  );
}

// ─── Export destinations block ──────────────────────────────────────

function ExportDestinationsBlock(props: {
  readonly value: readonly ExportDestDraft[];
  readonly onChange: (next: readonly ExportDestDraft[]) => void;
  readonly sellerCountryIso?: string | null;
}): React.JSX.Element {
  const { value, onChange, sellerCountryIso } = props;
  const addDest = () => onChange([...value, EMPTY_EXPORT_DEST]);
  const updateAt = (i: number, next: ExportDestDraft) => {
    const copy = [...value];
    copy[i] = next;
    onChange(copy);
  };
  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const normalisedSeller = sellerCountryIso ? sellerCountryIso.trim().toUpperCase() : null;

  return (
    <div style={blockStyle}>
      <SectionHeading
        title="Export destinations"
        subtitle="Add each country you serve. Pricing, shipping and timing are declared per destination — not blanket."
        countLabel={`${value.length} ${value.length === 1 ? "country" : "countries"}`}
      />
      {normalisedSeller ? (
        <p style={{ fontSize: 11.5, color: INK_DIM, margin: "0 0 4px" }}>
          Your seller country is <strong>{normalisedSeller}</strong>. Buyers in that country are served by your Local zones above — don&rsquo;t add it as an export destination.
        </p>
      ) : null}
      {value.length === 0 ? (
        <div style={emptyStyle}>No destinations yet.</div>
      ) : (
        value.map((d, i) => (
          <ExportDestRow
            key={i} index={i} value={d}
            onChange={(n) => updateAt(i, n)}
            onRemove={() => removeAt(i)}
            sellerCountryIso={normalisedSeller}
          />
        ))
      )}
      <AddButton onClick={addDest} label="+ Add export country" />
    </div>
  );
}

function ExportDestRow(props: {
  readonly index: number;
  readonly value: ExportDestDraft;
  readonly onChange: (next: ExportDestDraft) => void;
  readonly onRemove: () => void;
  readonly sellerCountryIso: string | null;
}): React.JSX.Element {
  const { value, onChange, onRemove, index, sellerCountryIso } = props;
  const set = <K extends keyof ExportDestDraft>(k: K, v: ExportDestDraft[K]) => onChange({ ...value, [k]: v });
  const iso = value.iso.trim().toUpperCase();
  const isSellerCountry = sellerCountryIso !== null && iso === sellerCountryIso;

  return (
    <div style={rowStyle}>
      <div style={rowHeadStyle}>
        <strong>Country {index + 1}</strong>
        <button type="button" onClick={onRemove} style={removeBtnStyle}>Remove</button>
      </div>
      <div style={gridStyle}>
        <Field label="Country (ISO 2-letter)">
          <Input value={value.iso} onChange={(v) => set("iso", v.toUpperCase())} placeholder="DE, US, SG" maxLength={2} />
        </Field>
        <Field label="Available for this country"><Checkbox checked={value.enabled} onChange={(v) => set("enabled", v)} /></Field>
      </div>
      {isSellerCountry ? (
        <div style={warningStyle}>
          This is your seller country ({sellerCountryIso}). Local-market buyers are served by your Local zones — move this entry there.
        </div>
      ) : null}
      <div style={gridStyle}>
        <Field label="Product price (optional override)">
          <PriceCurrencyRow
            price={value.priceMajor} currency={value.currency}
            onPrice={(v) => set("priceMajor", v)} onCurrency={(v) => set("currency", v)}
            currencyOptions={["USD","EUR","GBP","IDR","MYR","SGD","AUD","JPY","CNY"]}
          />
        </Field>
        <Field label="Shipping cost">
          <PriceCurrencyRow
            price={value.shippingCostMajor} currency={value.shippingCurrency}
            onPrice={(v) => set("shippingCostMajor", v)} onCurrency={(v) => set("shippingCurrency", v)}
            currencyOptions={["USD","EUR","GBP","IDR","MYR","SGD","AUD","JPY","CNY"]}
          />
        </Field>
      </div>
      <div style={gridStyle}>
        <Field label="Dispatch (days)" help="YOUR prep time range.">
          <RangeInputs min={value.dispatchMinDays} max={value.dispatchMaxDays} onMin={(v) => set("dispatchMinDays", v)} onMax={(v) => set("dispatchMaxDays", v)} />
        </Field>
        <Field label="Est. delivery (days)" help="Carrier transit — seller-declared.">
          <RangeInputs min={value.deliveryMinDays} max={value.deliveryMaxDays} onMin={(v) => set("deliveryMinDays", v)} onMax={(v) => set("deliveryMaxDays", v)} />
        </Field>
      </div>
      <Field label="Minimum order (optional)"><Input type="number" value={value.minOrderMajor} onChange={(v) => set("minOrderMajor", v)} min={0} /></Field>
      <Field label="Notes"><Textarea value={value.notes} onChange={(v) => set("notes", v)} rows={2} maxLength={400} /></Field>
    </div>
  );
}

// ─── Primitives ─────────────────────────────────────────────────────

function SectionHeading(props: { title: string; subtitle: string; countLabel: string }): React.JSX.Element {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: INK }}>{props.title}</h3>
        <p style={{ fontSize: 11.5, color: INK_DIM, margin: "2px 0 0", lineHeight: 1.5 }}>{props.subtitle}</p>
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color: INK_DIM }}>{props.countLabel}</span>
    </div>
  );
}

function AddButton(props: { label: string; onClick: () => void }): React.JSX.Element {
  return (
    <button type="button" onClick={props.onClick} style={{
      alignSelf: "flex-start",
      padding: "8px 14px", borderRadius: 999,
      border: `1.5px solid ${ACCENT}`, background: "transparent",
      color: ACCENT, fontWeight: 800, fontSize: 13,
      cursor: "pointer", fontFamily: NEX_FONT_SANS,
    }}>{props.label}</button>
  );
}

function Field(props: { label: string; help?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: INK_DIM, textTransform: "uppercase", letterSpacing: "0.04em" }}>{props.label}</span>
      {props.children}
      {props.help ? <span style={{ fontSize: 11, color: INK_DIM, lineHeight: 1.4 }}>{props.help}</span> : null}
    </label>
  );
}

function Input(props: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; maxLength?: number; min?: number; disabled?: boolean }): React.JSX.Element {
  return (
    <input
      type={props.type ?? "text"}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      maxLength={props.maxLength}
      min={props.min}
      disabled={props.disabled}
      style={inputStyle(props.disabled === true)}
    />
  );
}

function Textarea(props: { value: string; onChange: (v: string) => void; rows: number; maxLength: number }): React.JSX.Element {
  return (
    <textarea
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      rows={props.rows}
      maxLength={props.maxLength}
      style={{ ...inputStyle(false), resize: "vertical", minHeight: 48 }}
    />
  );
}

function Checkbox(props: { checked: boolean; onChange: (v: boolean) => void }): React.JSX.Element {
  return (
    <input
      type="checkbox"
      checked={props.checked}
      onChange={(e) => props.onChange(e.target.checked)}
      style={{ width: 18, height: 18, accentColor: ACCENT }}
    />
  );
}

function RangeInputs(props: { min: string; max: string; onMin: (v: string) => void; onMax: (v: string) => void }): React.JSX.Element {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 6, alignItems: "center" }}>
      <input type="number" value={props.min} min={0} onChange={(e) => props.onMin(e.target.value)} placeholder="min" style={inputStyle(false)} />
      <span style={{ fontSize: 12, color: INK_DIM }}>–</span>
      <input type="number" value={props.max} min={0} onChange={(e) => props.onMax(e.target.value)} placeholder="max" style={inputStyle(false)} />
    </div>
  );
}

function PriceCurrencyRow(props: {
  readonly price: string;
  readonly currency: string;
  readonly onPrice: (v: string) => void;
  readonly onCurrency: (v: string) => void;
  readonly currencyOptions: readonly string[];
}): React.JSX.Element {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 6 }}>
      <input type="number" value={props.price} min={0} step="0.01" onChange={(e) => props.onPrice(e.target.value)} style={inputStyle(false)} />
      <select value={props.currency} onChange={(e) => props.onCurrency(e.target.value)} style={inputStyle(false)}>
        {props.currencyOptions.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}

const inputStyle = (disabled: boolean): React.CSSProperties => ({
  padding: "8px 10px",
  borderRadius: 8,
  border: `1.5px solid ${RIM}`,
  background: disabled ? "rgba(74, 96, 128, 0.05)" : BG,
  color: INK,
  fontSize: 13,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: NEX_FONT_SANS,
  cursor: disabled ? "not-allowed" : "text",
});

const blockStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: `1.5px solid ${RIM}`,
  background: BG,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};
const rowStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: `1.5px solid ${RIM}`,
  background: "rgba(0, 175, 255, 0.03)",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};
const rowHeadStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 12,
  color: INK,
};
const removeBtnStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: `1.5px solid rgba(200,16,46,0.35)`,
  background: "transparent",
  color: RED,
  fontWeight: 800,
  fontSize: 11,
  cursor: "pointer",
  fontFamily: NEX_FONT_SANS,
};
const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};
const emptyStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: `1.5px dashed ${RIM}`,
  color: INK_DIM,
  fontSize: 12.5,
  fontStyle: "italic",
};
const warningStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  background: "rgba(184, 110, 0, 0.08)",
  color: "#B86E00",
  fontSize: 11.5,
  fontWeight: 700,
};
