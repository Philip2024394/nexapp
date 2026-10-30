// src/lib/nex-native/catalogue/specs/tools-diy-construction.ts
//
// Tools, DIY & Construction · Batch D department · Phase 1 Product
// System continuous rollout per §I.5 + §K.2 (owner-sealed 2026-10-30).
// 17 sub-categories (largest department).

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  brand: z.string().max(80).optional(),
  model: z.string().max(80).optional(),
  condition: z.enum(["new", "like_new", "good", "fair"]).default("new"),
  warranty_months: z.number().int().nonnegative().optional(),
  weight_kg: z.number().positive().optional(),
});

export const HandToolsSpec = commonBase.extend({
  tool_type: z.string().min(1).max(60),
  material: z.string().max(60).optional(),
});

export const PowerToolsSpec = commonBase.extend({
  tool_type: z.string().min(1).max(60),
  power_source: z.string().max(40).optional(),
  voltage: z.string().max(40).optional(),
  wattage: z.number().positive().optional(),
});

export const ToolStorageSpec = commonBase.extend({
  storage_type: z.string().min(1).max(60),
  dimensions: z.string().max(80).optional(),
  lockable: z.boolean().optional(),
});

export const FixingsFastenersSpec = commonBase.extend({
  fastener_type: z.string().min(1).max(60),
  size: z.string().max(40).optional(),
  pack_count: z.number().int().positive().optional(),
});

export const BuildingMaterialsSpec = commonBase.extend({
  material_type: z.string().min(1).max(60),
  grade: z.string().max(40).optional(),
  dimensions: z.string().max(80).optional(),
  quantity_unit: z.string().max(40).optional(),
});

export const DoorsWindowsSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  material: z.string().max(60).optional(),
  dimensions: z.string().max(80).optional(),
  glazing: z.string().max(60).optional(),
});

export const FlooringSpec = commonBase.extend({
  flooring_type: z.string().min(1).max(60),
  coverage_sqm: z.number().positive().optional(),
  thickness_mm: z.number().positive().optional(),
});

export const PaintDecoratingSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  colour: z.string().max(60).optional(),
  finish: z.string().max(40).optional(),
  volume_litres: z.number().positive().optional(),
  coverage_sqm: z.number().positive().optional(),
});

export const PlumbingSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  pipe_size: z.string().max(40).optional(),
  pressure_rating: z.string().max(40).optional(),
});

export const ElectricalSuppliesSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  voltage: z.string().max(40).optional(),
  certification: z.string().max(80).optional(),
});

export const HeatingVentilationSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  capacity: z.string().max(60).optional(),
  energy_rating: z.string().max(10).optional(),
});

export const RoofingGutteringSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  material: z.string().max(60).optional(),
  length_m: z.number().positive().optional(),
});

export const SafetyWorkwearSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  size: z.string().max(40).optional(),
  certification: z.string().max(80).optional(),
});

export const AccessEquipmentSpec = commonBase.extend({
  equipment_type: z.string().min(1).max(60),
  max_height_m: z.number().positive().optional(),
  load_rating_kg: z.number().positive().optional(),
});

export const BuildingFinishesSpec = commonBase.extend({
  finish_type: z.string().min(1).max(60),
  coverage_sqm: z.number().positive().optional(),
});

export const WorkshopEquipmentSpec = commonBase.extend({
  equipment_type: z.string().min(1).max(60),
  power_source: z.string().max(40).optional(),
});

export const TradeConsumablesSpec = commonBase.extend({
  consumable_type: z.string().min(1).max(60),
  pack_size: z.string().max(40).optional(),
});

const conditionField: SpecFieldConfig = {
  key: "condition", label: "Condition", kind: "select", required: true,
  options: [
    { value: "new", label: "New" },
    { value: "like_new", label: "Like new" },
    { value: "good", label: "Good" },
    { value: "fair", label: "Fair" },
  ],
};
const baseFields: readonly SpecFieldConfig[] = [
  conditionField,
  { key: "brand", label: "Brand", kind: "text", maxLength: 80 },
  { key: "model", label: "Model", kind: "text", maxLength: 80 },
  { key: "warranty_months", label: "Warranty (months)", kind: "number", min: 0 },
  { key: "weight_kg", label: "Weight (kg)", kind: "number", min: 0 },
];

export const ToolsDiyConstructionSpecs: readonly CategorySpec[] = [
  { departmentId: "tools_diy_construction", categoryId: "hand_tools", label: "Hand Tools", schema: HandToolsSpec, fields: [
    { key: "tool_type", label: "Tool type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "material", label: "Material", kind: "text", maxLength: 60 },
  ]},
  { departmentId: "tools_diy_construction", categoryId: "power_tools", label: "Power Tools", schema: PowerToolsSpec, fields: [
    { key: "tool_type", label: "Tool type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "power_source", label: "Power source", kind: "text", maxLength: 40, placeholder: "e.g. corded, cordless, petrol" },
    { key: "voltage", label: "Voltage", kind: "text", maxLength: 40 },
    { key: "wattage", label: "Wattage (W)", kind: "number", min: 0 },
  ]},
  { departmentId: "tools_diy_construction", categoryId: "tool_storage", label: "Tool Storage", schema: ToolStorageSpec, fields: [
    { key: "storage_type", label: "Storage type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "dimensions", label: "Dimensions", kind: "text", maxLength: 80 },
    { key: "lockable", label: "Lockable", kind: "boolean" },
  ]},
  { departmentId: "tools_diy_construction", categoryId: "fixings_fasteners", label: "Fixings & Fasteners", schema: FixingsFastenersSpec, fields: [
    { key: "fastener_type", label: "Fastener type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "size", label: "Size", kind: "text", maxLength: 40 },
    { key: "pack_count", label: "Pack count", kind: "number", min: 1 },
  ]},
  { departmentId: "tools_diy_construction", categoryId: "building_materials", label: "Building Materials", schema: BuildingMaterialsSpec, fields: [
    { key: "material_type", label: "Material type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "grade", label: "Grade", kind: "text", maxLength: 40 },
    { key: "dimensions", label: "Dimensions", kind: "text", maxLength: 80 },
    { key: "quantity_unit", label: "Quantity unit", kind: "text", maxLength: 40, placeholder: "e.g. per bag, per m²" },
  ]},
  { departmentId: "tools_diy_construction", categoryId: "doors_windows", label: "Doors, Windows & Joinery", schema: DoorsWindowsSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "material", label: "Material", kind: "text", maxLength: 60 },
    { key: "dimensions", label: "Dimensions", kind: "text", maxLength: 80 },
    { key: "glazing", label: "Glazing", kind: "text", maxLength: 60 },
  ]},
  { departmentId: "tools_diy_construction", categoryId: "flooring", label: "Flooring", schema: FlooringSpec, fields: [
    { key: "flooring_type", label: "Flooring type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "coverage_sqm", label: "Coverage (m²)", kind: "number", min: 0 },
    { key: "thickness_mm", label: "Thickness (mm)", kind: "number", min: 0 },
  ]},
  { departmentId: "tools_diy_construction", categoryId: "paint_decorating", label: "Paint & Decorating", schema: PaintDecoratingSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "colour", label: "Colour", kind: "text", maxLength: 60 },
    { key: "finish", label: "Finish", kind: "text", maxLength: 40 },
    { key: "volume_litres", label: "Volume (L)", kind: "number", min: 0 },
    { key: "coverage_sqm", label: "Coverage (m²)", kind: "number", min: 0 },
  ]},
  { departmentId: "tools_diy_construction", categoryId: "plumbing", label: "Plumbing", schema: PlumbingSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "pipe_size", label: "Pipe size", kind: "text", maxLength: 40 },
    { key: "pressure_rating", label: "Pressure rating", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "tools_diy_construction", categoryId: "electrical_supplies", label: "Electrical Supplies", schema: ElectricalSuppliesSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "voltage", label: "Voltage", kind: "text", maxLength: 40 },
    { key: "certification", label: "Certification", kind: "text", maxLength: 80 },
  ]},
  { departmentId: "tools_diy_construction", categoryId: "heating_ventilation", label: "Heating & Ventilation", schema: HeatingVentilationSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "capacity", label: "Capacity", kind: "text", maxLength: 60 },
    { key: "energy_rating", label: "Energy rating", kind: "text", maxLength: 10 },
  ]},
  { departmentId: "tools_diy_construction", categoryId: "roofing_guttering", label: "Roofing & Guttering", schema: RoofingGutteringSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "material", label: "Material", kind: "text", maxLength: 60 },
    { key: "length_m", label: "Length (m)", kind: "number", min: 0 },
  ]},
  { departmentId: "tools_diy_construction", categoryId: "safety_workwear", label: "Safety & Workwear", schema: SafetyWorkwearSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "size", label: "Size", kind: "text", maxLength: 40 },
    { key: "certification", label: "Certification", kind: "text", maxLength: 80 },
  ]},
  { departmentId: "tools_diy_construction", categoryId: "access_equipment", label: "Access Equipment", schema: AccessEquipmentSpec, fields: [
    { key: "equipment_type", label: "Equipment type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "max_height_m", label: "Max height (m)", kind: "number", min: 0 },
    { key: "load_rating_kg", label: "Load rating (kg)", kind: "number", min: 0 },
  ]},
  { departmentId: "tools_diy_construction", categoryId: "building_finishes", label: "Building Finishes", schema: BuildingFinishesSpec, fields: [
    { key: "finish_type", label: "Finish type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "coverage_sqm", label: "Coverage (m²)", kind: "number", min: 0 },
  ]},
  { departmentId: "tools_diy_construction", categoryId: "workshop_equipment", label: "Workshop Equipment", schema: WorkshopEquipmentSpec, fields: [
    { key: "equipment_type", label: "Equipment type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "power_source", label: "Power source", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "tools_diy_construction", categoryId: "trade_consumables", label: "Trade Consumables", schema: TradeConsumablesSpec, fields: [
    { key: "consumable_type", label: "Consumable type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "pack_size", label: "Pack size", kind: "text", maxLength: 40 },
  ]},
];
