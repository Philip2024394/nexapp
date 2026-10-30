"use client";

// src/app/nex-native/create/product/form/_form-client.tsx
//
// Client shell for the shared Create Product form. Composes:
//   · Name + description (shared · every product)
//   · Price + currency (shared · with sensible default)
//   · Image URL (Phase 1 · pastes a hosted URL · gallery deferred)
//   · Stock status (shared)
//   · SpecFormBuilder (category-specific · from sealed FormConfig)
//   · Save Draft + Publish buttons · call createProductAction
//
// Phase 1 scope: text-only inputs for media (paste URL). Phase 2 can
// swap in the sealed image uploader primitive.

import * as React from "react";
import { useRouter } from "next/navigation";
import { SpecFormBuilder } from "@/components/nex-native/product-create/SpecFormBuilder";
import {
  MarketSelector,
  EMPTY_MARKET_VALUE,
  type MarketSelectorValue,
} from "@/components/nex-native/product-create/MarketSelector";
import { ImageGallerySection } from "@/components/nex-native/product-create/ImageGallerySection";
import {
  VariantsBuilder,
  type VariantDraft,
} from "@/components/nex-native/product-create/VariantsBuilder";
import { createProductAction } from "@/app/nex-native/create/product/_actions";
import type { SpecFieldConfig } from "@/lib/nex-native/catalogue/specs/types";
import type { DepartmentId } from "@/lib/nex-native/catalogue/departments";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const INK = "#102033";
const INK_DIM = "#4A6080";
const ACCENT = "#00AFFF";
const RIM = "rgba(0, 175, 255, 0.18)";
const BG = "#FFFFFF";
const RED = "#C8102E";

const COMMON_INPUT: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: `1.5px solid ${RIM}`,
  background: BG,
  color: INK,
  fontFamily: NEX_FONT_SANS,
  fontSize: 14,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

export interface CreateProductFormClientProps {
  readonly businessId: string;
  readonly businessName: string;
  readonly departmentId: DepartmentId;
  readonly departmentLabel: string;
  readonly categoryId: string;
  readonly categoryLabel: string;
  readonly fields: readonly SpecFieldConfig[];
}

export function CreateProductFormClient(props: CreateProductFormClientProps): React.JSX.Element {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [currency, setCurrency] = React.useState("IDR");
  const [imageUrl, setImageUrl] = React.useState("");
  const [stockStatus, setStockStatus] = React.useState<"in_stock" | "low_stock" | "sold_out" | "made_to_order">(
    "in_stock",
  );
  const [spec, setSpec] = React.useState<Record<string, unknown>>({});
  const [market, setMarket] = React.useState<MarketSelectorValue>(EMPTY_MARKET_VALUE);
  const [gallery, setGallery] = React.useState<readonly string[]>([]);
  const [variants, setVariants] = React.useState<readonly VariantDraft[]>([]);
  const [submitting, setSubmitting] = React.useState<null | "draft" | "live">(null);
  const [error, setError] = React.useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && price.trim().length > 0 && !Number.isNaN(Number(price));

  const submit = async (publishLive: boolean) => {
    if (!canSubmit) {
      setError("Enter a name and price before saving.");
      return;
    }
    setError(null);
    setSubmitting(publishLive ? "live" : "draft");
    try {
      const pricePence = Math.round(Number(price) * 100);
      const result = await createProductAction({
        businessId: props.businessId,
        departmentId: props.departmentId,
        categoryId: props.categoryId,
        name: name.trim(),
        description: description.trim() || undefined,
        pricePence,
        currency: currency.trim().toUpperCase(),
        imageUrl: imageUrl.trim() || null,
        galleryUrls: gallery.map((u) => u.trim()).filter((u) => u.length > 0),
        stockStatus,
        spec,
        market: toMarketPayload(market),
        status: publishLive ? "live" : "draft",
        variants: toVariantPayload(variants),
      });
      if (!result.ok) {
        setError(`${result.code}: ${result.message}`);
        setSubmitting(null);
        return;
      }
      router.push(`/nex-native/manage/products/${result.data.productId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(null);
    }
  };

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#F7F9FC",
        color: INK,
        fontFamily: "Inter, system-ui, sans-serif",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <nav style={{ fontSize: 12, color: INK_DIM, marginBottom: 12 }}>
          {props.businessName} · <strong style={{ color: INK }}>{props.departmentLabel}</strong> · {props.categoryLabel}
        </nav>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, marginBottom: 20 }}>
          New {props.categoryLabel.toLowerCase()}
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Product name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="A short, searchable name"
              maxLength={120}
              style={COMMON_INPUT}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell buyers what makes this special"
              rows={3}
              maxLength={2000}
              style={{ ...COMMON_INPUT, resize: "vertical", minHeight: 70 }}
            />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <Field label="Price" required>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="150000"
                min={0}
                step="0.01"
                style={COMMON_INPUT}
              />
            </Field>
            <Field label="Currency">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={COMMON_INPUT}
              >
                <option value="IDR">IDR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </Field>
          </div>
          <Field label="Main image URL">
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://... (file-upload coming in Phase 2)"
              style={COMMON_INPUT}
            />
          </Field>
          <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid ${RIM}` }}>
            <ImageGallerySection value={gallery} onChange={setGallery} />
          </div>
          <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid ${RIM}` }}>
            <VariantsBuilder value={variants} onChange={setVariants} />
          </div>
          <Field label="Stock status">
            <select
              value={stockStatus}
              onChange={(e) => setStockStatus(e.target.value as "in_stock" | "low_stock" | "sold_out" | "made_to_order")}
              style={COMMON_INPUT}
            >
              <option value="in_stock">In stock</option>
              <option value="low_stock">Low stock</option>
              <option value="sold_out">Sold out</option>
              <option value="made_to_order">Made to order</option>
            </select>
          </Field>

          <div
            style={{
              marginTop: 10,
              paddingTop: 14,
              borderTop: `1px solid ${RIM}`,
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, marginBottom: 12 }}>
              {props.categoryLabel} details
            </h2>
            <SpecFormBuilder fields={props.fields} value={spec} onChange={setSpec} />
          </div>

          <div
            style={{
              marginTop: 4,
              paddingTop: 14,
              borderTop: `1px solid ${RIM}`,
            }}
          >
            <MarketSelector value={market} onChange={setMarket} />
          </div>

          {error ? (
            <div
              role="alert"
              style={{
                marginTop: 8,
                padding: "10px 12px",
                background: "rgba(200,16,46,0.08)",
                color: RED,
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={!canSubmit || submitting !== null}
              style={{
                padding: "12px 20px",
                borderRadius: 999,
                border: `1.5px solid ${ACCENT}`,
                background: "transparent",
                color: ACCENT,
                fontWeight: 800,
                fontSize: 14,
                cursor: canSubmit && submitting === null ? "pointer" : "not-allowed",
                opacity: canSubmit && submitting === null ? 1 : 0.5,
              }}
            >
              {submitting === "draft" ? "Saving…" : "Save as draft"}
            </button>
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={!canSubmit || submitting !== null}
              style={{
                padding: "12px 20px",
                borderRadius: 999,
                border: "none",
                background: ACCENT,
                color: "#031018",
                fontWeight: 800,
                fontSize: 14,
                cursor: canSubmit && submitting === null ? "pointer" : "not-allowed",
                opacity: canSubmit && submitting === null ? 1 : 0.5,
              }}
            >
              {submitting === "live" ? "Publishing…" : "Publish live"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

/** Translate the UI market value (major-currency price) into the
 *  server-side payload (minor-currency price in integer pence). */
function toMarketPayload(v: MarketSelectorValue): {
  scope: "local" | "export" | "both";
  local?: Record<string, unknown>;
  export?: Record<string, unknown>;
} {
  const toPence = (raw: unknown): number | undefined => {
    if (raw === undefined || raw === null || raw === "") return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return Math.round(n * 100);
  };
  const cleanLocal = (obj: Record<string, unknown>) => {
    const { price_pence_major, ...rest } = obj;
    const price_pence = toPence(price_pence_major);
    const out: Record<string, unknown> = { ...rest };
    if (price_pence !== undefined) out.price_pence = price_pence;
    return out;
  };
  const cleanExport = (obj: Record<string, unknown>) => {
    const cleaned = cleanLocal(obj);
    // Countries field arrives as a comma-separated string from the UI;
    // normalise to a trimmed string array before Zod validation.
    const countries = cleaned.countries;
    if (typeof countries === "string") {
      const list = countries.split(",").map((c) => c.trim()).filter(Boolean);
      if (list.length > 0) cleaned.countries = list;
      else delete cleaned.countries;
    }
    return cleaned;
  };
  const payload: {
    scope: "local" | "export" | "both";
    local?: Record<string, unknown>;
    export?: Record<string, unknown>;
  } = { scope: v.scope };
  if (v.scope === "local" || v.scope === "both") {
    payload.local = cleanLocal(v.local);
  }
  if (v.scope === "export" || v.scope === "both") {
    payload.export = cleanExport(v.export);
  }
  return payload;
}

/** Convert local VariantDraft rows to the server-side payload shape.
 *  Drops blank-name rows silently (seller may have hit "+ Add variant"
 *  without filling the row). Empty axis + empty stock + empty price
 *  all map to null on the server. */
function toVariantPayload(drafts: readonly VariantDraft[]) {
  return drafts
    .filter((d) => d.name.trim().length > 0)
    .map((d, i) => {
      const priceRaw = d.priceMajor.trim();
      const priceNum = priceRaw === "" ? null : Number(priceRaw);
      const price_pence =
        priceNum !== null && Number.isFinite(priceNum) && priceNum >= 0
          ? Math.round(priceNum * 100)
          : null;
      return {
        existingId: d.existingId,
        name: d.name.trim(),
        attribute: d.axis === "" ? null : d.axis,
        price_pence,
        stock_status: d.stock === "" ? null : d.stock,
        position: i,
      };
    });
}

function Field(props: { label: string; required?: boolean; children: React.ReactNode }): React.JSX.Element {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>
        {props.label}
        {props.required ? <span style={{ color: RED, marginLeft: 4 }}>*</span> : null}
      </span>
      {props.children}
    </label>
  );
}
