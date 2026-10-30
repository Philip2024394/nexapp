// src/lib/nex-native/catalogue/specs/gifts-celebrations-seasonal.ts
//
// Gifts, Celebrations & Seasonal · Batch I · Phase 1 Product System.
// 4 sub-categories.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  recipient: z.string().max(60).optional(),
  occasion: z.string().max(60).optional(),
  theme: z.string().max(60).optional(),
  budget_tier: z.string().max(40).optional(),
  giftwrap_available: z.boolean().optional(),
});

const makeSpec = (extra: Record<string, z.ZodTypeAny> = {}) => commonBase.extend(extra);

export const GiftOccasionsSpec = makeSpec({ product_type: z.string().min(1).max(60) });
export const GiftTypesSpec = makeSpec({ gift_type: z.string().min(1).max(60) });
export const CelebrationsSpec = makeSpec({ product_type: z.string().min(1).max(60), event_type: z.string().max(60).optional() });
export const SeasonalShoppingSpec = makeSpec({ product_type: z.string().min(1).max(60), season: z.string().max(40).optional() });

const baseFields: readonly SpecFieldConfig[] = [
  { key: "recipient", label: "Recipient", kind: "text", maxLength: 60 },
  { key: "occasion", label: "Occasion", kind: "text", maxLength: 60 },
  { key: "theme", label: "Theme", kind: "text", maxLength: 60 },
  { key: "budget_tier", label: "Budget tier", kind: "text", maxLength: 40 },
  { key: "giftwrap_available", label: "Gift wrap available", kind: "boolean" },
];

export const GiftsCelebrationsSeasonalSpecs: readonly CategorySpec[] = [
  { departmentId: "gifts_celebrations_seasonal", categoryId: "gift_occasions", label: "Gift Occasions", schema: GiftOccasionsSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
  { departmentId: "gifts_celebrations_seasonal", categoryId: "gift_types", label: "Gift Types", schema: GiftTypesSpec, fields: [
    { key: "gift_type", label: "Gift type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
  { departmentId: "gifts_celebrations_seasonal", categoryId: "celebrations", label: "Celebrations", schema: CelebrationsSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "event_type", label: "Event type", kind: "text", maxLength: 60 },
  ]},
  { departmentId: "gifts_celebrations_seasonal", categoryId: "seasonal_shopping", label: "Seasonal Shopping", schema: SeasonalShoppingSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "season", label: "Season", kind: "text", maxLength: 40 },
  ]},
];
