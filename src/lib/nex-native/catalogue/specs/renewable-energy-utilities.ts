// src/lib/nex-native/catalogue/specs/renewable-energy-utilities.ts
//
// Renewable Energy & Utilities · Batch J · Phase 1 Product System.
// 5 sub-categories.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  brand: z.string().max(80).optional(),
  model: z.string().max(80).optional(),
  condition: z.enum(["new", "like_new", "good", "fair"]).default("new"),
  certification: z.string().max(80).optional(),
  warranty_months: z.number().int().nonnegative().optional(),
  installation_included: z.boolean().optional(),
});

export const SolarEnergySpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  rated_power_watts: z.number().positive().optional(),
  efficiency_percent: z.number().min(0).max(100).optional(),
  dimensions: z.string().max(80).optional(),
});

export const PowerBackupSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  capacity_kwh: z.number().positive().optional(),
  output_watts: z.number().positive().optional(),
  battery_chemistry: z.string().max(40).optional(),
});

export const EnergyEfficiencySpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  rating: z.string().max(10).optional(),
  savings_claim: z.string().max(200).optional(),
});

export const WaterSystemsSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  flow_rate: z.string().max(40).optional(),
  filtration_stages: z.number().int().positive().optional(),
});

export const RenewableAccessoriesSpec = commonBase.extend({
  accessory_type: z.string().min(1).max(60),
  compatibility: z.string().max(200).optional(),
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
  { key: "certification", label: "Certification", kind: "text", maxLength: 80 },
  { key: "warranty_months", label: "Warranty (months)", kind: "number", min: 0 },
  { key: "installation_included", label: "Installation included", kind: "boolean" },
];

export const RenewableEnergyUtilitiesSpecs: readonly CategorySpec[] = [
  { departmentId: "renewable_energy_utilities", categoryId: "solar_energy", label: "Solar Energy", schema: SolarEnergySpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. panel, inverter, kit" },
    ...baseFields,
    { key: "rated_power_watts", label: "Rated power (W)", kind: "number", min: 0 },
    { key: "efficiency_percent", label: "Efficiency (%)", kind: "number", min: 0, max: 100 },
    { key: "dimensions", label: "Dimensions", kind: "text", maxLength: 80 },
  ]},
  { departmentId: "renewable_energy_utilities", categoryId: "power_backup", label: "Power Backup", schema: PowerBackupSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. battery, UPS, generator" },
    ...baseFields,
    { key: "capacity_kwh", label: "Capacity (kWh)", kind: "number", min: 0 },
    { key: "output_watts", label: "Output (W)", kind: "number", min: 0 },
    { key: "battery_chemistry", label: "Battery chemistry", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "renewable_energy_utilities", categoryId: "energy_efficiency", label: "Energy Efficiency", schema: EnergyEfficiencySpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "rating", label: "Energy rating", kind: "text", maxLength: 10 },
    { key: "savings_claim", label: "Savings claim", kind: "textarea", maxLength: 200 },
  ]},
  { departmentId: "renewable_energy_utilities", categoryId: "water_systems", label: "Water Systems", schema: WaterSystemsSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "flow_rate", label: "Flow rate", kind: "text", maxLength: 40 },
    { key: "filtration_stages", label: "Filtration stages", kind: "number", min: 1 },
  ]},
  { departmentId: "renewable_energy_utilities", categoryId: "renewable_accessories", label: "Renewable Energy Accessories", schema: RenewableAccessoriesSpec, fields: [
    { key: "accessory_type", label: "Accessory type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "compatibility", label: "Compatibility", kind: "text", maxLength: 200 },
  ]},
];
