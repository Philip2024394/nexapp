// src/lib/nex-native/catalogue/specs/travel-luggage-outdoor.ts
//
// Travel, Luggage & Outdoor · Batch F · Phase 1 Product System.
// 4 sub-categories.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  brand: z.string().max(80).optional(),
  colour: z.string().max(60).optional(),
  material: z.string().max(80).optional(),
  weight_kg: z.number().positive().optional(),
  condition: z.enum(["new", "like_new", "good", "fair"]).default("new"),
});

export const TravelAccessoriesSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
});

export const TravelEssentialsSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  cabin_approved: z.boolean().optional(),
});

export const OutdoorTravelSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  capacity_litres: z.number().positive().optional(),
  waterproof: z.boolean().optional(),
});

export const BusinessTravelSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  laptop_compartment: z.boolean().optional(),
  capacity_litres: z.number().positive().optional(),
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
  { key: "colour", label: "Colour", kind: "text", maxLength: 60 },
  { key: "material", label: "Material", kind: "text", maxLength: 80 },
  { key: "weight_kg", label: "Weight (kg)", kind: "number", min: 0 },
];

export const TravelLuggageOutdoorSpecs: readonly CategorySpec[] = [
  { departmentId: "travel_luggage_outdoor", categoryId: "travel_accessories", label: "Travel Accessories", schema: TravelAccessoriesSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. adapter, neck pillow, lock" },
    ...baseFields,
  ]},
  { departmentId: "travel_luggage_outdoor", categoryId: "travel_essentials", label: "Travel Essentials", schema: TravelEssentialsSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. carry-on, suitcase, toiletry bag" },
    ...baseFields,
    { key: "cabin_approved", label: "Cabin approved", kind: "boolean" },
  ]},
  { departmentId: "travel_luggage_outdoor", categoryId: "outdoor_travel", label: "Outdoor Travel", schema: OutdoorTravelSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. backpack, duffel, dry bag" },
    ...baseFields,
    { key: "capacity_litres", label: "Capacity (L)", kind: "number", min: 0 },
    { key: "waterproof", label: "Waterproof", kind: "boolean" },
  ]},
  { departmentId: "travel_luggage_outdoor", categoryId: "business_travel", label: "Business Travel", schema: BusinessTravelSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. briefcase, laptop bag" },
    ...baseFields,
    { key: "laptop_compartment", label: "Laptop compartment", kind: "boolean" },
    { key: "capacity_litres", label: "Capacity (L)", kind: "number", min: 0 },
  ]},
];
