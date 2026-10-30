// src/lib/nex-native/catalogue/specs/baby-nursery-parenting.ts
//
// Baby, Nursery & Parenting · Batch B department · Phase 1 Product
// System continuous rollout per §I.5 + §K.2 (owner-sealed 2026-10-30).
// 7 sub-categories.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  brand: z.string().max(80).optional(),
  age_range: z.string().max(40).optional(),
  safety_standard: z.string().max(80).optional(),
  material: z.string().max(80).optional(),
  colour: z.string().max(60).optional(),
});

export const BabyClothingSpec = commonBase.extend({
  item_type: z.string().min(1).max(60),
  size: z.string().max(40).optional(),
  gender: z.string().max(40).optional(),
});

export const FeedingSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  capacity_ml: z.number().positive().optional(),
  bpa_free: z.boolean().optional(),
});

export const NappiesHygieneSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  size: z.string().max(40).optional(),
  pack_count: z.number().int().positive().optional(),
});

export const NurseryFurnitureSpec = commonBase.extend({
  item_type: z.string().min(1).max(60),
  dimensions: z.string().max(80).optional(),
  weight_capacity_kg: z.number().positive().optional(),
});

export const TravelSafetySpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  group: z.string().max(40).optional(),
  weight_capacity_kg: z.number().positive().optional(),
});

export const BabyToysSpec = commonBase.extend({
  toy_type: z.string().min(1).max(60),
  battery_required: z.boolean().optional(),
});

export const ParentingAccessoriesSpec = commonBase.extend({
  accessory_type: z.string().min(1).max(60),
});

const baseFields: readonly SpecFieldConfig[] = [
  { key: "brand", label: "Brand", kind: "text", maxLength: 80 },
  { key: "age_range", label: "Age range", kind: "text", maxLength: 40, placeholder: "e.g. 0-6 months, 1-3 years" },
  { key: "safety_standard", label: "Safety standard", kind: "text", maxLength: 80 },
  { key: "material", label: "Material", kind: "text", maxLength: 80 },
  { key: "colour", label: "Colour", kind: "text", maxLength: 60 },
];

export const BabyNurseryParentingSpecs: readonly CategorySpec[] = [
  { departmentId: "baby_nursery_parenting", categoryId: "baby_clothing", label: "Baby Clothing", schema: BabyClothingSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "size", label: "Size", kind: "text", maxLength: 40 },
    { key: "gender", label: "Gender", kind: "text", maxLength: 40, placeholder: "e.g. unisex, boys, girls" },
  ]},
  { departmentId: "baby_nursery_parenting", categoryId: "feeding", label: "Feeding", schema: FeedingSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. bottle, bib, high chair" },
    ...baseFields,
    { key: "capacity_ml", label: "Capacity (ml)", kind: "number", min: 0 },
    { key: "bpa_free", label: "BPA free", kind: "boolean" },
  ]},
  { departmentId: "baby_nursery_parenting", categoryId: "nappies_hygiene", label: "Nappies & Hygiene", schema: NappiesHygieneSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "size", label: "Size", kind: "text", maxLength: 40 },
    { key: "pack_count", label: "Pack count", kind: "number", min: 1 },
  ]},
  { departmentId: "baby_nursery_parenting", categoryId: "nursery_furniture", label: "Nursery Furniture", schema: NurseryFurnitureSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. cot, changing table, rocker" },
    ...baseFields,
    { key: "dimensions", label: "Dimensions", kind: "text", maxLength: 80 },
    { key: "weight_capacity_kg", label: "Weight capacity (kg)", kind: "number", min: 0 },
  ]},
  { departmentId: "baby_nursery_parenting", categoryId: "travel_safety", label: "Travel & Safety", schema: TravelSafetySpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. car seat, stroller, carrier" },
    ...baseFields,
    { key: "group", label: "Group", kind: "text", maxLength: 40, placeholder: "e.g. 0+, 1, 2/3 (car seats)" },
    { key: "weight_capacity_kg", label: "Weight capacity (kg)", kind: "number", min: 0 },
  ]},
  { departmentId: "baby_nursery_parenting", categoryId: "baby_toys", label: "Baby Toys", schema: BabyToysSpec, fields: [
    { key: "toy_type", label: "Toy type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "battery_required", label: "Battery required", kind: "boolean" },
  ]},
  { departmentId: "baby_nursery_parenting", categoryId: "parenting_accessories", label: "Parenting Accessories", schema: ParentingAccessoriesSpec, fields: [
    { key: "accessory_type", label: "Accessory type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
];
