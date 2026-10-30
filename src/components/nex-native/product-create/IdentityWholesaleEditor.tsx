"use client";

// src/components/nex-native/product-create/IdentityWholesaleEditor.tsx
//
// Owner-authorised 2026-10-30 (Product Upload World-Class brief ·
// expansion §3). Composite editor that captures:
//   · Identity   — condition, country of manufacture, country of
//                  origin, optional condition notes.
//   · Wholesale  — bulk-offer toggle, min qty, pricing mode
//                  (tiers / on request / none), repeatable price tiers.
//
// Each sub-section has its own progressive disclosure — tiers only
// render when pricing_mode = "tiers"; wholesale fields collapse when
// offered = false.

import * as React from "react";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const INK = "#102033";
const INK_DIM = "#4A6080";
const ACCENT = "#00AFFF";
const RIM = "rgba(0, 175, 255, 0.18)";
const BG = "#FFFFFF";
const RED = "#C8102E";

export interface IdentityDraft {
  readonly condition: "new" | "used" | "refurbished" | "handmade" | "other";
  readonly conditionNotes: string;
  readonly countryOfManufacture: string;
  readonly countryOfOrigin: string;
  readonly dimensions: string;
  readonly weightG: string;
}

export interface WholesaleTierDraft {
  readonly minQty: string;
  readonly priceMajor: string;
  readonly currency: string;
}

export interface WholesaleDraft {
  readonly offered: boolean;
  readonly minQty: string;
  readonly pricingMode: "tiers" | "on_request" | "none";
  readonly tiers: readonly WholesaleTierDraft[];
  readonly notes: string;
}

export const EMPTY_IDENTITY: IdentityDraft = {
  condition: "new",
  conditionNotes: "",
  countryOfManufacture: "",
  countryOfOrigin: "",
  dimensions: "",
  weightG: "",
};

export const EMPTY_WHOLESALE: WholesaleDraft = {
  offered: false,
  minQty: "",
  pricingMode: "none",
  tiers: [],
  notes: "",
};

const EMPTY_TIER: WholesaleTierDraft = { minQty: "", priceMajor: "", currency: "IDR" };

export interface IdentityWholesaleEditorProps {
  readonly identity: IdentityDraft;
  readonly onIdentityChange: (next: IdentityDraft) => void;
  readonly wholesale: WholesaleDraft;
  readonly onWholesaleChange: (next: WholesaleDraft) => void;
}

export function IdentityWholesaleEditor(props: IdentityWholesaleEditorProps): React.JSX.Element {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <IdentityBlock value={props.identity} onChange={props.onIdentityChange} />
      <WholesaleBlock value={props.wholesale} onChange={props.onWholesaleChange} />
    </section>
  );
}

function IdentityBlock(props: { value: IdentityDraft; onChange: (next: IdentityDraft) => void }): React.JSX.Element {
  const { value, onChange } = props;
  const set = <K extends keyof IdentityDraft>(k: K, v: IdentityDraft[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div style={blockStyle}>
      <div>
        <h2 style={headingStyle}>Product identity</h2>
        <p style={subStyle}>
          Condition, where it&rsquo;s made, and (if different) its country of origin for customs.
        </p>
      </div>
      <div style={gridStyle}>
        <Field label="Condition">
          <select value={value.condition} onChange={(e) => set("condition", e.target.value as IdentityDraft["condition"])} style={inputStyle(false)}>
            <option value="new">New</option>
            <option value="used">Used</option>
            <option value="refurbished">Refurbished</option>
            <option value="handmade">Handmade</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Condition notes (optional)">
          <input type="text" value={value.conditionNotes} onChange={(e) => set("conditionNotes", e.target.value)} maxLength={400} style={inputStyle(false)} />
        </Field>
      </div>
      <div style={gridStyle}>
        <Field label="Country of manufacture (ISO 2-letter)" help="Where the product is made.">
          <input type="text" value={value.countryOfManufacture} onChange={(e) => set("countryOfManufacture", e.target.value.toUpperCase())} maxLength={2} placeholder="ID, CN, DE" style={inputStyle(false)} />
        </Field>
        <Field label="Country of origin (ISO 2-letter)" help="Customs/trade concept — may differ from manufacture.">
          <input type="text" value={value.countryOfOrigin} onChange={(e) => set("countryOfOrigin", e.target.value.toUpperCase())} maxLength={2} placeholder="ID" style={inputStyle(false)} />
        </Field>
      </div>
      <div style={gridStyle}>
        <Field label="Dimensions (L × W × H)" help="Product itself, unpackaged.">
          <input type="text" value={value.dimensions} onChange={(e) => set("dimensions", e.target.value)} maxLength={80} placeholder="30 × 20 × 10 cm" style={inputStyle(false)} />
        </Field>
        <Field label="Weight (g)" help="Product itself, unpackaged.">
          <input type="number" min={0} value={value.weightG} onChange={(e) => set("weightG", e.target.value)} style={inputStyle(false)} />
        </Field>
      </div>
    </div>
  );
}

function WholesaleBlock(props: { value: WholesaleDraft; onChange: (next: WholesaleDraft) => void }): React.JSX.Element {
  const { value, onChange } = props;
  const set = <K extends keyof WholesaleDraft>(k: K, v: WholesaleDraft[K]) =>
    onChange({ ...value, [k]: v });

  const addTier = () => set("tiers", [...value.tiers, EMPTY_TIER]);
  const updateTier = (i: number, next: WholesaleTierDraft) => {
    const copy = [...value.tiers];
    copy[i] = next;
    set("tiers", copy);
  };
  const removeTier = (i: number) => set("tiers", value.tiers.filter((_, idx) => idx !== i));

  return (
    <div style={blockStyle}>
      <div>
        <h2 style={headingStyle}>Wholesale &amp; bulk</h2>
        <p style={subStyle}>
          Offer bulk orders? Set the minimum quantity and how pricing is shown.
        </p>
      </div>
      <Field label="Offer wholesale / bulk">
        <input type="checkbox" checked={value.offered} onChange={(e) => set("offered", e.target.checked)} style={{ width: 18, height: 18, accentColor: ACCENT }} />
      </Field>

      {value.offered ? (
        <>
          <div style={gridStyle}>
            <Field label="Minimum wholesale quantity">
              <input type="number" min={1} value={value.minQty} onChange={(e) => set("minQty", e.target.value)} style={inputStyle(false)} />
            </Field>
            <Field label="Pricing mode">
              <select value={value.pricingMode} onChange={(e) => set("pricingMode", e.target.value as WholesaleDraft["pricingMode"])} style={inputStyle(false)}>
                <option value="tiers">Fixed price tiers</option>
                <option value="on_request">Price on request (chat)</option>
                <option value="none">No special wholesale pricing</option>
              </select>
            </Field>
          </div>

          {value.pricingMode === "tiers" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: INK_DIM, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Price tiers ({value.tiers.length})
              </div>
              {value.tiers.length === 0 ? (
                <div style={emptyStyle}>No tiers yet. Add at least one to publish wholesale.</div>
              ) : (
                value.tiers.map((t, i) => (
                  <TierRow key={i} index={i} value={t} onChange={(n) => updateTier(i, n)} onRemove={() => removeTier(i)} />
                ))
              )}
              <button
                type="button"
                onClick={addTier}
                style={{ alignSelf: "flex-start", padding: "8px 14px", borderRadius: 999, border: `1.5px solid ${ACCENT}`, background: "transparent", color: ACCENT, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: NEX_FONT_SANS }}
              >+ Add tier</button>
            </div>
          ) : null}

          <Field label="Wholesale notes">
            <textarea value={value.notes} onChange={(e) => set("notes", e.target.value)} rows={2} maxLength={400} style={{ ...inputStyle(false), resize: "vertical", minHeight: 48 }} />
          </Field>
        </>
      ) : null}
    </div>
  );
}

function TierRow(props: {
  readonly index: number;
  readonly value: WholesaleTierDraft;
  readonly onChange: (next: WholesaleTierDraft) => void;
  readonly onRemove: () => void;
}): React.JSX.Element {
  const { value, onChange, onRemove, index } = props;
  const set = <K extends keyof WholesaleTierDraft>(k: K, v: WholesaleTierDraft[K]) => onChange({ ...value, [k]: v });
  return (
    <div style={{ padding: 10, borderRadius: 10, border: `1.5px solid ${RIM}`, background: "rgba(0, 175, 255, 0.03)" }}>
      <div style={{ fontSize: 12, color: INK, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>Tier {index + 1}</strong>
        <button type="button" onClick={onRemove} style={removeBtnStyle}>Remove</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 6 }}>
        <Field label="Min qty">
          <input type="number" min={1} value={value.minQty} onChange={(e) => set("minQty", e.target.value)} style={inputStyle(false)} />
        </Field>
        <Field label="Price per unit">
          <input type="number" min={0} step="0.01" value={value.priceMajor} onChange={(e) => set("priceMajor", e.target.value)} style={inputStyle(false)} />
        </Field>
        <Field label="Currency">
          <select value={value.currency} onChange={(e) => set("currency", e.target.value)} style={inputStyle(false)}>
            <option value="IDR">IDR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="MYR">MYR</option>
            <option value="SGD">SGD</option>
            <option value="AUD">AUD</option>
          </select>
        </Field>
      </div>
    </div>
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
});
const blockStyle: React.CSSProperties = { padding: 14, borderRadius: 12, border: `1.5px solid ${RIM}`, background: BG, display: "flex", flexDirection: "column", gap: 10 };
const headingStyle: React.CSSProperties = { fontSize: 15, fontWeight: 800, margin: 0, color: INK };
const subStyle: React.CSSProperties = { fontSize: 12.5, color: INK_DIM, margin: "4px 0 0", lineHeight: 1.5 };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const emptyStyle: React.CSSProperties = { padding: "10px 12px", borderRadius: 8, border: `1.5px dashed ${RIM}`, color: INK_DIM, fontSize: 12.5, fontStyle: "italic" };
const removeBtnStyle: React.CSSProperties = { padding: "6px 10px", borderRadius: 999, border: `1.5px solid rgba(200,16,46,0.35)`, background: "transparent", color: RED, fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: NEX_FONT_SANS };
