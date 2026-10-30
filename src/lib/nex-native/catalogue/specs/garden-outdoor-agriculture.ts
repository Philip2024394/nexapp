// src/lib/nex-native/catalogue/specs/garden-outdoor-agriculture.ts
//
// Garden, Outdoor & Agriculture · Batch C department · Phase 1 Product
// System continuous rollout per §I.5 + §K.2 (owner-sealed 2026-10-30).
// 8 sub-categories.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  brand: z.string().max(80).optional(),
  material: z.string().max(80).optional(),
  size: z.string().max(60).optional(),
  weight_kg: z.number().positive().optional(),
  weatherproof: z.boolean().optional(),
});

export const GardeningToolsSpec = commonBase.extend({
  tool_type: z.string().min(1).max(60),
  power_source: z.string().max(40).optional(),
});

export const PlantsSeedsSpec = commonBase.extend({
  item_type: z.string().min(1).max(60),
  species: z.string().max(80).optional(),
  hardiness_zone: z.string().max(40).optional(),
  mature_height_cm: z.number().positive().optional(),
  flowering_season: z.string().max(40).optional(),
});

export const GardenSuppliesSpec = commonBase.extend({
  supply_type: z.string().min(1).max(60),
  pack_size: z.string().max(40).optional(),
});

export const OutdoorFurnitureSpec = commonBase.extend({
  item_type: z.string().min(1).max(60),
  seats: z.number().int().positive().optional(),
  dimensions: z.string().max(80).optional(),
});

export const OutdoorStructuresSpec = commonBase.extend({
  structure_type: z.string().min(1).max(60),
  dimensions: z.string().max(80).optional(),
  assembly_required: z.boolean().optional(),
});

export const GardenMachinerySpec = commonBase.extend({
  machinery_type: z.string().min(1).max(60),
  power_source: z.string().max(40).optional(),
  cutting_width_cm: z.number().positive().optional(),
  warranty_months: z.number().int().nonnegative().optional(),
});

export const AgricultureFarmingSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  intended_use: z.string().max(80).optional(),
});

export const OutdoorLivingSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
});

const baseFields: readonly SpecFieldConfig[] = [
  { key: "brand", label: "Brand", kind: "text", maxLength: 80 },
  { key: "material", label: "Material", kind: "text", maxLength: 80 },
  { key: "size", label: "Size", kind: "text", maxLength: 60 },
  { key: "weight_kg", label: "Weight (kg)", kind: "number", min: 0 },
  { key: "weatherproof", label: "Weatherproof", kind: "boolean" },
];

export const GardenOutdoorAgricultureSpecs: readonly CategorySpec[] = [
  { departmentId: "garden_outdoor_agriculture", categoryId: "gardening_tools", label: "Gardening Tools", schema: GardeningToolsSpec, fields: [
    { key: "tool_type", label: "Tool type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. spade, trowel, pruner" },
    ...baseFields,
    { key: "power_source", label: "Power source", kind: "text", maxLength: 40, placeholder: "e.g. manual, electric, petrol" },
  ]},
  { departmentId: "garden_outdoor_agriculture", categoryId: "plants_seeds", label: "Plants & Seeds", schema: PlantsSeedsSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. seedling, seed packet, bulb" },
    ...baseFields,
    { key: "species", label: "Species / variety", kind: "text", maxLength: 80 },
    { key: "hardiness_zone", label: "Hardiness zone", kind: "text", maxLength: 40 },
    { key: "mature_height_cm", label: "Mature height (cm)", kind: "number", min: 0 },
    { key: "flowering_season", label: "Flowering season", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "garden_outdoor_agriculture", categoryId: "garden_supplies", label: "Garden Supplies", schema: GardenSuppliesSpec, fields: [
    { key: "supply_type", label: "Supply type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. compost, fertiliser, pots" },
    ...baseFields,
    { key: "pack_size", label: "Pack size", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "garden_outdoor_agriculture", categoryId: "outdoor_furniture", label: "Outdoor Furniture", schema: OutdoorFurnitureSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "seats", label: "Seats", kind: "number", min: 1 },
    { key: "dimensions", label: "Dimensions", kind: "text", maxLength: 80 },
  ]},
  { departmentId: "garden_outdoor_agriculture", categoryId: "outdoor_structures", label: "Outdoor Structures", schema: OutdoorStructuresSpec, fields: [
    { key: "structure_type", label: "Structure type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. shed, pergola, greenhouse" },
    ...baseFields,
    { key: "dimensions", label: "Dimensions", kind: "text", maxLength: 80 },
    { key: "assembly_required", label: "Assembly required", kind: "boolean" },
  ]},
  { departmentId: "garden_outdoor_agriculture", categoryId: "garden_machinery", label: "Garden Machinery", schema: GardenMachinerySpec, fields: [
    { key: "machinery_type", label: "Machinery type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. lawn mower, chainsaw" },
    ...baseFields,
    { key: "power_source", label: "Power source", kind: "text", maxLength: 40 },
    { key: "cutting_width_cm", label: "Cutting width (cm)", kind: "number", min: 0 },
    { key: "warranty_months", label: "Warranty (months)", kind: "number", min: 0 },
  ]},
  { departmentId: "garden_outdoor_agriculture", categoryId: "agriculture_farming", label: "Agriculture & Farming", schema: AgricultureFarmingSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "intended_use", label: "Intended use", kind: "text", maxLength: 80 },
  ]},
  { departmentId: "garden_outdoor_agriculture", categoryId: "outdoor_living", label: "Outdoor Living", schema: OutdoorLivingSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. BBQ, firepit, hot tub" },
    ...baseFields,
  ]},
];
