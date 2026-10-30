// src/lib/nex-native/catalogue/specs/types.ts
//
// Shared types for category-specific product specifications.
// Owner-authorised 2026-10-30 · Phase 1 of the Product System
// Implementation Contract. §A.2 locks spec storage as
// nex_product.spec jsonb + Zod validators per category.
//
// Each category registers a Zod schema here (via the registry at
// ./index.ts). The shared createProductAction + updateProductSpecAction
// dispatch on (departmentId, categoryId) to look up the schema and
// validate the client-supplied spec payload before writing jsonb.
//
// FormConfig describes how the auto-generated form renders each field
// so SpecFormBuilder can produce a usable UI without a dedicated form
// component per category. Categories with unusual UX needs can supply
// a dedicated form component instead; FormConfig is for the common case.

import type { z } from "zod";
import type { DepartmentId } from "@/lib/nex-native/catalogue/departments";

export type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "multi-select"
  | "boolean"
  | "date"
  | "image"
  | "image-gallery";

export interface SpecFieldConfig {
  readonly key: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly placeholder?: string;
  readonly helpText?: string;
  readonly options?: readonly { readonly value: string; readonly label: string }[];
  readonly required?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly maxLength?: number;
}

export interface CategorySpec {
  readonly departmentId: DepartmentId;
  readonly categoryId: string;
  readonly label: string;
  /** Zod schema that validates the spec payload. */
  readonly schema: z.ZodType<unknown>;
  /** Ordered field configuration that drives SpecFormBuilder. */
  readonly fields: readonly SpecFieldConfig[];
}

/** Shape of the spec payload after Zod validation. Always a JSON object. */
export type ValidatedSpec = Record<string, unknown>;
