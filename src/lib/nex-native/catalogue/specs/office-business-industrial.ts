// src/lib/nex-native/catalogue/specs/office-business-industrial.ts
//
// Office, Business & Industrial · Batch E · Phase 1 Product System.
// 10 sub-categories.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  brand: z.string().max(80).optional(),
  model: z.string().max(80).optional(),
  condition: z.enum(["new", "like_new", "good", "fair"]).default("new"),
  warranty_months: z.number().int().nonnegative().optional(),
  dimensions: z.string().max(80).optional(),
  weight_kg: z.number().positive().optional(),
});

const makeSpec = (extra: Record<string, z.ZodTypeAny> = {}) => commonBase.extend(extra);

export const OfficeEquipmentSpec = makeSpec({ product_type: z.string().min(1).max(60), capacity: z.string().max(60).optional() });
export const BusinessFurnitureSpec = makeSpec({ item_type: z.string().min(1).max(60), seats: z.number().int().positive().optional() });
export const PackagingShippingSpec = makeSpec({ product_type: z.string().min(1).max(60), pack_count: z.number().int().positive().optional(), size: z.string().max(40).optional() });
export const WarehouseEquipmentSpec = makeSpec({ equipment_type: z.string().min(1).max(60), load_capacity_kg: z.number().positive().optional() });
export const IndustrialToolsSpec = makeSpec({ tool_type: z.string().min(1).max(60), power_source: z.string().max(40).optional() });
export const IndustrialSafetySpec = makeSpec({ product_type: z.string().min(1).max(60), certification: z.string().max(80).optional(), size: z.string().max(40).optional() });
export const MaterialHandlingSpec = makeSpec({ product_type: z.string().min(1).max(60), load_capacity_kg: z.number().positive().optional() });
export const CommercialCleaningSpec = makeSpec({ product_type: z.string().min(1).max(60), volume_litres: z.number().positive().optional() });
export const HospitalityCateringSpec = makeSpec({ product_type: z.string().min(1).max(60), capacity: z.string().max(60).optional() });
export const BusinessTechnologySpec = makeSpec({ product_type: z.string().min(1).max(60), bundled_services: z.string().max(200).optional() });

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
  { key: "dimensions", label: "Dimensions", kind: "text", maxLength: 80 },
  { key: "weight_kg", label: "Weight (kg)", kind: "number", min: 0 },
];

export const OfficeBusinessIndustrialSpecs: readonly CategorySpec[] = [
  { departmentId: "office_business_industrial", categoryId: "office_equipment", label: "Office Equipment", schema: OfficeEquipmentSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. shredder, printer, scanner" },
    ...baseFields,
    { key: "capacity", label: "Capacity", kind: "text", maxLength: 60 },
  ]},
  { departmentId: "office_business_industrial", categoryId: "business_furniture", label: "Business Furniture", schema: BusinessFurnitureSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "seats", label: "Seats", kind: "number", min: 1 },
  ]},
  { departmentId: "office_business_industrial", categoryId: "packaging_shipping", label: "Packaging & Shipping", schema: PackagingShippingSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "pack_count", label: "Pack count", kind: "number", min: 1 },
    { key: "size", label: "Size", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "office_business_industrial", categoryId: "warehouse_equipment", label: "Warehouse Equipment", schema: WarehouseEquipmentSpec, fields: [
    { key: "equipment_type", label: "Equipment type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "load_capacity_kg", label: "Load capacity (kg)", kind: "number", min: 0 },
  ]},
  { departmentId: "office_business_industrial", categoryId: "industrial_tools", label: "Industrial Tools", schema: IndustrialToolsSpec, fields: [
    { key: "tool_type", label: "Tool type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "power_source", label: "Power source", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "office_business_industrial", categoryId: "industrial_safety", label: "Industrial Safety", schema: IndustrialSafetySpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "certification", label: "Certification", kind: "text", maxLength: 80 },
    { key: "size", label: "Size", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "office_business_industrial", categoryId: "material_handling", label: "Material Handling", schema: MaterialHandlingSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "load_capacity_kg", label: "Load capacity (kg)", kind: "number", min: 0 },
  ]},
  { departmentId: "office_business_industrial", categoryId: "commercial_cleaning", label: "Commercial Cleaning", schema: CommercialCleaningSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "volume_litres", label: "Volume (L)", kind: "number", min: 0 },
  ]},
  { departmentId: "office_business_industrial", categoryId: "hospitality_catering", label: "Hospitality & Catering Supplies", schema: HospitalityCateringSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "capacity", label: "Capacity", kind: "text", maxLength: 60 },
  ]},
  { departmentId: "office_business_industrial", categoryId: "business_technology", label: "Business Technology", schema: BusinessTechnologySpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "bundled_services", label: "Bundled services", kind: "text", maxLength: 200 },
  ]},
];
