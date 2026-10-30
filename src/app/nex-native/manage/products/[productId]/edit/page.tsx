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
import type { MarketSelectorValue } from "@/components/nex-native/product-create/MarketSelector";
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

  // Split spec: strip the market block, keep category-specific keys.
  const rawSpec = (product.spec ?? {}) as Record<string, unknown>;
  const { [MARKET_SPEC_KEY]: _marketBlock, ...categoryOnlySpec } = rawSpec;
  const market = extractMarket(rawSpec);

  const initial: MarketSelectorValue = marketToUIValue(market);

  const status: AllowedStatus = ((["draft", "live", "archived"] as readonly string[]).includes(product.status) ? product.status : "draft") as AllowedStatus;
  const stock: AllowedStock = ((["in_stock", "low_stock", "sold_out", "made_to_order"] as readonly string[]).includes(product.stock_status ?? "") ? (product.stock_status as AllowedStock) : "in_stock");

  // honest access to display_name without widening the business-service import
  const biz = await businessService.getBusinessById(product.business_id).catch(() => null);
  const businessName = biz?.display_name ?? owningBusiness.display_name;

  return (
    <EditProductFormClient
      productId={product.id}
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
        stockStatus: stock,
        status,
        spec: categoryOnlySpec,
        market: initial,
      }}
    />
  );
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
