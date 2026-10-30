// src/lib/nex-native/catalogue/specs/automotive-motorcycles-transport.ts
//
// Automotive & Motorcycles · Batch D department · Phase 1 Product
// System continuous rollout per §I.5 + §K.2 (owner-sealed 2026-10-30).
// 10 sub-categories.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  brand: z.string().max(80).optional(),
  model: z.string().max(80).optional(),
  condition: z.enum(["new", "like_new", "good", "fair"]).default("new"),
  compatibility: z.string().max(200).optional(),
  warranty_months: z.number().int().nonnegative().optional(),
});

export const CarPartsSpec = commonBase.extend({
  part_type: z.string().min(1).max(60),
  oem_number: z.string().max(80).optional(),
});

export const CarAccessoriesSpec = commonBase.extend({
  accessory_type: z.string().min(1).max(60),
});

export const TyresWheelsSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  size: z.string().max(40).optional(),
  tread_depth_mm: z.number().positive().optional(),
  load_rating: z.string().max(40).optional(),
  speed_rating: z.string().max(10).optional(),
});

export const CarElectronicsSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  wireless: z.boolean().optional(),
});

export const CarCareSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  volume_litres: z.number().positive().optional(),
});

export const MotorcyclesSpec = commonBase.extend({
  listing_type: z.string().min(1).max(60),
  engine_cc: z.number().int().positive().optional(),
  year: z.number().int().positive().optional(),
  mileage_km: z.number().int().nonnegative().optional(),
  fuel_type: z.string().max(40).optional(),
});

export const AutomotiveToolsSpec = commonBase.extend({
  tool_type: z.string().min(1).max(60),
  power_source: z.string().max(40).optional(),
});

export const ElectricVehiclesSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  range_km: z.number().positive().optional(),
  battery_kwh: z.number().positive().optional(),
  charging_time_hours: z.number().positive().optional(),
});

export const CommercialVehiclesSpec = commonBase.extend({
  vehicle_type: z.string().min(1).max(60),
  year: z.number().int().positive().optional(),
  mileage_km: z.number().int().nonnegative().optional(),
  payload_kg: z.number().positive().optional(),
});

export const VehicleListingsSpec = commonBase.extend({
  vehicle_type: z.string().min(1).max(60),
  year: z.number().int().positive().optional(),
  mileage_km: z.number().int().nonnegative().optional(),
  fuel_type: z.string().max(40).optional(),
  transmission: z.string().max(40).optional(),
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
  { key: "brand", label: "Brand / make", kind: "text", maxLength: 80 },
  { key: "model", label: "Model", kind: "text", maxLength: 80 },
  { key: "compatibility", label: "Compatibility (vehicle fit)", kind: "textarea", maxLength: 200 },
  { key: "warranty_months", label: "Warranty (months)", kind: "number", min: 0 },
];

export const AutomotiveMotorcyclesTransportSpecs: readonly CategorySpec[] = [
  { departmentId: "automotive_motorcycles_transport", categoryId: "car_parts", label: "Car Parts", schema: CarPartsSpec, fields: [
    { key: "part_type", label: "Part type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "oem_number", label: "OEM number", kind: "text", maxLength: 80 },
  ]},
  { departmentId: "automotive_motorcycles_transport", categoryId: "car_accessories", label: "Car Accessories", schema: CarAccessoriesSpec, fields: [
    { key: "accessory_type", label: "Accessory type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
  { departmentId: "automotive_motorcycles_transport", categoryId: "tyres_wheels", label: "Tyres & Wheels", schema: TyresWheelsSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "size", label: "Size", kind: "text", maxLength: 40 },
    { key: "tread_depth_mm", label: "Tread depth (mm)", kind: "number", min: 0 },
    { key: "load_rating", label: "Load rating", kind: "text", maxLength: 40 },
    { key: "speed_rating", label: "Speed rating", kind: "text", maxLength: 10 },
  ]},
  { departmentId: "automotive_motorcycles_transport", categoryId: "car_electronics", label: "Car Electronics", schema: CarElectronicsSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "wireless", label: "Wireless", kind: "boolean" },
  ]},
  { departmentId: "automotive_motorcycles_transport", categoryId: "car_care", label: "Car Care", schema: CarCareSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "volume_litres", label: "Volume (L)", kind: "number", min: 0 },
  ]},
  { departmentId: "automotive_motorcycles_transport", categoryId: "motorcycles", label: "Motorcycles", schema: MotorcyclesSpec, fields: [
    { key: "listing_type", label: "Listing type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. bike, parts, accessory" },
    ...baseFields,
    { key: "engine_cc", label: "Engine (cc)", kind: "number", min: 1 },
    { key: "year", label: "Year", kind: "number", min: 1900 },
    { key: "mileage_km", label: "Mileage (km)", kind: "number", min: 0 },
    { key: "fuel_type", label: "Fuel type", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "automotive_motorcycles_transport", categoryId: "automotive_tools", label: "Automotive Tools", schema: AutomotiveToolsSpec, fields: [
    { key: "tool_type", label: "Tool type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "power_source", label: "Power source", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "automotive_motorcycles_transport", categoryId: "electric_vehicles", label: "Electric Vehicles", schema: ElectricVehiclesSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "range_km", label: "Range (km)", kind: "number", min: 0 },
    { key: "battery_kwh", label: "Battery (kWh)", kind: "number", min: 0 },
    { key: "charging_time_hours", label: "Charging time (hours)", kind: "number", min: 0 },
  ]},
  { departmentId: "automotive_motorcycles_transport", categoryId: "commercial_vehicles", label: "Commercial Vehicles", schema: CommercialVehiclesSpec, fields: [
    { key: "vehicle_type", label: "Vehicle type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. van, truck, pickup" },
    ...baseFields,
    { key: "year", label: "Year", kind: "number", min: 1900 },
    { key: "mileage_km", label: "Mileage (km)", kind: "number", min: 0 },
    { key: "payload_kg", label: "Payload (kg)", kind: "number", min: 0 },
  ]},
  { departmentId: "automotive_motorcycles_transport", categoryId: "vehicle_listings", label: "Vehicle Listings", schema: VehicleListingsSpec, fields: [
    { key: "vehicle_type", label: "Vehicle type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "year", label: "Year", kind: "number", min: 1900 },
    { key: "mileage_km", label: "Mileage (km)", kind: "number", min: 0 },
    { key: "fuel_type", label: "Fuel type", kind: "text", maxLength: 40 },
    { key: "transmission", label: "Transmission", kind: "text", maxLength: 40 },
  ]},
];
