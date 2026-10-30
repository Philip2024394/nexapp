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
import type { DepartmentId } from "@/lib/nex-native/catalogue/departments";
import type { NexProductStatus, NexProductStockStatus } from "@/lib/nex-native/types";

export type CreateProductErrorCode =
  | "not-signed-in"
  | "invalid-input"
  | "business-not-owned"
  | "unknown-category"
  | "spec-invalid"
  | "tier-limit"
  | "internal";

export type CreateProductResult =
  | { ok: true; data: { productId: string } }
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
  readonly status?: Extract<NexProductStatus, "draft" | "live">;
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

  // 6 · Write canonical nex_product row
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
      spec: validated.data as Record<string, unknown>,
    });
    return { ok: true, data: { productId: row.id } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/tier.*limit|cap|gratis/i.test(msg)) {
      return err("tier-limit", msg);
    }
    return err("internal", `createProduct failed: ${msg}`);
  }
}
