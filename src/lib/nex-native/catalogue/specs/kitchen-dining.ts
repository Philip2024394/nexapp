// src/lib/nex-native/catalogue/specs/kitchen-dining.ts
//
// Kitchen & Dining · Batch A department · Phase 1 Product System
// continuous rollout per §I.5 + §K.2 (owner-sealed 2026-10-30).
// 8 sub-categories.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const condition: SpecFieldConfig = {
  key: "condition", label: "Condition", kind: "select", required: true,
  options: [
    { value: "new", label: "New" },
    { value: "like_new", label: "Like new" },
    { value: "good", label: "Good" },
  ],
};

const material: SpecFieldConfig = {
  key: "material", label: "Material", kind: "text", maxLength: 80,
  placeholder: "e.g. stainless steel, cast iron, ceramic",
};

const commonBase = z.object({
  condition: z.enum(["new", "like_new", "good"]).default("new"),
  brand: z.string().max(80).optional(),
  material: z.string().max(80).optional(),
  colour: z.string().max(60).optional(),
});

export const CookwareSpec = commonBase.extend({
  item_type: z.string().min(1).max(60),
  size_cm: z.number().positive().optional(),
  induction_compatible: z.boolean().optional(),
  non_stick: z.boolean().optional(),
});

export const KitchenUtensilsSpec = commonBase.extend({
  utensil_type: z.string().min(1).max(60),
  dishwasher_safe: z.boolean().optional(),
});

export const TablewareSpec = commonBase.extend({
  item_type: z.string().min(1).max(60),
  pieces: z.number().int().positive().optional(),
  dishwasher_safe: z.boolean().optional(),
  microwave_safe: z.boolean().optional(),
});

export const KitchenStorageSpec = commonBase.extend({
  storage_type: z.string().min(1).max(60),
  capacity_litres: z.number().positive().optional(),
  airtight: z.boolean().optional(),
});

export const KitchenAppliancesSpec = commonBase.extend({
  appliance_type: z.string().min(1).max(60),
  wattage: z.number().positive().optional(),
  capacity: z.string().max(40).optional(),
  warranty_months: z.number().int().nonnegative().optional(),
});

export const RefrigerationSpec = commonBase.extend({
  appliance_type: z.string().min(1).max(60),
  capacity_litres: z.number().positive().optional(),
  energy_rating: z.string().max(10).optional(),
  warranty_months: z.number().int().nonnegative().optional(),
});

export const LaundryAppliancesSpec = commonBase.extend({
  appliance_type: z.string().min(1).max(60),
  capacity_kg: z.number().positive().optional(),
  spin_speed_rpm: z.number().int().positive().optional(),
  energy_rating: z.string().max(10).optional(),
  warranty_months: z.number().int().nonnegative().optional(),
});

export const WaterBeverageSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  capacity_litres: z.number().positive().optional(),
  filtration: z.boolean().optional(),
});

const baseFields: readonly SpecFieldConfig[] = [
  condition,
  { key: "brand", label: "Brand", kind: "text", maxLength: 80 },
  material,
  { key: "colour", label: "Colour", kind: "text", maxLength: 60 },
];

export const KitchenDiningSpecs: readonly CategorySpec[] = [
  { departmentId: "kitchen_dining", categoryId: "cookware", label: "Cookware", schema: CookwareSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. frying pan, saucepan, wok" },
    ...baseFields,
    { key: "size_cm", label: "Size (cm)", kind: "number", min: 0 },
    { key: "induction_compatible", label: "Induction compatible", kind: "boolean" },
    { key: "non_stick", label: "Non-stick", kind: "boolean" },
  ]},
  { departmentId: "kitchen_dining", categoryId: "kitchen_utensils", label: "Kitchen Utensils", schema: KitchenUtensilsSpec, fields: [
    { key: "utensil_type", label: "Utensil type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "dishwasher_safe", label: "Dishwasher safe", kind: "boolean" },
  ]},
  { departmentId: "kitchen_dining", categoryId: "tableware", label: "Tableware", schema: TablewareSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. plates, glasses, cutlery" },
    ...baseFields,
    { key: "pieces", label: "Pieces in set", kind: "number", min: 1 },
    { key: "dishwasher_safe", label: "Dishwasher safe", kind: "boolean" },
    { key: "microwave_safe", label: "Microwave safe", kind: "boolean" },
  ]},
  { departmentId: "kitchen_dining", categoryId: "kitchen_storage", label: "Kitchen Storage", schema: KitchenStorageSpec, fields: [
    { key: "storage_type", label: "Storage type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "capacity_litres", label: "Capacity (litres)", kind: "number", min: 0 },
    { key: "airtight", label: "Airtight", kind: "boolean" },
  ]},
  { departmentId: "kitchen_dining", categoryId: "kitchen_appliances", label: "Kitchen Appliances", schema: KitchenAppliancesSpec, fields: [
    { key: "appliance_type", label: "Appliance type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. blender, air fryer, kettle" },
    ...baseFields,
    { key: "wattage", label: "Wattage (W)", kind: "number", min: 0 },
    { key: "capacity", label: "Capacity", kind: "text", maxLength: 40 },
    { key: "warranty_months", label: "Warranty (months)", kind: "number", min: 0 },
  ]},
  { departmentId: "kitchen_dining", categoryId: "refrigeration", label: "Refrigeration", schema: RefrigerationSpec, fields: [
    { key: "appliance_type", label: "Appliance type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. fridge, freezer, wine cooler" },
    ...baseFields,
    { key: "capacity_litres", label: "Capacity (litres)", kind: "number", min: 0 },
    { key: "energy_rating", label: "Energy rating", kind: "text", maxLength: 10, placeholder: "e.g. A+++, B" },
    { key: "warranty_months", label: "Warranty (months)", kind: "number", min: 0 },
  ]},
  { departmentId: "kitchen_dining", categoryId: "laundry_appliances", label: "Laundry Appliances", schema: LaundryAppliancesSpec, fields: [
    { key: "appliance_type", label: "Appliance type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. washer, dryer, iron" },
    ...baseFields,
    { key: "capacity_kg", label: "Capacity (kg)", kind: "number", min: 0 },
    { key: "spin_speed_rpm", label: "Spin speed (rpm)", kind: "number", min: 0 },
    { key: "energy_rating", label: "Energy rating", kind: "text", maxLength: 10 },
    { key: "warranty_months", label: "Warranty (months)", kind: "number", min: 0 },
  ]},
  { departmentId: "kitchen_dining", categoryId: "water_beverage", label: "Water & Beverage", schema: WaterBeverageSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. water dispenser, coffee maker" },
    ...baseFields,
    { key: "capacity_litres", label: "Capacity (litres)", kind: "number", min: 0 },
    { key: "filtration", label: "Includes filtration", kind: "boolean" },
  ]},
];
