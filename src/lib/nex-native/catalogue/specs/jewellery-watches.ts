// src/lib/nex-native/catalogue/specs/jewellery-watches.ts
//
// Jewellery & Watches · Batch I · Phase 1 Product System rollout.
// 5 sub-categories.
//
// NOTE · The Watches reconciliation (migrations 227-232) is a separate
// Phase 4 task per the sealed Implementation Contract (§C.3). The spec
// here is additive: it describes the generic jewellery/watches product
// shape so new listings validate correctly. It does NOT migrate the
// pre-existing watches domain tables — those remain untouched pending
// explicit Phase 4 authorisation. Dept was already enabled=true in
// departments.ts; this commit only registers the specs.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  brand: z.string().max(80).optional(),
  material: z.string().max(80).optional(),
  stone: z.string().max(60).optional(),
  carat: z.number().positive().optional(),
  size: z.string().max(40).optional(),
  gender: z.string().max(40).optional(),
  certification: z.string().max(80).optional(),
  condition: z.enum(["new", "pre_owned", "vintage", "antique"]).default("new"),
});

export const FineJewellerySpec = commonBase.extend({
  item_type: z.string().min(1).max(60),
  hallmark: z.string().max(60).optional(),
  weight_grams: z.number().positive().optional(),
});

export const FashionJewellerySpec = commonBase.extend({
  item_type: z.string().min(1).max(60),
  style: z.string().max(60).optional(),
});

export const WatchesSpec = commonBase.extend({
  watch_type: z.string().min(1).max(60),
  movement: z.string().max(40).optional(),
  water_resistance_m: z.number().int().nonnegative().optional(),
  case_diameter_mm: z.number().positive().optional(),
  strap_material: z.string().max(60).optional(),
  reference_number: z.string().max(60).optional(),
});

export const JewelleryAccessoriesSpec = commonBase.extend({
  accessory_type: z.string().min(1).max(60),
});

export const CollectibleWatchesSpec = commonBase.extend({
  reference_number: z.string().min(1).max(60),
  year: z.number().int().positive().optional(),
  movement: z.string().max(40).optional(),
  box_papers: z.boolean().optional(),
  provenance: z.string().max(400).optional(),
});

const conditionField: SpecFieldConfig = {
  key: "condition", label: "Condition", kind: "select", required: true,
  options: [
    { value: "new", label: "New" },
    { value: "pre_owned", label: "Pre-owned" },
    { value: "vintage", label: "Vintage" },
    { value: "antique", label: "Antique" },
  ],
};
const baseFields: readonly SpecFieldConfig[] = [
  conditionField,
  { key: "brand", label: "Brand", kind: "text", maxLength: 80 },
  { key: "material", label: "Material", kind: "text", maxLength: 80, placeholder: "e.g. 18k gold, platinum, silver" },
  { key: "stone", label: "Stone", kind: "text", maxLength: 60 },
  { key: "carat", label: "Carat / purity", kind: "number", min: 0 },
  { key: "size", label: "Size", kind: "text", maxLength: 40 },
  { key: "gender", label: "Gender", kind: "text", maxLength: 40 },
  { key: "certification", label: "Certification", kind: "text", maxLength: 80 },
];

export const JewelleryWatchesSpecs: readonly CategorySpec[] = [
  { departmentId: "jewellery_watches", categoryId: "fine_jewellery", label: "Fine Jewellery", schema: FineJewellerySpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "hallmark", label: "Hallmark", kind: "text", maxLength: 60 },
    { key: "weight_grams", label: "Weight (g)", kind: "number", min: 0 },
  ]},
  { departmentId: "jewellery_watches", categoryId: "fashion_jewellery", label: "Fashion Jewellery", schema: FashionJewellerySpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "style", label: "Style", kind: "text", maxLength: 60 },
  ]},
  { departmentId: "jewellery_watches", categoryId: "watches", label: "Watches", schema: WatchesSpec, fields: [
    { key: "watch_type", label: "Watch type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "movement", label: "Movement", kind: "text", maxLength: 40, placeholder: "e.g. automatic, quartz, manual" },
    { key: "water_resistance_m", label: "Water resistance (m)", kind: "number", min: 0 },
    { key: "case_diameter_mm", label: "Case diameter (mm)", kind: "number", min: 0 },
    { key: "strap_material", label: "Strap material", kind: "text", maxLength: 60 },
    { key: "reference_number", label: "Reference number", kind: "text", maxLength: 60 },
  ]},
  { departmentId: "jewellery_watches", categoryId: "jewellery_accessories", label: "Jewellery Accessories", schema: JewelleryAccessoriesSpec, fields: [
    { key: "accessory_type", label: "Accessory type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
  { departmentId: "jewellery_watches", categoryId: "collectible_watches", label: "Collectible Watches", schema: CollectibleWatchesSpec, fields: [
    { key: "reference_number", label: "Reference number", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "year", label: "Year", kind: "number", min: 1800 },
    { key: "movement", label: "Movement", kind: "text", maxLength: 40 },
    { key: "box_papers", label: "Box & papers", kind: "boolean" },
    { key: "provenance", label: "Provenance", kind: "textarea", maxLength: 400 },
  ]},
];
