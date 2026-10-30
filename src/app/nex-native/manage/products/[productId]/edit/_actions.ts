"use server";

// src/app/nex-native/manage/products/[productId]/edit/_actions.ts
//
// Owner-authorised 2026-10-30 (Product Upload World-Class brief) ·
// shared Edit Product server action. Mirrors createProductAction in
// shape and gates so sellers can revise any product without losing
// data and without creating a duplicate record.
//
// Gates (fail-closed, same order as createProductAction):
//   1 · Session
//   2 · Input validation (defence-in-depth)
//   3 · Product exists
//   4 · Ownership (the owning business belongs to the signed-in account)
//   5 · Category spec gate (dept/cat still registered — refuses writes
//       to categories that have been retired since the product was created)
//   6 · Zod spec validation
//   7 · Zod market validation
//   8 · Merge market into spec.__market
//   9 · updateProductBatch · single atomic UPDATE

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
import type { DepartmentId } from "@/lib/nex-native/catalogue/departments";
import type { NexProductStatus, NexProductStockStatus, NexVariantAttribute } from "@/lib/nex-native/types";
import { NEX_VARIANT_ATTRIBUTES, NEX_PRODUCT_STOCK_STATUSES } from "@/lib/nex-native/types";

export interface UpdateProductVariantPayload {
  readonly existingId?: string;
  readonly name: string;
  readonly attribute: string | null;
  readonly price_pence?: number | null;
  readonly stock_status?: string | null;
  readonly position?: number;
}

export type UpdateProductErrorCode =
  | "not-signed-in"
  | "invalid-input"
  | "product-not-found"
  | "business-not-owned"
  | "unknown-category"
  | "spec-invalid"
  | "market-invalid"
  | "delivery-invalid"
  | "identity-invalid"
  | "wholesale-invalid"
  | "internal";

export type UpdateProductResult =
  | { ok: true; data: { productId: string; variantWarning?: string } }
  | { ok: false; code: UpdateProductErrorCode; message: string };

export interface UpdateProductInput {
  readonly productId: string;
  readonly departmentId: DepartmentId;
  readonly categoryId: string;
  readonly name: string;
  readonly description?: string | null;
  readonly pricePence: number;
  readonly currency: string;
  readonly imageUrl?: string | null;
  readonly galleryUrls?: readonly string[];
  readonly stockStatus?: NexProductStockStatus;
  readonly spec: unknown;
  readonly market: unknown;
  readonly delivery?: unknown;
  readonly identity?: unknown;
  readonly wholesale?: unknown;
  readonly status?: Extract<NexProductStatus, "draft" | "live" | "archived">;
  /** Full desired variant list · diff-synced against existing rows. */
  readonly variants?: readonly UpdateProductVariantPayload[];
}

function err(code: UpdateProductErrorCode, message: string): UpdateProductResult {
  return { ok: false, code, message };
}

function isUuidLike(v: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(v);
}

export async function updateProductAction(
  input: UpdateProductInput,
): Promise<UpdateProductResult> {
  // 1 · Session
  const session = await resolveSessionWithDevOverride();
  if (!session) return err("not-signed-in", "Sign in required");

  // 2 · Input validation
  if (!isUuidLike(input.productId)) {
    return err("invalid-input", "productId must be a UUID");
  }
  if (!input.name || input.name.trim().length === 0) {
    return err("invalid-input", "name is required");
  }
  if (typeof input.pricePence !== "number" || !Number.isFinite(input.pricePence) || input.pricePence < 0) {
    return err("invalid-input", "pricePence must be a non-negative number");
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    return err("invalid-input", "currency must be ISO 4217 3-letter");
  }

  // 3 · Product exists
  let existing;
  try {
    existing = await productService.getProductById(input.productId);
  } catch (e) {
    return err("internal", `product read failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!existing) return err("product-not-found", "Product does not exist");

  // 4 · Ownership
  let ownedIds: ReadonlySet<string>;
  try {
    const raw = await listBusinessesByOwner(session.account.id);
    ownedIds = new Set(raw.map((b) => b.id));
  } catch (e) {
    return err("internal", `ownership lookup failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!ownedIds.has(existing.business_id)) {
    return err("business-not-owned", "You do not own this business");
  }

  // 5 · Category spec gate
  if (!isCategorySpecRegistered(input.departmentId, input.categoryId)) {
    return err("unknown-category", `Category ${input.departmentId}/${input.categoryId} is not currently available`);
  }
  const categorySpec = resolveCategorySpec(input.departmentId, input.categoryId);
  if (!categorySpec) {
    return err("unknown-category", `Category ${input.departmentId}/${input.categoryId} unresolved`);
  }

  // 6 · Zod spec validation
  const validated = categorySpec.schema.safeParse(input.spec);
  if (!validated.success) {
    return err("spec-invalid", `Spec validation failed: ${validated.error.message}`);
  }

  // 7 · Market payload validation
  const marketResult = MarketSpec.safeParse(input.market);
  if (!marketResult.success) {
    return err("market-invalid", `Market validation failed: ${marketResult.error.message}`);
  }
  const market: Market = marketResult.data;

  // 8 · Merge market into spec
  const specWithMarket = mergeMarketIntoSpec(
    validated.data as Record<string, unknown>,
    market,
  );

  // 8b · Delivery (optional)
  let specFinal: Record<string, unknown> = specWithMarket;
  if (input.delivery !== undefined) {
    const dResult = DeliverySpec.safeParse(input.delivery);
    if (!dResult.success) {
      return err("delivery-invalid", `Delivery validation failed: ${dResult.error.message}`);
    }
    const delivery: DeliveryT = dResult.data;
    specFinal = mergeDeliveryIntoSpec(specFinal, delivery);
  }

  // 8c · Identity (optional)
  if (input.identity !== undefined) {
    const iResult = IdentitySpec.safeParse(input.identity);
    if (!iResult.success) {
      return err("identity-invalid", `Identity validation failed: ${iResult.error.message}`);
    }
    const identity: IdentityT = iResult.data;
    specFinal = mergeIdentityIntoSpec(specFinal, identity);
  }

  // 8d · Wholesale (optional)
  if (input.wholesale !== undefined) {
    const wResult = WholesaleSpec.safeParse(input.wholesale);
    if (!wResult.success) {
      return err("wholesale-invalid", `Wholesale validation failed: ${wResult.error.message}`);
    }
    const wholesale: WholesaleT = wResult.data;
    specFinal = mergeWholesaleIntoSpec(specFinal, wholesale);
  }

  // 9 · updateProductBatch
  try {
    const row = await productService.updateProductBatch(input.productId, {
      name: input.name.trim(),
      description: input.description === undefined ? undefined : input.description,
      image_url: input.imageUrl === undefined ? undefined : input.imageUrl,
      gallery_urls: input.galleryUrls === undefined
        ? undefined
        : (input.galleryUrls.length > 0 ? [...input.galleryUrls] : null),
      stock_status: input.stockStatus,
      price_pence: input.pricePence,
      currency: input.currency,
      status: input.status,
      department_id: input.departmentId,
      category_id: input.categoryId,
      spec: specFinal,
    });
    // Variant sync (fail-soft · same posture as createProductAction).
    if (input.variants !== undefined) {
      try {
        await productService.syncProductVariants(
          row.id,
          input.variants.map((v, i) => ({
            existingId: v.existingId,
            name: v.name,
            attribute: validAxis(v.attribute),
            price_pence: typeof v.price_pence === "number" ? v.price_pence : null,
            stock_status: validStock(v.stock_status),
            position: typeof v.position === "number" ? v.position : i,
          })),
        );
      } catch (ve) {
        return { ok: true, data: { productId: row.id, variantWarning: ve instanceof Error ? ve.message : String(ve) } };
      }
    }
    return { ok: true, data: { productId: row.id } };
  } catch (e) {
    return err("internal", `updateProduct failed: ${e instanceof Error ? e.message : String(e)}`);
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
