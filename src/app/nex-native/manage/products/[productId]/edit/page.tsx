// src/app/nex-native/manage/products/[productId]/edit/page.tsx
//
// Owner-authorised 2026-10-30 (Product Upload World-Class brief) ·
// shared Edit Product route. Pre-fills the EditProductFormClient from
// the canonical nex_product row — INCLUDING the market block extracted
// from spec.__market — so sellers can revise without losing data.
//
// Server-side gates mirror the Edit action (defence-in-depth):
//   · Session (dev-override aware)
//   · Product exists
//   · Ownership (owning business belongs to the signed-in account)
//   · Category still registered (otherwise edit is blocked and user is
//     routed back to the manage detail page with a reason)

import { notFound, redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import * as businessService from "@/lib/nex-native/business-service";
import {
  resolveCategorySpec,
  isCategorySpecRegistered,
} from "@/lib/nex-native/catalogue/specs";
import { findDepartment, type DepartmentId } from "@/lib/nex-native/catalogue/departments";
import { extractMarket, MARKET_SPEC_KEY } from "@/lib/nex-native/catalogue/market-spec";
import { extractDelivery, DELIVERY_SPEC_KEY } from "@/lib/nex-native/catalogue/delivery-spec";
import {
  extractIdentity,
  extractWholesale,
  IDENTITY_SPEC_KEY,
  WHOLESALE_SPEC_KEY,
} from "@/lib/nex-native/catalogue/identity-wholesale-spec";
import { extractReturns, RETURNS_SPEC_KEY } from "@/lib/nex-native/catalogue/returns-spec";
import type { MarketSelectorValue } from "@/components/nex-native/product-create/MarketSelector";
import type { VariantDraft } from "@/components/nex-native/product-create/VariantsBuilder";
import type {
  DeliveryEditorValue,
  LocalZoneDraft,
  ExportDestDraft,
} from "@/components/nex-native/product-create/DeliveryEditor";
import {
  EMPTY_IDENTITY,
  EMPTY_WHOLESALE,
  type IdentityDraft,
  type WholesaleDraft,
} from "@/components/nex-native/product-create/IdentityWholesaleEditor";
import {
  EMPTY_RETURNS,
  type ReturnsDraft,
} from "@/components/nex-native/product-create/ReturnsEditor";
import { EditProductFormClient } from "./_edit-client";

export const dynamic = "force-dynamic";

type AllowedStatus = "draft" | "live" | "archived";
type AllowedStock = "in_stock" | "low_stock" | "sold_out" | "made_to_order";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}): Promise<React.JSX.Element> {
  const { productId } = await params;

  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect(`/nex-native/sign-in?next=${encodeURIComponent(`/nex-native/manage/products/${productId}/edit`)}`);
  }

  const product = await productService.getProductById(productId);
  if (!product) notFound();

  // Ownership
  const owned = await listBusinessesByOwner(session.account.id).catch(() => []);
  const owningBusiness = owned.find((b) => b.id === product.business_id);
  if (!owningBusiness) {
    redirect(`/nex-native/manage/products/${productId}?e=not-owned`);
  }

  // Resolve department/category · fall back to everything_else/unclassified
  // when a row predates the category registry (migration 239 not applied in
  // prod yet · existing products carry NULL department_id/category_id).
  const rawDeptId = (product as unknown as { department_id?: string | null }).department_id;
  const rawCatId = (product as unknown as { category_id?: string | null }).category_id;
  const deptId: DepartmentId = (rawDeptId as DepartmentId | null) ?? "everything_else";
  const catId = rawCatId ?? "unclassified";

  // If this (dept, cat) is not registered we still show the form so sellers
  // can reclassify + save. The server action re-validates on submit.
  const dept = findDepartment(deptId);
  const departmentLabel = dept?.label ?? "Everything Else";
  const cat = dept?.categories.find((c) => c.id === catId);
  const categoryLabel = cat?.label ?? "Products not yet classified";

  const categorySpec = isCategorySpecRegistered(deptId, catId)
    ? resolveCategorySpec(deptId, catId)
    : resolveCategorySpec("everything_else", "unclassified");
  if (!categorySpec) {
    // Impossible (everything_else is always registered) but defensive.
    redirect(`/nex-native/manage/products/${productId}?e=no-spec`);
  }

  // Split spec: strip the reserved blocks (market + delivery), keep
  // category-specific keys. Rename `_unused` so lint doesn't flag.
  const rawSpec = (product.spec ?? {}) as Record<string, unknown>;
  const {
    [MARKET_SPEC_KEY]: _marketBlock,
    [DELIVERY_SPEC_KEY]: _deliveryBlock,
    [IDENTITY_SPEC_KEY]: _identityBlock,
    [WHOLESALE_SPEC_KEY]: _wholesaleBlock,
    [RETURNS_SPEC_KEY]: _returnsBlock,
    ...categoryOnlySpec
  } = rawSpec;
  void _marketBlock; void _deliveryBlock; void _identityBlock; void _wholesaleBlock; void _returnsBlock;
  const market = extractMarket(rawSpec);
  const delivery = extractDelivery(rawSpec);
  const identity = extractIdentity(rawSpec);
  const wholesale = extractWholesale(rawSpec);
  const returns = extractReturns(rawSpec);

  const initial: MarketSelectorValue = marketToUIValue(market);
  const initialDelivery: DeliveryEditorValue = deliveryToUIValue(delivery);
  const initialIdentity: IdentityDraft = identityToUIValue(identity);
  const initialWholesale: WholesaleDraft = wholesaleToUIValue(wholesale);
  const initialReturns: ReturnsDraft = returnsToUIValue(returns);

  const status: AllowedStatus = ((["draft", "live", "archived"] as readonly string[]).includes(product.status) ? product.status : "draft") as AllowedStatus;
  const stock: AllowedStock = ((["in_stock", "low_stock", "sold_out", "made_to_order"] as readonly string[]).includes(product.stock_status ?? "") ? (product.stock_status as AllowedStock) : "in_stock");

  // honest access to display_name without widening the business-service import
  const biz = await businessService.getBusinessById(product.business_id).catch(() => null);
  const businessName = biz?.display_name ?? owningBusiness.display_name;

  // Load variants and translate to the client-facing VariantDraft shape
  // (major-currency price string, blank-string axis/stock when null).
  const variantRows = await productService.listVariants(product.id).catch(() => []);
  const variantDrafts: readonly VariantDraft[] = variantRows.map((v) => ({
    existingId: v.id,
    name: v.name,
    axis: (v.attribute ?? "") as VariantDraft["axis"],
    priceMajor: typeof v.price_pence === "number" ? (v.price_pence / 100).toString() : "",
    stock: (v.stock_status ?? "") as VariantDraft["stock"],
  }));

  return (
    <EditProductFormClient
      productId={product.id}
      businessId={product.business_id}
      businessName={businessName}
      departmentId={deptId}
      departmentLabel={departmentLabel}
      categoryId={catId}
      categoryLabel={categoryLabel}
      fields={categorySpec.fields}
      initial={{
        name: product.name,
        description: product.description ?? "",
        pricePenceMajor: (product.price_pence / 100).toString(),
        currency: product.currency,
        imageUrl: product.image_url ?? "",
        galleryUrls: Array.isArray(product.gallery_urls)
          ? product.gallery_urls.filter((u): u is string => typeof u === "string")
          : [],
        stockStatus: stock,
        status,
        spec: categoryOnlySpec,
        market: initial,
        variants: variantDrafts,
        delivery: initialDelivery,
        identity: initialIdentity,
        wholesale: initialWholesale,
        returns: initialReturns,
      }}
    />
  );
}

/** Translate stored Returns substrate into UI draft. */
function returnsToUIValue(r: ReturnType<typeof extractReturns>): ReturnsDraft {
  if (!r) return EMPTY_RETURNS;
  const p = r.seller_policy;
  return {
    acceptsReturns: p.accepts_returns,
    withinDays: typeof p.within_days === "number" ? String(p.within_days) : "",
    whoPaysShipping: p.who_pays_shipping,
    conditionRequirement: p.condition_requirement ?? "",
    notes: p.notes ?? "",
  };
}

/** Translate stored Identity substrate into UI drafts. */
function identityToUIValue(i: ReturnType<typeof extractIdentity>): IdentityDraft {
  if (!i) return EMPTY_IDENTITY;
  return {
    condition: i.condition,
    conditionNotes: i.condition_notes ?? "",
    countryOfManufacture: i.country_of_manufacture ?? "",
    countryOfOrigin: i.country_of_origin ?? "",
    dimensions: i.dimensions ?? "",
    weightG: typeof i.weight_g === "number" ? String(i.weight_g) : "",
  };
}

/** Translate stored Wholesale substrate into UI drafts. */
function wholesaleToUIValue(w: ReturnType<typeof extractWholesale>): WholesaleDraft {
  if (!w) return EMPTY_WHOLESALE;
  return {
    offered: w.offered,
    minQty: typeof w.min_qty === "number" ? String(w.min_qty) : "",
    pricingMode: w.pricing_mode,
    tiers: (w.tiers ?? []).map((t) => ({
      minQty: String(t.min_qty),
      priceMajor: (t.price_pence / 100).toString(),
      currency: t.currency,
    })),
    notes: w.notes ?? "",
  };
}

/** Translate stored Delivery substrate (pence integers, arrays) back
 *  into the UI shape the DeliveryEditor expects (major-currency
 *  strings, comma-separated CSVs). */
function deliveryToUIValue(d: ReturnType<typeof extractDelivery>): DeliveryEditorValue {
  if (!d) return { local: [], export: [] };
  const toMajor = (p: number | undefined): string => (typeof p === "number" ? (p / 100).toString() : "");
  const toStr = (v: number | undefined): string => (typeof v === "number" ? String(v) : "");
  const joinArr = (a: readonly string[] | undefined): string => (Array.isArray(a) ? a.join(", ") : "");
  const local: LocalZoneDraft[] = (d.local?.zones ?? []).map((z) => ({
    label: z.label,
    cities: joinArr(z.cities),
    areas: joinArr(z.areas),
    priceMajor: toMajor(z.price_pence),
    currency: z.currency,
    freeAboveMajor: toMajor(z.free_above_pence),
    dispatchDays: toStr(z.dispatch_days),
    deliveryMinDays: toStr(z.delivery_days_min),
    deliveryMaxDays: toStr(z.delivery_days_max),
    codEnabled: z.cod_enabled,
    codMinOrderMajor: toMajor(z.cod_min_order_pence),
    pickupAvailable: z.pickup_available,
    notes: z.notes ?? "",
  }));
  const exportDest: ExportDestDraft[] = (d.export?.destinations ?? []).map((x) => ({
    iso: x.iso,
    enabled: x.enabled,
    priceMajor: toMajor(x.price_pence),
    currency: x.currency ?? "USD",
    shippingCostMajor: toMajor(x.shipping_cost_pence),
    shippingCurrency: x.shipping_currency,
    dispatchMinDays: toStr(x.dispatch_days_min),
    dispatchMaxDays: toStr(x.dispatch_days_max),
    deliveryMinDays: toStr(x.delivery_days_min),
    deliveryMaxDays: toStr(x.delivery_days_max),
    minOrderMajor: toMajor(x.min_order_pence),
    notes: x.notes ?? "",
  }));
  return { local, export: exportDest };
}

/** Translate a server-side Market (price_pence integer) back into the UI
 *  shape the MarketSelector expects (price_pence_major as decimal string). */
function marketToUIValue(m: ReturnType<typeof extractMarket>): MarketSelectorValue {
  if (!m) {
    return { scope: "local", local: {}, export: {} };
  }
  const toMajor = (p: number | undefined) => (typeof p === "number" ? (p / 100).toString() : undefined);
  const toLocalUI = (block: NonNullable<typeof m.local>): Record<string, unknown> => {
    const { price_pence, ...rest } = block;
    const out: Record<string, unknown> = { ...rest };
    const major = toMajor(price_pence);
    if (major !== undefined) out.price_pence_major = major;
    return out;
  };
  const toExportUI = (block: NonNullable<typeof m.export>): Record<string, unknown> => {
    const { price_pence, countries, ...rest } = block;
    const out: Record<string, unknown> = { ...rest };
    const major = toMajor(price_pence);
    if (major !== undefined) out.price_pence_major = major;
    // Join country array back into comma-separated string for the text field.
    if (Array.isArray(countries) && countries.length > 0) out.countries = countries.join(", ");
    return out;
  };
  return {
    scope: m.scope,
    local: m.local ? toLocalUI(m.local) : {},
    export: m.export ? toExportUI(m.export) : {},
  };
}
