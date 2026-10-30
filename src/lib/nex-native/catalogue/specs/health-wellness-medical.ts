// src/lib/nex-native/catalogue/specs/health-wellness-medical.ts
//
// Health, Wellness & Medical · Batch B department · Phase 1 Product
// System continuous rollout per §I.5 + §K.2 (owner-sealed 2026-10-30).
// 8 sub-categories.
//
// NOTE · product_type text is deliberately open; medical-device claims
// and dosage-sensitive items should be reviewed before marketing copy
// is written. This file DOES NOT itself make any regulatory promise.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  brand: z.string().max(80).optional(),
  manufacturer: z.string().max(80).optional(),
  model: z.string().max(80).optional(),
  certification: z.string().max(80).optional(),
  warranty_months: z.number().int().nonnegative().optional(),
  expiry: z.string().max(40).optional(),
});

export const PersonalWellnessSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
});

export const HealthMonitoringSpec = commonBase.extend({
  device_type: z.string().min(1).max(60),
  power_source: z.string().max(40).optional(),
  wireless: z.boolean().optional(),
});

export const MobilitySpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  weight_capacity_kg: z.number().positive().optional(),
  foldable: z.boolean().optional(),
});

export const FirstAidSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  pack_size: z.string().max(40).optional(),
});

export const MedicalEquipmentSpec = commonBase.extend({
  equipment_type: z.string().min(1).max(60),
  professional_use: z.boolean().optional(),
});

export const HearingVisionSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  prescription_required: z.boolean().optional(),
});

export const HealthConsumablesSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  pack_size: z.string().max(40).optional(),
});

export const VitaminsSupplementsSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  pack_size: z.string().max(40).optional(),
  dosage: z.string().max(60).optional(),
  dietary: z.string().max(60).optional(),
});

const baseFields: readonly SpecFieldConfig[] = [
  { key: "brand", label: "Brand", kind: "text", maxLength: 80 },
  { key: "manufacturer", label: "Manufacturer", kind: "text", maxLength: 80 },
  { key: "model", label: "Model", kind: "text", maxLength: 80 },
  { key: "certification", label: "Certification", kind: "text", maxLength: 80, placeholder: "e.g. CE, FDA (regulatory text only)" },
  { key: "warranty_months", label: "Warranty (months)", kind: "number", min: 0 },
  { key: "expiry", label: "Expiry / batch", kind: "text", maxLength: 40 },
];

export const HealthWellnessMedicalSpecs: readonly CategorySpec[] = [
  { departmentId: "health_wellness_medical", categoryId: "personal_wellness", label: "Personal Wellness", schema: PersonalWellnessSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
  { departmentId: "health_wellness_medical", categoryId: "health_monitoring", label: "Health Monitoring", schema: HealthMonitoringSpec, fields: [
    { key: "device_type", label: "Device type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. BP monitor, oximeter, thermometer" },
    ...baseFields,
    { key: "power_source", label: "Power source", kind: "text", maxLength: 40 },
    { key: "wireless", label: "Wireless", kind: "boolean" },
  ]},
  { departmentId: "health_wellness_medical", categoryId: "mobility", label: "Mobility & Accessibility", schema: MobilitySpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. wheelchair, walker, cane" },
    ...baseFields,
    { key: "weight_capacity_kg", label: "Weight capacity (kg)", kind: "number", min: 0 },
    { key: "foldable", label: "Foldable", kind: "boolean" },
  ]},
  { departmentId: "health_wellness_medical", categoryId: "first_aid", label: "First Aid", schema: FirstAidSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "pack_size", label: "Pack size", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "health_wellness_medical", categoryId: "medical_equipment", label: "Medical Equipment", schema: MedicalEquipmentSpec, fields: [
    { key: "equipment_type", label: "Equipment type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "professional_use", label: "Professional use", kind: "boolean" },
  ]},
  { departmentId: "health_wellness_medical", categoryId: "hearing_vision", label: "Hearing & Vision", schema: HearingVisionSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. hearing aid, reading glasses" },
    ...baseFields,
    { key: "prescription_required", label: "Prescription required", kind: "boolean" },
  ]},
  { departmentId: "health_wellness_medical", categoryId: "health_consumables", label: "Health Consumables", schema: HealthConsumablesSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "pack_size", label: "Pack size", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "health_wellness_medical", categoryId: "vitamins_supplements", label: "Vitamins & Supplements", schema: VitaminsSupplementsSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "pack_size", label: "Pack size", kind: "text", maxLength: 40 },
    { key: "dosage", label: "Dosage", kind: "text", maxLength: 60 },
    { key: "dietary", label: "Dietary", kind: "text", maxLength: 60, placeholder: "e.g. vegan, gluten-free, halal" },
  ]},
];
