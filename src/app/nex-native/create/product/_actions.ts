"use server";

// src/app/nex-native/create/product/_actions.ts
//
// Shared Create Product server action · Phase 1 of the Product System
// Implementation Contract (sealed 2026-10-30, §K owner-resolved).
//
// Dispatches on (departmentId, categoryId) · validates spec against the
// sealed Zod schema · writes canonical nex_product row.
//
// Scope (sealed per §A.4):
//   · One action for every category · no per-category server action
//   · Zod validation at the server boundary · fail-closed
//   · Taxonomy source: src/lib/nex-native/catalogue/departments.ts
//   · Spec source: src/lib/nex-native/catalogue/specs/*
//
// Honest limitations:
//   · This action writes to nex_product even BEFORE migration 239 is
//     applied in production. The department_id/category_id columns
//     will be added only when 239 is applied; current-prod writes
//     will silently drop those fields (safe · the shared action still
//     works, Shop/Live filters just can't filter by category yet).
//     Once 239 is applied, the columns persist and category filtering
//     becomes operational.
//   · Owner-only (business owner) write enforcement happens via
//     resolveSessionWithDevOverride + business ownership check.

import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import {
  resolveCategorySpec,
  isCategorySpecRegistered,
} from "@/lib/nex-native/catalogue/specs";
import {
  MarketSpec,
  mergeMarketIntoSpec,
  type Market,
} from "@/lib/nex-native/catalogue/market-spec";
import {
  DeliverySpec,
  mergeDeliveryIntoSpec,
  type DeliveryT,
} from "@/lib/nex-native/catalogue/delivery-spec";
import {
  IdentitySpec,
  WholesaleSpec,
  mergeIdentityIntoSpec,
  mergeWholesaleIntoSpec,
  type IdentityT,
  type WholesaleT,
} from "@/lib/nex-native/catalogue/identity-wholesale-spec";
import {
  ReturnsSpec,
  mergeReturnsIntoSpec,
  type ReturnsT,
} from "@/lib/nex-native/catalogue/returns-spec";
import {
  ColorsSpec,
  mergeColorsIntoSpec,
  type ColorsT,
} from "@/lib/nex-native/catalogue/colors-spec";
import {
  CoverVideoSpec,
  mergeCoverVideoIntoSpec,
  type CoverVideoT,
} from "@/lib/nex-native/catalogue/cover-video-spec";
import type { DepartmentId } from "@/lib/nex-native/catalogue/departments";
import type { NexProductStatus, NexProductStockStatus, NexVariantAttribute } from "@/lib/nex-native/types";
import { NEX_VARIANT_ATTRIBUTES, NEX_PRODUCT_STOCK_STATUSES } from "@/lib/nex-native/types";

export interface CreateProductVariantPayload {
  readonly name: string;
  readonly attribute: string | null;
  readonly price_pence?: number | null;
  readonly stock_status?: string | null;
  readonly position?: number;
}

export type CreateProductErrorCode =
  | "not-signed-in"
  | "invalid-input"
  | "business-not-owned"
  | "unknown-category"
  | "spec-invalid"
  | "market-invalid"
  | "delivery-invalid"
  | "identity-invalid"
  | "wholesale-invalid"
  | "returns-invalid"
  | "colors-invalid"
  | "cover-video-invalid"
  | "tier-limit"
  | "internal";

export type CreateProductResult =
  | { ok: true; data: { productId: string; variantWarning?: string } }
  | { ok: false; code: CreateProductErrorCode; message: string };

export interface CreateProductInput {
  readonly businessId: string;
  readonly departmentId: DepartmentId;
  readonly categoryId: string;
  readonly name: string;
  readonly description?: string;
  readonly pricePence: number;
  readonly currency: string;
  readonly imageUrl?: string | null;
  readonly galleryUrls?: readonly string[];
  readonly tags?: readonly string[];
  readonly sku?: string | null;
  readonly stockStatus?: NexProductStockStatus;
  readonly spec: unknown;
  /** Sales-market substrate. Required · every product declares scope. */
  readonly market: unknown;
  /** Optional · when provided, validated by DeliverySpec and merged
   *  under spec.__delivery. Omit for non-shippable listings. */
  readonly delivery?: unknown;
  readonly identity?: unknown;
  readonly wholesale?: unknown;
  readonly returns?: unknown;
  readonly colors?: unknown;
  readonly coverVideo?: unknown;
  readonly status?: Extract<NexProductStatus, "draft" | "live">;
  /** Optional · zero variants means a flat non-variant product. */
  readonly variants?: readonly CreateProductVariantPayload[];
}

function err(code: CreateProductErrorCode, message: string): CreateProductResult {
  return { ok: false, code, message };
}

function isUuidLike(v: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(v);
}

export async function createProductAction(
  input: CreateProductInput,
): Promise<CreateProductResult> {
  // 1 · Session gate
  const session = await resolveSessionWithDevOverride();
  if (!session) return err("not-signed-in", "Sign in required");

  // 2 · Input validation (defence-in-depth above Zod)
  if (!isUuidLike(input.businessId)) {
    return err("invalid-input", "businessId must be a UUID");
  }
  if (!input.name || input.name.trim().length === 0) {
    return err("invalid-input", "name is required");
  }
  if (typeof input.pricePence !== "number" || !Number.isFinite(input.pricePence) || input.pricePence < 0) {
    return err("invalid-input", "pricePence must be a non-negative number");
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    return err("invalid-input", "currency must be an ISO 4217 3-letter code");
  }

  // 3 · Ownership gate
  let ownedIds: ReadonlySet<string>;
  try {
    const raw = await listBusinessesByOwner(session.account.id);
    ownedIds = new Set(raw.map((b) => b.id));
  } catch (e) {
    return err("internal", `ownership lookup failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!ownedIds.has(input.businessId)) {
    return err("business-not-owned", "You do not own this business");
  }

  // 4 · Category spec gate
  if (!isCategorySpecRegistered(input.departmentId, input.categoryId)) {
    return err("unknown-category", `Category ${input.departmentId}/${input.categoryId} is not yet available for upload`);
  }
  const categorySpec = resolveCategorySpec(input.departmentId, input.categoryId);
  if (!categorySpec) {
    // defensive · isCategorySpecRegistered already returned true
    return err("unknown-category", `Category ${input.departmentId}/${input.categoryId} unresolved`);
  }

  // 5 · Zod spec validation (fail-closed)
  const validated = categorySpec.schema.safeParse(input.spec);
  if (!validated.success) {
    return err("spec-invalid", `Spec validation failed: ${validated.error.message}`);
  }

  // 6 · Market payload validation (fail-closed · scope mandatory)
  const marketResult = MarketSpec.safeParse(input.market);
  if (!marketResult.success) {
    return err("market-invalid", `Market validation failed: ${marketResult.error.message}`);
  }
  const market: Market = marketResult.data;

  // 7 · Merge market into spec jsonb under reserved key __market
  const specWithMarket = mergeMarketIntoSpec(
    validated.data as Record<string, unknown>,
    market,
  );

  // 7b · Delivery substrate (optional).
  let specFinal: Record<string, unknown> = specWithMarket;
  if (input.delivery !== undefined) {
    const dResult = DeliverySpec.safeParse(input.delivery);
    if (!dResult.success) {
      return err("delivery-invalid", `Delivery validation failed: ${dResult.error.message}`);
    }
    const delivery: DeliveryT = dResult.data;
    specFinal = mergeDeliveryIntoSpec(specFinal, delivery);
  }

  // 7c · Identity substrate (optional).
  if (input.identity !== undefined) {
    const iResult = IdentitySpec.safeParse(input.identity);
    if (!iResult.success) {
      return err("identity-invalid", `Identity validation failed: ${iResult.error.message}`);
    }
    const identity: IdentityT = iResult.data;
    specFinal = mergeIdentityIntoSpec(specFinal, identity);
  }

  // 7d · Wholesale substrate (optional).
  if (input.wholesale !== undefined) {
    const wResult = WholesaleSpec.safeParse(input.wholesale);
    if (!wResult.success) {
      return err("wholesale-invalid", `Wholesale validation failed: ${wResult.error.message}`);
    }
    const wholesale: WholesaleT = wResult.data;
    specFinal = mergeWholesaleIntoSpec(specFinal, wholesale);
  }

  // 7e · Returns substrate (optional). Only the seller policy is
  // validated here; the statutory floor is a read-only overlay the UI
  // computes from catalogue/consumer-rights.ts.
  if (input.returns !== undefined) {
    const rResult = ReturnsSpec.safeParse(input.returns);
    if (!rResult.success) {
      return err("returns-invalid", `Returns validation failed: ${rResult.error.message}`);
    }
    const returns: ReturnsT = rResult.data;
    specFinal = mergeReturnsIntoSpec(specFinal, returns);
  }

  // 7f · Colors substrate (optional · owner-authorised 2026-10-31).
  if (input.colors !== undefined) {
    const cResult = ColorsSpec.safeParse(input.colors);
    if (!cResult.success) {
      return err("colors-invalid", `Colors validation failed: ${cResult.error.message}`);
    }
    const colors: ColorsT = cResult.data;
    specFinal = mergeColorsIntoSpec(specFinal, colors);
  }

  // 7g · Cover video (optional · owner-authorised 2026-10-31).
  //    null payload → skip; declared payload → Zod validate + merge.
  if (input.coverVideo !== undefined && input.coverVideo !== null) {
    const vResult = CoverVideoSpec.safeParse(input.coverVideo);
    if (!vResult.success) {
      return err("cover-video-invalid", `Cover video validation failed: ${vResult.error.message}`);
    }
    const video: CoverVideoT = vResult.data;
    specFinal = mergeCoverVideoIntoSpec(specFinal, video);
  }

  // 8 · Write canonical nex_product row
  try {
    const row = await productService.createProduct({
      business_id: input.businessId,
      name: input.name.trim(),
      description: input.description ?? null,
      image_url: input.imageUrl ?? null,
      gallery_urls: input.galleryUrls ? [...input.galleryUrls] : null,
      tags: input.tags ? [...input.tags] : null,
      sku: input.sku ?? null,
      stock_status: input.stockStatus ?? "in_stock",
      price_pence: input.pricePence,
      currency: input.currency as "GBP" | "USD" | "EUR" | "IDR" | string,
      status: input.status ?? "draft",
      department_id: input.departmentId,
      category_id: input.categoryId,
      spec: specFinal,
    });
    // 9 · Variant sync (fail-soft · bad variants surface a diagnostic
    // but DO NOT revoke the parent product. The seller can finish the
    // variants from the Edit page, which is the single source of truth
    // for existing-variant management.)
    if (input.variants && input.variants.length > 0) {
      try {
        await productService.syncProductVariants(
          row.id,
          input.variants.map((v, i) => ({
            name: v.name,
            attribute: validAxis(v.attribute),
            price_pence: typeof v.price_pence === "number" ? v.price_pence : null,
            stock_status: validStock(v.stock_status),
            position: typeof v.position === "number" ? v.position : i,
          })),
        );
      } catch (ve) {
        // Honest signal: product was created but variants partly failed.
        // Return success with productId so the seller can navigate to
        // Edit and finish the variants (one source of truth).
        const vMsg = ve instanceof Error ? ve.message : String(ve);
        return { ok: true, data: { productId: row.id, variantWarning: vMsg } };
      }
    }
    return { ok: true, data: { productId: row.id } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/tier.*limit|cap|gratis/i.test(msg)) {
      return err("tier-limit", msg);
    }
    return err("internal", `createProduct failed: ${msg}`);
  }
}

function validAxis(a: string | null | undefined): NexVariantAttribute | null {
  if (!a) return null;
  return (NEX_VARIANT_ATTRIBUTES as readonly string[]).includes(a) ? (a as NexVariantAttribute) : null;
}

function validStock(s: string | null | undefined): NexProductStockStatus | null {
  if (!s) return null;
  return (NEX_PRODUCT_STOCK_STATUSES as readonly string[]).includes(s) ? (s as NexProductStockStatus) : null;
}
