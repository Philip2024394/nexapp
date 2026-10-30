"use client";

// src/app/nex-native/manage/products/[productId]/edit/_edit-client.tsx
//
// Edit variant of the shared Create form. Owner-authorised 2026-10-30
// as part of the world-class upload brief. Receives initial values
// pre-filled from the canonical nex_product row (incl. market block
// extracted from spec.__market) and calls updateProductAction.
//
// This file is deliberately parallel to _form-client.tsx (create). We
// keep two shells rather than one over-abstracted shell so each flow
// can evolve independently; the shared bits are the primitives:
// SpecFormBuilder and MarketSelector.

import * as React from "react";
import { useRouter } from "next/navigation";
import { SpecFormBuilder } from "@/components/nex-native/product-create/SpecFormBuilder";
import {
  MarketSelector,
  type MarketSelectorValue,
} from "@/components/nex-native/product-create/MarketSelector";
import { ImageGallerySection } from "@/components/nex-native/product-create/ImageGallerySection";
import { MainImageUploader } from "@/components/nex-native/product-create/MainImageUploader";
import {
  VariantsBuilder,
  type VariantDraft,
} from "@/components/nex-native/product-create/VariantsBuilder";
import {
  DeliveryEditor,
  EMPTY_DELIVERY,
  type DeliveryEditorValue,
  type LocalZoneDraft,
  type ExportDestDraft,
} from "@/components/nex-native/product-create/DeliveryEditor";
import {
  IdentityWholesaleEditor,
  type IdentityDraft,
  type WholesaleDraft,
} from "@/components/nex-native/product-create/IdentityWholesaleEditor";
import {
  ReturnsEditor,
  type ReturnsDraft,
} from "@/components/nex-native/product-create/ReturnsEditor";
import {
  ColorsEditor,
  type ColorsEditorValue,
  type ColorEntryDraft,
} from "@/components/nex-native/product-create/ColorsEditor";
import {
  CoverVideoEditor,
  type CoverVideoDraft,
} from "@/components/nex-native/product-create/CoverVideoEditor";
import { updateProductAction } from "@/app/nex-native/manage/products/[productId]/edit/_actions";
import type { SpecFieldConfig } from "@/lib/nex-native/catalogue/specs/types";
import type { DepartmentId } from "@/lib/nex-native/catalogue/departments";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const INK = "#102033";
const INK_DIM = "#4A6080";
const ACCENT = "#00AFFF";
const RIM = "rgba(0, 175, 255, 0.18)";
const BG = "#FFFFFF";
const RED = "#C8102E";
const AMBER = "#B86E00";

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

export interface EditProductFormClientProps {
  readonly productId: string;
  readonly businessId: string;
  readonly businessName: string;
  readonly departmentId: DepartmentId;
  readonly departmentLabel: string;
  readonly categoryId: string;
  readonly categoryLabel: string;
  readonly fields: readonly SpecFieldConfig[];
  readonly initial: {
    readonly name: string;
    readonly description: string;
    readonly pricePenceMajor: string;
    readonly currency: string;
    readonly imageUrl: string;
    readonly galleryUrls: readonly string[];
    readonly stockStatus: "in_stock" | "low_stock" | "sold_out" | "made_to_order";
    readonly status: "draft" | "live" | "archived";
    readonly spec: Record<string, unknown>;
    readonly market: MarketSelectorValue;
    readonly variants: readonly VariantDraft[];
    readonly delivery: DeliveryEditorValue;
    readonly identity: IdentityDraft;
    readonly wholesale: WholesaleDraft;
    readonly returns: ReturnsDraft;
    readonly colors: ColorsEditorValue;
    readonly coverVideo: CoverVideoDraft;
  };
}

export function EditProductFormClient(props: EditProductFormClientProps): React.JSX.Element {
  const router = useRouter();
  const [name, setName] = React.useState(props.initial.name);
  const [description, setDescription] = React.useState(props.initial.description);
  const [price, setPrice] = React.useState(props.initial.pricePenceMajor);
  const [currency, setCurrency] = React.useState(props.initial.currency);
  const [imageUrl, setImageUrl] = React.useState(props.initial.imageUrl);
  const [stockStatus, setStockStatus] = React.useState(props.initial.stockStatus);
  const [status, setStatus] = React.useState(props.initial.status);
  const [spec, setSpec] = React.useState<Record<string, unknown>>(props.initial.spec);
  const [market, setMarket] = React.useState<MarketSelectorValue>(props.initial.market);
  const [gallery, setGallery] = React.useState<readonly string[]>(props.initial.galleryUrls);
  const [variants, setVariants] = React.useState<readonly VariantDraft[]>(props.initial.variants);
  const [delivery, setDelivery] = React.useState<DeliveryEditorValue>(props.initial.delivery);
  const [identity, setIdentity] = React.useState<IdentityDraft>(props.initial.identity);
  const [wholesale, setWholesale] = React.useState<WholesaleDraft>(props.initial.wholesale);
  const [returns, setReturns] = React.useState<ReturnsDraft>(props.initial.returns);
  const [colors, setColors] = React.useState<ColorsEditorValue>(props.initial.colors);
  const [coverVideo, setCoverVideo] = React.useState<CoverVideoDraft>(props.initial.coverVideo);

  const exportDestinationIsos = React.useMemo(
    () => delivery.export.map((d) => d.iso.trim().toUpperCase()).filter((iso) => /^[A-Z]{2}$/.test(iso)),
    [delivery.export],
  );
  const [submitting, setSubmitting] = React.useState<null | "save" | "publish" | "archive">(null);
  const [error, setError] = React.useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && price.trim().length > 0 && !Number.isNaN(Number(price));

  const submit = async (desiredStatus: "draft" | "live" | "archived", busyKey: "save" | "publish" | "archive") => {
    if (!canSubmit && desiredStatus !== "archived") {
      setError("Enter a name and price before saving.");
      return;
    }
    setError(null);
    setSubmitting(busyKey);
    try {
      const pricePence = Math.round(Number(price) * 100);
      const result = await updateProductAction({
        productId: props.productId,
        departmentId: props.departmentId,
        categoryId: props.categoryId,
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
        pricePence,
        currency: currency.trim().toUpperCase(),
        imageUrl: imageUrl.trim() ? imageUrl.trim() : null,
        galleryUrls: gallery.map((u) => u.trim()).filter((u) => u.length > 0),
        stockStatus,
        status: desiredStatus,
        spec,
        market: toMarketPayload(market),
        delivery: toDeliveryPayload(delivery, market.scope),
        identity: toIdentityPayload(identity),
        wholesale: toWholesalePayload(wholesale),
        returns: toReturnsPayload(returns),
        colors: toColorsPayload(colors),
        coverVideo: toCoverVideoPayload(coverVideo),
        variants: toVariantPayload(variants),
      });
      if (!result.ok) {
        setError(`${result.code}: ${result.message}`);
        setSubmitting(null);
        return;
      }
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
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <nav style={{ fontSize: 12, color: INK_DIM, marginBottom: 12 }}>
          {props.businessName} · <strong style={{ color: INK }}>{props.departmentLabel}</strong> · {props.categoryLabel}
          {" · "}
          <StatusChip status={status} />
        </nav>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, marginBottom: 20 }}>
          Edit {props.categoryLabel.toLowerCase()}
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Product name" required>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} style={COMMON_INPUT} />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} style={{ ...COMMON_INPUT, resize: "vertical", minHeight: 70 }} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <Field label="Price" required>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} min={0} step="0.01" style={COMMON_INPUT} />
            </Field>
            <Field label="Currency">
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={COMMON_INPUT}>
                <option value="IDR">IDR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </Field>
          </div>
          <MainImageUploader
            value={imageUrl}
            onChange={setImageUrl}
            businessId={props.businessId}
          />
          <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid ${RIM}` }}>
            <ImageGallerySection
              value={gallery}
              onChange={setGallery}
              businessId={props.businessId}
              onSetAsMain={(url) => {
                const oldMain = imageUrl.trim();
                const next = gallery.filter((u) => u !== url);
                if (oldMain && !next.includes(oldMain)) next.push(oldMain);
                setGallery(next);
                setImageUrl(url);
              }}
            />
          </div>
          <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid ${RIM}` }}>
            <VariantsBuilder value={variants} onChange={setVariants} />
          </div>
          <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid ${RIM}` }}>
            <DeliveryEditor scope={market.scope} value={delivery} onChange={setDelivery} />
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
          <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid ${RIM}` }}>
            <ColorsEditor
              value={colors} onChange={setColors}
              businessId={props.businessId}
              baseCurrency={currency}
            />
          </div>
          <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid ${RIM}` }}>
            <CoverVideoEditor
              value={coverVideo}
              onChange={setCoverVideo}
              businessId={props.businessId}
            />
          </div>
          <Field label="Stock status">
            <select value={stockStatus} onChange={(e) => setStockStatus(e.target.value as EditProductFormClientProps["initial"]["stockStatus"])} style={COMMON_INPUT}>
              <option value="in_stock">In stock</option>
              <option value="low_stock">Low stock</option>
              <option value="sold_out">Sold out</option>
              <option value="made_to_order">Made to order</option>
            </select>
          </Field>

          <div style={{ marginTop: 10, paddingTop: 14, borderTop: `1px solid ${RIM}` }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, marginBottom: 12 }}>{props.categoryLabel} details</h2>
            <SpecFormBuilder fields={props.fields} value={spec} onChange={setSpec} />
          </div>

          <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid ${RIM}` }}>
            <MarketSelector value={market} onChange={setMarket} />
          </div>

          {error ? (
            <div role="alert" style={{ marginTop: 8, padding: "10px 12px", background: "rgba(200,16,46,0.08)", color: RED, borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
              {error}
            </div>
          ) : null}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => submit("draft", "save")}
              disabled={submitting !== null}
              style={buttonStyle(ACCENT, true, submitting === null)}
            >
              {submitting === "save" ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => submit("live", "publish")}
              disabled={!canSubmit || submitting !== null}
              style={buttonStyle(ACCENT, false, canSubmit && submitting === null)}
            >
              {submitting === "publish" ? "Publishing…" : status === "live" ? "Save & keep live" : "Publish live"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("Archive this product? It will no longer be visible to buyers.")) {
                  submit("archived", "archive");
                }
              }}
              disabled={submitting !== null}
              style={{ ...buttonStyle(AMBER, true, submitting === null), marginLeft: "auto" }}
            >
              {submitting === "archive" ? "Archiving…" : "Archive"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function buttonStyle(color: string, outlined: boolean, enabled: boolean): React.CSSProperties {
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

function StatusChip(props: { status: "draft" | "live" | "archived" }): React.JSX.Element {
  const palette: Record<typeof props.status, { bg: string; fg: string; label: string }> = {
    draft:    { bg: "rgba(74, 96, 128, 0.14)", fg: INK_DIM, label: "Draft" },
    live:     { bg: "rgba(0, 175, 255, 0.14)", fg: ACCENT,  label: "Live" },
    archived: { bg: "rgba(184, 110, 0, 0.14)", fg: AMBER,   label: "Archived" },
  };
  const p = palette[props.status];
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", background: p.bg, color: p.fg, borderRadius: 999, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>
      {p.label}
    </span>
  );
}

/** Mirror of Create form's toCoverVideoPayload. */
function toCoverVideoPayload(v: CoverVideoDraft): Record<string, unknown> | null {
  if (!v.url || v.durationSeconds <= 0) return null;
  const out: Record<string, unknown> = {
    url: v.url,
    duration_seconds: Math.min(Math.max(1, Math.round(v.durationSeconds)), 30),
  };
  if (v.objectPath) out.object_path = v.objectPath;
  return out;
}

/** Mirror of Create form's toColorsPayload. */
function toColorsPayload(v: ColorsEditorValue): Record<string, unknown> {
  const toPenceOpt = (raw: string): number | undefined => {
    const t = raw.trim(); if (t === "") return undefined;
    const n = Number(t); if (!Number.isFinite(n) || n < 0) return undefined;
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

/** Mirror of Create form's toReturnsPayload. */
function toReturnsPayload(v: ReturnsDraft): Record<string, unknown> {
  const toIntOpt = (raw: string): number | undefined => {
    const t = raw.trim(); if (t === "") return undefined;
    const n = Number(t); if (!Number.isFinite(n) || n < 0) return undefined;
    return Math.round(n);
  };
  const sellerPolicy: Record<string, unknown> = {
    accepts_returns: v.acceptsReturns,
    who_pays_shipping: v.whoPaysShipping,
  };
  const within = toIntOpt(v.withinDays);
  if (within !== undefined) sellerPolicy.within_days = within;
  if (v.conditionRequirement.trim()) sellerPolicy.condition_requirement = v.conditionRequirement.trim();
  if (v.notes.trim()) sellerPolicy.notes = v.notes.trim();
  const iso = v.sellerCountryIso.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(iso)) sellerPolicy.seller_country_iso = iso;
  return { seller_policy: sellerPolicy };
}

/** Mirror of Create form's toIdentityPayload. */
function toIdentityPayload(v: IdentityDraft): Record<string, unknown> {
  const out: Record<string, unknown> = { condition: v.condition };
  if (v.conditionNotes.trim()) out.condition_notes = v.conditionNotes.trim();
  const m = v.countryOfManufacture.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(m)) out.country_of_manufacture = m;
  const o = v.countryOfOrigin.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(o)) out.country_of_origin = o;
  if (v.dimensions.trim()) out.dimensions = v.dimensions.trim();
  const w = v.weightG.trim();
  if (w !== "") {
    const n = Number(w);
    if (Number.isFinite(n) && n > 0) out.weight_g = n;
  }
  return out;
}

/** Mirror of Create form's toWholesalePayload. */
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
  const tiers = v.tiers.map((t) => {
    const min_qty = toIntOpt(t.minQty);
    const price_pence = toPenceOpt(t.priceMajor);
    if (min_qty === undefined || price_pence === undefined) return null;
    return { min_qty, price_pence, currency: t.currency };
  }).filter((x): x is { min_qty: number; price_pence: number; currency: string } => x !== null);
  const out: Record<string, unknown> = { offered: v.offered, pricing_mode: v.pricingMode };
  const mq = toIntOpt(v.minQty); if (mq !== undefined) out.min_qty = mq;
  if (tiers.length > 0) out.tiers = tiers;
  if (v.notes.trim()) out.notes = v.notes.trim();
  return out;
}

/** Mirror of Create form's toDeliveryPayload. See create/_form-client.tsx
 *  for the per-field reasoning; both paths share the same server shape. */
function toDeliveryPayload(
  v: DeliveryEditorValue,
  scope: "local" | "export" | "both",
): { local?: unknown; export?: unknown } {
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
  const splitCsv = (raw: string): string[] | undefined => {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : undefined;
  };
  const mapLocal = (z: LocalZoneDraft) => {
    const dispatch_days = toIntOpt(z.dispatchDays) ?? 0;
    const delivery_days_min = toIntOpt(z.deliveryMinDays) ?? 0;
    const delivery_days_max = toIntOpt(z.deliveryMaxDays) ?? delivery_days_min;
    const row: Record<string, unknown> = {
      label: z.label.trim(),
      cities: splitCsv(z.cities),
      areas: splitCsv(z.areas),
      price_pence: toPenceOpt(z.priceMajor) ?? 0,
      currency: z.currency,
      dispatch_days, delivery_days_min, delivery_days_max,
      cod_enabled: z.codEnabled,
      pickup_available: z.pickupAvailable,
    };
    const free = toPenceOpt(z.freeAboveMajor); if (free !== undefined) row.free_above_pence = free;
    const codMin = toPenceOpt(z.codMinOrderMajor); if (codMin !== undefined) row.cod_min_order_pence = codMin;
    if (z.notes.trim()) row.notes = z.notes.trim();
    return row;
  };
  const mapExport = (d: ExportDestDraft) => {
    const dispatch_days_min = toIntOpt(d.dispatchMinDays) ?? 0;
    const dispatch_days_max = toIntOpt(d.dispatchMaxDays) ?? dispatch_days_min;
    const delivery_days_min = toIntOpt(d.deliveryMinDays) ?? 0;
    const delivery_days_max = toIntOpt(d.deliveryMaxDays) ?? delivery_days_min;
    const row: Record<string, unknown> = {
      iso: d.iso.trim().toUpperCase(),
      enabled: d.enabled,
      shipping_cost_pence: toPenceOpt(d.shippingCostMajor) ?? 0,
      shipping_currency: d.shippingCurrency,
      dispatch_days_min, dispatch_days_max,
      delivery_days_min, delivery_days_max,
    };
    const price = toPenceOpt(d.priceMajor); if (price !== undefined) row.price_pence = price;
    if (d.currency) row.currency = d.currency;
    const minOrder = toPenceOpt(d.minOrderMajor); if (minOrder !== undefined) row.min_order_pence = minOrder;
    if (d.notes.trim()) row.notes = d.notes.trim();
    return row;
  };
  const out: { local?: unknown; export?: unknown } = {};
  if (scope === "local" || scope === "both") {
    out.local = { zones: v.local.filter((z) => z.label.trim().length > 0).map(mapLocal) };
  }
  if (scope === "export" || scope === "both") {
    out.export = { destinations: v.export.filter((d) => d.iso.trim().length === 2).map(mapExport) };
  }
  return out;
}

/** Mirror of the Create form's toVariantPayload. Drops blank-name
 *  drafts silently. Includes existingId so the server diff-sync knows
 *  which rows are updates vs new inserts. */
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

function toMarketPayload(v: MarketSelectorValue): { scope: "local" | "export" | "both"; local?: Record<string, unknown>; export?: Record<string, unknown> } {
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
  const payload: { scope: "local" | "export" | "both"; local?: Record<string, unknown>; export?: Record<string, unknown> } = { scope: v.scope };
  if (v.scope === "local" || v.scope === "both") payload.local = cleanLocal(v.local);
  if (v.scope === "export" || v.scope === "both") payload.export = cleanExport(v.export);
  return payload;
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
