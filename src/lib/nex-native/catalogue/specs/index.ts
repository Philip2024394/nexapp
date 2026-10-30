// src/lib/nex-native/catalogue/specs/index.ts
//
// Category-spec registry · owner-authorised 2026-10-30 · Phase 1 of
// the Product System Implementation Contract.
//
// Lookup function: `resolveCategorySpec(departmentId, categoryId)`.
// Returns the sealed CategorySpec for the matching (dept, cat) pair,
// or `null` when the pair is unknown. Callers that write to
// nex_product MUST validate against the returned schema before INSERT.
//
// Only Fashion & Clothing is enabled Phase 1 (pilot per §K.1). Other
// departments are stubbed with no spec registered until their
// implementation batch per §I.5.

import type { CategorySpec } from "./types";
import type { DepartmentId } from "@/lib/nex-native/catalogue/departments";
import { FashionClothingSpecs } from "./fashion-clothing";
import { ElectronicsTechnologySpecs } from "./electronics-technology";
import { HomeFurnitureLivingSpecs } from "./home-furniture-living";
import { KitchenDiningSpecs } from "./kitchen-dining";
import { BeautyPersonalCareSpecs } from "./beauty-personal-care";
import { HealthWellnessMedicalSpecs } from "./health-wellness-medical";
import { BabyNurseryParentingSpecs } from "./baby-nursery-parenting";

// Registry entries · one row per sub-category.
const ALL_CATEGORY_SPECS: readonly CategorySpec[] = [
  ...FashionClothingSpecs,
  ...ElectronicsTechnologySpecs,
  ...HomeFurnitureLivingSpecs,
  ...KitchenDiningSpecs,
  ...BeautyPersonalCareSpecs,
  ...HealthWellnessMedicalSpecs,
  ...BabyNurseryParentingSpecs,
  // Other departments: add entries here as they ship per §I.5 batches.
];

// Fast lookup table built once at module load.
const SPEC_INDEX = new Map<string, CategorySpec>();
for (const spec of ALL_CATEGORY_SPECS) {
  SPEC_INDEX.set(specKey(spec.departmentId, spec.categoryId), spec);
}

function specKey(dept: DepartmentId, cat: string): string {
  return `${dept}::${cat}`;
}

/** Resolve the sealed spec for a (dept, cat) pair. Returns null when
 *  no spec is registered (department not yet implemented in Phase 1). */
export function resolveCategorySpec(
  departmentId: DepartmentId,
  categoryId: string,
): CategorySpec | null {
  return SPEC_INDEX.get(specKey(departmentId, categoryId)) ?? null;
}

/** List all registered category specs. Used by the Create route to
 *  decide which categories are selectable right now (enabled by having
 *  a spec registered, not by the stale departments.ts enabled flag). */
export function listRegisteredCategorySpecs(): readonly CategorySpec[] {
  return ALL_CATEGORY_SPECS;
}

/** Check whether a (dept, cat) pair has a registered spec. */
export function isCategorySpecRegistered(
  departmentId: DepartmentId,
  categoryId: string,
): boolean {
  return SPEC_INDEX.has(specKey(departmentId, categoryId));
}

export type { CategorySpec, SpecFieldConfig, FieldKind, ValidatedSpec } from "./types";
