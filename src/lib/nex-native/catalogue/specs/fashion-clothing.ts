// src/lib/nex-native/catalogue/specs/fashion-clothing.ts
//
// Fashion & Clothing · PILOT department for Phase 1 of the Product
// System Implementation Contract (sealed 2026-10-30, §K.1).
//
// 8 sub-categories per sealed taxonomy in departments.ts:
//   womens, mens, childrens, shoes, bags_luggage, accessories,
//   underwear_sleepwear, traditional_cultural
//
// Each sub-category exposes a Zod schema + a FormConfig that lets
// the shared SpecFormBuilder render a usable UI without a dedicated
// form component. More specialised sub-categories (e.g. shoes with
// region-specific sizing) can graduate to a dedicated form later
// without changing the server contract.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const SIZE_HELP = "Common sizes: XS, S, M, L, XL, XXL, or numeric (e.g. 38, 42)";

// Shared field snippets reused across sub-categories.
const commonTextField = (key: string, label: string, maxLength = 80): SpecFieldConfig => ({
  key, label, kind: "text", required: true, maxLength,
});

const sizeField: SpecFieldConfig = {
  key: "size",
  label: "Size",
  kind: "text",
  required: true,
  maxLength: 10,
  helpText: SIZE_HELP,
};

const colourField: SpecFieldConfig = {
  key: "colour",
  label: "Colour",
  kind: "text",
  required: true,
  maxLength: 40,
};

const materialField: SpecFieldConfig = {
  key: "material",
  label: "Material / fabric",
  kind: "text",
  required: true,
  maxLength: 80,
  placeholder: "e.g. 100% cotton, polyester blend, leather",
};

const careField: SpecFieldConfig = {
  key: "care_instructions",
  label: "Care instructions",
  kind: "textarea",
  required: false,
  maxLength: 400,
  placeholder: "e.g. Machine wash cold, do not tumble dry",
};

const seasonField: SpecFieldConfig = {
  key: "season",
  label: "Season",
  kind: "select",
  required: false,
  options: [
    { value: "spring", label: "Spring" },
    { value: "summer", label: "Summer" },
    { value: "autumn", label: "Autumn" },
    { value: "winter", label: "Winter" },
    { value: "all_year", label: "All year" },
  ],
};

const genderNeutralSeason = seasonField;

// ──── Zod schemas · one per sub-category ──────────────────────────

export const WomensClothingSpecSchema = z.object({
  size: z.string().min(1).max(10),
  colour: z.string().min(1).max(40),
  material: z.string().min(1).max(80),
  care_instructions: z.string().max(400).optional(),
  season: z.enum(["spring","summer","autumn","winter","all_year"]).optional(),
  cut: z.string().max(40).optional(),
  fit: z.string().max(40).optional(),
});

export const MensClothingSpecSchema = z.object({
  size: z.string().min(1).max(10),
  colour: z.string().min(1).max(40),
  material: z.string().min(1).max(80),
  care_instructions: z.string().max(400).optional(),
  season: z.enum(["spring","summer","autumn","winter","all_year"]).optional(),
  cut: z.string().max(40).optional(),
  fit: z.string().max(40).optional(),
});

export const ChildrensClothingSpecSchema = z.object({
  size: z.string().min(1).max(10),
  colour: z.string().min(1).max(40),
  material: z.string().min(1).max(80),
  age_range: z.string().min(1).max(20),
  care_instructions: z.string().max(400).optional(),
  season: z.enum(["spring","summer","autumn","winter","all_year"]).optional(),
});

export const ShoesSpecSchema = z.object({
  size: z.string().min(1).max(10),
  colour: z.string().min(1).max(40),
  material: z.string().min(1).max(80),
  size_region: z.enum(["EU","UK","US","JP","CM","INT"]).default("INT"),
  gender: z.enum(["womens","mens","unisex","childrens"]).optional(),
  style: z.string().max(40).optional(),
  care_instructions: z.string().max(400).optional(),
});

export const BagsLuggageSpecSchema = z.object({
  colour: z.string().min(1).max(40),
  material: z.string().min(1).max(80),
  capacity_litres: z.number().positive().optional(),
  dimensions_cm: z.string().max(40).optional(),
  bag_type: z.string().max(40).optional(),
  closure_type: z.string().max(40).optional(),
  care_instructions: z.string().max(400).optional(),
});

export const AccessoriesSpecSchema = z.object({
  accessory_type: z.string().min(1).max(40),
  colour: z.string().min(1).max(40),
  material: z.string().min(1).max(80),
  size: z.string().max(20).optional(),
  care_instructions: z.string().max(400).optional(),
});

export const UnderwearSleepwearSpecSchema = z.object({
  size: z.string().min(1).max(10),
  colour: z.string().min(1).max(40),
  material: z.string().min(1).max(80),
  gender: z.enum(["womens","mens","unisex","childrens"]),
  category: z.enum(["underwear","sleepwear","loungewear"]).optional(),
  pack_size: z.number().int().positive().optional(),
  care_instructions: z.string().max(400).optional(),
});

export const TraditionalCulturalSpecSchema = z.object({
  size: z.string().min(1).max(10),
  colour: z.string().min(1).max(40),
  material: z.string().min(1).max(80),
  cultural_origin: z.string().min(1).max(80),
  occasion: z.string().max(80).optional(),
  craftsmanship: z.string().max(200).optional(),
  care_instructions: z.string().max(400).optional(),
});

// ──── CategorySpec entries (schema + FormConfig together) ─────────

export const FashionClothingSpecs: readonly CategorySpec[] = [
  {
    departmentId: "fashion_clothing",
    categoryId: "womens",
    label: "Women's Clothing",
    schema: WomensClothingSpecSchema,
    fields: [
      sizeField, colourField, materialField,
      { key: "cut", label: "Cut", kind: "text", maxLength: 40 },
      { key: "fit", label: "Fit", kind: "text", maxLength: 40 },
      genderNeutralSeason, careField,
    ],
  },
  {
    departmentId: "fashion_clothing",
    categoryId: "mens",
    label: "Men's Clothing",
    schema: MensClothingSpecSchema,
    fields: [
      sizeField, colourField, materialField,
      { key: "cut", label: "Cut", kind: "text", maxLength: 40 },
      { key: "fit", label: "Fit", kind: "text", maxLength: 40 },
      genderNeutralSeason, careField,
    ],
  },
  {
    departmentId: "fashion_clothing",
    categoryId: "childrens",
    label: "Children's Clothing",
    schema: ChildrensClothingSpecSchema,
    fields: [
      sizeField, colourField, materialField,
      { key: "age_range", label: "Age range", kind: "text", required: true, maxLength: 20, placeholder: "e.g. 3-4 years" },
      genderNeutralSeason, careField,
    ],
  },
  {
    departmentId: "fashion_clothing",
    categoryId: "shoes",
    label: "Shoes",
    schema: ShoesSpecSchema,
    fields: [
      sizeField, colourField, materialField,
      {
        key: "size_region", label: "Size system", kind: "select", required: true,
        options: [
          { value: "EU", label: "European (EU)" },
          { value: "UK", label: "UK" },
          { value: "US", label: "US" },
          { value: "JP", label: "Japanese (JP)" },
          { value: "CM", label: "Centimetres (CM)" },
          { value: "INT", label: "International (XS/S/M/L)" },
        ],
      },
      {
        key: "gender", label: "Fit for", kind: "select",
        options: [
          { value: "womens", label: "Women's" },
          { value: "mens", label: "Men's" },
          { value: "unisex", label: "Unisex" },
          { value: "childrens", label: "Children's" },
        ],
      },
      { key: "style", label: "Style", kind: "text", maxLength: 40, placeholder: "e.g. trainers, loafers" },
      careField,
    ],
  },
  {
    departmentId: "fashion_clothing",
    categoryId: "bags_luggage",
    label: "Bags & Luggage",
    schema: BagsLuggageSpecSchema,
    fields: [
      commonTextField("bag_type", "Bag type", 40),
      colourField, materialField,
      { key: "capacity_litres", label: "Capacity (L)", kind: "number", min: 0 },
      { key: "dimensions_cm", label: "Dimensions (cm)", kind: "text", maxLength: 40, placeholder: "e.g. 40 × 30 × 15" },
      { key: "closure_type", label: "Closure", kind: "text", maxLength: 40, placeholder: "e.g. zip, drawstring, magnetic" },
      careField,
    ],
  },
  {
    departmentId: "fashion_clothing",
    categoryId: "accessories",
    label: "Fashion Accessories",
    schema: AccessoriesSpecSchema,
    fields: [
      commonTextField("accessory_type", "Accessory type", 40),
      colourField, materialField,
      { key: "size", label: "Size", kind: "text", maxLength: 20 },
      careField,
    ],
  },
  {
    departmentId: "fashion_clothing",
    categoryId: "underwear_sleepwear",
    label: "Underwear & Sleepwear",
    schema: UnderwearSleepwearSpecSchema,
    fields: [
      sizeField, colourField, materialField,
      {
        key: "gender", label: "For", kind: "select", required: true,
        options: [
          { value: "womens", label: "Women's" },
          { value: "mens", label: "Men's" },
          { value: "unisex", label: "Unisex" },
          { value: "childrens", label: "Children's" },
        ],
      },
      {
        key: "category", label: "Category", kind: "select",
        options: [
          { value: "underwear", label: "Underwear" },
          { value: "sleepwear", label: "Sleepwear" },
          { value: "loungewear", label: "Loungewear" },
        ],
      },
      { key: "pack_size", label: "Pack size (count)", kind: "number", min: 1 },
      careField,
    ],
  },
  {
    departmentId: "fashion_clothing",
    categoryId: "traditional_cultural",
    label: "Traditional & Cultural Clothing",
    schema: TraditionalCulturalSpecSchema,
    fields: [
      sizeField, colourField, materialField,
      commonTextField("cultural_origin", "Cultural origin", 80),
      { key: "occasion", label: "Occasion", kind: "text", maxLength: 80, placeholder: "e.g. wedding, festival, daily wear" },
      { key: "craftsmanship", label: "Craftsmanship notes", kind: "textarea", maxLength: 200 },
      careField,
    ],
  },
];
