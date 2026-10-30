// src/lib/nex-native/catalogue/specs/food-grocery-beverages.ts
//
// Food, Grocery & Beverages · Batch D department · Phase 1 Product
// System continuous rollout per §I.5 + §K.2 (owner-sealed 2026-10-30).
// 10 sub-categories.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  brand: z.string().max(80).optional(),
  origin: z.string().max(60).optional(),
  pack_size: z.string().max(40).optional(),
  weight_g: z.number().positive().optional(),
  volume_ml: z.number().positive().optional(),
  dietary: z.string().max(60).optional(),
  halal: z.boolean().optional(),
  organic: z.boolean().optional(),
  storage: z.string().max(40).optional(),
  shelf_life: z.string().max(40).optional(),
  expiry: z.string().max(40).optional(),
});

const makeSpec = (extra: Record<string, z.ZodTypeAny> = {}) =>
  commonBase.extend(extra);

export const FreshProduceSpec = makeSpec({
  produce_type: z.string().min(1).max(60),
  season: z.string().max(40).optional(),
});

export const MeatPoultrySpec = makeSpec({
  product_type: z.string().min(1).max(60),
  cut: z.string().max(60).optional(),
  frozen: z.boolean().optional(),
});

export const FishSeafoodSpec = makeSpec({
  product_type: z.string().min(1).max(60),
  wild_or_farmed: z.string().max(40).optional(),
  frozen: z.boolean().optional(),
});

export const DairyEggsSpec = makeSpec({
  product_type: z.string().min(1).max(60),
  fat_content: z.string().max(40).optional(),
});

export const BakerySpec = makeSpec({
  product_type: z.string().min(1).max(60),
  freshly_baked: z.boolean().optional(),
});

export const PantryStaplesSpec = makeSpec({
  product_type: z.string().min(1).max(60),
});

export const SnacksConfectionerySpec = makeSpec({
  product_type: z.string().min(1).max(60),
  flavour: z.string().max(60).optional(),
});

export const BeveragesGrocerySpec = makeSpec({
  product_type: z.string().min(1).max(60),
  alcoholic: z.boolean().optional(),
  abv_percent: z.number().min(0).max(100).optional(),
});

export const SpecialityFoodsSpec = makeSpec({
  product_type: z.string().min(1).max(60),
  cuisine: z.string().max(60).optional(),
});

export const FoodPrepSuppliesSpec = makeSpec({
  product_type: z.string().min(1).max(60),
});

const baseFields: readonly SpecFieldConfig[] = [
  { key: "brand", label: "Brand", kind: "text", maxLength: 80 },
  { key: "origin", label: "Origin", kind: "text", maxLength: 60 },
  { key: "pack_size", label: "Pack size", kind: "text", maxLength: 40 },
  { key: "weight_g", label: "Weight (g)", kind: "number", min: 0 },
  { key: "volume_ml", label: "Volume (ml)", kind: "number", min: 0 },
  { key: "dietary", label: "Dietary", kind: "text", maxLength: 60, placeholder: "e.g. vegan, gluten-free" },
  { key: "halal", label: "Halal", kind: "boolean" },
  { key: "organic", label: "Organic", kind: "boolean" },
  { key: "storage", label: "Storage", kind: "text", maxLength: 40, placeholder: "e.g. ambient, chilled, frozen" },
  { key: "shelf_life", label: "Shelf life", kind: "text", maxLength: 40 },
  { key: "expiry", label: "Best before / expiry", kind: "text", maxLength: 40 },
];

export const FoodGroceryBeveragesSpecs: readonly CategorySpec[] = [
  { departmentId: "food_grocery_beverages", categoryId: "fresh_produce", label: "Fresh Produce", schema: FreshProduceSpec, fields: [
    { key: "produce_type", label: "Produce type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. apple, carrot, basil" },
    ...baseFields,
    { key: "season", label: "Season", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "food_grocery_beverages", categoryId: "meat_poultry", label: "Meat & Poultry", schema: MeatPoultrySpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "cut", label: "Cut", kind: "text", maxLength: 60 },
    { key: "frozen", label: "Frozen", kind: "boolean" },
  ]},
  { departmentId: "food_grocery_beverages", categoryId: "fish_seafood", label: "Fish & Seafood", schema: FishSeafoodSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "wild_or_farmed", label: "Wild / farmed", kind: "text", maxLength: 40 },
    { key: "frozen", label: "Frozen", kind: "boolean" },
  ]},
  { departmentId: "food_grocery_beverages", categoryId: "dairy_eggs", label: "Dairy & Eggs", schema: DairyEggsSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "fat_content", label: "Fat content", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "food_grocery_beverages", categoryId: "bakery", label: "Bakery", schema: BakerySpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "freshly_baked", label: "Freshly baked", kind: "boolean" },
  ]},
  { departmentId: "food_grocery_beverages", categoryId: "pantry_staples", label: "Pantry Staples", schema: PantryStaplesSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
  { departmentId: "food_grocery_beverages", categoryId: "snacks_confectionery", label: "Snacks & Confectionery", schema: SnacksConfectionerySpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "flavour", label: "Flavour", kind: "text", maxLength: 60 },
  ]},
  { departmentId: "food_grocery_beverages", categoryId: "beverages", label: "Beverages", schema: BeveragesGrocerySpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "alcoholic", label: "Alcoholic", kind: "boolean" },
    { key: "abv_percent", label: "ABV (%)", kind: "number", min: 0, max: 100 },
  ]},
  { departmentId: "food_grocery_beverages", categoryId: "speciality_foods", label: "Speciality Foods", schema: SpecialityFoodsSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "cuisine", label: "Cuisine", kind: "text", maxLength: 60 },
  ]},
  { departmentId: "food_grocery_beverages", categoryId: "food_prep_supplies", label: "Food Preparation Supplies", schema: FoodPrepSuppliesSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
];
