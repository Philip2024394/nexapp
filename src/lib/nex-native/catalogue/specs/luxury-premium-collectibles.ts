// src/lib/nex-native/catalogue/specs/luxury-premium-collectibles.ts
//
// Luxury, Premium & Collectibles · Batch I · Phase 1 Product System.
// 6 sub-categories.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  designer_or_maker: z.string().max(120).optional(),
  authenticity: z.string().max(80).optional(),
  provenance: z.string().max(400).optional(),
  box_papers: z.boolean().optional(),
  edition: z.string().max(60).optional(),
  condition: z.enum(["new", "like_new", "pre_owned", "vintage"]).default("new"),
});

const makeSpec = (extra: Record<string, z.ZodTypeAny> = {}) => commonBase.extend(extra);

export const LuxuryFashionSpec = makeSpec({ item_type: z.string().min(1).max(60), size: z.string().max(40).optional(), year: z.number().int().positive().optional() });
export const LuxuryWatchesSpec = makeSpec({ reference_number: z.string().max(60).optional(), movement: z.string().max(40).optional(), year: z.number().int().positive().optional() });
export const FineJewelleryLuxurySpec = makeSpec({ item_type: z.string().min(1).max(60), material: z.string().max(80).optional(), stone: z.string().max(60).optional() });
export const ArtAntiquesSpec = makeSpec({ item_type: z.string().min(1).max(60), period: z.string().max(60).optional(), dimensions: z.string().max(80).optional() });
export const CollectiblesLuxurySpec = makeSpec({ item_type: z.string().min(1).max(60), rarity: z.string().max(40).optional() });
export const PremiumLifestyleSpec = makeSpec({ product_type: z.string().min(1).max(60) });

const conditionField: SpecFieldConfig = {
  key: "condition", label: "Condition", kind: "select", required: true,
  options: [
    { value: "new", label: "New" },
    { value: "like_new", label: "Like new" },
    { value: "pre_owned", label: "Pre-owned" },
    { value: "vintage", label: "Vintage" },
  ],
};
const baseFields: readonly SpecFieldConfig[] = [
  conditionField,
  { key: "designer_or_maker", label: "Designer / maker", kind: "text", maxLength: 120 },
  { key: "authenticity", label: "Authenticity", kind: "text", maxLength: 80, placeholder: "e.g. verified, serial" },
  { key: "provenance", label: "Provenance", kind: "textarea", maxLength: 400 },
  { key: "box_papers", label: "Box & papers", kind: "boolean" },
  { key: "edition", label: "Edition", kind: "text", maxLength: 60 },
];

export const LuxuryPremiumCollectiblesSpecs: readonly CategorySpec[] = [
  { departmentId: "luxury_premium_collectibles", categoryId: "luxury_fashion", label: "Luxury Fashion", schema: LuxuryFashionSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "size", label: "Size", kind: "text", maxLength: 40 },
    { key: "year", label: "Year", kind: "number", min: 1800 },
  ]},
  { departmentId: "luxury_premium_collectibles", categoryId: "luxury_watches", label: "Luxury Watches", schema: LuxuryWatchesSpec, fields: [
    { key: "reference_number", label: "Reference number", kind: "text", maxLength: 60 },
    ...baseFields,
    { key: "movement", label: "Movement", kind: "text", maxLength: 40 },
    { key: "year", label: "Year", kind: "number", min: 1800 },
  ]},
  { departmentId: "luxury_premium_collectibles", categoryId: "fine_jewellery", label: "Fine Jewellery", schema: FineJewelleryLuxurySpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "material", label: "Material", kind: "text", maxLength: 80 },
    { key: "stone", label: "Stone", kind: "text", maxLength: 60 },
  ]},
  { departmentId: "luxury_premium_collectibles", categoryId: "art_antiques", label: "Art & Antiques", schema: ArtAntiquesSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "period", label: "Period / era", kind: "text", maxLength: 60 },
    { key: "dimensions", label: "Dimensions", kind: "text", maxLength: 80 },
  ]},
  { departmentId: "luxury_premium_collectibles", categoryId: "collectibles", label: "Collectibles", schema: CollectiblesLuxurySpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "rarity", label: "Rarity", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "luxury_premium_collectibles", categoryId: "premium_lifestyle", label: "Premium Lifestyle", schema: PremiumLifestyleSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
];
