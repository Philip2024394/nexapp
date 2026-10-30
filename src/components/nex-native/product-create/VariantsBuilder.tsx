"use client";

// src/components/nex-native/product-create/VariantsBuilder.tsx
//
// Owner-authorised 2026-10-30 (Product Upload World-Class brief) ·
// variants builder for the shared Create + Edit forms. Serves the
// 30-department marketplace use cases the owner called out:
//
//   · Clothing: Small/Medium/Large (size) · Red/Blue (colour)
//   · Electronics: Model A / Model B (model → mapped to "style" axis)
//   · Furniture: Oak / Walnut (material)
//   · Food: 250g / 500g (pack_size)
//
// Storage model (no migration required):
//   · One row per variant in nex_product_variant (table exists).
//   · Columns: name · attribute (axis) · price_pence (optional
//     override) · stock_status (optional override) · position.
//
// This component is a pure value-in/value-out primitive. It knows
// nothing about the server. The parent form:
//   · Create flow → passes variants into createProductAction which
//     then inserts them after the parent product row.
//   · Edit flow  → passes variants into updateProductAction which
//     diff-syncs them (create new · update changed · delete removed).

import * as React from "react";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const INK = "#102033";
const INK_DIM = "#4A6080";
const ACCENT = "#00AFFF";
const RIM = "rgba(0, 175, 255, 0.18)";
const BG = "#FFFFFF";
const RED = "#C8102E";

/** Mirror of NEX_VARIANT_ATTRIBUTES (lib/nex-native/types.ts). Kept
 *  as a const literal here so the client bundle doesn't import
 *  server-only modules. The server action re-validates against the
 *  canonical constant before writing. */
export const VARIANT_AXES = [
  { value: "size", label: "Size" },
  { value: "colour", label: "Colour" },
  { value: "material", label: "Material" },
  { value: "package", label: "Package" },
  { value: "duration", label: "Duration" },
  { value: "style", label: "Style / Model" },
  { value: "finish", label: "Finish" },
  { value: "fit", label: "Fit" },
  { value: "pack_size", label: "Pack size" },
  { value: "other", label: "Other" },
] as const;

export type VariantAxis = (typeof VARIANT_AXES)[number]["value"];

export const VARIANT_STOCK_OPTIONS = [
  { value: "", label: "— inherit —" },
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "sold_out", label: "Sold out" },
  { value: "made_to_order", label: "Made to order" },
] as const;

export type VariantStock = "in_stock" | "low_stock" | "sold_out" | "made_to_order" | "";

/** Variant row as held by the form. Price is major-currency string
 *  (user-friendly input); the parent form converts to pence before
 *  shipping to the server. `existingId` is set only for variants that
 *  already exist in the DB (edit flow); new variants have no id. */
export interface VariantDraft {
  readonly existingId?: string;
  readonly name: string;
  readonly axis: VariantAxis | "";
  readonly priceMajor: string;
  readonly stock: VariantStock;
}

export const EMPTY_VARIANT: VariantDraft = {
  name: "",
  axis: "",
  priceMajor: "",
  stock: "",
};

export interface VariantsBuilderProps {
  readonly value: readonly VariantDraft[];
  readonly onChange: (next: readonly VariantDraft[]) => void;
}

export function VariantsBuilder({ value, onChange }: VariantsBuilderProps): React.JSX.Element {
  const updateAt = (i: number, next: VariantDraft) => {
    const copy = [...value];
    copy[i] = next;
    onChange(copy);
  };
  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const addRow = () => onChange([...value, EMPTY_VARIANT]);

  return (
    <section aria-labelledby="nex-variants-heading" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <h2 id="nex-variants-heading" style={{ fontSize: 15, fontWeight: 800, margin: 0, color: INK }}>
          Variants
          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: INK_DIM }}>{value.length}</span>
        </h2>
        <p style={{ fontSize: 11.5, color: INK_DIM, margin: "4px 0 0", lineHeight: 1.5 }}>
          Optional. Add sizes, colours, models, or packs. Each variant can override price and stock.
        </p>
      </div>

      {value.length === 0 ? (
        <div style={emptyStyle}>
          No variants yet. The product sells at the main price and stock status above.
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {value.map((v, i) => (
          <VariantRow
            key={v.existingId ?? `new-${i}`}
            value={v}
            onChange={(next) => updateAt(i, next)}
            onRemove={() => removeAt(i)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        style={{
          alignSelf: "flex-start",
          padding: "9px 14px",
          borderRadius: 999,
          border: `1.5px solid ${ACCENT}`,
          background: "transparent",
          color: ACCENT,
          fontWeight: 800,
          fontSize: 13,
          cursor: "pointer",
          fontFamily: NEX_FONT_SANS,
        }}
      >
        + Add variant
      </button>
    </section>
  );
}

interface RowProps {
  readonly value: VariantDraft;
  readonly onChange: (next: VariantDraft) => void;
  readonly onRemove: () => void;
}

function VariantRow({ value, onChange, onRemove }: RowProps): React.JSX.Element {
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
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 10,
        border: `1.5px solid ${RIM}`,
        background: BG,
        display: "grid",
        gridTemplateColumns: "1fr auto",
        rowGap: 8,
        columnGap: 10,
        alignItems: "end",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 8 }}>
        <Field label="Name">
          <input
            type="text"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="e.g. Small, Red, Model A"
            maxLength={200}
            style={inputStyle}
          />
        </Field>
        <Field label="Axis">
          <select
            value={value.axis}
            onChange={(e) => onChange({ ...value, axis: e.target.value as VariantAxis | "" })}
            style={inputStyle}
          >
            <option value="">—</option>
            {VARIANT_AXES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Price (optional)">
          <input
            type="number"
            value={value.priceMajor}
            onChange={(e) => onChange({ ...value, priceMajor: e.target.value })}
            placeholder="override"
            min={0}
            step="0.01"
            style={inputStyle}
          />
        </Field>
        <Field label="Stock (optional)">
          <select
            value={value.stock}
            onChange={(e) => onChange({ ...value, stock: e.target.value as VariantStock })}
            style={inputStyle}
          >
            {VARIANT_STOCK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove variant"
        style={{
          padding: "8px 12px",
          borderRadius: 999,
          border: `1.5px solid rgba(200,16,46,0.35)`,
          background: "transparent",
          color: RED,
          fontWeight: 800,
          fontSize: 12,
          cursor: "pointer",
          fontFamily: NEX_FONT_SANS,
          height: 34,
        }}
      >
        Remove
      </button>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: INK_DIM, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {props.label}
      </span>
      {props.children}
    </label>
  );
}

const emptyStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: `1.5px dashed ${RIM}`,
  color: INK_DIM,
  fontSize: 12.5,
  fontStyle: "italic",
};
