// src/lib/nex-native/catalogue/specs/home-furniture-living.ts
//
// Home, Furniture & Living · Batch A department · Phase 1 Product
// System continuous rollout per §I.5 + §K.2 (owner-sealed 2026-10-30).
// 10 sub-categories.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const condition: SpecFieldConfig = {
  key: "condition", label: "Condition", kind: "select", required: true,
  options: [
    { value: "new", label: "New" },
    { value: "like_new", label: "Like new" },
    { value: "good", label: "Good" },
    { value: "fair", label: "Fair" },
  ],
};

const material: SpecFieldConfig = {
  key: "material", label: "Material", kind: "text", maxLength: 120,
  placeholder: "e.g. solid oak, cotton, bamboo",
};

const colour: SpecFieldConfig = {
  key: "colour", label: "Colour", kind: "text", maxLength: 60,
};

const dimensions: SpecFieldConfig = {
  key: "dimensions", label: "Dimensions (W × D × H cm)", kind: "text",
  maxLength: 80, placeholder: "e.g. 180 × 90 × 75",
};

const commonBase = z.object({
  condition: z.enum(["new", "like_new", "good", "fair"]).default("new"),
  material: z.string().max(120).optional(),
  colour: z.string().max(60).optional(),
  dimensions: z.string().max(80).optional(),
  brand: z.string().max(80).optional(),
});

export const LivingRoomSpec = commonBase.extend({
  item_type: z.string().min(1).max(60),
  seats: z.number().int().positive().optional(),
  assembly_required: z.boolean().optional(),
});

export const BedroomSpec = commonBase.extend({
  item_type: z.string().min(1).max(60),
  bed_size: z.string().max(40).optional(),
  mattress_included: z.boolean().optional(),
  assembly_required: z.boolean().optional(),
});

export const DiningRoomSpec = commonBase.extend({
  item_type: z.string().min(1).max(60),
  seats: z.number().int().positive().optional(),
  extendable: z.boolean().optional(),
});

export const OfficeFurnitureSpec = commonBase.extend({
  item_type: z.string().min(1).max(60),
  ergonomic: z.boolean().optional(),
  adjustable_height: z.boolean().optional(),
});

export const HomeDecorSpec = commonBase.extend({
  decor_type: z.string().min(1).max(60),
  style: z.string().max(60).optional(),
});

export const LightingSpec = commonBase.extend({
  lighting_type: z.string().min(1).max(60),
  bulb_type: z.string().max(40).optional(),
  wattage: z.number().positive().optional(),
  smart_control: z.boolean().optional(),
});

export const BeddingTextilesSpec = commonBase.extend({
  textile_type: z.string().min(1).max(60),
  size: z.string().max(40).optional(),
  thread_count: z.number().int().positive().optional(),
});

export const StorageOrganisationSpec = commonBase.extend({
  storage_type: z.string().min(1).max(60),
  capacity_litres: z.number().positive().optional(),
});

export const CleaningHouseholdSpec = commonBase.extend({
  item_type: z.string().min(1).max(60),
  eco_friendly: z.boolean().optional(),
  pack_size: z.string().max(40).optional(),
});

export const HomeSafetySpec = commonBase.extend({
  safety_type: z.string().min(1).max(60),
  certification: z.string().max(80).optional(),
  power_source: z.string().max(40).optional(),
});

const baseFields: readonly SpecFieldConfig[] = [
  condition,
  { key: "brand", label: "Brand", kind: "text", maxLength: 80 },
  material, colour, dimensions,
];

export const HomeFurnitureLivingSpecs: readonly CategorySpec[] = [
  { departmentId: "home_furniture_living", categoryId: "living_room", label: "Living Room Furniture", schema: LivingRoomSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. sofa, armchair, coffee table" },
    ...baseFields,
    { key: "seats", label: "Number of seats", kind: "number", min: 1 },
    { key: "assembly_required", label: "Assembly required", kind: "boolean" },
  ]},
  { departmentId: "home_furniture_living", categoryId: "bedroom", label: "Bedroom Furniture", schema: BedroomSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. bed, wardrobe, bedside table" },
    ...baseFields,
    { key: "bed_size", label: "Bed size", kind: "text", maxLength: 40, placeholder: "e.g. single, double, king" },
    { key: "mattress_included", label: "Mattress included", kind: "boolean" },
    { key: "assembly_required", label: "Assembly required", kind: "boolean" },
  ]},
  { departmentId: "home_furniture_living", categoryId: "dining_room", label: "Dining Room", schema: DiningRoomSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "seats", label: "Seats", kind: "number", min: 1 },
    { key: "extendable", label: "Extendable", kind: "boolean" },
  ]},
  { departmentId: "home_furniture_living", categoryId: "office_furniture", label: "Office Furniture", schema: OfficeFurnitureSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "ergonomic", label: "Ergonomic", kind: "boolean" },
    { key: "adjustable_height", label: "Adjustable height", kind: "boolean" },
  ]},
  { departmentId: "home_furniture_living", categoryId: "home_decor", label: "Home Decor", schema: HomeDecorSpec, fields: [
    { key: "decor_type", label: "Decor type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. mirror, vase, wall art" },
    ...baseFields,
    { key: "style", label: "Style", kind: "text", maxLength: 60, placeholder: "e.g. modern, boho, minimalist" },
  ]},
  { departmentId: "home_furniture_living", categoryId: "lighting", label: "Lighting", schema: LightingSpec, fields: [
    { key: "lighting_type", label: "Lighting type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. floor lamp, pendant, ceiling" },
    ...baseFields,
    { key: "bulb_type", label: "Bulb type", kind: "text", maxLength: 40, placeholder: "e.g. LED, E27, GU10" },
    { key: "wattage", label: "Wattage (W)", kind: "number", min: 0 },
    { key: "smart_control", label: "Smart control", kind: "boolean" },
  ]},
  { departmentId: "home_furniture_living", categoryId: "bedding_textiles", label: "Bedding & Textiles", schema: BeddingTextilesSpec, fields: [
    { key: "textile_type", label: "Textile type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. duvet, towel, cushion" },
    ...baseFields,
    { key: "size", label: "Size", kind: "text", maxLength: 40 },
    { key: "thread_count", label: "Thread count", kind: "number", min: 0 },
  ]},
  { departmentId: "home_furniture_living", categoryId: "storage_organisation", label: "Storage & Organisation", schema: StorageOrganisationSpec, fields: [
    { key: "storage_type", label: "Storage type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "capacity_litres", label: "Capacity (litres)", kind: "number", min: 0 },
  ]},
  { departmentId: "home_furniture_living", categoryId: "cleaning_household", label: "Cleaning & Household", schema: CleaningHouseholdSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "eco_friendly", label: "Eco-friendly", kind: "boolean" },
    { key: "pack_size", label: "Pack size", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "home_furniture_living", categoryId: "home_safety", label: "Home Safety", schema: HomeSafetySpec, fields: [
    { key: "safety_type", label: "Safety type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. smoke alarm, lock, CCTV" },
    ...baseFields,
    { key: "certification", label: "Certification", kind: "text", maxLength: 80 },
    { key: "power_source", label: "Power source", kind: "text", maxLength: 40 },
  ]},
];
