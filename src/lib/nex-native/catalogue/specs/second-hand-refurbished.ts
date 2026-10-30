// src/lib/nex-native/catalogue/specs/second-hand-refurbished.ts
//
// Second-Hand & Refurbished · Batch H · Phase 1 Product System rollout.
// 10 sub-categories.
//
// NOTE · This department exists in parallel to the primary departments
// so sellers can route pre-owned stock to a dedicated discovery surface.
// Specs intentionally emphasize condition + original_box + reconditioning
// context ahead of model/brand to mirror used-market buyer priorities.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  brand: z.string().max(80).optional(),
  model: z.string().max(80).optional(),
  condition: z.enum(["like_new", "very_good", "good", "acceptable", "for_parts"]).default("good"),
  original_box: z.boolean().optional(),
  original_accessories: z.boolean().optional(),
  reconditioning: z.string().max(200).optional(),
  age_years: z.number().positive().optional(),
  warranty_months: z.number().int().nonnegative().optional(),
});

const makeSpec = (extra: Record<string, z.ZodTypeAny> = {}) => commonBase.extend(extra);

export const UsedElectronicsSpec = makeSpec({ product_type: z.string().min(1).max(60) });
export const RefurbishedComputersSpec = makeSpec({ product_type: z.string().min(1).max(60), ram_gb: z.number().int().positive().optional(), storage_gb: z.number().int().positive().optional() });
export const PreOwnedPhonesSpec = makeSpec({ product_type: z.string().min(1).max(60), unlocked: z.boolean().optional(), battery_health_percent: z.number().min(0).max(100).optional() });
export const SecondHandFurnitureSpec = makeSpec({ item_type: z.string().min(1).max(60), dimensions: z.string().max(80).optional() });
export const UsedToolsSpec = makeSpec({ tool_type: z.string().min(1).max(60) });
export const PreOwnedVehiclesSpec = makeSpec({ vehicle_type: z.string().min(1).max(60), year: z.number().int().positive().optional(), mileage_km: z.number().int().nonnegative().optional() });
export const UsedFashionSpec = makeSpec({ item_type: z.string().min(1).max(60), size: z.string().max(40).optional() });
export const VintageClothingSpec = makeSpec({ item_type: z.string().min(1).max(60), era: z.string().max(60).optional(), size: z.string().max(40).optional() });
export const UsedBooksSpec = makeSpec({ title: z.string().min(1).max(200), author: z.string().max(120).optional() });
export const UsedSportsEquipmentSpec = makeSpec({ product_type: z.string().min(1).max(60) });

const conditionField: SpecFieldConfig = {
  key: "condition", label: "Condition", kind: "select", required: true,
  options: [
    { value: "like_new", label: "Like new" },
    { value: "very_good", label: "Very good" },
    { value: "good", label: "Good" },
    { value: "acceptable", label: "Acceptable" },
    { value: "for_parts", label: "For parts / not working" },
  ],
};
const baseFields: readonly SpecFieldConfig[] = [
  conditionField,
  { key: "brand", label: "Brand", kind: "text", maxLength: 80 },
  { key: "model", label: "Model", kind: "text", maxLength: 80 },
  { key: "original_box", label: "Original box", kind: "boolean" },
  { key: "original_accessories", label: "Original accessories", kind: "boolean" },
  { key: "reconditioning", label: "Reconditioning notes", kind: "textarea", maxLength: 200 },
  { key: "age_years", label: "Age (years)", kind: "number", min: 0 },
  { key: "warranty_months", label: "Warranty (months)", kind: "number", min: 0 },
];

export const SecondHandRefurbishedSpecs: readonly CategorySpec[] = [
  { departmentId: "second_hand_refurbished", categoryId: "used_electronics", label: "Used Electronics", schema: UsedElectronicsSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
  { departmentId: "second_hand_refurbished", categoryId: "refurbished_computers", label: "Refurbished Computers", schema: RefurbishedComputersSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "ram_gb", label: "RAM (GB)", kind: "number", min: 1 },
    { key: "storage_gb", label: "Storage (GB)", kind: "number", min: 1 },
  ]},
  { departmentId: "second_hand_refurbished", categoryId: "pre_owned_phones", label: "Pre-Owned Phones", schema: PreOwnedPhonesSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "unlocked", label: "Unlocked", kind: "boolean" },
    { key: "battery_health_percent", label: "Battery health (%)", kind: "number", min: 0, max: 100 },
  ]},
  { departmentId: "second_hand_refurbished", categoryId: "second_hand_furniture", label: "Second-Hand Furniture", schema: SecondHandFurnitureSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "dimensions", label: "Dimensions", kind: "text", maxLength: 80 },
  ]},
  { departmentId: "second_hand_refurbished", categoryId: "used_tools", label: "Used Tools", schema: UsedToolsSpec, fields: [
    { key: "tool_type", label: "Tool type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
  { departmentId: "second_hand_refurbished", categoryId: "pre_owned_vehicles", label: "Pre-Owned Vehicles", schema: PreOwnedVehiclesSpec, fields: [
    { key: "vehicle_type", label: "Vehicle type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "year", label: "Year", kind: "number", min: 1900 },
    { key: "mileage_km", label: "Mileage (km)", kind: "number", min: 0 },
  ]},
  { departmentId: "second_hand_refurbished", categoryId: "used_fashion", label: "Used Fashion", schema: UsedFashionSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "size", label: "Size", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "second_hand_refurbished", categoryId: "vintage_clothing", label: "Vintage Clothing", schema: VintageClothingSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "era", label: "Era", kind: "text", maxLength: 60, placeholder: "e.g. 1960s, 1990s" },
    { key: "size", label: "Size", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "second_hand_refurbished", categoryId: "used_books", label: "Used Books", schema: UsedBooksSpec, fields: [
    { key: "title", label: "Title", kind: "text", required: true, maxLength: 200 },
    { key: "author", label: "Author", kind: "text", maxLength: 120 },
    ...baseFields,
  ]},
  { departmentId: "second_hand_refurbished", categoryId: "used_sports_equipment", label: "Used Sports Equipment", schema: UsedSportsEquipmentSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
];
