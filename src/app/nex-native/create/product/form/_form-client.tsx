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
import {
  ProductImagesEditor,
  EMPTY_PRODUCT_IMAGES,
  productImagesToStored,
  type ProductImagesValue,
} from "@/components/nex-native/product-create/ProductImagesEditor";
import {
  VariantsBuilder,
  type VariantDraft,
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
  type ColorEntryDraft,
} from "@/components/nex-native/product-create/ColorsEditor";
import {
  CoverVideoEditor,
  EMPTY_COVER_VIDEO,
  type CoverVideoDraft,
} from "@/components/nex-native/product-create/CoverVideoEditor";
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
  /** Owner-authorised 2026-11-05 iter 25 · owner's recent uploaded
   *  videos · when non-empty the form renders a "NEX Live background"
   *  picker so the merchant can attach a looped video behind the
   *  shoppable-card overlay. */
  readonly myVideos?: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly publicUrl: string;
  }>;
}

export function CreateProductFormClient(props: CreateProductFormClientProps): React.JSX.Element {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [currency, setCurrency] = React.useState("IDR");
  const [stockStatus, setStockStatus] = React.useState<"in_stock" | "low_stock" | "sold_out" | "made_to_order">(
    "in_stock",
  );
  const [dispatchTime, setDispatchTime] = React.useState("");
  const [spec, setSpec] = React.useState<Record<string, unknown>>({});
  const [market, setMarket] = React.useState<MarketSelectorValue>(EMPTY_MARKET_VALUE);
  const [images, setImages] = React.useState<ProductImagesValue>(EMPTY_PRODUCT_IMAGES);
  const [variants, setVariants] = React.useState<readonly VariantDraft[]>([]);
  const [delivery, setDelivery] = React.useState<DeliveryEditorValue>(EMPTY_DELIVERY);
  const [identity, setIdentity] = React.useState<IdentityDraft>(EMPTY_IDENTITY);
  const [wholesale, setWholesale] = React.useState<WholesaleDraft>(EMPTY_WHOLESALE);
  const [returns, setReturns] = React.useState<ReturnsDraft>(EMPTY_RETURNS);
  const [colors, setColors] = React.useState<ColorsEditorValue>(EMPTY_COLORS);
  const [coverVideo, setCoverVideo] = React.useState<CoverVideoDraft>(EMPTY_COVER_VIDEO);
  // Owner-authorised 2026-11-05 iter 25 · NEX Live shoppable-card
  // background video id. null = no attached background (product card
  // renders on plain gradient when posted to NEX Live).
  const [backgroundVideoId, setBackgroundVideoId] = React.useState<string | null>(null);
  const [variantType, setVariantType] = React.useState<
    "none" | "colour" | "size" | "material" | "style" | "pack_size" | "fit" | "other"
  >("none");

  const exportDestinationIsos = React.useMemo(
    () => delivery.export.map((d) => d.iso.trim().toUpperCase()).filter((iso) => /^[A-Z]{2}$/.test(iso)),
    [delivery.export],
  );
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
        imageUrl: productImagesToStored(images).image_url,
        galleryUrls: productImagesToStored(images).gallery_urls,
        stockStatus,
        dispatchTime: dispatchTime.trim() || undefined,
        spec,
        market: toMarketPayload(market),
        delivery: toDeliveryPayload(delivery, market.scope, currency),
        identity: toIdentityPayload(identity),
        wholesale: toWholesalePayload(wholesale),
        returns: toReturnsPayload(returns),
        // Variant-type gates both sub-payloads: one axis per product.
        //   "colour" → send colors, skip variants.
        //   "none"   → send empty { entries: [] } colors, skip variants.
        //   anything else → send variants (axis forced to variantType),
        //                   send empty colors so a prior colour choice
        //                   gets cleared on save.
        colors:
          variantType === "colour"
            ? toColorsPayload(colors)
            : { entries: [] },
        coverVideo: toCoverVideoPayload(coverVideo),
        // Owner-authorised 2026-11-05 iter 25 · attach the picked
        // NEX Live background video if one is selected. null = no
        // background · product card renders on plain gradient.
        backgroundVideoId: backgroundVideoId,
        status: publishLive ? "live" : "draft",
        variants:
          variantType !== "none" && variantType !== "colour"
            ? toVariantPayload(variants).map((v) => ({ ...v, attribute: variantType }))
            : [],
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
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, marginBottom: 20, paddingRight: 48 }}>
          {props.categoryLabel}
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
              placeholder="Tell buyers what makes this special"
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
                color: description.length >= 450 ? "#C8102E" : "#4A6080",
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
                placeholder="150000"
                min={0}
                step="0.01"
                style={COMMON_INPUT}
              />
            </Field>
            <Field label="Price">
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

          {/* ── NEX Live background · optional shoppable-card overlay ──
              Owner-authorised 2026-11-05 iter 25 · migration 280
              applied. When set, the product renders as a clickable
              card on top of the chosen video in the NEX Live feed. */}
          {props.myVideos && props.myVideos.length > 0 ? (
            <section
              style={{
                marginTop: 4,
                paddingTop: 14,
                borderTop: `1px solid ${RIM}`,
              }}
            >
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  margin: 0,
                  color: INK,
                }}
              >
                NEX Live background
              </h2>
              <p
                style={{
                  fontSize: 11.5,
                  color: INK_DIM,
                  margin: "4px 0 10px",
                  lineHeight: 1.5,
                }}
              >
                Attach one of your uploaded videos · it loops behind
                your product card when viewers scroll past in NEX Live.
                Skip for a card on plain gradient.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => setBackgroundVideoId(null)}
                  aria-pressed={backgroundVideoId === null}
                  data-nex-bg-video-pick="none"
                  style={bgTileStyle(backgroundVideoId === null)}
                >
                  <div style={bgTileNoneGlyph}>⊘</div>
                  <div style={bgTileLabel}>No video</div>
                </button>
                {props.myVideos.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setBackgroundVideoId(v.id)}
                    aria-pressed={backgroundVideoId === v.id}
                    data-nex-bg-video-pick={v.id}
                    title={v.title}
                    style={bgTileStyle(backgroundVideoId === v.id)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <video
                      src={v.publicUrl}
                      muted
                      playsInline
                      preload="metadata"
                      style={{
                        width: "100%",
                        aspectRatio: "9 / 16",
                        objectFit: "cover",
                        display: "block",
                        background: "#111",
                        borderRadius: 8,
                      }}
                    />
                    <div style={bgTileLabel}>{v.title}</div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {/* ── VARIANTS · one type at a time ──────────────────── */}
          <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid ${RIM}` }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: INK }}>
              Variants
            </h2>
            <p style={{ fontSize: 11.5, color: INK_DIM, margin: "4px 0 10px", lineHeight: 1.5 }}>
              Does this product come in different versions? Pick one type.
            </p>
            <Field label="Variant type">
              <select
                value={variantType}
                onChange={(e) => setVariantType(e.target.value as typeof variantType)}
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
                  value={colors} onChange={setColors}
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

          <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid ${RIM}` }}>
            <DeliveryEditor scope={market.scope} value={delivery} onChange={setDelivery} productCurrency={currency} />
          </div>
          <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid ${RIM}` }}>
            <IdentityWholesaleEditor
              identity={identity} onIdentityChange={setIdentity}
              wholesale={wholesale} onWholesaleChange={setWholesale}
            />
          </div>
          <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid ${RIM}` }}>
            <ReturnsEditor
              value={returns} onChange={setReturns}
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

/** Convert CoverVideoDraft → server payload. Returns null when the
 *  seller has no video set so the server can simply omit the
 *  substrate rather than persisting an empty object. */
function toCoverVideoPayload(v: CoverVideoDraft): Record<string, unknown> | null {
  if (!v.url || v.durationSeconds <= 0) return null;
  const out: Record<string, unknown> = {
    url: v.url,
    duration_seconds: Math.min(Math.max(1, Math.round(v.durationSeconds)), 30),
  };
  if (v.objectPath) out.object_path = v.objectPath;
  return out;
}

/** Convert ColorsEditorValue → server payload. Normalise hex to upper,
 *  convert major-currency price string to integer pence, strip blank-
 *  name entries silently so sellers can click a palette swatch and
 *  immediately move on without being forced to fill every slot. */
function toColorsPayload(v: ColorsEditorValue): Record<string, unknown> {
  const toPenceOpt = (raw: string): number | undefined => {
    const t = raw.trim();
    if (t === "") return undefined;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return Math.round(n * 100);
  };
  const entries = v.entries
    .filter((e) => e.name.trim().length > 0 && /^#[0-9A-Fa-f]{6}$/.test(e.hex))
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

/** Convert simplified ReturnsDraft → server payload. */
function toReturnsPayload(v: ReturnsDraft): Record<string, unknown> {
  const sellerPolicy: Record<string, unknown> = {};
  if (v.policyText.trim()) sellerPolicy.policy_text = v.policyText.trim();
  if (v.daysOption !== null) sellerPolicy.days_option = v.daysOption;
  return { seller_policy: sellerPolicy };
}

/** Convert IdentityDraft → server payload. Empty ISO strings become
 *  undefined (not sent) so Zod doesn't reject partial filling.
 *  Dimensions/weight moved to Delivery.package 2026-10-31. */
function toIdentityPayload(v: IdentityDraft): Record<string, unknown> {
  const out: Record<string, unknown> = { condition: v.condition };
  // Owner directive 2026-10-31: condition_notes only applies to USED
  // items. Drop stale text when the condition is anything else so the
  // UI (hidden field) matches what's stored.
  if (v.condition === "used" && v.conditionNotes.trim()) {
    out.condition_notes = v.conditionNotes.trim();
  }
  const m = v.countryOfManufacture.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(m)) out.country_of_manufacture = m;
  const o = v.countryOfOrigin.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(o)) out.country_of_origin = o;
  return out;
}

/** Convert simplified WholesaleDraft → server payload. */
function toWholesalePayload(v: WholesaleDraft): Record<string, unknown> {
  const toPenceOpt = (raw: string): number | undefined => {
    const t = raw.trim(); if (t === "") return undefined;
    const n = Number(t); if (!Number.isFinite(n) || n < 0) return undefined;
    return Math.round(n * 100);
  };
  const toIntOpt = (raw: string): number | undefined => {
    const t = raw.trim(); if (t === "") return undefined;
    const n = Number(t); if (!Number.isFinite(n) || n < 0) return undefined;
    return Math.round(n);
  };
  const out: Record<string, unknown> = { offered: v.offered };
  const mq = toIntOpt(v.minQty); if (mq !== undefined) out.min_qty = mq;
  const pp = toPenceOpt(v.pricePerPieceMajor); if (pp !== undefined) out.price_per_piece_pence = pp;
  return out;
}

/** Convert the DeliveryEditor UI state into the server shape. Package
 *  dimensions + weight live on the top-level `package` block, applied
 *  to both local and export. Currency is inherited from the product. */
function toDeliveryPayload(
  v: DeliveryEditorValue,
  scope: "local" | "export" | "both",
  productCurrency: string,
): { package?: unknown; local?: unknown; export?: unknown } {
  const toPenceOpt = (raw: string): number | undefined => {
    const t = raw.trim(); if (t === "") return undefined;
    const n = Number(t); if (!Number.isFinite(n) || n < 0) return undefined;
    return Math.round(n * 100);
  };
  const toPositiveNumOpt = (raw: string): number | undefined => {
    const t = raw.trim(); if (t === "") return undefined;
    const n = Number(t); if (!Number.isFinite(n) || n <= 0) return undefined;
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
    const row: Record<string, unknown> = { km, price_pence, currency: productCurrency };
    const dd = toPositiveIntOpt(r.deliveryDays); if (dd !== undefined) row.delivery_days = dd;
    return row;
  };
  const mapExport = (d: ExportCountryDraft) => {
    const iso = d.iso.trim().toUpperCase();
    const price_pence = toPenceOpt(d.priceMajor);
    if (!/^[A-Z]{2}$/.test(iso) || price_pence === undefined) return null;
    const row: Record<string, unknown> = { iso, price_pence, currency: productCurrency };
    const dd = toPositiveIntOpt(d.deliveryDays); if (dd !== undefined) row.delivery_days = dd;
    return row;
  };

  const out: { package?: unknown; local?: unknown; export?: unknown } = {};
  // Shared package info (dims + weight)
  const pkg: Record<string, unknown> = {};
  if (v.packageInfo.dimensions.trim()) pkg.dimensions = v.packageInfo.dimensions.trim();
  const wkg = toPositiveNumOpt(v.packageInfo.weightKg);
  if (wkg !== undefined) pkg.weight_kg = wkg;
  if (Object.keys(pkg).length > 0) out.package = pkg;

  if (scope === "local" || scope === "both") {
    const radii = v.local.map(mapLocal).filter((x): x is NonNullable<ReturnType<typeof mapLocal>> => x !== null);
    out.local = { radii };
  }
  if (scope === "export" || scope === "both") {
    const countries = v.export.map(mapExport).filter((x): x is NonNullable<ReturnType<typeof mapExport>> => x !== null);
    out.export = { countries };
  }
  return out;
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

// ─── NEX Live background-video tile styles (iter 25) ─────────────────
function bgTileStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: 4,
    borderRadius: 10,
    background: active
      ? "color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 18%, transparent)"
      : "rgba(2,9,20,0.6)",
    border: active
      ? "2px solid var(--nex-world-secondary, #C6A15B)"
      : "1px solid rgba(255,255,255,0.14)",
    color: "#F2F5F8",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 11,
    textAlign: "left",
    overflow: "hidden",
  };
}
const bgTileNoneGlyph: React.CSSProperties = {
  width: "100%",
  aspectRatio: "9 / 16",
  background: "linear-gradient(135deg, #1a0a0a 0%, #0a1526 100%)",
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "rgba(255,255,255,0.5)",
  fontSize: 28,
};
const bgTileLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "#B5C3D6",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  padding: "0 2px",
};
