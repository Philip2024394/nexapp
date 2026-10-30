// src/lib/nex-native/catalogue/specs/beauty-personal-care.ts
//
// Beauty & Personal Care · Batch B department · Phase 1 Product
// System continuous rollout per §I.5 + §K.2 (owner-sealed 2026-10-30).
// 8 sub-categories.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  brand: z.string().max(80).optional(),
  size: z.string().max(40).optional(),
  skin_type: z.string().max(40).optional(),
  scent: z.string().max(80).optional(),
  cruelty_free: z.boolean().optional(),
  vegan: z.boolean().optional(),
  expiry: z.string().max(40).optional(),
});

export const SkincareSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  key_ingredient: z.string().max(80).optional(),
});

export const MakeupSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  shade: z.string().max(60).optional(),
  finish: z.string().max(40).optional(),
});

export const HaircareSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  hair_type: z.string().max(40).optional(),
});

export const FragrancesSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  concentration: z.string().max(40).optional(),
  volume_ml: z.number().positive().optional(),
});

export const BathBodySpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
});

export const GroomingSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  gender_target: z.string().max(40).optional(),
});

export const OralCareSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  flavour: z.string().max(40).optional(),
});

export const BeautyAccessoriesSpec = commonBase.extend({
  accessory_type: z.string().min(1).max(60),
});

const baseFields: readonly SpecFieldConfig[] = [
  { key: "brand", label: "Brand", kind: "text", maxLength: 80 },
  { key: "size", label: "Size / volume", kind: "text", maxLength: 40 },
  { key: "skin_type", label: "Skin type", kind: "text", maxLength: 40, placeholder: "e.g. dry, oily, combination" },
  { key: "scent", label: "Scent", kind: "text", maxLength: 80 },
  { key: "cruelty_free", label: "Cruelty free", kind: "boolean" },
  { key: "vegan", label: "Vegan", kind: "boolean" },
  { key: "expiry", label: "Expiry / batch", kind: "text", maxLength: 40 },
];

export const BeautyPersonalCareSpecs: readonly CategorySpec[] = [
  { departmentId: "beauty_personal_care", categoryId: "skincare", label: "Skincare", schema: SkincareSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. moisturiser, serum, cleanser" },
    ...baseFields,
    { key: "key_ingredient", label: "Key ingredient", kind: "text", maxLength: 80, placeholder: "e.g. hyaluronic acid, retinol" },
  ]},
  { departmentId: "beauty_personal_care", categoryId: "makeup", label: "Makeup", schema: MakeupSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. lipstick, foundation, mascara" },
    ...baseFields,
    { key: "shade", label: "Shade", kind: "text", maxLength: 60 },
    { key: "finish", label: "Finish", kind: "text", maxLength: 40, placeholder: "e.g. matte, satin, dewy" },
  ]},
  { departmentId: "beauty_personal_care", categoryId: "haircare", label: "Haircare", schema: HaircareSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. shampoo, conditioner, mask" },
    ...baseFields,
    { key: "hair_type", label: "Hair type", kind: "text", maxLength: 40, placeholder: "e.g. curly, fine, coloured" },
  ]},
  { departmentId: "beauty_personal_care", categoryId: "fragrances", label: "Fragrances", schema: FragrancesSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. eau de parfum, body spray" },
    ...baseFields,
    { key: "concentration", label: "Concentration", kind: "text", maxLength: 40, placeholder: "e.g. EDP, EDT" },
    { key: "volume_ml", label: "Volume (ml)", kind: "number", min: 0 },
  ]},
  { departmentId: "beauty_personal_care", categoryId: "bath_body", label: "Bath & Body", schema: BathBodySpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
  { departmentId: "beauty_personal_care", categoryId: "grooming", label: "Grooming", schema: GroomingSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. razor, trimmer, beard oil" },
    ...baseFields,
    { key: "gender_target", label: "Target", kind: "text", maxLength: 40, placeholder: "e.g. unisex, men's, women's" },
  ]},
  { departmentId: "beauty_personal_care", categoryId: "oral_care", label: "Oral Care", schema: OralCareSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. toothpaste, floss, mouthwash" },
    ...baseFields,
    { key: "flavour", label: "Flavour", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "beauty_personal_care", categoryId: "beauty_accessories", label: "Beauty Accessories", schema: BeautyAccessoriesSpec, fields: [
    { key: "accessory_type", label: "Accessory type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. brush, mirror, hair tie" },
    ...baseFields,
  ]},
];
