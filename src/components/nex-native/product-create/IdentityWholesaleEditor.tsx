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
import { COUNTRIES } from "@/lib/nex-native/catalogue/countries";

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
}

export interface WholesaleDraft {
  readonly offered: boolean;
  readonly minQty: string;
  readonly pricePerPieceMajor: string;
}

export const EMPTY_IDENTITY: IdentityDraft = {
  condition: "new",
  conditionNotes: "",
  countryOfManufacture: "",
  countryOfOrigin: "",
};

export const EMPTY_WHOLESALE: WholesaleDraft = {
  offered: false,
  minQty: "",
  pricePerPieceMajor: "",
};


export interface IdentityWholesaleEditorProps {
  readonly identity: IdentityDraft;
  readonly onIdentityChange: (next: IdentityDraft) => void;
  readonly wholesale: WholesaleDraft;
  readonly onWholesaleChange: (next: WholesaleDraft) => void;
  /**
   * W14 (2026-11-18) · suppress the internal single-tier WholesaleBlock
   * when the parent will render the multi-tier editor itself. Default
   * false preserves the existing create-flow behaviour unchanged.
   */
  readonly hideWholesale?: boolean;
}

export function IdentityWholesaleEditor(props: IdentityWholesaleEditorProps): React.JSX.Element {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <IdentityBlock value={props.identity} onChange={props.onIdentityChange} />
      {props.hideWholesale ? null : (
        <WholesaleBlock value={props.wholesale} onChange={props.onWholesaleChange} />
      )}
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
      <Field label="Condition">
        <select value={value.condition} onChange={(e) => set("condition", e.target.value as IdentityDraft["condition"])} style={inputStyle(false)}>
          <option value="new">New</option>
          <option value="used">Used</option>
          <option value="refurbished">Refurbished</option>
          <option value="handmade">Handmade</option>
          <option value="other">Other</option>
        </select>
      </Field>
      {/* Owner directive 2026-10-31: condition notes only appears when
          the item has been used. Hidden for new/refurbished/handmade/other. */}
      {value.condition === "used" ? (
        <Field label="Condition notes" help="Describe wear, scratches, missing accessories, etc.">
          <input
            type="text"
            value={value.conditionNotes}
            onChange={(e) => set("conditionNotes", e.target.value)}
            placeholder="e.g. Light scratch on back cover, 85% battery health"
            maxLength={400}
            style={inputStyle(false)}
          />
        </Field>
      ) : null}
      <div style={gridStyle}>
        <Field label="Made in">
          <select
            value={value.countryOfManufacture}
            onChange={(e) => set("countryOfManufacture", e.target.value)}
            style={inputStyle(false)}
          >
            <option value="">— select country —</option>
            {COUNTRIES.map((c) => (
              <option key={c.iso} value={c.iso}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Sold From">
          <select
            value={value.countryOfOrigin}
            onChange={(e) => set("countryOfOrigin", e.target.value)}
            style={inputStyle(false)}
          >
            <option value="">— select country —</option>
            {COUNTRIES.map((c) => (
              <option key={c.iso} value={c.iso}>{c.name}</option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}

function WholesaleBlock(props: { value: WholesaleDraft; onChange: (next: WholesaleDraft) => void }): React.JSX.Element {
  const { value, onChange } = props;
  const set = <K extends keyof WholesaleDraft>(k: K, v: WholesaleDraft[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div style={blockStyle}>
      <div>
        <h2 style={headingStyle}>Wholesale</h2>
        <p style={subStyle}>Offer bulk orders? Set a minimum quantity and a per-piece price.</p>
      </div>
      <Field label="Offer wholesale">
        <input type="checkbox" checked={value.offered} onChange={(e) => set("offered", e.target.checked)} style={{ width: 18, height: 18, accentColor: ACCENT }} />
      </Field>
      {value.offered ? (
        <div style={gridStyle}>
          <Field label="Min quantity">
            <input type="number" min={1} value={value.minQty} onChange={(e) => set("minQty", e.target.value)} placeholder="e.g. 50" style={inputStyle(false)} />
          </Field>
          <Field label="Price per pcs">
            <input type="number" min={0} step="0.01" value={value.pricePerPieceMajor} onChange={(e) => set("pricePerPieceMajor", e.target.value)} style={inputStyle(false)} />
          </Field>
        </div>
      ) : null}
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
