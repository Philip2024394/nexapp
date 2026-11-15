"use client";

// src/app/nex-native/create/product/form/_create-product-client.tsx
//
// D3 · Create Product form client · deliberately parallel to
// src/app/nex-native/manage/products/[productId]/edit/_edit-client.tsx.
// Composes the existing editors under
// `src/components/nex-native/product-create/*` — no new taxonomy, no
// new spec types. Submits to the sealed shared `createProductAction`.
//
// Status options expose `draft` and `live` only · CreateProductInput
// types status as `Extract<NexProductStatus, "draft" | "live">`, so
// archived is deliberately not offered on the create flow (archiving
// requires the edit flow, which owns the destructive action).
//
// Everything that EDIT exposes is wired here · if an editor isn't
// relevant to the chosen category the Zod schema simply treats it as
// optional and the seller leaves it blank. There is NO per-category
// conditional composition — EDIT doesn't gate either, and we match it
// exactly so the two flows stay symmetrical for the seller.

import * as React from "react";
import { useRouter } from "next/navigation";

import { SpecFormBuilder } from "@/components/nex-native/product-create/SpecFormBuilder";
import {
  MarketSelector,
  EMPTY_MARKET_VALUE,
  type MarketSelectorValue,
} from "@/components/nex-native/product-create/MarketSelector";
import {
  ProductImagesEditor,
  productImagesToStored,
  EMPTY_PRODUCT_IMAGES,
  type ProductImagesValue,
} from "@/components/nex-native/product-create/ProductImagesEditor";
import {
  VariantsBuilder,
  type VariantDraft,
  type VariantAxis,
} from "@/components/nex-native/product-create/VariantsBuilder";
import {
  DeliveryEditor,
  EMPTY_DELIVERY,
  type DeliveryEditorValue,
  type LocalRadiusDraft,
  type ExportCountryDraft,
} from "@/components/nex-native/product-create/DeliveryEditor";
import {
  IdentityWholesaleEditor,
  EMPTY_IDENTITY,
  EMPTY_WHOLESALE,
  type IdentityDraft,
  type WholesaleDraft,
} from "@/components/nex-native/product-create/IdentityWholesaleEditor";
import {
  ReturnsEditor,
  EMPTY_RETURNS,
  type ReturnsDraft,
} from "@/components/nex-native/product-create/ReturnsEditor";
import {
  ColorsEditor,
  EMPTY_COLORS,
  type ColorsEditorValue,
} from "@/components/nex-native/product-create/ColorsEditor";
import {
  CoverVideoEditor,
  EMPTY_COVER_VIDEO,
  type CoverVideoDraft,
} from "@/components/nex-native/product-create/CoverVideoEditor";

import {
  createProductAction,
  type CreateProductInput,
} from "@/app/nex-native/create/product/_actions";
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
  readonly defaultCurrency: string;
}

type AllowedStatus = "draft" | "live";
type AllowedStock = "in_stock" | "low_stock" | "sold_out" | "made_to_order";

const CURRENCY_OPTIONS: readonly string[] = ["IDR", "USD", "EUR", "GBP"];

export function CreateProductFormClient(
  props: CreateProductFormClientProps,
): React.JSX.Element {
  const router = useRouter();

  // ── Primitive fields ────────────────────────────────────────────
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [currency, setCurrency] = React.useState<string>(() => {
    const normalised = props.defaultCurrency.trim().toUpperCase();
    return /^[A-Z]{3}$/.test(normalised) ? normalised : "EUR";
  });
  const [images, setImages] = React.useState<ProductImagesValue>(EMPTY_PRODUCT_IMAGES);
  const [stockStatus, setStockStatus] = React.useState<AllowedStock>("in_stock");
  const [dispatchTime, setDispatchTime] = React.useState("");

  // ── Substrate blocks ────────────────────────────────────────────
  const [spec, setSpec] = React.useState<Record<string, unknown>>({});
  const [market, setMarket] = React.useState<MarketSelectorValue>(EMPTY_MARKET_VALUE);
  const [delivery, setDelivery] = React.useState<DeliveryEditorValue>(EMPTY_DELIVERY);
  const [identity, setIdentity] = React.useState<IdentityDraft>(EMPTY_IDENTITY);
  const [wholesale, setWholesale] = React.useState<WholesaleDraft>(EMPTY_WHOLESALE);
  const [returns, setReturns] = React.useState<ReturnsDraft>(EMPTY_RETURNS);
  const [colors, setColors] = React.useState<ColorsEditorValue>(EMPTY_COLORS);
  const [coverVideo, setCoverVideo] = React.useState<CoverVideoDraft>(EMPTY_COVER_VIDEO);

  // ── Variants ────────────────────────────────────────────────────
  const [variantType, setVariantType] = React.useState<"none" | VariantAxis>("none");
  const [variants, setVariants] = React.useState<readonly VariantDraft[]>([]);

  const exportDestinationIsos = React.useMemo(
    () =>
      delivery.export
        .map((d) => d.iso.trim().toUpperCase())
        .filter((iso) => /^[A-Z]{2}$/.test(iso)),
    [delivery.export],
  );

  const [submitting, setSubmitting] = React.useState<null | "draft" | "live">(null);
  const [error, setError] = React.useState<string | null>(null);

  // ── Inline required-field validation ────────────────────────────
  //
  // Required (owner spec): name, price, currency, department, category,
  // spec, market. Department + category + spec + market are structurally
  // always present (department/category come from URL; spec + market
  // are controlled component state). We gate on name + price here and
  // let the server run full Zod validation on submit.
  const priceNum = Number(price);
  const priceValid =
    price.trim().length > 0 && Number.isFinite(priceNum) && priceNum >= 0;
  const nameValid = name.trim().length > 0;
  const currencyValid = /^[A-Z]{3}$/.test(currency.trim().toUpperCase());
  const canSubmit = nameValid && priceValid && currencyValid;

  const submit = async (desiredStatus: AllowedStatus) => {
    setError(null);
    if (!canSubmit) {
      if (!nameValid) setError("Enter a product name.");
      else if (!priceValid) setError("Enter a valid price.");
      else if (!currencyValid) setError("Pick a currency.");
      return;
    }

    setSubmitting(desiredStatus);
    try {
      const pricePence = Math.round(priceNum * 100);
      const storedImages = productImagesToStored(images);

      const payload: CreateProductInput = {
        businessId: props.businessId,
        departmentId: props.departmentId,
        categoryId: props.categoryId,
        name: name.trim(),
        description: description.trim() ? description.trim() : undefined,
        pricePence,
        currency: currency.trim().toUpperCase(),
        imageUrl: storedImages.image_url,
        galleryUrls: storedImages.gallery_urls ?? undefined,
        stockStatus,
        dispatchTime: dispatchTime.trim() || undefined,
        status: desiredStatus,
        spec,
        market: toMarketPayload(market),
        delivery: toDeliveryPayload(delivery, market.scope, currency),
        identity: toIdentityPayload(identity),
        wholesale: toWholesalePayload(wholesale),
        returns: toReturnsPayload(returns),
        colors:
          variantType === "colour" ? toColorsPayload(colors) : { entries: [] },
        coverVideo: toCoverVideoPayload(coverVideo),
        variants:
          variantType !== "none" && variantType !== "colour"
            ? toVariantPayload(variants).map((v) => ({
                ...v,
                attribute: variantType,
              }))
            : [],
      };

      const result = await createProductAction(payload);
      if (!result.ok) {
        setError(`${result.code}: ${result.message}`);
        setSubmitting(null);
        return;
      }
      // Success · route to the detail page (same target the edit flow
      // uses after a save). Seller can continue editing from there.
      router.push(`/nex-native/manage/products/${result.data.productId}`);
      router.refresh();
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
      <div style={{ maxWidth: 640, margin: "0 auto", position: "relative" }}>
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: `1.5px solid ${RIM}`,
            background: "#FFFFFF",
            color: INK,
            fontSize: 20,
            lineHeight: 1,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 1px 2px rgba(16,32,51,0.06)",
          }}
        >
          ×
        </button>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: INK_DIM,
            marginBottom: 6,
          }}
        >
          {props.departmentLabel}
          {props.businessName ? ` · ${props.businessName}` : null}
        </div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            margin: 0,
            marginBottom: 20,
            paddingRight: 48,
          }}
        >
          New {props.categoryLabel.toLowerCase()}
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Product name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              style={COMMON_INPUT}
            />
          </Field>
          <Field label="Stock status">
            <select
              value={stockStatus}
              onChange={(e) =>
                setStockStatus(e.target.value as AllowedStock)
              }
              style={COMMON_INPUT}
            >
              <option value="in_stock">In stock</option>
              <option value="low_stock">Low stock</option>
              <option value="sold_out">Sold out</option>
              <option value="made_to_order">Made to order</option>
            </select>
          </Field>
          <Field label="Dispatch time">
            <input
              type="text"
              value={dispatchTime}
              onChange={(e) => setDispatchTime(e.target.value)}
              placeholder="e.g. Ships within 2 business days"
              maxLength={120}
              style={COMMON_INPUT}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              rows={3}
              maxLength={500}
              style={{ ...COMMON_INPUT, resize: "vertical", minHeight: 70 }}
            />
            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                fontWeight: 700,
                textAlign: "right",
                color: description.length >= 450 ? RED : INK_DIM,
              }}
            >
              {description.length} / 500
            </div>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <Field label="Price" required>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min={0}
                step="0.01"
                style={COMMON_INPUT}
              />
            </Field>
            <Field label="Currency" required>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={COMMON_INPUT}
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* ── MEDIA · images + cover video together ──────────── */}
          <ProductImagesEditor
            value={images}
            onChange={setImages}
            businessId={props.businessId}
          />
          <CoverVideoEditor
            value={coverVideo}
            onChange={setCoverVideo}
            businessId={props.businessId}
          />

          {/* ── VARIANTS · type selector + slide-down ──────────── */}
          <div
            style={{
              marginTop: 4,
              paddingTop: 14,
              borderTop: `1px solid ${RIM}`,
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: INK }}>
              Variants
            </h2>
            <p
              style={{
                fontSize: 11.5,
                color: INK_DIM,
                margin: "4px 0 10px",
                lineHeight: 1.5,
              }}
            >
              Does this product come in different versions? Pick one type.
            </p>
            <Field label="Variant type">
              <select
                value={variantType}
                onChange={(e) => {
                  const next = e.target.value as typeof variantType;
                  setVariantType(next);
                  // 2026-11-15 · D3 integration finding. VariantsBuilder's
                  // "+ Add another" button only renders when value.length
                  // > 0; without a first row seed the seller sees an
                  // empty section with no obvious next action. Seed one
                  // blank row on first switch from "none" to a non-colour
                  // axis, and clear rows on switch back to "none".
                  if (next === "none") {
                    setVariants([]);
                  } else if (next !== "colour" && variants.length === 0) {
                    setVariants([
                      { name: "", axis: next, priceMajor: "", stock: "" },
                    ]);
                  }
                }}
                style={COMMON_INPUT}
              >
                <option value="none">No variants</option>
                <option value="colour">Colour</option>
                <option value="size">Size</option>
                <option value="material">Material</option>
                <option value="style">Style / Model</option>
                <option value="pack_size">Pack size</option>
                <option value="fit">Fit</option>
                <option value="other">Other</option>
              </select>
            </Field>
            {variantType === "colour" ? (
              <div style={{ marginTop: 10 }}>
                <ColorsEditor
                  value={colors}
                  onChange={setColors}
                  businessId={props.businessId}
                  baseCurrency={currency}
                />
              </div>
            ) : variantType !== "none" ? (
              <div style={{ marginTop: 10 }}>
                <VariantsBuilder value={variants} onChange={setVariants} />
              </div>
            ) : null}
          </div>

          <div
            style={{
              marginTop: 4,
              paddingTop: 14,
              borderTop: `1px solid ${RIM}`,
            }}
          >
            <DeliveryEditor
              scope={market.scope}
              value={delivery}
              onChange={setDelivery}
              productCurrency={currency}
            />
          </div>
          <div
            style={{
              marginTop: 4,
              paddingTop: 14,
              borderTop: `1px solid ${RIM}`,
            }}
          >
            <IdentityWholesaleEditor
              identity={identity}
              onIdentityChange={setIdentity}
              wholesale={wholesale}
              onWholesaleChange={setWholesale}
            />
          </div>
          <div
            style={{
              marginTop: 4,
              paddingTop: 14,
              borderTop: `1px solid ${RIM}`,
            }}
          >
            <ReturnsEditor
              value={returns}
              onChange={setReturns}
              destinationIsos={exportDestinationIsos}
            />
          </div>

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
            <SpecFormBuilder
              fields={props.fields}
              value={spec}
              onChange={setSpec}
            />
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

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 10,
            }}
          >
            <button
              type="button"
              onClick={() => submit("draft")}
              disabled={submitting !== null}
              style={buttonStyle(ACCENT, true, submitting === null)}
            >
              {submitting === "draft" ? "Saving…" : "Save as draft"}
            </button>
            <button
              type="button"
              onClick={() => submit("live")}
              disabled={!canSubmit || submitting !== null}
              style={buttonStyle(ACCENT, false, canSubmit && submitting === null)}
            >
              {submitting === "live" ? "Publishing…" : "Publish live"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function buttonStyle(
  color: string,
  outlined: boolean,
  enabled: boolean,
): React.CSSProperties {
  return {
    padding: "12px 20px",
    borderRadius: 999,
    border: outlined ? `1.5px solid ${color}` : "none",
    background: outlined ? "transparent" : color,
    color: outlined ? color : "#031018",
    fontWeight: 800,
    fontSize: 14,
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.5,
  };
}

/** Mirror of the Edit client's toMarketPayload. */
function toMarketPayload(
  v: MarketSelectorValue,
): {
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
  if (v.scope === "local" || v.scope === "both") payload.local = cleanLocal(v.local);
  if (v.scope === "export" || v.scope === "both") payload.export = cleanExport(v.export);
  return payload;
}

/** Mirror of the Edit client's toDeliveryPayload. Package dims + weight
 *  shared across local + export; currency inherited from product. */
function toDeliveryPayload(
  v: DeliveryEditorValue,
  scope: "local" | "export" | "both",
  productCurrency: string,
): { package?: unknown; local?: unknown; export?: unknown } {
  const toPenceOpt = (raw: string): number | undefined => {
    const t = raw.trim();
    if (t === "") return undefined;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return Math.round(n * 100);
  };
  const toPositiveNumOpt = (raw: string): number | undefined => {
    const t = raw.trim();
    if (t === "") return undefined;
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return n;
  };
  const toPositiveIntOpt = (raw: string): number | undefined => {
    const n = toPositiveNumOpt(raw);
    return n === undefined ? undefined : Math.round(n);
  };

  const mapLocal = (r: LocalRadiusDraft) => {
    const km = toPositiveIntOpt(r.km);
    const price_pence = toPenceOpt(r.priceMajor);
    if (km === undefined || price_pence === undefined) return null;
    const row: Record<string, unknown> = {
      km,
      price_pence,
      currency: productCurrency,
    };
    const dd = toPositiveIntOpt(r.deliveryDays);
    if (dd !== undefined) row.delivery_days = dd;
    return row;
  };
  const mapExport = (d: ExportCountryDraft) => {
    const iso = d.iso.trim().toUpperCase();
    const price_pence = toPenceOpt(d.priceMajor);
    if (!/^[A-Z]{2}$/.test(iso) || price_pence === undefined) return null;
    const row: Record<string, unknown> = {
      iso,
      price_pence,
      currency: productCurrency,
    };
    const dd = toPositiveIntOpt(d.deliveryDays);
    if (dd !== undefined) row.delivery_days = dd;
    return row;
  };

  const out: { package?: unknown; local?: unknown; export?: unknown } = {};
  const pkg: Record<string, unknown> = {};
  if (v.packageInfo.dimensions.trim()) pkg.dimensions = v.packageInfo.dimensions.trim();
  const wkg = toPositiveNumOpt(v.packageInfo.weightKg);
  if (wkg !== undefined) pkg.weight_kg = wkg;
  if (Object.keys(pkg).length > 0) out.package = pkg;

  if (scope === "local" || scope === "both") {
    const radii = v.local
      .map(mapLocal)
      .filter((x): x is NonNullable<ReturnType<typeof mapLocal>> => x !== null);
    out.local = { radii };
  }
  if (scope === "export" || scope === "both") {
    const countries = v.export
      .map(mapExport)
      .filter((x): x is NonNullable<ReturnType<typeof mapExport>> => x !== null);
    out.export = { countries };
  }
  return out;
}

/** Mirror of the Edit client's toIdentityPayload. */
function toIdentityPayload(v: IdentityDraft): Record<string, unknown> {
  const out: Record<string, unknown> = { condition: v.condition };
  if (v.condition === "used" && v.conditionNotes.trim()) {
    out.condition_notes = v.conditionNotes.trim();
  }
  const m = v.countryOfManufacture.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(m)) out.country_of_manufacture = m;
  const o = v.countryOfOrigin.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(o)) out.country_of_origin = o;
  return out;
}

/** Mirror of the Edit client's toWholesalePayload. */
function toWholesalePayload(v: WholesaleDraft): Record<string, unknown> {
  const toPenceOpt = (raw: string): number | undefined => {
    const t = raw.trim();
    if (t === "") return undefined;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return Math.round(n * 100);
  };
  const toIntOpt = (raw: string): number | undefined => {
    const t = raw.trim();
    if (t === "") return undefined;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return Math.round(n);
  };
  const out: Record<string, unknown> = { offered: v.offered };
  const mq = toIntOpt(v.minQty);
  if (mq !== undefined) out.min_qty = mq;
  const pp = toPenceOpt(v.pricePerPieceMajor);
  if (pp !== undefined) out.price_per_piece_pence = pp;
  return out;
}

/** Mirror of the Edit client's toReturnsPayload. */
function toReturnsPayload(v: ReturnsDraft): Record<string, unknown> {
  const sellerPolicy: Record<string, unknown> = {};
  if (v.policyText.trim()) sellerPolicy.policy_text = v.policyText.trim();
  if (v.daysOption !== null) sellerPolicy.days_option = v.daysOption;
  return { seller_policy: sellerPolicy };
}

/** Mirror of the Edit client's toColorsPayload. */
function toColorsPayload(v: ColorsEditorValue): Record<string, unknown> {
  const toPenceOpt = (raw: string): number | undefined => {
    const t = raw.trim();
    if (t === "") return undefined;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return Math.round(n * 100);
  };
  const entries = v.entries
    .filter(
      (e) => e.name.trim().length > 0 && /^#[0-9A-Fa-f]{6}$/.test(e.hex),
    )
    .map((e, i) => {
      const price = toPenceOpt(e.priceMajor);
      const out: Record<string, unknown> = {
        name: e.name.trim(),
        hex: e.hex.toUpperCase(),
        position: i,
      };
      if (price !== undefined) out.price_pence_override = price;
      if (e.imageUrl.trim()) out.image_url = e.imageUrl.trim();
      return out;
    });
  return { entries };
}

/** Mirror of the Edit client's toCoverVideoPayload. */
function toCoverVideoPayload(
  v: CoverVideoDraft,
): Record<string, unknown> | null {
  if (!v.url || v.durationSeconds <= 0) return null;
  const out: Record<string, unknown> = {
    url: v.url,
    duration_seconds: Math.min(Math.max(1, Math.round(v.durationSeconds)), 30),
  };
  if (v.objectPath) out.object_path = v.objectPath;
  return out;
}

/** Mirror of the Edit client's toVariantPayload (minus existingId · all
 *  rows are fresh inserts on Create). Drops blank-name drafts silently. */
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
        name: d.name.trim(),
        attribute: d.axis === "" ? null : d.axis,
        price_pence,
        stock_status: d.stock === "" ? null : d.stock,
        position: i,
      };
    });
}

function Field(props: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>
        {props.label}
        {props.required ? (
          <span style={{ color: RED, marginLeft: 4 }}>*</span>
        ) : null}
      </span>
      {props.children}
    </label>
  );
}
