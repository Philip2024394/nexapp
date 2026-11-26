// tests/e2e/_fixtures/spec-payload-helper.ts
//
// L-034 · category-spec payload helper · authored 2026-11-26 under the
// Strict Complete-App Delivery Directive 2026-11-26 §3 (spec-editor
// full-form edit journey · build the required helper rather than
// leaving as permanently deferred).
//
// Purpose
// -------
// Produce a MINIMAL VALID payload for any registered CategorySpec in
// the Phase-1 Product System catalogue. Returned payloads pass
// `categorySpec.schema.safeParse` and are safe to send to
// `updateProductAction` / `createProductAction` as the `spec` field.
//
// This is a TEST-ONLY helper. It lives in tests/e2e/_fixtures so it
// cannot leak into product bundles. The helper does NOT mutate any
// DB state, does NOT read env vars, and does NOT depend on a running
// server. It simply synthesises payload values from the
// `CategorySpec.fields` metadata.
//
// Strategy
// --------
// The spec registry at `src/lib/nex-native/catalogue/specs/index.ts`
// exports `listRegisteredCategorySpecs()`. Each entry has:
//   · `schema` · the Zod validator the server action enforces.
//   · `fields` · an ordered FormBuilder config that mirrors which
//     keys are required.
//
// Strategy: for every field in `spec.fields`:
//   · If `required: true`, emit a defaulted value matching its `kind`.
//   · Otherwise, leave the key unset (Zod `.optional()` accepts).
//
// Companion market/delivery/identity/etc. payloads live in sibling
// helpers below · they are also MINIMAL + VALID by construction.
//
// Reference: `src/app/nex-native/manage/products/[productId]/edit/
// _actions.ts:98-124` lists the full `UpdateProductInput` shape.

import type {
  CategorySpec,
  FieldKind,
  SpecFieldConfig,
} from "@/lib/nex-native/catalogue/specs/types";

/**
 * Default value for a field kind. Chosen to pass `.min(1)` / `.min(0)`
 * / `.regex` constraints common across the registered specs. Callers
 * that need a *specific* value for a specific field can override via
 * the `overrides` argument on the outer builder.
 */
export function defaultValueForFieldKind(kind: FieldKind): unknown {
  switch (kind) {
    case "text":
      return "test";
    case "textarea":
      return "test description";
    case "number":
      // 1 clears both `.positive()` and `.nonnegative()` constraints.
      return 1;
    case "boolean":
      return false;
    case "date":
      // ISO-8601 calendar date. Common Zod storage is `.string()` with
      // length ≤ 40 — "2026-01-01" satisfies that.
      return "2026-01-01";
    case "image":
      return "https://example.invalid/placeholder.png";
    case "image-gallery":
      return ["https://example.invalid/placeholder.png"];
    case "select":
    case "multi-select":
      // Caller resolves from the field's own `options[]` because the
      // kind alone has no option list. Sentinel · see
      // `defaultValueForField` below.
      return undefined;
    default: {
      // Exhaustiveness — if a new FieldKind is added and this switch
      // is not updated, TypeScript narrows this branch and tests catch
      // the gap at compile time.
      const _never: never = kind;
      return _never;
    }
  }
}

/**
 * Resolve a default value for a specific field, using its `options`
 * for select/multi-select kinds.
 */
export function defaultValueForField(field: SpecFieldConfig): unknown {
  if (field.kind === "select") {
    return field.options && field.options.length > 0
      ? field.options[0].value
      : "unknown";
  }
  if (field.kind === "multi-select") {
    return field.options && field.options.length > 0
      ? [field.options[0].value]
      : [];
  }
  return defaultValueForFieldKind(field.kind);
}

/**
 * Build a MINIMAL VALID spec payload for a given registered
 * CategorySpec.
 *
 * - Every `required: true` field in `spec.fields` receives a default
 *   value chosen to satisfy common Zod constraints.
 * - Optional fields are omitted.
 * - Caller can pass `overrides` to pin specific keys (e.g. a brand
 *   string under test).
 *
 * The returned object is guaranteed to pass `spec.schema.safeParse`
 * for every category currently in the registry — this invariant is
 * enforced by `tests/e2e/regression-spec-payload-helper.spec.ts`.
 */
export function buildMinimalCategorySpecPayload(
  spec: CategorySpec,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of spec.fields) {
    if (field.required) {
      payload[field.key] = defaultValueForField(field);
    }
  }
  return { ...payload, ...overrides };
}

/**
 * Build a MINIMAL VALID market payload for `MarketSpec` in
 * `src/lib/nex-native/catalogue/market-spec.ts`. Scope defaults to
 * "local" with an empty local object — all local fields are optional.
 */
export function buildMinimalMarketPayload(
  scope: "local" | "export" | "both" = "local",
): Record<string, unknown> {
  if (scope === "local") return { scope, local: {} };
  if (scope === "export") return { scope, export: {} };
  return { scope: "both", local: {}, export: {} };
}

/**
 * Helper for the FULL `UpdateProductInput` shape. Takes the IDs of
 * an existing product + its category and returns a payload that
 * passes every gate in `updateProductAction` (session + ownership
 * gates are checked separately by the caller).
 *
 * Returns the server-action-ready input · the caller can shallow-
 * merge further fields (name, pricePence, status, variants, …).
 */
export interface MinimalUpdateProductInputArgs {
  readonly productId: string;
  readonly categorySpec: CategorySpec;
  readonly name?: string;
  readonly pricePence?: number;
  readonly currency?: string;
  readonly specOverrides?: Record<string, unknown>;
}

export function buildMinimalUpdateProductInput(
  args: MinimalUpdateProductInputArgs,
): {
  readonly productId: string;
  readonly departmentId: CategorySpec["departmentId"];
  readonly categoryId: string;
  readonly name: string;
  readonly pricePence: number;
  readonly currency: string;
  readonly spec: Record<string, unknown>;
  readonly market: Record<string, unknown>;
} {
  return {
    productId: args.productId,
    departmentId: args.categorySpec.departmentId,
    categoryId: args.categorySpec.categoryId,
    name: args.name ?? "L-034 test product",
    pricePence: args.pricePence ?? 999,
    currency: args.currency ?? "GBP",
    spec: buildMinimalCategorySpecPayload(
      args.categorySpec,
      args.specOverrides,
    ),
    market: buildMinimalMarketPayload("local"),
  };
}
